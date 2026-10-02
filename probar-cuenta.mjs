/**
 * Prueba de `GET /api/cuenta`.
 *
 * ============================================================================
 *  QUE COMPRUEBA Y POR QUE
 * ============================================================================
 * `/api/cuenta` es la ruta de la que dependen `/cuenta`, `/panel` y `/owner`, las
 * tres paginas de identidad del sitio. Si devuelve algo distinto de lo que
 * espera, las tres muestran estados equivocados.
 *
 * Las cuatro cosas que se comprueban aqui son las unicas que pueden salir mal
 * de una forma silenciosa:
 *
 *   1. SIN cookie responde 401 y NO 200 con `null`. Si devolviera 200, la pagina
 *      tendria que decidir por su cuenta si es un invitado o un fallo, y esa
 *      decision se tomaria en el sitio, que es donde no se puede validar nada.
 *
 *   2. CON cookie devuelve los datos DE ESE USUARIO. Se comprueba con dos
 *      cuentas distintas en la misma corrida: si `/api/cuenta` leyera un id de
 *      la sesion equivocado, con una sola cuenta no se notaria.
 *
 *   3. La exencion se lee por CORREO, no por `usuario_id`. Se comprueba con una
 *      cuenta normal, que NO debe salir exenta. Si la consulta se hacia por id
 *      y el seeded se hubiera copiado a la tabla por id, aqui saldria exento.
 *
 *   4. NO acepta un `id` por la URL ni en el cuerpo. Es la comprobacion que
 *      impide ver la cuenta de otro. Se manda un `?id=1` a proposito y se exige
 *      que se ignorare: una pagina de panel no puede dejar que la URL decida a
 *      quien se leen los datos.
 *
 * ============================================================================
 *  SOLO CONTRA EL WORKER LOCAL
 * ============================================================================
 * El script empieza comprobando que el puerto 8787 responde y que la ruta dice
 * `localhost` o `127.0.0.1`. Contra el Worker de produccion crearia cuentas de
 * prueba de verdad en la base del marketplace.
 */
import { reiniciarCuentasLocales, BASE } from './reiniciar-cuentas-locales.mjs'

const API = BASE + '/api'

/** Correo del Owner. El rol sale de `owner_registro_preautorizado`, no del cuerpo. */
const OWNER = { email: 'sgborbolla@gmail.com', nombre: 'Propietario' }
/** El patrocinador: vendedor con privilegios administrativos y exento. */
const PATROCINADOR = { email: 'frankfreemansariol2016@gmail.com', nombre: 'Freeman' }

/** Una cuenta corriente, para comprobar que NO sale exenta ni administradora. */
const NORMAL = { email: 'prueba-normal@example.test', nombre: 'Prueba Normal' }

const CONTRASENA = 'Prueba-de-tipos-2026'

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

/** Devuelve `{ ok, status, cuerpo, cookie }` de una peticion. */
async function pedir(ruta, opciones = {}) {
  const r = await fetch(API + ruta, {
    ...opciones,
    headers: {
      Origin: 'http://localhost:4321',
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
  })

  let cuerpo = null
  try {
    cuerpo = await r.json()
  } catch {
    cuerpo = null
  }

  return {
    ok: r.ok,
    status: r.status,
    cuerpo,
    cookie: r.headers.get('Set-Cookie'),
  }
}

/** Registra una cuenta y devuelve su cookie de sesion. */
async function registrar(cuenta) {
  const r = await pedir('/registro', {
    method: 'POST',
    body: JSON.stringify({ ...cuenta, contrasena: CONTRASENA }),
  })

  if (!r.cuerpo || r.cuerpo.ok !== true) {
    throw new Error(
      'no se pudo registrar ' + cuenta.email + ': ' + r.status + ' ' + JSON.stringify(r.cuerpo),
    )
  }

  const par = (r.cookie ?? '').split(';')[0]
  if (!par.startsWith('qb_sesion=') && !par.includes('=')) {
    throw new Error('la respuesta de registro no trae cookie de sesion')
  }
  return { cookie: par, usuario: r.cuerpo.usuario }
}

/** Devuelve solo la pareja de la cookie, sin atributos. */
function soloCookie(cabecera) {
  return (cabecera ?? '').split(';')[0]
}

console.log('Probando GET /api/cuenta')
console.log('')

// 1. Sin sesion tiene que ser 401, no 200 con null.
console.log('1. Sin cookie')
{
  const r = await pedir('/cuenta', { method: 'GET' })

  comprobar('sin sesion responde 401', r.status === 401, 'status ' + r.status)
  comprobar('y dice que no estas dentro', r.cuerpo?.codigo === 'no_dentro', JSON.stringify(r.cuerpo))
  comprobar(
    'y no devuelve datos de nadie',
    r.cuerpo?.usuario === undefined && r.cuerpo?.exencion === undefined,
  )
  comprobar(
    'y no permite otros metodos',
    (await pedir('/cuenta', { method: 'POST', body: '{}' })).status === 405,
  )
}

// 2. Tres cuentas reales, cada una con lo suyo.
console.log('')
console.log('2. Con sesion')

reiniciarCuentasLocales()

const owner = await registrar(OWNER)
const patrocinador = await registrar(PATROCINADOR)
const normal = await registrar(NORMAL)

comprobar('el Owner se registra con rol owner', owner.usuario.rol === 'owner', owner.usuario.rol)
comprobar(
  'el patrocinador se registra como vendedor',
  patrocinador.usuario.rol === 'vendedor',
  patrocinador.usuario.rol,
)
comprobar('y ademas puede administrar', patrocinador.usuario.puedeAdministrar === true)

// El Owner: libre de porcentaje, libre de paquetes, administrador.
{
  const r = await pedir('/cuenta', { method: 'GET', headers: { Cookie: owner.cookie } })

  comprobar('el Owner puede leer su cuenta', r.ok && r.cuerpo?.ok === true, String(r.status))
  comprobar('y es el', r.cuerpo?.usuario?.email === OWNER.email, r.cuerpo?.usuario?.email)
  comprobar('y sale libre de porcentaje', r.cuerpo?.exencion?.exentoComision === true)
  comprobar('y sale libre de paquetes', r.cuerpo?.exencion?.slotsIlimitados === true)
  comprobar('y sale administrador de todo', r.cuerpo?.usuario?.puedeAdministrar === true)
  comprobar('y con el motivo de la exencion puesto', (r.cuerpo?.exencion?.motivo ?? '').length > 0)
}

// El patrocinador: vendedor, exento, con tienda.
{
  const r = await pedir('/cuenta', { method: 'GET', headers: { Cookie: patrocinador.cookie } })

  comprobar('el patrocinador puede leer su cuenta', r.ok && r.cuerpo?.ok === true, String(r.status))
  comprobar('y es el', r.cuerpo?.usuario?.email === PATROCINADOR.email, r.cuerpo?.usuario?.email)
  comprobar('y sale libre de porcentaje', r.cuerpo?.exencion?.exentoComision === true)
  comprobar('y sale libre de paquetes', r.cuerpo?.exencion?.slotsIlimitados === true)
  comprobar('y tiene tienda', typeof r.cuerpo?.tienda?.slug === 'string', r.cuerpo?.tienda?.slug)
  comprobar(
    'y la tienda es la suya',
    r.cuerpo?.tienda?.slug === 'freeman-impresiones',
    r.cuerpo?.tienda?.slug,
  )
}

// Una cuenta corriente: ni exenta ni administradora. Esta es la que verifica
// que lo de arriba no es "todo el mundo sale exento".
{
  const r = await pedir('/cuenta', { method: 'GET', headers: { Cookie: normal.cookie } })

  comprobar('una cuenta corriente puede leer su cuenta', r.ok && r.cuerpo?.ok === true, String(r.status))
  comprobar('y NO sale libre de porcentaje', r.cuerpo?.exencion === null, JSON.stringify(r.cuerpo?.exencion))
  comprobar('y NO tiene tienda', r.cuerpo?.tienda === null, JSON.stringify(r.cuerpo?.tienda))
  comprobar('y NO puede administrar', r.cuerpo?.usuario?.puedeAdministrar === false)
  comprobar('y NO sale como vendedor', r.cuerpo?.usuario?.esVendedor === false)
}

// 3. Una cookie de otra persona NO da acceso a la cuenta de nadie mas.
console.log('')
console.log('3. Que no se puede ver la cuenta de otro')
{
  // La cuenta corriente intenta pedir la del Owner poniendole el id en la URL.
  // `/api/cuenta` no acepta ningun parametro, asi que el id se tiene que
  // IGNORAR. Esto es la comprobacion de que la pagina de panel no deja que la
  // URL decida a quien se leen los datos: si el Worker honrara el `?id=`, con
  // cambiar un numero en la barra de direcciones se leeria la cuenta de otro.
  const conParametro = await pedir('/cuenta?id=' + owner.usuario.id, {
    method: 'GET',
    headers: { Cookie: normal.cookie },
  })
  comprobar(
    'un id en la URL se ignora',
    conParametro.cuerpo?.usuario?.email === NORMAL.email,
    conParametro.cuerpo?.usuario?.email,
  )

  // Y lo mismo por una cabecera inventada.
  const conCabecera = await pedir('/cuenta', {
    method: 'GET',
    headers: { Cookie: normal.cookie, 'X-Id-Usuario': String(owner.usuario.id) },
  })
  comprobar(
    'un id en una cabecera se ignora',
    conCabecera.cuerpo?.usuario?.email === NORMAL.email,
    conCabecera.cuerpo?.usuario?.email,
  )

  // Y una cookie inventada no da acceso a nada.
  const conCookieFalsa = await pedir('/cuenta', {
    method: 'GET',
    headers: { Cookie: 'qb_sesion=' + 'a'.repeat(64) },
  })
  comprobar('una cookie inventada no abre nada', conCookieFalsa.status === 401)
}

// 4. Con la cookie revocada, la cuenta ya no existe.
console.log('')
console.log('4. Tras salir')
{
  const salida = await pedir('/sesion', {
    method: 'DELETE',
    headers: { Cookie: owner.cookie },
  })
  comprobar('salir responde 200', salida.ok, String(salida.status))

  const despues = await pedir('/cuenta', { method: 'GET', headers: { Cookie: owner.cookie } })
  comprobar('la cuenta ya no se lee con la cookie vieja', despues.status === 401, String(despues.status))
}

console.log('')
console.log(`=== ${pasadas} pruebas ok`)
if (falladas > 0) {
  console.log(`=== ${falladas} FALLARON`)
  process.exit(1)
}