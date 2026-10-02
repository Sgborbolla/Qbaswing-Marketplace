/**
 * Comprobacion de la API DESPLIEGADA.
 *
 * ============================================================================
 *  QUE COMPRUEBA Y QUE NO
 * ============================================================================
 * Que el Worker de produccion responde y que las rutas de identidad estan
 * enrutadas. NO crea cuentas ni entra: para eso estan `probar-identidad.mjs` y
 * `probar-cuenta.mjs`, que solo corren contra la base local. Aqui se mira lo
 * unico que se puede mirar sin escribir en la base de verdad.
 *
 * Las cuatro cosas que se comprueban:
 *
 *   1. `/api/salud` responde 200 y dice que hay base de datos.
 *   2. `/api/cuenta` existe y responde 401 sin cookie. Un 404 aqui significa
 *      que el Worker desplegado es una version antigua sin la ruta.
 *   3. `/api/cuenta` responde 405 a un POST, con la cabecera `Allow` puesta.
 *   4. Una cookie inventada no abre nada. Es la misma comprobacion que hace
 *      falta en produccion: que no basta con inventarse una cadena.
 *
 * Que la peticion mande `Origin` a proposito: el Worker rechaza las peticiones
 * de origenes que no estan en `ALLOWED_ORIGIN`, asi que sin `Origin` lo que se
 * estaria midiendo es el CORS, que es otra cosa.
 */
const API = process.argv[2] ?? 'https://qbaswing-api.sgborbolla.workers.dev'
const ORIGEN = process.argv[3] ?? 'https://qbaswing-marketplace.pages.dev'

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

async function pedir(ruta, opciones = {}) {
  try {
    const r = await fetch(API + ruta, {
      ...opciones,
      headers: { Origin: ORIGEN, 'Content-Type': 'application/json', ...(opciones.headers ?? {}) },
    })
    let cuerpo = null
    try {
      cuerpo = await r.json()
    } catch {
      cuerpo = null
    }
    return { ok: r.ok, status: r.status, cuerpo, cabeceras: r.headers }
  } catch (error) {
    return { ok: false, status: 0, cuerpo: null, error: String(error) }
  }
}

console.log('Comprobando ' + API)
console.log('')

console.log('1. Salud')
{
  const r = await pedir('/api/salud')
  comprobar('responde 200', r.ok, String(r.status))
  // La forma exacta es `base.conectada` y `base.esquema`. Se mira `conectada` y
  // no `ok` porque hay estados intermedios que tambien son 200: una base
  // conectada con el esquema sin aplicar tiene que salir como problema, no como
  // "todo bien".
  comprobar('y dice que la base responde', r.cuerpo?.base?.conectada === true, JSON.stringify(r.cuerpo?.base))
  comprobar('y que el esquema esta aplicado', r.cuerpo?.base?.esquema === 'aplicado', r.cuerpo?.base?.esquema)
  comprobar('y no enseña el secreto', JSON.stringify(r.cuerpo ?? {}).includes('QBASWING_SECRETO_FIRMA') === false)

  // El numero de tablas y de productos se enseña: es el dato que dice si hay
  // algo real dentro. Con 0 productos publicados hay que decirlo en voz alta,
  // no dejar que el sitio parezca lleno.
  const tablas = r.cuerpo?.base?.tablas
  const productos = r.cuerpo?.base?.productos_publicados
  console.log(`       tablas: ${tablas}, productos publicados: ${productos}`)
  if (productos === 0) {
    console.log('       AVISO: no hay ningun producto publicado todavia.')
  }

  // Los secretos que faltan. Cada uno es una razon por la que una parte del
  // sitio no funciona, asi que se listan en vez de esconderlos.
  const faltan = r.cuerpo?.secretos_faltantes ?? []
  if (faltan.length > 0) {
    console.log(`       secretos que faltan: ${faltan.join(', ')}`)
  }
}

console.log('')
console.log('2. La ruta /api/cuenta esta desplegada')
{
  const r = await pedir('/api/cuenta')
  // 401 es lo correcto: la ruta existe y pide sesion. Un 404 seria un Worker viejo.
  comprobar('sin cookie responde 401 y no 404', r.status === 401, 'status ' + r.status)
  comprobar('y dice que hay que entrar', r.cuerpo?.codigo === 'no_dentro', JSON.stringify(r.cuerpo))
  comprobar('y no manda cabeceras de cache', r.cabeceras?.get('cache-control')?.includes('no-store') === true, r.cabeceras?.get('cache-control') ?? 'sin cabecera')
}

console.log('')
console.log('3. Solo se lee')
{
  const r = await pedir('/api/cuenta', { method: 'POST', body: '{}' })
  comprobar('un POST responde 405', r.status === 405, 'status ' + r.status)
  comprobar('y dice que metodos se permiten', r.cabeceras?.get('allow') === 'GET', r.cabeceras?.get('allow') ?? 'sin cabecera')
}

console.log('')
console.log('4. Una cookie inventada no abre nada')
{
  const r = await pedir('/api/cuenta', {
    headers: { Cookie: 'qb_sesion=' + 'a'.repeat(64) },
  })
  comprobar('responde 401', r.status === 401, 'status ' + r.status)
}

console.log('')
console.log('5. CORS: el origen permitido entra, uno raro no')
{
  const bueno = await pedir('/api/salud')
  const buenoCors = bueno.cabeceras?.get('access-control-allow-origin')
  comprobar('el origen del sitio va permitido', buenoCors === ORIGEN, buenoCors ?? 'sin cabecera')

  const raro = await fetch(API + '/api/salud', { headers: { Origin: 'https://ejemplo.invalido' } })
  const raroCors = raro.headers.get('access-control-allow-origin')
  comprobar('un origen raro no va permitido', raroCors !== 'https://ejemplo.invalido', raroCors ?? 'sin cabecera')
}

console.log('')
console.log(`=== ${pasadas} pruebas ok`)
if (falladas > 0) {
  console.log(`=== ${falladas} FALLARON`)
  process.exit(1)
}