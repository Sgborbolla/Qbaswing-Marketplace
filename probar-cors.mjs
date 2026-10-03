/**
 * Comprobacion del PREFLIGHT de CORS.
 *
 * ============================================================================
 *  POR QUE HACE FALTA UN ARCHIVO PARA ESTO
 * ============================================================================
 * El sitio pide la sesion y la cuenta con `fetch` y con
 * `Content-Type: application/json`. Un `Content-Type` que no sea
 * `application/x-www-form-urlencoded`, `multipart/form-data` o `text/plain`
 * convierte la peticion en "no simple", y el navegador tiene que mandar antes
 * un `OPTIONS` para preguntar si puede.
 *
 * Eso significa que una peticion que funciona con `curl` puede fallar en el
 * navegador sin dar ningun error visible: el navegador pide permiso, recibe un
 * `OPTIONS` mal formado, y no hace ni la lectura ni la escritura.
 *
 * Por eso `probar-produccion.mjs` NO alcanza: sus peticiones no llevan
 * `Content-Type`, asi que van directas y nunca pasan por aqui. Este archivo
 * manda el mismo `OPTIONS` que manda el navegador, y compara lo que responde el
 * Worker con lo que el navegador exige.
 *
 * ============================================================================
 *  QUE HAY QUE DEVOLVER EN UN PREFLIGHT
 * ============================================================================
 *   - `Access-Control-Allow-Origin`: el origen EXACTO, o `*` si no hay credenciales.
 *   - `Access-Control-Allow-Methods`: los metodos que se van a usar.
 *   - `Access-Control-Allow-Headers`: `content-type` va SIEMPRE, sin excepcion.
 *   - `Access-Control-Allow-Credentials`: `true`, porque la cookie de sesion es
 *     `HttpOnly` y solo se manda si el navegador tiene permiso para mandarla.
 *
 * Y dos trampas que hacen fallar esto sin decir nada:
 *
 *   1. `Allow-Origin: *` JUNTO CON credenciales. El navegador lo rechaza. Con
 *      credenciales hay que devolver el origen literal, nunca el asterisco.
 *
 *   2. El status 204. Muchos `fetch` de CORS no aceptan un 204 como respuesta
 *      valida al preflight. Lo seguro es 200 con cuerpo vacio.
 */
const API = process.argv[2] ?? 'https://qbaswing-api.sgborbolla.workers.dev'
const ORIGEN = process.argv[3] ?? 'http://localhost:4321'

let pasadas = 0
let falladas = 0

function comprobar(descripcion, condicion, detalle = '') {
  if (condicion) {
    pasadas++
    console.log('  ok   ' + descripcion)
  } else {
    falladas++
    console.log('  FALLA ' + descripcion + (detalle ? '  ' + detalle : ''))
  }
}

/**
 * Los metodos y rutas que el navegador tiene que poder usar sinEco.
 *
 * Se prueban TODOS, no solo un OPTIONS suelto: un Worker puede responder bien a
 * `/api/sesion` y mal a `/api/cuenta`, y con un solo exemplo no se veria.
 */
const CASOS = [
  { ruta: '/api/sesion', metodo: 'GET' },
  { ruta: '/api/sesion', metodo: 'POST' },
  { ruta: '/api/sesion', metodo: 'DELETE' },
  { ruta: '/api/cuenta', metodo: 'GET' },
  { ruta: '/api/registro', metodo: 'POST' },
]

console.log('Preflight de CORS contra ' + API)
console.log('origen: ' + ORIGEN)
console.log('')

for (const caso of CASOS) {
  const etiqueta = 'OPTIONS ' + caso.ruta + ' para ' + caso.metodo
  console.log(caso.ruta + ' (' + caso.metodo + ')')

  const r = await fetch(API + caso.ruta, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGEN,
      // Estos tres son los que hacen falta para que la respuesta final se pueda leer.
      'Access-Control-Request-Method': caso.metodo,
      'Access-Control-Request-Headers': 'content-type',
    },
  })

  const origen = r.headers.get('access-control-allow-origin')
  const metodos = r.headers.get('access-control-allow-methods') ?? ''
  const cabeceras = r.headers.get('access-control-allow-headers') ?? ''
  const credenciales = r.headers.get('access-control-allow-credentials')
  const varios = r.headers.get('access-control-allow-origin') ?? ''

  comprobar('responde 200 o 204', r.status === 200 || r.status === 204, 'status ' + r.status)

  comprobar('devuelve el origen exacto', origen === ORIGEN, origen ?? 'sin cabecera')

  // La trampa 1: con credenciales, el asterisco no vale.
  comprobar(
    'NO devuelve asterisco con credenciales',
    varios !== '*' && credenciales === 'true',
    'allow-origin=' + varios + ' credentials=' + credenciales,
  )

  comprobar(
    'el metodo pedido esta permitido',
    metodos.split(',').map((m) => m.trim().toUpperCase()).includes(caso.metodo),
    metodos || 'sin cabecera',
  )

  comprobar(
    'permite content-type',
    cabeceras.toLowerCase().includes('content-type'),
    cabeceras || 'sin cabecera',
  )

  console.log('')
}

console.log(`=== ${pasadas} pruebas ok`)
if (falladas > 0) {
  console.log(`=== ${falladas} FALLARON`)
  process.exit(1)
}