/**
 * Router de cuentas para el Owner: `/api/owner/usuarios`.
 *
 * ============================================================================
 *  QUE CONTROLA Y QUE NO
 * ============================================================================
 * Aqui el Owner (y solo el) decide sobre las CUENTAS:
 *
 *   GET    /api/owner/usuarios            lista las cuentas
 *   PATCH  /api/owner/usuarios            cambia el rol o la verificacion
 *   DELETE /api/owner/usuarios            borra una cuenta
 *
 * Lo que NO se toca desde aqui, a proposito:
 *
 *   - Las formas de cobro de nadie. Un numero de cuenta es de su dueno, y ya
 *     tiene su ruta (`/api/panel/medios-pago`) que solo responde a su sesion.
 *   - El contacto y los datos personales de los vendedores. Son suyos.
 *
 * El Owner controla la PLATAFORMA (los paquetes, las redes y el contacto del
 * pie de pagina, las FAQ, la aprobacion de productos); no es el administrador
 * de la vida privada de sus usuarios.
 *
 * ============================================================================
 *  EL ROL `owner` NO SE REPARTE
 * ============================================================================
 * El desplegable admite `vendedor`, `comprador` y `administrador`. El `owner`
 * no aparece: el trigger `trg_usuarios_no_promocion_update` aborta cualquier
 * ascenso a owner que no venga de un correo preautorizado, y ofrecer una opcion
 * que la base va a tirar es prometer algo que no se puede cumplir.
 */

import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { tiendaParaUsuario, usuarioDePeticion, type UsuarioSesion } from './registro'

/** Roles que el Owner puede asignar. `owner` NO esta y no es un olvido. */
const ROLES_ASIGNABLES = ['vendedor', 'comprador', 'administrador'] as const

function esAdministrador(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'owner' || usuario.rol === 'administrador'
}

export async function responderOwnerCuentas(
  peticion: Request,
  env: Env,
): Promise<Response> {
  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)
  if (!usuario) throw ErrorApi.noAutenticado()
  if (!esAdministrador(usuario)) throw ErrorApi.sinPermiso()

  const ruta = new URL(peticion.url).pathname.replace(/\/+$/, '')
  if (ruta !== '/api/owner/usuarios') throw ErrorApi.noEncontrado('Esa ruta')

  if (peticion.method === 'GET') return listar(peticion, env)
  if (peticion.method === 'PATCH') return cambiar(peticion, env, usuario)
  if (peticion.method === 'DELETE') return borrar(peticion, env, usuario)

  throw ErrorApi.metodoNoPermitido('Ese metodo no existe aqui.', ['GET', 'PATCH', 'DELETE'])
}

async function listar(peticion: Request, env: Env): Promise<Response> {
  const url = new URL(peticion.url)
  const busqueda = (url.searchParams.get('q') ?? '').trim().slice(0, 80)
  const rol = url.searchParams.get('rol')

  const condiciones: string[] = []
  const valores: unknown[] = []

  if (busqueda) {
    const patron = `%${busqueda.replace(/[%_]/g, '')}%`
    condiciones.push('(u.email LIKE ? OR u.nombre LIKE ?)')
    valores.push(patron, patron)
  }
  if (rol && ['owner', 'administrador', 'vendedor', 'comprador'].includes(rol)) {
    condiciones.push('u.rol = ?')
    valores.push(rol)
  }

  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.nombre, u.rol, u.verificado, u.creado_at,
            v.slug AS tienda_slug, v.nombre_comercial AS tienda_nombre,
            (SELECT COUNT(*) FROM productos p WHERE p.vendedor_id = u.vendedor_id) AS productos,
            (SELECT COUNT(*) FROM transacciones t WHERE t.usuario_id = u.id) AS compras
       FROM usuarios u
       LEFT JOIN vendedores v ON v.id = u.vendedor_id
       ${donde}
      ORDER BY u.creado_at DESC, u.id DESC
      LIMIT 200`,
  )
    .bind(...valores)
    .all()

  return json({ ok: true, usuarios: results ?? [] })
}

async function cambiar(
  peticion: Request,
  env: Env,
  actor: UsuarioSesion,
): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const id = entero(cuerpo.id)
  if (!id) throw ErrorApi.invalido('id', 'Falta la cuenta.')

  const fila = await env.DB.prepare(
    'SELECT id, email, nombre, rol, verificado, vendedor_id FROM usuarios WHERE id = ?',
  )
    .bind(id)
    .first<{
      id: number
      email: string
      nombre: string
      rol: string
      verificado: number
      vendedor_id: number | null
    }>()
  if (!fila) throw ErrorApi.noEncontrado('Esa cuenta')

  // Nadie se cambia el rol a si mismo: un Owner que se pasa a comprador por
  // error se queda fuera de su propio panel y no hay forma de volver sin tocar
  // la base a mano.
  if (fila.id === actor.id && cuerpo.rol !== undefined) {
    throw ErrorApi.invalido('rol', 'No puedes cambiarte el rol a ti mismo.')
  }

  let rol = fila.rol
  let vendedorId = fila.vendedor_id

  if (cuerpo.rol !== undefined) {
    const pedido = typeof cuerpo.rol === 'string' ? cuerpo.rol.trim().toLowerCase() : ''
    if (pedido === 'owner') {
      throw ErrorApi.invalido(
        'rol',
        'El rol owner no se reparte desde aqui: solo lo tienen los correos preautorizados.',
      )
    }
    if (!(ROLES_ASIGNABLES as readonly string[]).includes(pedido)) {
      throw ErrorApi.invalido('rol', `El rol tiene que ser uno de: ${ROLES_ASIGNABLES.join(', ')}.`)
    }
    rol = pedido

    // Todo vendedor necesita tienda. Las cuentas nuevas ya la traen del registro;
    // una cuenta anterior podria no tenerla, y sin ella el `CHECK` de la tabla
    // rechazaria el cambio con un error en ingles.
    if (rol === 'vendedor' && vendedorId === null) {
      vendedorId = await tiendaParaUsuario(env.DB, fila.nombre, fila.email)
    }
  }

  let verificado = fila.verificado
  if (cuerpo.verificado !== undefined) {
    verificado = cuerpo.verificado === true || cuerpo.verificado === 1 ? 1 : 0
  }

  const sentencias = [
    env.DB.prepare(
      `UPDATE usuarios SET rol = ?, verificado = ?, vendedor_id = ? WHERE id = ?`,
    ).bind(rol, verificado, vendedorId, id),
  ]

  // El sello del vendedor vive en DOS sitios: `usuarios.verificado` (la cuenta)
  // y `vendedores.verificado` (la ficha publica). Se mueven juntos o el sello
  // de la tienda y el de la cuenta dirian cosas distintas.
  if (vendedorId !== null) {
    sentencias.push(
      env.DB.prepare('UPDATE vendedores SET verificado = ? WHERE id = ?').bind(
        verificado,
        vendedorId,
      ),
    )
  }

  await env.DB.batch(sentencias)

  return json({ ok: true, usuario: { id, rol, verificado, vendedor_id: vendedorId } })
}

async function borrar(
  peticion: Request,
  env: Env,
  actor: UsuarioSesion,
): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const id = entero(cuerpo.id)
  if (!id) throw ErrorApi.invalido('id', 'Falta la cuenta.')

  if (id === actor.id) {
    throw ErrorApi.invalido('id', 'No puedes borrar tu propia cuenta desde aqui.')
  }

  const fila = await env.DB.prepare('SELECT rol FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ rol: string }>()
  if (!fila) throw ErrorApi.noEncontrado('Esa cuenta')

  // La cuenta del Owner no se borra por la API. Es la unica llave de la
  // plataforma y un clic de mas no deberia poder dejarla sin dueno.
  if (fila.rol === 'owner') {
    throw ErrorApi.invalido('id', 'La cuenta del Owner no se borra desde aqui.')
  }

  try {
    await env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(id).run()
  } catch (error) {
    // `transacciones.usuario_id` es ON DELETE RESTRICT: una cuenta con compras o
    // ventas registradas no se puede borrar sin llevarse el historial por
    // delante. Se dice tal cual en vez de un 500, porque no es un fallo del
    // servidor: es una regla, y el Owner puede decidir otra cosa.
    const mensaje = error instanceof Error ? error.message : String(error)
    if (/FOREIGN KEY constraint failed/i.test(mensaje)) {
      throw new ErrorApi(
        'cuenta_con_historial',
        'Esa cuenta tiene compras o ventas registradas y no se puede borrar sin perder el historial. Desactivala verificando su estado en vez de eliminarla.',
        409,
      )
    }
    throw error
  }

  return json({ ok: true })
}

function entero(valor: unknown): number | undefined {
  const n = typeof valor === 'number' ? valor : Number.parseInt(String(valor ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
