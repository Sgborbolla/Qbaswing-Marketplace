/**
 * Router de datos de la plataforma: redes sociales, contacto y FAQ.
 *
 * ============================================================================
 *  POR QUE ESTO NO ESTA EN `plataforma.ts` COMO CONSTANTE
 * ============================================================================
 * Las redes, el correo y las FAQ cambian cuando el Owner decide, no cuando se
 * despliega. Si estuvieran escritas en el `.astro` del footer, cambiar el
 * WhatsApp exigiria un commit y un redespliegue, y como eso es una barrera, la
 * gente termina no actualizandolo. Un footer con el Instagram equivocado se ve
 * peor que uno sin Instagram.
 *
 * Asi que el componente PIDE estos datos. Si la API esta caida, el footer dibuja
 * los iconos deshabilitados en vez de romper la pagina: es el mismo diseno que
 * daria un footer sin redes configuradas, y por eso no parece un error.
 *
 * ============================================================================
 *  LO QUE NUNCA SE INVENTA
 * ============================================================================
 * `0002_datos_plataforma.sql` inserta las ocho redes con `valor = ''` y un
 * contacto vacio. Este router devuelve ese estado tal cual, con `valor: ''`, en
 * vez de rellenarlo con cuentas de ejemplo.
 *
 * Un placeholder del tipo `@qbaswing_oficial` en un sitio recien lanzado es una
 * mentira que el visitante da por cierta, y si el Owner nunca lo cambia queda
 * para siempre. Es preferible un icono deshabilitado.
 */

import { json, cuerpoJson } from '../http'
import { RUTAS, ErrorApi, TOPE_PRECIO } from '../constantes'
import type { Env } from '../entorno'
import { usuarioDePeticion } from './registro'

export async function responderPlataforma(
  ruta: string,
  peticion: Request,
  env: Env,
  soloLectura: boolean,
): Promise<Response> {
  // Las tarifas no entran en el `switch` de abajo: son las unicas de este
  // fichero que piden sesion, tambien en lectura. El resto son publicas porque
  // las lee el pie de pagina de cualquiera que abra la portada; los precios
  // activos ya lo son por `/api/paquetes`, pero este panel devuelve tambien los
  // paquetes apagados, que solo al Owner le importan.
  if (ruta === RUTAS.paquetesTarifas) return tarifas(peticion, env, soloLectura)

  if (!soloLectura) {
    // Escribir estas tablas es trabajo del Owner y va por el panel, que aun no
    // existe. Decir "no" ahora evita prometer algo que despues se cambie.
    throw new ErrorApi(
      'no_implementado',
      'La edicion desde el panel todavia no esta disponible.',
      501,
    )
  }

  switch (ruta) {
    case RUTAS.redes:
      return json({ ok: true, redes: await redes(env) })
    case RUTAS.contacto:
      return json({ ok: true, contacto: await contacto(env) })
    case RUTAS.faq:
      return json({ ok: true, faq: await faq(env) })
    default:
      throw ErrorApi.noEncontrado('Esa ruta')
  }
}

/**
 * Redes ordenadas como las ordeno el Owner.
 *
 * `ORDER BY orden, id` y no solo `orden`: si dos redes tienen el mismo orden,
 * SQLite puede devolverlas en cualquier orden y el footer cambiaria de aspecto
 * entre una carga y otra. `id` es estable.
 */
async function redes(env: Env): Promise<Record<string, unknown>[]> {
  const { results } = await env.DB.prepare(
    `SELECT etiqueta, icono, tipo, base, valor, activo, orden
       FROM redes_sociales
      WHERE activo = 1
      ORDER BY orden, id`,
  ).all()

  return (results as Record<string, unknown>[]).map((r) => ({
    etiqueta: r.etiqueta,
    icono: r.icono,
    tipo: r.tipo,
    base: r.base,
    valor: r.valor,
    orden: r.orden,
  }))
}

/**
 * Contacto de la plataforma.
 *
 * Devuelve `null` cuando la fila esta vacia, no un objeto con campos en blanco.
 * La diferencia importa: `null` le dice al footer "no hay contacto configurado"
 * y lo deja oculto; un objeto con cadenas vacias lo hace pintar etiquetas sin
 * nada al lado, que es lo que hace que un sitio recien creado parezca roto.
 */
async function contacto(env: Env): Promise<Record<string, unknown> | null> {
  const fila = await env.DB.prepare(
    `SELECT telefono, email, whatsapp, direccion, horario
       FROM contacto_plataforma
      ORDER BY id
      LIMIT 1`,
  ).first<Record<string, unknown>>()

  if (!fila) return null

  const campos = ['telefono', 'email', 'whatsapp', 'direccion', 'horario'] as const
  const alguno = campos.some((c) => String(fila[c] ?? '').trim() !== '')
  if (!alguno) return null

  return Object.fromEntries(campos.map((c) => [c, fila[c]]))
}

/**
 * FAQ activa, en el orden que fijo el Owner.
 *
 * `activa` se devuelve aunque la consulta ya la haya filtrado. No es redundancia
 * por descuido: el frontend compara `f.activa` para decidir si pinta la
 * pregunta, y sin la columna descartaba las veinte. Un filtro que el servidor ya
 * aplico vuelve a ser responsabilidad de quien consume, y las dos reglas se
 * contradicen en silencio cuando eso pasa.
 *
 * Lo que si es redundante y no se devuelve: el texto de la tabla de quien la
 * edito. No lo necesita ningun visitante.
 */
async function faq(env: Env): Promise<Record<string, unknown>[]> {
  const { results } = await env.DB.prepare(
    `SELECT pregunta, respuesta, orden, activa
       FROM faq
      WHERE activa = 1
      ORDER BY orden, id`,
  ).all()

  return results as Record<string, unknown>[]
}

/* ===========================================================================
 * Tarifas de los paquetes de 60 dias
 * ======================================================================== */

/**
 * ============================================================================
 *  QUIEN MANDA AQUI
 * ============================================================================
 * El Documento Maestro pone la matriz tarifaria entera en la seccion 3 y
 * termina con una frase que es toda la justificacion de este router: "tarifas
 * base configurables por el Owner desde el panel de control". La tabla
 * `paquetes` repite lo mismo en el comentario de `precio_cup`.
 *
 * Asi que los precios NO estan escritos en el codigo. Estan en la base, se
 * leen desde `/api/paquetes` y los cambia una sola persona. Meterlos en
 * `constantes.ts` habria hecho que cambiar $10.00 por $8.00 exigiera commit,
 * build, despliegue y subida a Pages, que es exactamente la barrera que el
 * documento quiere evitar.
 *
 * ============================================================================
 *  LAS TRES COLUMNAS NO COMPARTEN UNIDAD
 * ============================================================================
 *   precio_cup  pesos enteros.    250 CUP -> 250
 *   precio_usd  centavos.         $10.00  -> 1000
 *   precio_eur  centimos.         10,00 EUR -> 1000
 *
 * La diferencia no es un descuido: USD y EUR tienen centavos reales y
 * guardarlos como enteros los perderia. La moneda se toma SIEMPRE del nombre de
 * la columna, igual que en `productos.precio`. Por eso no hay un campo
 * `moneda` en este panel: las tres monedas conviven en la misma fila y se
 * editan a la vez, que es lo contrario de lo que hace un producto, que solo
 * tiene una.
 *
 * ============================================================================
 *  LO QUE UN PRECIO VACIO SIGNIFICA
 * ============================================================================
 * `precio_cup`, `precio_usd` y `precio_eur` son columnas anulables. Dejar una
 * en blanco la guarda como `NULL`, que el catalogo pinta como "no disponible":
 * no es un precio de cero, es "este paquete no se vende en esta moneda". Un `0`
 * tecleado a mano se podria distinguir de un vacio en la base, pero las dos
 * cosas se ven igual en el escaparate, y preferir el `0` dejaria filas que
 * parecen tener precio y no lo tienen.
 */

/**
 * La unidad de cada columna, con un ejemplo.
 *
 * Va en el mensaje de error y no solo en la documentacion porque es el error
 * que mas se va a ver: teclear `10` en USD queriendo $10.00 es guardar diez
 * CENTAVOS. Decirlo con el ejemplo delante es lo unico que evita que el paquete
 * salga costando $0.10 sin que nadie se entere.
 */
const UNIDADES: Record<'CUP' | 'USD' | 'EUR', string> = {
  CUP: 'pesos enteros: 250 CUP se escribe 250',
  USD: 'centavos: $10.00 se escribe 1000',
  EUR: 'centimos: 10,00 EUR se escribe 1000',
}

/**
 * GET y PATCH de las tarifas. Los dos detras de la sesion de Owner.
 *
 * El GET no es publico aunque los precios activos ya lo sean por
 * `/api/paquetes`: esta lista incluye los paquetes con `activo = 0`, que son
 * los que nadie compra y que no hace falta que sepa el resto del mundo.
 */
async function tarifas(
  peticion: Request,
  env: Env,
  soloLectura: boolean,
): Promise<Response> {
  await soloOwner(peticion, env)

  if (soloLectura) return json({ ok: true, paquetes: await todosLosPaquetes(env) })
  return cambiarTarifas(peticion, env)
}

/**
 * Lee la cookie y exige rol `owner`.
 *
 * Los dos errores son distintos a proposito. Sin sesion el arreglo es entrar
 * otra vez; con sesion de otro rol, entrar otra vez no arregla nada, y decirle
 * a un vendedor que inicie sesion lo dejaria dando vueltas.
 */
async function soloOwner(peticion: Request, env: Env): Promise<void> {
  const { usuario } = await usuarioDePeticion(
    env.DB,
    peticion,
    env.QBASWING_SECRETO_FIRMA,
  )

  if (!usuario) throw ErrorApi.noAutenticado()
  if (usuario.rol !== 'owner') {
    throw ErrorApi.sinPermiso('Las tarifas de los paquetes las fija solo el propietario del sitio.')
  }
}

/**
 * Todos los paquetes, activos y apagados.
 *
 * El orden es el mismo que el del catalogo publico (`slots DESC, precio_cup
 * ASC, id ASC`) para que el panel y la portada enseñen la lista en el mismo
 * orden: dos ordenes distintos harian que el Owner buscara un paquete donde no
 * esta.
 */
async function todosLosPaquetes(env: Env): Promise<Record<string, unknown>[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, categoria, slots, vigencia_dias,
            precio_cup, precio_usd, precio_eur,
            precio_configurable, activo
       FROM paquetes
      ORDER BY slots DESC, precio_cup ASC, id ASC`,
  ).all<{
    id: number
    nombre: string
    categoria: string
    slots: number
    vigencia_dias: number
    precio_cup: number | null
    precio_usd: number | null
    precio_eur: number | null
    precio_configurable: number
    activo: number
  }>()

  return (results ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    slots: p.slots,
    vigencia_dias: p.vigencia_dias,
    precio_cup: p.precio_cup,
    precio_usd: p.precio_usd,
    precio_eur: p.precio_eur,
    // Los dos enteros de la tabla salen como booleanos: en el HTML da igual,
    // pero una API que devuelve `0` para "apagado" obliga a cada pantalla que
    // la recuerde a acordarse de que `0` es `false`. Y `precio_configurable`
    // solo se usa para marcar en el panel las dos categorias que el documento
    // deja con rango.
    precio_configurable: p.precio_configurable === 1,
    activo: p.activo === 1,
  }))
}

/**
 * PATCH. Cambia los tres precios de UN paquete.
 *
 * El id va dentro del cuerpo, igual que en los productos propios. Aqui no hay
 * columna de propiedad que anadir al `WHERE` porque no es una propiedad: no hay
 * un paquete "de" nadie. Lo que protege la fila es `soloOwner`, que ya corrio
 * antes de llegar aqui, y el `WHERE id = ?`, que hace imposible tocar dos a la
 * vez.
 *
 * Los tres campos van SIEMPRE, aunque solo se haya tocado uno. Es el mismo
 * contrato que en el resto del panel: el servidor conservaria los que no
 * lleguen, pero mandar el formulario entero hace que la respuesta describa la
 * fila tal cual quedo, no la mitad que se acaba de cambiar.
 */
async function cambiarTarifas(peticion: Request, env: Env): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  const id = Number(cuerpo.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw ErrorApi.invalido('id', 'Falta el paquete que quieres cambiar.')
  }

  const existente = await env.DB.prepare(
    `SELECT precio_cup, precio_usd, precio_eur
       FROM paquetes
      WHERE id = ?`,
  )
    .bind(id)
    .first<{
      precio_cup: number | null
      precio_usd: number | null
      precio_eur: number | null
    }>()

  // El panel solo enseña paquetes que existen, pero el id viene del cuerpo y se
  // puede teclear. Aqui no se inserta nada, y este 404 es lo que hace que la
  // ruta cambie precios en vez de fabricar filas.
  if (!existente) throw ErrorApi.noEncontrado('Ese paquete')

  const precioCup = leerPrecio(
    cuerpo.precio_cup,
    existente.precio_cup,
    'precio_cup',
    UNIDADES.CUP,
  )
  const precioUsd = leerPrecio(
    cuerpo.precio_usd,
    existente.precio_usd,
    'precio_usd',
    UNIDADES.USD,
  )
  const precioEur = leerPrecio(
    cuerpo.precio_eur,
    existente.precio_eur,
    'precio_eur',
    UNIDADES.EUR,
  )

  const actualizado = await env.DB.prepare(
    `UPDATE paquetes
        SET precio_cup = ?,
            precio_usd = ?,
            precio_eur = ?
      WHERE id = ?`,
  )
    .bind(precioCup, precioUsd, precioEur, id)
    .run()

  if (actualizado.meta?.changes !== 1) throw ErrorApi.noEncontrado('Ese paquete')

  return json({
    ok: true,
    paquete: {
      id,
      precio_cup: precioCup,
      precio_usd: precioUsd,
      precio_eur: precioEur,
    },
  })
}

/**
 * Un precio de paquete, ya validado, en la unidad de SU columna.
 *
 * `undefined` conserva el que tenia. `null` o vacio lo limpian: la columna es
 * anulable y el catalogo lo pinta como "no disponible", que es lo que significa
 * no haber puesto precio en esa moneda.
 *
 * `campo` y `unidad` van separados porque el mensaje sale de los dos: decir
 * "no es un numero" sin decir en que unidad se teclea invita a repetir el mismo
 * error. Y se comprueba el entero aunque no llegue un decimal por casualidad:
 * la tabla no es STRICT, asi que SQLite aceptaria `10.5` en una columna INTEGER
 * y el problema se veria despues, en el escaparate, con un precio que nadie
 * puede cobrar.
 */
function leerPrecio(
  actual: unknown,
  previo: number | null,
  campo: string,
  unidad: string,
): number | null {
  if (actual === undefined) return previo

  if (actual === null || String(actual).trim() === '') return null

  const numero = typeof actual === 'number' ? actual : Number(String(actual).trim())

  if (!Number.isFinite(numero)) {
    throw ErrorApi.invalido(campo, 'Ese precio no es un numero.')
  }

  if (!Number.isInteger(numero)) {
    throw ErrorApi.invalido(campo, `El precio se guarda en ${unidad}.`)
  }

  if (numero < 0) {
    throw ErrorApi.invalido(campo, 'El precio no puede ser negativo.')
  }

  if (numero > TOPE_PRECIO) {
    throw ErrorApi.invalido(campo, 'Ese precio es demasiado grande para poder calcularlo.')
  }

  return numero
}
