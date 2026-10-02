/**
 * Prueba de extremo a extremo de la identidad, contra el Worker local.
 *
 * No es un test de frameworks: son peticiones reales y se mira lo que contestan.
 * Se escribe a mano y no con `vitest` porque lo que hay que comprobar aqui no es
 * que las funciones devuelvan lo esperado, sino que la COOKIE llegue al
 * navegador, que la revocacion en la base la haga inexplicable el token, y que
 * el 405 traiga el `Allow`. Eso solo se ve pasando por HTTP de verdad.
 *
 * Uso:  node probar-identidad.mjs
 * Requiere `wrangler dev` escuchando en 127.0.0.1:8787.
 */
const BASE = 'http://127.0.0.1:8787'

let fallos = 0
let pruebas = 0

/** Comprueba una condicion y anota el resultado. */
function comprobar(ok, etiqueta, detalle = '') {
  pruebas++
  if (!ok) fallos++
  const marca = ok ? 'ok  ' : 'FALLA'
  console.log(`  ${marca}  ${etiqueta}${detalle ? '  (' + detalle + ')' : ''}`)
}

/** Peticion que devuelve cuerpo, status y cabeceras. */
async function pedir(metodo, ruta, { cuerpo, cookie } = {}) {
  const cabeceras = {}
  if (cuerpo) cabeceras['Content-Type'] = 'application/json'
  if (cookie) cabeceras.Cookie = cookie

  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })

  let datos = null
  const texto = await r.text()
  try {
    datos = JSON.parse(texto)
  } catch {
    datos = texto
  }
  return { status: r.status, datos, headers: r.headers }
}

/** El valor de la cookie de sesion que vino en el `Set-Cookie`. */
function tokenDeCookie(setCookie) {
  if (!setCookie) return null
  const par = setCookie.split(';')[0]
  const igual = par.indexOf('=')
  return igual < 0 ? null : par.slice(igual + 1)
}

const correo = 'sgborbolla@gmail.com'
const contrasena = 'pruebaLocal123'

console.log('\n1. Antes de nada')
{
  const r = await pedir('GET', '/api/sesion')
  comprobar(r.status === 200, 'GET /api/sesion sin cookie responde 200', 'status ' + r.status)
  comprobar(r.datos.ok === true && r.datos.usuario === null, 'y dice que no hay nadie dentro')
  comprobar(
    (r.headers.get('cache-control') || '').includes('no-store'),
    'la respuesta no se cachea',
    r.headers.get('cache-control'),
  )
}

console.log('\n2. Metodo que no existe en la ruta')
{
  const r = await pedir('PUT', '/api/sesion')
  comprobar(r.status === 405, 'PUT /api/sesion responde 405', 'status ' + r.status)
  const allow = r.headers.get('allow') || ''
  comprobar(allow.includes('DELETE'), 'la cabecera Allow dice DELETE', allow || '(vacia)')
}

console.log('\n3. Registro del Owner')
let cookiePropia = null
{
  const r = await pedir('POST', '/api/registro', {
    cuerpo: { email: correo, nombre: 'Sonia G', contrasena },
  })
  comprobar(r.status === 201, 'el registro responde 201', 'status ' + r.status + ' ' + JSON.stringify(r.datos))
  comprobar(r.datos.usuario?.rol === 'owner', 'el rol se deduce: owner', r.datos.usuario?.rol)
  comprobar(r.datos.usuario?.verificado === true, 'el Owner queda verificado de salida')
  comprobar(r.datos.usuario?.puedeAdministrar === true, 'puede administrar')

  const setCookie = r.headers.get('set-cookie')
  cookiePropia = tokenDeCookie(setCookie)
  comprobar(Boolean(cookiePropia), 'la cookie de sesion viene en Set-Cookie')
  comprobar(
    (setCookie || '').includes('HttpOnly') && (setCookie || '').includes('SameSite=Lax'),
    'la cookie es HttpOnly y SameSite=Lax',
  )
  comprobar((setCookie || '').includes('Secure'), 'la cookie es Secure')
}

console.log('\n4. El rol NO se puede pedir desde el cliente')
{
  const r = await pedir('POST', '/api/registro', {
    cuerpo: { email: 'nuevo@ejemplo.com', nombre: 'Prueba', contrasena, rol: 'owner', verificado: true },
  })
  comprobar(r.status === 201, 'la cuenta se crea ignorando los campos que se mandan de mas', 'status ' + r.status)
  comprobar(r.datos.usuario?.rol === 'comprador', 'y el rol sigue siendo comprador, no owner', r.datos.usuario?.rol)
  comprobar(r.datos.usuario?.verificado === false, 'y no sale verificado')
}

console.log('\n5. Correo repetido')
{
  const r = await pedir('POST', '/api/registro', { cuerpo: { email: correo, nombre: 'Otro', contrasena } })
  comprobar(r.status === 409, 'registrarse dos veces con el mismo correo responde 409', 'status ' + r.status)
  comprobar(
    r.datos.mensaje?.includes('ya existe') || r.datos.mensaje?.includes('Ya hay'),
    'y el mensaje no revela si la contrasena era correcta',
    r.datos.mensaje,
  )
}

console.log('\n6. Contrasena debil y correo mal escrito')
{
  const debil = await pedir('POST', '/api/registro', {
    cuerpo: { email: 'debil@ejemplo.com', nombre: 'X', contrasena: '123' },
  })
  comprobar(debil.status === 400, 'una contrasena corta se rechaza', 'status ' + debil.status)

  const mala = await pedir('POST', '/api/registro', {
    cuerpo: { email: 'no-es-correo', nombre: 'X', contrasena: 'UnaContrasenaLarga1' },
  })
  comprobar(mala.status === 400, 'un correo sin @ se rechaza', 'status ' + mala.status)
}

console.log('\n7. Entrar con la contrasena correcta e incorrecta')
{
  const mal = await pedir('POST', '/api/sesion', { cuerpo: { email: correo, contrasena: 'incorrecta999' } })
  comprobar(mal.status === 401, 'con la contrasena incorrecta responde 401', 'status ' + mal.status)
  comprobar(!mal.headers.get('set-cookie'), 'y no deja cookie ninguna')

  const bien = await pedir('POST', '/api/sesion', { cuerpo: { email: correo, contrasena } })
  comprobar(bien.status === 200, 'con la correcta responde 200', 'status ' + bien.status)
  comprobar(bien.datos.usuario?.rol === 'owner', 'y devuelve el Owner')
  comprobar(Boolean(tokenDeCookie(bien.headers.get('set-cookie'))), 'y abre sesion con cookie nueva')
}

console.log('\n8. Con la cookie, quien soy')
{
  const r = await pedir('GET', '/api/sesion', { cookie: 'qbaswing_sesion=' + cookiePropia })
  comprobar(r.status === 200, 'responde 200', 'status ' + r.status)
  comprobar(r.datos.usuario?.email === correo, 'reconoce al Owner', r.datos.usuario?.email)
  comprobar(r.datos.usuario?.sesion_id === undefined, 'y NO devuelve el id interno de la sesion')
}

console.log('\n9. Token inventado')
{
  const r = await pedir('GET', '/api/sesion', { cookie: 'qbaswing_sesion=' + 'A'.repeat(40) })
  comprobar(r.status === 200 && r.datos.usuario === null, 'una cookie inventada no entra', 'status ' + r.status)
}

console.log('\n10. ESTA ES LA IMPORTANTE: cerrar sesion y volver a usar el token')
{
  const salida = await pedir('DELETE', '/api/sesion', { cookie: 'qbaswing_sesion=' + cookiePropia })
  comprobar(salida.status === 200, 'DELETE /api/sesion responde 200', 'status ' + salida.status)
  comprobar((salida.headers.get('set-cookie') || '').includes('Max-Age=0'), 'manda la cookie con Max-Age=0 para borrarla')

  const clear = salida.headers.get('clear-site-data') || ''
  comprobar(clear.includes('cache'), 'manda Clear-Site-Data para la cache', clear || '(vacia)')
  comprobar(!clear.includes('cookies'), 'pero NO pide borrar cookies a ciegas (eso seria el carrito)', clear)

  // El token es el MISMO. Si la revocacion es real, esto ya no vale.
  const despues = await pedir('GET', '/api/sesion', { cookie: 'qbaswing_sesion=' + cookiePropia })
  comprobar(
    despues.datos.usuario === null,
    'el token que se uso para salir YA NO SIRVE, aunque se vuelva a poner en la cookie',
  )

  const reentrar = await pedir('POST', '/api/sesion', { cuerpo: { email: correo, contrasena } })
  comprobar(reentrar.status === 200, 'pero se puede volver a entrar con correo y contrasena', 'status ' + reentrar.status)
}

console.log('\n11. El patrocinador: vendedor con privilegios administrativos')
{
  const r = await pedir('POST', '/api/registro', {
    cuerpo: { email: 'frankfreemansariol2016@gmail.com', nombre: 'Freeman', contrasena: 'pruebaLocal123' },
  })
  comprobar(r.status === 201, 'se registra', 'status ' + r.status + ' ' + JSON.stringify(r.datos))
  comprobar(r.datos.usuario?.rol === 'vendedor', 'el rol es vendedor', r.datos.usuario?.rol)
  comprobar(r.datos.usuario?.esVendedor === true, 'tiene tienda')
  comprobar(r.datos.usuario?.puedeAdministrar === true, 'y ademas puede administrar, por el privilegio de la tabla')
}

console.log('\n')
console.log('=== ' + (pruebas - fallos) + '/' + pruebas + ' pruebas ok')
if (fallos > 0) {
  console.log('=== ' + fallos + ' FALLARON')
  process.exitCode = 1
}