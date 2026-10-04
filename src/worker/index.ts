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

import { ErrorApi, RUTAS } from './constantes'
import { type Env } from './entorno'
import { decodificar, enteroDeQuery, json } from './http'
import { responderPlataforma } from './routers/plataforma'
import { responderMediosPago } from './routers/medios-pago'
import { responderCatalogo } from './routers/catalogo'
import { responderSalud } from './routers/salud'
import { responderWebhooks } from './routers/webhooks'
import { responderIdentidad } from './routers/identidad'
import { responderCarrito } from './routers/carrito'

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
    // 200 y no 204. La especificacion acepta los dos, pero hay `fetch` de
    // navegadores que tratan un 204 como respuesta vacia fallida y cortan la
    // cadena de peticiones. Un 200 con cuerpo vacio no le da a nadie la
    // oportunidad de interpretar mal, y aqui no se gana nada con ahorrar dos
    // bytes de respuesta.
    return new Response(null, { status: 200, headers: cors })
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

  // Identidad. Va antes que el catalogo porque `DELETE /api/sesion` es el cierre
  // de sesion y `POST /api/registro` es el alta: si el catalogo aceptase estos
  // metodos, un POST a `/api/sesion` llegaria al router equivocado.
  if (ruta === RUTAS.registro || ruta === RUTAS.sesion || ruta === RUTAS.cuenta) {
    return responderIdentidad(ruta, peticion.method, peticion, env)
  }

  // Datos editables por el Owner: redes, contacto, FAQ. Publicos en lectura.
  if (ruta === RUTAS.redes || ruta === RUTAS.contacto || ruta === RUTAS.faq) {
    return responderPlataforma(ruta, env, soloLectura)
  }

  // Formas de pago. Publicas en lectura y con el numero de cuenta dentro.
  //
  // No va dentro del grupo de arriba porque `responderPlataforma` SOLO devuelve
  // datos de pie de pagina, y una forma de pago no lo es: es informacion de
  // compra. Mezclarlas haria que pensar en esta tabla desde el footer, que es
  // donde no se decide como cobra nadie.
  if (ruta === RUTAS.mediosPago) {
    return responderMediosPago(env)
  }

  // Carrito. Va antes que el catalogo porque `GET /api/carrito` tiene que saber
  // quien pregunta antes que nada, y el catalogo es de lectura publica.
  if (ruta === RUTAS.carrito) {
    return responderCarrito(ruta, peticion.method, peticion, env)
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
 * `ALLOWED_ORIGIN` es una LISTA separada por comas, y cada entrada se compara
 * exacta y sin barra final. Comparar con `startsWith` seria un agujero: un
 * atacante puede pedir `https://sitio.pages.dev.ataque.com` y pasaria la
 * comprobacion si el prefijo esta permitido.
 *
 * POR QUE HACE FALTA MAS DE UN ORIGEN
 * El sitio en produccion es `https://qbaswing-marketplace.pages.dev`. En local
 * el mismo sitio corre en `http://localhost:4321`, y el navegador trata eso como
 * otro origen completo: son dominios, puertos y esquemas distintos.
 *
 * Y hace falta de verdad, no por si acaso: el registro y el acceso se hacen con
 * `fetch` DESDE el navegador, porque la pagina es HTML estatico y no hay servidor
 * que envie el formulario. Sin `localhost` en la lista, entrar funciona en
 * produccion y no funciona en local, que es la forma mas incomoda de fallar:
 * durante el desarrollo no se ve nunca.
 *
 * `http://localhost` y no `http://127.0.0.1`: son el mismo servidor pero
 * orígenes distintos para el navegador, y algunos resuelven uno como otro. Se
 * permiten los dos para no tener que depender de como el navegador lo trate.
 */
function cabecerasCors(peticion: Request, env: Env): Record<string, string> {
  const permitidos = (env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  const origenRecibido = peticion.headers.get('Origin')
  const origemSolicitado = origenRecibido ? origenRecibido.replace(/\/+$/, '') : ''

  // Se refleja el origen del solicitante en `Vary` y NO en
  // `Access-Control-Allow-Origin`, salvo que sea uno de los permitidos. Asi el
  // CDN no guarda la respuesta de un sitio para entregarsela a otro.
  const permitido = permitidos.includes(origemSolicitado) ? origemSolicitado : permitidos[0]

  const cabeceras: Record<string, string> = {
    'Access-Control-Allow-Origin': permitido || '*',
    // DELETE no es opcional: es el metodo del cierre de sesion, y sin el aqui el
    // navegador manda la peticion pero se come la respuesta, que es justo la que
    // trae el `Clear-Site-Data` que hace que el boton de atras no resucite la
    // pagina. Un cierre de sesion a medias es peor que no cerrar.
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-QBASWing-Firma',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }

  // ESTA CABECERA ES LA QUE HACIA QUE ENTRAR NO FUNCIONARA.
  //
  // El sitio pide la sesion con `credentials: 'include'`, porque la cookie es
  // `HttpOnly` y el JavaScript solo puede MANDARLA, nunca leerla. El navegador
  // exige `Access-Control-Allow-Credentials: true` para obedecer eso: sin esta
  // cabecera, no envia la cookie y descarta la respuesta entera.
  //
  // Es el fallo mas incomodo que se puede tener aqui, porque no se ve en NINGUN
  // lado desde el servidor. `curl` funciona, la prueba de produccion pasa, el
  // Worker devuelve 200 con los datos correctos... y el navegador no muestra
  // nada. La unica forma de verlo es mandando el preflight de verdad, que es lo
  // que hace `probar-cors.mjs`.
  //
  // Y va SIEMPRE con `Access-Control-Allow-Origin` con el origen LITERAL, nunca
  // con `*`: la especificacion prohibe el asterisco cuando hay credenciales, y
  // el navegador rechaza la combinacion aunque las dos cabeceras esten puestas.
  cabeceras['Access-Control-Allow-Credentials'] = 'true'

  if (permitidos.length === 0) {
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
    // El 405 lleva `Allow`. Sin esta cabecera la respuesta esta incompleta y el
    // navegador avisa por consola; con ella el cliente sabe que metodos usar.
    const cabeceras: Record<string, string> = {}
    if (error.metodosPermitidos?.length) {
      cabeceras.Allow = error.metodosPermitidos.join(', ')
    }
    return json(
      { ok: false, codigo: error.codigo, mensaje: error.message },
      error.status,
      cabeceras,
    )
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
