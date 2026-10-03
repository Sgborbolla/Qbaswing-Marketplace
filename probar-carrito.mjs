/**
 * Prueba del carrito.
 *
 * ============================================================================
 *  POR QUE HACE FALTA Y QUE COMPRUEBA
 * ============================================================================
 * El carrito toca la base de datos de verdad: inserta, suma, borra. Si algo de
 * eso esta mal, el dano no es una pantalla fea: son lineas de producto de otro,
 * precios equivocados o carritos que no cuadran. Por eso se prueba de forma
 * aislada y no "a ojo".
 *
 * Las comprobaciones van en este orden porque cada una depende de la anterior:
 *
 *   1. Un carrito nuevo NACIE VACIO. Un carrito con lineas que nadie ha pedido
 *      seria un sitio donde meter cosas gratis.
 *   2. Anadir devuelve el producto con el precio del servidor. El precio lo
 *      pone el Worker; la pagina no lo decide nunca.
 *   3. Anadir dos veces SUMA, no duplica y no falla.
 *   4. Dos carritos anonimos NO se ven. El token del primero tiene que servir
 *      solo para lo suyo, o un token adivinado dejaria ver y vaciar el carrito
 *      de otro.
 *   5. Quitar con un id ajeno NO borra nada. Los ids son consecutivos y se
 *      adivinan; el `WHERE` tiene que llevar el `carrito_id` encima.
 *   6. El precio se CONGELA al anadir: si el producto cambia de precio, el
 *      carrito sigue mostrando el viejo y avisa del cambio.
 *   7. Sin sesion se puede comprar igual, pero con sesion el carrito pasa al de
 *      la cuenta.
 */
import { execFileSync } from 'node:child_process'
import { reiniciarCuentasLocales } from './reiniciar-cuentas-locales.mjs'

const API = process.env.API_BASE ?? 'http://127.0.0.1:8787'
const CABECERA = 'X-QBASWing-Carrito'
// La contrasena NO lleva nada del correo a proposito. El Worker rechaza una
// contrasena que contenga el correo del usuario, y esta prueba usaba un correo
// `prueba-carrito@...` con contrasena `Prueba-carrito-2026`: el servidor la
// rechazo con un 400 y la prueba leyo eso como que el registro fallaba. Era una
// proteccion real del servidor funcionando, no un fallo del registro.
const CONTRASENA = 'Migracion-Siete-9042'

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

async function pedir(ruta, opciones = {}, token = '', cabecerasExtra = {}) {
  const r = await fetch(API + ruta, {
    ...opciones,
    headers: {
      Origin: 'http://localhost:4321',
      'Content-Type': 'application/json',
      ...(token ? { [CABECERA]: token } : {}),
      ...cabecerasExtra,
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
    token: r.headers.get(CABECERA) ?? token,
    // La cookie de sesion. Solo la usan el registro y el acceso; el resto de
    // rutas del carrito no la devuelven.
    cookie: r.headers.get('Set-Cookie') ?? '',
  }
}

/**
 * Ejecuta un SQL en la base LOCAL y devuelve la salida.
 *
 * El SQL va en UNA SOLA LINEA. Al pasar por `shell: true` en Windows, un salto
 * de linea parte el argumento y SQLite recibe la instruccion cortada, con el
 * error `incomplete input`, que no dice nada sobre el salto de linea.
 */
function sql(instruccion) {
  return execFileSync(
    'npx',
    [
      'wrangler', 'd1', 'execute', 'qbaswing_marketplace',
      '-c', 'wrangler.api.toml',
      '--command', `"${instruccion}"`,
    ],
    { cwd: process.cwd(), encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/** Crea un producto publicado directamente en la base local. */
async function crearProducto(titulo, precio = 2500, moneda = 'USD') {
  const marca = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  sql(
    `INSERT INTO productos (slug, vendedor_id, titulo, descripcion, tipo, origen, regla, categoria, precio, moneda, publicado) ` +
      `VALUES ('prueba-${marca}', 1, '${titulo}', 'Producto de prueba.', 'digital', 'qbaswing', 'B', 'pruebas', ${precio}, '${moneda}', 1)`,
  )

  // Se lee de vuelta el id por el slug, que es unico para esta prueba.
  const lectura = sql(`SELECT id FROM productos WHERE slug = 'prueba-${marca}'`)

  const id = lectura.match(/"id":\s*(\d+)/)
  return id ? Number(id[1]) : 0
}

console.log('Probando el carrito')
console.log('')

reiniciarCuentasLocales()

// El vendedor 1 es el de Freeman, que existe desde la migracion 0006.
const productoA = await crearProducto('Prueba A')
const productoB = await crearProducto('Prueba B', 500, 'CUP')

// Se comprueba ANTES de usar los ids. Si `crearProducto` devuelve 0, el POST
// recibiria un producto_id de 0, el Worker lo rechaza con un 400, y el resto de
// la prueba mediria un fallo derivado en lugar del fallo real. Peor: al no
// haber linea, los ids de linea salen `undefined`, y `JSON.stringify({id:
// undefined})` es `{}`, que el Worker lee como "vaciar el carrito". Ahi estaba el
// fallo en cascada que hacia pensar que la parte 6 estaba rota.
if (productoA <= 0 || productoB <= 0) {
  console.log(`  FALLA no se pudieron crear los productos de prueba: ${productoA} y ${productoB}`)
  process.exit(1)
}

console.log('1. Carrito nuevo')
let r = await pedir('/api/carrito', { method: 'GET' })
comprobar('nace vacio', r.cuerpo?.carrito?.vacio === true)
comprobar('y devuelve token', (r.token ?? '').length === 32, r.token)
const tokenA = r.token
comprobar('y no acepta otros metodos', (await pedir('/api/carrito', { method: 'PUT', body: '{}' }, tokenA)).status === 405)

console.log('')
console.log('2. Anadir')
r = await pedir('/api/carrito', { method: 'POST', body: JSON.stringify({ producto_id: productoA, cantidad: 2 }) }, tokenA)
comprobar('devuelve ok', r.cuerpo?.ok === true, JSON.stringify(r.cuerpo))
comprobar('con una linea', r.cuerpo?.carrito?.lineas?.length === 1)
comprobar('con la cantidad pedida', r.cuerpo?.carrito?.lineas?.[0]?.cantidad === 2)
comprobar('y el precio lo pone el servidor', r.cuerpo?.carrito?.lineas?.[0]?.precioUnitario === 2500, String(r.cuerpo?.carrito?.lineas?.[0]?.precioUnitario))
comprobar('el subtotal es precio por cantidad', r.cuerpo?.carrito?.lineas?.[0]?.subtotal === 5000, String(r.cuerpo?.carrito?.lineas?.[0]?.subtotal))
comprobar('no avisa de nada todavia', r.cuerpo?.carrito?.hayAvisos === false)
// La peticion lleva `cantidad` a proposito. Sin ella, el Worker rechaza antes
// de mirar el producto, con un 400 de "la cantidad no es valida", y la prueba
// mediria un 400 donde esperaba un 404. Que se compruebe el formato ANTES de
// tocar la base es lo correcto: no tiene sentido ir a la base a buscar algo
// cuando el pedido ya venia mal.
comprobar('un producto que no existe no se anade', (await pedir('/api/carrito', { method: 'POST', body: JSON.stringify({ producto_id: 99999999, cantidad: 1 }) }, tokenA)).status === 404)

console.log('')
console.log('3. Anadir dos veces suma')
r = await pedir('/api/carrito', { method: 'POST', body: JSON.stringify({ producto_id: productoA, cantidad: 1 }) }, tokenA)
comprobar('no duplica la linea', r.cuerpo?.carrito?.lineas?.length === 1, String(r.cuerpo?.carrito?.lineas?.length))
comprobar('suma la cantidad', r.cuerpo?.carrito?.lineas?.[0]?.cantidad === 3, String(r.cuerpo?.carrito?.lineas?.[0]?.cantidad))

console.log('')
console.log('4. Dos carritos anonimos no se ven')
const otro = await pedir('/api/carrito', { method: 'GET' })
comprobar('el segundo nace vacio', otro.cuerpo?.carrito?.vacio === true)
comprobar('con token distinto', otro.token !== tokenA)
r = await pedir('/api/carrito', { method: 'GET' }, otro.token)
comprobar('y no ve lo del primero', r.cuerpo?.carrito?.lineas?.length === 0, String(r.cuerpo?.carrito?.lineas?.length))

console.log('')
console.log('5. No se borra lo ajeno')
{
  const conTokenAjeno = await pedir('/api/carrito', { method: 'POST', body: JSON.stringify({ producto_id: productoB, cantidad: 1 }) }, otro.token)
  const idLineaAjena = conTokenAjeno.cuerpo?.carrito?.lineas?.[0]?.id

  // Sin el corte que hay despues, un `id` que venga `undefined` se mandaria
  // como `{}` y el Worker lo interpretaria como "vaciar el carrito entero": la
  // prueba fallaria en la linea 5 y ademas en la 6 y en la 7, y el fallo real
  // quedaria enterrado debajo de tres errores que no son suyos.

  // El detalle enseña la respuesta ENTERA cuando algo no cuadra. Poner solo el
  // id daba un "undefined" que no dice si fallo la peticion, si la respuesta
  // vino con otra forma o si el producto ya no existe. Con el cuerpo a la vista
  // el motivo esta en la linea que fallo, no en tres mensajes despues.
  comprobar(
    'la linea ajena existe y trae id',
    Number.isInteger(idLineaAjena) && idLineaAjena > 0,
    `estado=${conTokenAjeno.status} cuerpo=${JSON.stringify(conTokenAjeno.cuerpo).slice(0, 240)}`,
  )
  if (!Number.isInteger(idLineaAjena) || idLineaAjena <= 0) {
    console.log('  (se para aqui: sin id de linea las tres comprobaciones siguientes no prueban nada)')
    console.log('')
    console.log(`=== ${pasadas} pruebas ok`)
    console.log('=== 1 FALLARON')
    process.exit(1)
  }

  const antes = await pedir('/api/carrito', { method: 'GET' }, tokenA)
  const lineasDelPrimero = antes.cuerpo?.carrito?.lineas?.length ?? 0

  const intento = await pedir('/api/carrito', { method: 'DELETE', body: JSON.stringify({ id: idLineaAjena }) }, tokenA)
  comprobar('el DELETE responde ok', intento.cuerpo?.ok === true, String(intento.status))
  comprobar('pero no borra la linea ajena', intento.cuerpo?.quitado === false, JSON.stringify(intento.cuerpo?.quitado))

  const despues = await pedir('/api/carrito', { method: 'GET' }, tokenA)
  comprobar('y el carrito ajeno sigue entero', (await pedir('/api/carrito', { method: 'GET' }, otro.token)).cuerpo?.carrito?.lineas?.length === 1)
  comprobar('y el propio tampoco', (despues.cuerpo?.carrito?.lineas?.length ?? 0) === lineasDelPrimero)
}

console.log('')
console.log('6. El precio se congela al anadir')
{
  sql(`UPDATE productos SET precio = 9999 WHERE id = ${productoA}`)

  const despues = await pedir('/api/carrito', { method: 'GET' }, tokenA)
  const linea = despues.cuerpo?.carrito?.lineas?.[0]
  comprobar('el carrito sigue con el precio viejo', linea?.precioUnitario === 2500, String(linea?.precioUnitario))
  comprobar('y avisa de que cambio', linea?.producto?.precioCambiado === true)
  comprobar('y ensena el nuevo', linea?.producto?.precioActual === 9999, String(linea?.producto?.precioActual))
  comprobar('y el carrito entero avisa', despues.cuerpo?.carrito?.hayAvisos === true)
}

console.log('')
console.log('7. Con sesion el carrito pasa a la cuenta')
{
  // La cabecera del carrito va TAMBIEN en el registro. No es un detalle del
  // cliente de pruebas: es lo que hacen `registrar` e `iniciarSesion` en
  // `src/lib/identidad-cliente.ts`. Sin ella, el servidor hace el volcado
  // correctamente y no ocurre nada, y quien se registra se encuentra el carrito
  // vacio. Esa prueba es la que vigila que el navegador siga mandandola.
  const registro = await pedir(
    '/api/registro',
    {
      method: 'POST',
      body: JSON.stringify({ email: 'prueba-carrito@example.test', nombre: 'Prueba Carrito', contrasena: CONTRASENA }),
    },
    tokenA,
  )
  const cookie = (registro.cookie ?? '').split(';')[0]
  comprobar('la cuenta se crea', registro.cuerpo?.ok === true, JSON.stringify(registro.cuerpo))

  const conSesion = await pedir('/api/carrito', { method: 'GET' }, tokenA, { Cookie: cookie })
  comprobar('y trae las lineas del carrito anonimo', conSesion.cuerpo?.carrito?.lineas?.length >= 1, String(conSesion.cuerpo?.carrito?.lineas?.length))
  comprobar('y ahora manda el token de la cuenta', (conSesion.token ?? '').length === 32)
}

console.log('')
console.log('8. Vaciar')
{
  const antes = await pedir('/api/carrito', { method: 'GET' }, tokenA)
  const lineas = antes.cuerpo?.carrito?.lineas?.length ?? 0

  const vacio = await pedir('/api/carrito', { method: 'DELETE', body: '{}' }, tokenA)
  comprobar('responde ok', vacio.cuerpo?.ok === true)
  comprobar('y el carrito queda vacio', vacio.cuerpo?.carrito?.vacio === true)
  comprobar('se han perdido todas las lineas', (vacio.cuerpo?.carrito?.lineas?.length ?? 0) === 0, `habia ${lineas}`)
}

console.log('')
console.log(`=== ${pasadas} pruebas ok`)
if (falladas > 0) {
  console.log(`=== ${falladas} FALLARON`)
  process.exit(1)
}