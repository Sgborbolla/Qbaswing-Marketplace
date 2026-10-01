/**
 * Punto de entrada del Worker.
 *
 * ============================================================================
 *  QUE HACE ESTE ARCHIVO Y POR QUE NO HACE MAS
 * ============================================================================
 * Resuelve la peticion y devuelve una respuesta. Toda la logica de negocio esta
 * en `src/lib/`, compartida con el sitio, y las reglas fijas en
 * `src/worker/constantes.ts`.
 *
 * La separacion no es purista. El Worker importa `src/lib/entrega.ts`, que es
 * el MISMO modulo que valida la compra. Si el Worker tuviera su propia copia de
 * esa regla, las dos podrian divergir y el sitio prometeria una cosa que la API
 * no cumple. Importando el modulo, no hay dos verdades: hay una.
 *
 * ============================================================================
 *  LO QUE ESTA DESPLEGADO HOY Y LO QUE NO
 * ============================================================================
 * Esta primera version es SOLO LECTURA del catalogo y de los datos editables de
 * la plataforma. Es lo unico que funciona sin ningun secreto configurado, y por
 * eso es lo primero que se despliega: hace falta una URL viva para registrar la
 * aplicacion en QvaPay, y una URL que devuelve 404 no sirve.
 *
 * Lo que NO esta, y por que:
 *
 *   - Escribir productos, carrito, pagos y aprobaciones. Necesitan sesion y
 *     forma de owner, que todavia no esta.
 *   - Descargar archivos. Necesita `QBASWING_SECRETO_FIRMA`.
 *   - Confirmar pagos. Necesita `QVAPAY_APP_SECRET`.
 *
 * Los webhooks EXISTEN y responden, pero rechazan mientras no haya secreto.
 * Rechazar es lo correcto: un webhook que acepta sin poder verificar la firma
 * deja que cualquiera marque un pago como pagado.
 */

import { ErrorApi, RUTAS, VENTANA_TIMESTAMP_SEG } from './constantes'
import { numero, type Env } from './entorno'
import { responderPlataforma } from './routers/plataforma'
import { responderCatalogo } from './routers/catalogo'
import { responderSalud } from './routers/salud'
import { responderWebhooks } from './routers/webhooks'

export default {
  async fetch(peticion: Request, env: Env): Promise<Response> {
    try {
      return await enrutar(peticion, env)
    } catch (error) {
      return responderError(error)
    }
  },
} satisfies ExportedHandler<Env>

/* ===========================================================================
 * Enrutado
 * ======================================================================== */

/**
 * Decide que router atiende la peticion.
 *
 * Los routers son funciones sueltas en vez de un mapa de rutas: el numero de
 * rutas todavia es chico y un mapa de objetos serializado en el bundle no aporta
 * nada. Cuando las rutas pasen de veinte, se cambia a tabla.
 */
async function enrutar(peticion: Request, env: Env): Promise<Response> {
  const url = new URL(peticion.url)
  const ruta = url.pathname.replace(/\/+$/, '') || '/'

  // CORS. Va antes que cualquier otra cosa, incluido el 404: si el navegador
  // llama a una ruta que no existe, tambien necesita poder leer la respuesta
  // para mostrar el error.
  const cors = cabecerasCors(peticion, env)

  if (peticion.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const respuesta = await despachar(ruta, peticion, env)
  for (const [clave, valor] of Object.entries(cors)) {
    respuesta.headers.set(clave, valor)
  }
  return respuesta
}

async function despachar(
  ruta: string,
  peticion: Request,
  env: Env,
): Promise<Response> {
  const soloLectura = peticion.method === 'GET' || peticion.method === 'HEAD'

  // Salud. Responde siempre, incluso sin base de datos, porque para eso sirve:
  // distingue "el Worker no esta desplegado" de "la base no responde".
  if (ruta === '/api/salud') return responderSalud(env, soloLectura)

  // Datos editables por el Owner: redes, contacto, FAQ. Publicos en lectura.
  if (ruta === RUTAS.redes || ruta === RUTAS.contacto || ruta === RUTAS.faq) {
    return responderPlataforma(ruta, env, soloLectura)
  }

  // Catalogo: productos, categorias, vendedores.
  if (
    ruta === RUTAS.productos ||
    ruta === RUTAS.categorias ||
    ruta === RUTAS.vendedores ||
    ruta === RUTAS.paquetes
  ) {
    return responderCatalogo(ruta, peticion, env, soloLectura)
  }

  // Detalle por slug. Se comparan los prefijos porque el slug va en la URL.
  if (ruta.startsWith('/api/productos/')) {
    const slug = decodificar(ruta.slice('/api/productos/'.length))
    if (!slug) throw ErrorApi.noEncontrado('Ese producto')
    return responderCatalogo(RUTAS.productos, peticion, env, soloLectura, { slug })
  }
  if (ruta.startsWith('/api/vendedores/')) {
    const slug = decodificar(ruta.slice('/api/vendedores/'.length))
    if (!slug) throw ErrorApi.noEncontrado('Ese vendedor')
    return responderCatalogo(RUTAS.vendedores, peticion, env, soloLectura, { slug })
  }

  // Webhooks. Se atienden aunque no haya secreto: lo que cambia es la
  // respuesta, no la existencia de la ruta. Una pasarela que recibe 404 en el
  // webhook reintenta y acaba marcando el pago como fallido; una que recibe 503
  // con un motivo claro tambien reintenta, pero el motivo dice por que.
  if (ruta === RUTAS.webhookQvaPay || ruta === RUTAS.webhookTropiPay) {
    return responderWebhooks(ruta, peticion, env)
  }

  throw ErrorApi.noEncontrado('Esa ruta')
}

/* ===========================================================================
 * CORS
 * ======================================================================== */

/**
 * Origenes permitidos.
 *
 * `ALLOWED_ORIGIN` es un origen, no un patron. Se compara exacto y sin barra
 * final. Comparar con `startsWith` seria un agujero: un atacante puede pedir
 * `https://sitio.pages.dev.ataque.com` y pasaria la comprobacion si el prefijo
 * esta permitido.
 *
 * Ademas se refleja el origen del solicitante en `Vary` y NO en
 * `Access-Control-Allow-Origin`, salvo que sea el permitido. Asi el CDN no
 * guarda la respuesta de un sitio para entregarsela a otro.
 */
function cabecerasCors(peticion: Request, env: Env): Record<string, string> {
  const permitido = (env.ALLOWED_ORIGIN || '').replace(/\/+$/, '')
  const soliciting = peticion.headers.get('Origin')
  const origen = soliciting && soliciting.replace(/\/+$/, '') === permitido ? soliciting : permitido

  const cabeceras: Record<string, string> = {
    'Access-Control-Allow-Origin': origen || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-QBASWing-Firma',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }

  if (!permitido) {
    // Sin `ALLOWED_ORIGIN` declarado, el Worker no sabe quien es el sitio. Se
    // responde sin cabecera de permiso en vez de abrirlo a todo el mundo con
    // `*`. Un token faltante que deja la API abierta es peor que un 403.
    delete cabeceras['Access-Control-Allow-Origin']
  }

  return cabeceras
}

/* ===========================================================================
 * Errores
 * ======================================================================== */

/**
 * Traduce cualquier error a una respuesta JSON.
 *
 * Lo que se devuelve y lo que se registra no son lo mismo. Al cliente se le da
 * el mensaje de `ErrorApi`, que esta escrito para que una persona lo lea. Al
 * log va el error completo, con la traza. Un error de SQL no debe llegar al
 * navegador: dice que columnas existen, y eso ayuda a quien quiera atacar.
 */
function responderError(error: unknown): Response {
  if (error instanceof ErrorApi) {
    return json({ ok: false, codigo: error.codigo, mensaje: error.message }, error.status)
  }

  const detalle = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error('[qbaswing-api] error no controlado', detalle, error instanceof Error ? error.stack : '')

  return json(
    {
      ok: false,
      codigo: 'error_interno',
      // Sin texto. El detalle esta en el log del Worker, no en la respuesta.
      mensaje: 'Algo fallo de nuestro lado. Intentalo de nuevo.',
    },
    500,
  )
}

/** Respuesta JSON con los headers que el Worker siempre manda. */
export function json(cuerpo: unknown, status = 200, cabeceras: HeadersInit = {}): Response {
  const h = new Headers(cabeceras)
  h.set('Content-Type', 'application/json; charset=utf-8')
  // Las respuestas de la API nunca se cachean en el CDN. El catalogo cambia
  // cuando el Owner aprueba un producto, y un indice desactualizado es peor
  // que uno lento: el Owner aprueba, recarga, y no ve el producto.
  h.set('Cache-Control', 'no-store')
  h.set('X-Content-Type-Options', 'nosniff')
  return new Response(JSON.stringify(cuerpo), { status, headers: h })
}

/** Lee un parametro de query, acotado, para que nadie pida un million de filas. */
export function enteroDeQuery(url: URL, nombre: string, defecto: number, maximo: number): number {
  const crudo = url.searchParams.get(nombre)
  if (crudo === null) return defecto
  const n = Number.parseInt(crudo, 10)
  if (!Number.isFinite(n) || n < 0) return defecto
  return Math.min(n, maximo)
}

/** `decodeURIComponent` que no lanza. Un slug con `%ZZ` da 404, no 500. */
function decodificar(valor: string): string | null {
  try {
    const limpio = decodeURIComponent(valor)
    return limpio.length > 0 && limpio.length <= 200 ? limpio : null
  } catch {
    return null
  }
}

/** Se exporta para que los routers usen la misma ventana de timestamp. */
export { VENTANA_TIMESTAMP_SEG, numero }
