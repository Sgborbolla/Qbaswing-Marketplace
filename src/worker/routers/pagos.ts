/**
 * Router de pagos: `/api/pagos`.
 *
 * ============================================================================
 *  QUE HACE
 * ============================================================================
 *   POST  /api/pagos   cobra el carrito y lo convierte en ordenes
 *   GET   /api/pagos   lista MIS compras (las de la sesion)
 *   PATCH /api/pagos   el Owner confirma o rechaza un pago manual
 *
 * ============================================================================
 *  POR QUE COBRAR EXIGE SESION Y EL CARRITO NO
 * ============================================================================
 * El carrito funciona sin cuenta a proposito (ver `carrito.ts`). Cobrar no: una
 * orden necesita un comprador al que entregarle lo comprado y una biblioteca
 * donde guardarlo. Sin sesion no hay a quien entregar, y una "compra" sin
 * comprador es exactamente la forma de dar productos gratis.
 *
 * Por eso `POST` contesta 401 sin sesion, y el sitio manda a entrar antes de
 * pagar.
 *
 * ============================================================================
 *  EL REPARTO POR VENDEDOR LO HACE `pagos.ts`, NO ESTE ARCHIVO
 * ===========================================================================
 * Aqui solo se lee la peticion, se comprueba quien es y se responde. La regla de
 * negocio (una orden por vendedor/moneda/regla, el 5% de la Regla A) vive en
 * `src/worker/pagos.ts`, que es tambien quien la ejecuta. Tenerla aqui obligaria
 * a duplicarla el dia que los webhooks tambien creen ordenes.
 */

import { ErrorApi, RUTAS } from '../constantes'
import { type Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { usuarioDePeticion } from './registro'
import { CABECERA_TOKEN_CARRITO, carritoDe, leerCarrito } from './carrito'
import { cambiarEstado, cobrarCarrito, ordenPorReferencia } from '../pagos'
import { PASARELAS, type EstadoPago, type Pasarela } from '../../lib/pagos'

/** Todos los metodos que atiende esta ruta. Va en la cabecera `Allow` del 405. */
const METODOS = ['GET', 'POST', 'PATCH']

export async function responderPagos(
  ruta: string,
  metodo: string,
  peticion: Request,
  env: Env,
): Promise<Response> {
  if (ruta !== RUTAS.pagos) throw ErrorApi.noEncontrado('Esa ruta')

  // La sesion se lee UNA vez para los tres metodos. Los tres necesitan saber
  // quien pregunta antes que nada.
  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)
  if (!usuario) throw ErrorApi.noAutenticado()

  if (metodo === 'GET') return listarCompras(env, usuario.id)

  if (metodo === 'POST') {
    const pasarela = leerPasarela(await cuerpoJson(peticion))

    // El carrito se resuelve con las mismas reglas que `/api/carrito`: el de la
    // cuenta si hay sesion (que la hay, porque ya se comprobo), y si no, el
    // token del navegador. Asi el carrito que se cobra es el que el comprador ve.
    const carrito = await carritoDe(env.DB, peticion, usuario)
    const cabeceras: Record<string, string> = {}
    if (carrito.token) cabeceras[CABECERA_TOKEN_CARRITO] = carrito.token

    const { ordenes } = await cobrarCarrito(env, carrito.id, usuario, pasarela)

    // Se devuelve el carrito YA vacio, no el de antes. Si el comprador ve su
    // carrito lleno despues de pagar, cree que el pago no paso y vuelve a pagar.
    const contenido = await leerCarrito(env.DB, carrito.id)
    return json({ ok: true, ordenes, carrito: contenido }, 200, cabeceras)
  }

  if (metodo === 'PATCH') return confirmarManual(env, usuario, await cuerpoJson(peticion))

  throw ErrorApi.metodoNoPermitido('Los pagos no aceptan ese metodo.', METODOS)
}

/** Valida que la pasarela sea una de las conocidas. */
function leerPasarela(cuerpo: unknown): Pasarela {
  const valor =
    typeof cuerpo === 'object' && cuerpo !== null
      ? (cuerpo as Record<string, unknown>).pasarela
      : undefined

  if (typeof valor !== 'string' || !(valor in PASARELAS)) {
    throw ErrorApi.invalido('pasarela', 'Elegi como vas a pagar.')
  }
  return valor as Pasarela
}

/** Las compras del comprador de la sesion, con el detalle de cada una. */
async function listarCompras(env: Env, usuarioId: number): Promise<Response> {
  const { results: ordenes } = await env.DB.prepare(
    `SELECT id, referencia, pasarela, moneda, moneda_codigo, subtotal,
            comision_qbaswing, total, regla_aplicada, estado, creado_at, verificado_at
       FROM transacciones
      WHERE usuario_id = ?
      ORDER BY creado_at DESC, id DESC
      LIMIT 100`,
  )
    .bind(usuarioId)
    .all<{
      id: number
      referencia: string
      pasarela: string
      moneda: string
      moneda_codigo: string | null
      subtotal: number
      comision_qbaswing: number
      total: number
      regla_aplicada: string
      estado: string
      creado_at: string
      verificado_at: string | null
    }>()

  return json({
    ok: true,
    ordenes: ordenes.map((o) => ({
      id: o.id,
      referencia: o.referencia,
      pasarela: o.pasarela,
      pasarelaNombre: PASARELAS[o.pasarela as Pasarela]?.nombre ?? o.pasarela,
      moneda: o.moneda,
      monedaCodigo: o.moneda_codigo ?? o.moneda,
      subtotal: o.subtotal,
      comision: o.comision_qbaswing,
      total: o.total,
      regla: o.regla_aplicada,
      estado: o.estado,
      creadoAt: o.creado_at,
      verificadoAt: o.verificado_at,
    })),
  })
}

/**
 * El Owner (o un administrador) confirma a mano un pago.
 *
 * Existe porque hay pagos que NINGUNA maquina puede confirmar: una transferencia
 * a una cuenta cubana, un mensaje de WhatsApp. El proveedor no avisa; una
 * persona mira el banco y lo marca. Sin este camino, esos pagos quedarian
 * `pendiente` para siempre.
 *
 * Se guarda quien lo confirmo, porque un pago manual sin nombre es un pago que
 * nadie puede auditar.
 */
async function confirmarManual(
  env: Env,
  usuario: { id: number; rol: string },
  cuerpo: unknown,
): Promise<Response> {
  if (usuario.rol !== 'owner' && usuario.rol !== 'administrador') {
    throw ErrorApi.sinPermiso('Solo el Owner puede confirmar pagos.')
  }

  const datos = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {}

  const referencia = typeof datos.referencia === 'string' ? datos.referencia.trim() : ''
  if (!referencia) throw ErrorApi.invalido('referencia', 'Falta la referencia de la orden.')

  const hacia = datos.estado
  if (hacia !== 'verificado' && hacia !== 'rechazado') {
    throw ErrorApi.invalido('estado', 'Solo se puede confirmar o rechazar.')
  }

  const nota = typeof datos.nota === 'string' ? datos.nota.slice(0, 4000) : ''

  const orden = await ordenPorReferencia(env, referencia)
  if (!orden) throw ErrorApi.noEncontrado('Esa orden')

  const clase = PASARELAS[orden.pasarela]?.clase ?? 'manual'
  const { entregados } = await cambiarEstado(env, orden, hacia as EstadoPago, {
    clase,
    crudo: nota || `Confirmado por ${usuario.id}`,
    confirmadoPor: usuario.id,
    moneda: orden.moneda as 'CUP' | 'USD' | 'EUR',
  })

  return json({ ok: true, referencia, estado: hacia, entregados })
}
