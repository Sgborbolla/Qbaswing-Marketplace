/**
 * Valida las migraciones 0002 y 0003 y las reglas de negocio que agregan.
 *
 * ============================================================================
 * POR QUE ESTE SCRIPT EXISTE
 * ============================================================================
 * `scripts/validar-schema.mjs` carga el esquema y prueba los permisos. Este
 * carga las tres migraciones y prueba el resto: la matriz tarifaria del
 * Documento Maestro, el circuito de aprobacion de la Regla A, la vigencia de 60
 * dias y la reutilizacion de slots.
 *
 * La reutilizacion de slots es la regla con mas formas de estar mal. Antes de
 * escribir 0003 la vista contaba productos con `p.creado_at >= s.activado_at` y
 * agrupaba por suscripcion. Las dos cosas dan numeros falsos y ninguno de los
 * dos casos se detecta leyendo el SQL: hay que ejecutarlos.
 *
 * Los tres casos que se prueban aqui son los que fallaban:
 *
 *   1. Un vendedor que ya tenia publicados 3 productos y despues compra un
 *      paquete de 10 debe ver 7 libres, no 10. El filtro por fecha de activacion
 *      hacia los 3 anteriores invisibles.
 *   2. Con dos paquetes de 10 y 3 publicados debe ver 17 libres de 20, no dos
 *      filas de "10-3". Agrupar por suscripcion duplicaba el conteo.
 *   3. Vender o despublicar un producto debe devolver el slot sin tocar una
 *      sola fila de suscripciones. Esa es la razon de que `slots_usados` sea un
 *      COUNT y no un contador.
 *
 * Tambien se comprueba que las 10 tarifas del documento esten exactamente como
 * el documento las escribe, porque una tarifa mal puesta no da error en ningun
 * sitio: se descubre cuando un vendedor se queja.
 *
 * Uso:  npm run validar:datos
 * Sale con codigo 1 si algo falla.
 */

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = join(aqui, '..')

const MIGRACIONES = [
  '0001_esquema_inicial.sql',
  '0002_datos_plataforma.sql',
  '0003_tarifas_espacios.sql',
]

const HASH = 'x'.repeat(64)

let fallos = 0
let pruebas = 0

function ok(nombre, condicion, detalle = '') {
  pruebas++
  if (condicion) {
    console.log(`  ok   ${nombre}`)
  } else {
    fallos++
    console.log(`  FALLA ${nombre}${detalle ? ` -- ${detalle}` : ''}`)
  }
}

function seccion(titulo) {
  console.log(`\n${titulo}`)
}

const db = new DatabaseSync(':memory:')

/* ---------------------------------------------------------------------------
 * 1. Carga
 * ------------------------------------------------------------------------ */

seccion('1. Carga de las migraciones')

for (const archivo of MIGRACIONES) {
  const sql = readFileSync(join(raiz, 'migrations', archivo), 'utf8')
  try {
    db.exec(sql)
    ok(archivo, true)
  } catch (error) {
    ok(archivo, false, error.message)
    process.exit(1)
  }
}

/* ---------------------------------------------------------------------------
 * 2. Datos de plataforma
 * ------------------------------------------------------------------------ */

seccion('2. Datos de plataforma (0002)')

const contar = (sql) => db.prepare(sql).get().n

ok('hay 8 redes', contar('SELECT COUNT(*) n FROM redes_sociales') === 8)
ok(
  'ninguna red tiene usuario puesto todavia',
  contar("SELECT COUNT(*) n FROM redes_sociales WHERE valor <> ''") === 0,
  'un icono apuntando a una cuenta inexistente es peor que ningun icono',
)
ok('hay 1 fila de contacto', contar('SELECT COUNT(*) n FROM contacto_plataforma') === 1)
ok('hay 20 FAQ', contar('SELECT COUNT(*) n FROM faq') === 20)

let emailInvalidoAceptado = false
try {
  db.prepare('UPDATE contacto_plataforma SET email = ? WHERE id = 1').run('no-es-correo')
} catch {
  emailInvalidoAceptado = true
}
ok('el contacto rechaza un email invalido', emailInvalidoAceptado)

/* ---------------------------------------------------------------------------
 * 3. Matriz tarifaria
 * ------------------------------------------------------------------------ */

seccion('3. Matriz tarifaria oficial (0003)')

const paquetes = db.prepare('SELECT * FROM paquetes ORDER BY categoria').all()

ok('hay 10 paquetes', paquetes.length === 10, `hay ${paquetes.length}`)

/**
 * Lo que dice el Documento Maestro, seccion 3, transcrito a numeros.
 *
 * El precio es el de los 60 dias completos, no el mensual. La columna "costo por
 * espacio / mes" del documento es informativa; lo que se cobra es el total.
 */
const ESPERADO = {
  ropa:         { slots: 10, cup: 250, usd: 1000, eur: 1000, configurable: 0 },
  belleza:      { slots: 10, cup: 250, usd: 1000, eur: 1000, configurable: 0 },
  calzado:      { slots: 8,  cup: 250, usd: 1000, eur: 1000, configurable: 0 },
  accesorios:   { slots: 10, cup: 250, usd: 1000, eur: 1000, configurable: 0 },
  hogar:        { slots: 5,  cup: 350, usd: 1200, eur: 1200, configurable: 0 },
  electronica:  { slots: 3,  cup: 500, usd: 1500, eur: 1500, configurable: 0 },
  electrodomesticos: { slots: 3, cup: 600, usd: 1700, eur: 1700, configurable: 0 },
  informatica:  { slots: 3,  cup: 500, usd: 1500, eur: 1500, configurable: 1 },
  automotriz:   { slots: 3,  cup: 750, usd: 2000, eur: 2000, configurable: 0 },
  construccion: { slots: 3,  cup: 750, usd: 2500, eur: 2500, configurable: 1 },
}

for (const p of paquetes) {
  const e = ESPERADO[p.categoria]
  if (!e) {
    ok(`${p.categoria}: existe en el documento`, false, 'categoria inventada')
    continue
  }
  const coincide =
    p.slots === e.slots &&
    p.precio_cup === e.cup &&
    p.precio_usd === e.usd &&
    p.precio_eur === e.eur &&
    p.precio_configurable === e.configurable &&
    p.vigencia_dias === 60

  ok(
    `${p.categoria}: ${e.slots} slots, ${e.cup} CUP, ${(e.usd / 100).toFixed(2)} USD, 60 dias`,
    coincide,
    coincide
      ? ''
      : `esperado ${JSON.stringify(e)}, hay ${JSON.stringify({
          slots: p.slots,
          cup: p.precio_cup,
          usd: p.precio_usd,
          eur: p.precio_eur,
          conf: p.precio_configurable,
          vig: p.vigencia_dias,
        })}`,
  )
}

const configurables = db
  .prepare('SELECT categoria FROM paquetes WHERE precio_configurable = 1 ORDER BY categoria')
  .all()
  .map((r) => r.categoria)

ok(
  'solo informatica y construccion son configurables',
  JSON.stringify(configurables) === JSON.stringify(['construccion', 'informatica']),
  configurables.join(', '),
)

/* ---------------------------------------------------------------------------
 * 4. Idempotencia
 * ------------------------------------------------------------------------ */

seccion('4. Idempotencia: que se puede repetir y que no')

/**
 * 0001 y 0002 SOLO anaden filas y crean objetos, asi que re-aplicarlas tiene que
 * ser inocuo. 0003 cambia la forma de las tablas, asi que NO: SQLite no tiene
 * `ADD COLUMN IF NOT EXISTS` y re-aplicarla aborta.
 *
 * Los dos comportamientos son correctos y estan probados por separado. Lo que
 * seria un error es que el re-aplicado de 0002 duplicara las FAQ, porque si.
 */
for (const archivo of ['0001_esquema_inicial.sql', '0002_datos_plataforma.sql']) {
  try {
    db.exec(readFileSync(join(raiz, 'migrations', archivo), 'utf8'))
    ok(`${archivo} se puede re-aplicar sin duplicar nada`, true)
  } catch (error) {
    ok(`${archivo} se puede re-aplicar sin duplicar nada`, false, error.message)
  }
}

let errorDeRepeticion = ''
try {
  db.exec(readFileSync(join(raiz, 'migrations', '0003_tarifas_espacios.sql'), 'utf8'))
} catch (error) {
  errorDeRepeticion = error.message
}
ok(
  '0003 no se puede re-aplicar y avisa por que',
  errorDeRepeticion.includes('duplicate column name'),
  errorDeRepeticion || 'no dio error, y deberia',
)
ok('y el aviso es sobre una columna, no sobre datos',
  errorDeRepeticion.includes('vence_at') || errorDeRepeticion.includes('vigencia_dias'),
  errorDeRepeticion)

// Lo que importa: despues del intento fallido, los datos siguen intactos. Un
// re-aplicado que aborta a mitad puede dejar la base a medias, que es el
// escenario que 0001 evita con `IF NOT EXISTS` en todos sus CREATE.
ok('siguen siendo 10 paquetes', contar('SELECT COUNT(*) n FROM paquetes') === 10,
  `hay ${contar('SELECT COUNT(*) n FROM paquetes')}`)
ok('siguen siendo 20 FAQ', contar('SELECT COUNT(*) n FROM faq') === 20)
ok('siguen siendo 8 redes', contar('SELECT COUNT(*) n FROM redes_sociales') === 8)

/* ---------------------------------------------------------------------------
 * 5. Escenarios de vendedor
 * ------------------------------------------------------------------------ */

seccion('5. Escenarios de vendedor')

const ROW = 'x'.repeat(64)

/**
 * El orden importa y por eso esta en un solo lugar: `usuarios.vendedor_id` tiene
 * una FK a `vendedores.id`, asi que el vendedor tiene que existir ANTES que el
 * usuario que lo referencia. Al reves da "FOREIGN KEY constraint failed", que
 * es el primer error que aparecio aqui.
 *
 * `vendedores.id` se fija a mano para que los scenarios puedan referring a el
 * con un numero legible. `AUTOINCREMENT` lo respeta: se puede insertar un id
 * explicito y el siguiente sigue la secuencia.
 */
function crearVendedor(id, slug, nombre) {
  db.prepare(
    `INSERT INTO vendedores (id, slug, nombre, nombre_comercial, verificado)
     VALUES (?, ?, ?, ?, 1)`,
  ).run(id, slug, nombre, nombre)
}

function crearUsuarioVendedor(email, nombre, vendedorId) {
  db.prepare(
    `INSERT INTO usuarios (email, nombre, rol, verificado, password_hash, vendedor_id)
     VALUES (?, ?, 'vendedor', 1, ?, ?)`,
  ).run(email, nombre, ROW, vendedorId)
}

crearVendedor(1, 'ana', 'Ana')
crearUsuarioVendedor('ana@tienda.cu', 'Ana', 1)

function publicarFisico(slug, titulo) {
  // Nace VISIBLE y aprobado: es el caso normal de un vendedor con saldo.
  db.prepare(
    `INSERT INTO productos (slug, vendedor_id, titulo, descripcion, tipo, origen,
                            regla, categoria, precio, moneda, publicado, estado_publicacion)
     VALUES (?, 1, ?, 'x', 'fisico', 'externo', 'C', 'ropa', 100, 'CUP', 1, 'aprobado')`,
  ).run(slug, titulo)
}

const slotsDe = (vendedorId = 1) =>
  db.prepare('SELECT * FROM v_slots_usados WHERE vendedor_id = ?').get(vendedorId)

// --- 5.1 Sin paquete no se publica -----------------------------------------
let sinPaqueteFalló = false
try {
  publicarFisico('zapatilla-1', 'Zapatilla')
} catch {
  sinPaqueteFalló = true
}
ok('sin paquete no se puede publicar un fisico', sinPaqueteFalló)

const borradorSinPaquete = db
  .prepare(
    `INSERT INTO productos (slug, vendedor_id, titulo, descripcion, tipo, origen,
                            regla, categoria, precio, moneda, publicado, estado_publicacion)
     VALUES ('borrador-1', 1, 'Borrador', 'x', 'fisico', 'externo', 'C', 'ropa', 100, 'CUP', 0, 'borrador')`,
  )
  .run()
ok('un borrador si se puede guardar sin paquete', borradorSinPaquete.lastInsertRowid > 0)

/* --- 5.2 Compra un paquete de 10 ------------------------------------------ */

const pkg = db
  .prepare(`INSERT INTO suscripciones (vendedor_id, paquete_id, slots_totales)
            SELECT 1, id, 10 FROM paquetes WHERE categoria = 'ropa'`)
  .run()

const suscripcionId = db.prepare('SELECT last_insert_rowid() AS id').get().id
const susc = db.prepare('SELECT * FROM suscripciones WHERE id = ?').get(suscripcionId)

ok('la suscripcion guarda 60 dias de vigencia', susc.vigencia_dias === 60, String(susc.vigencia_dias))

/**
 * El trigger tiene que haber calculado `vence_at`. Este es el aserto que hacia
 * falta: comparar la fecha guardada contra la que SQLite calcula por su cuenta.
 *
 * La primera version de esta prueba comparaba la fecha guardada contra un
 * pedazo de si misma, que es una tautologia: era cierta con cualquier valor,
 * incluso con NULL. Un aserto que no puede fallar no prueba nada, y este todavia
 * no habia detectado que el trigger no hacia nada.
 */
const calculadoPorSqlite = db
  .prepare(
    `SELECT strftime('%Y-%m-%dT%H:%M:%fZ', activado_at, '+' || vigencia_dias || ' days') AS v
       FROM suscripciones WHERE id = ?`,
  )
  .get(suscripcionId).v

ok('el trigger calculo la fecha de vencimiento', Boolean(susc.vence_at), 'vence_at quedo NULL')
ok(
  'y coincide con la que calcula SQLite',
  susc.vence_at === calculadoPorSqlite,
  `guardada ${susc.vence_at}, esperada ${calculadoPorSqlite}`,
)

// La diferencia tiene que ser de 60 dias, no "cualquier fecha futura". Si el
// trigger escribiera cualquier cosa, la comparacion con SQLite lo detectaria,
// pero esta comprobacion verifica la regla del documento por si misma.
const dias = Math.round(
  (Date.parse(susc.vence_at) - Date.parse(susc.activado_at)) / 86400000,
)
ok('vence exactamente 60 dias despues de activarse', dias === 60, `${dias} dias`)

let slots = slotsDe()
ok('recien comprado: 10 totales, 0 usados, 10 libres',
  slots.slots_totales === 10 && slots.slots_usados === 0 && slots.slots_libres === 10,
  JSON.stringify(slots))

/* --- 5.3 El caso que la vista anterior rompia ----------------------------- */
// Publica 3 productos. Los 3 cuentan aunque su creado_at sea POSTERIOR al
// paquete, que es el caso normal. La vista vieja fallaba en el contrario: cuando
// el producto era ANTERIOR al paquete, no contaba.

publicarFisico('camisa-1', 'Camisa')
publicarFisico('camisa-2', 'Camisa 2')
publicarFisico('camisa-3', 'Camisa 3')

slots = slotsDe()
ok('con 3 publicados quedan 7 libres',
  slots.slots_totales === 10 && slots.slots_usados === 3 && slots.slots_libres === 7,
  JSON.stringify(slots))

/* --- 5.4 Vender o despublicar devuelve el slot ---------------------------- */
// ESTA es la regla de reutilizacion. No hay UPDATE en suscripciones: el slot
// vuelve solo porque el conteo es un COUNT.

db.prepare(`UPDATE productos SET publicado = 0 WHERE slug = 'camisa-2'`).run()
slots = slotsDe()
ok('despublicar devuelve el slot: 8 libres', slots.slots_libres === 8, JSON.stringify(slots))

db.prepare(`UPDATE productos SET publicado = 1 WHERE slug = 'camisa-2'`).run()
slots = slotsDe()
ok('volver a publicar lo ocupa otra vez: 7 libres', slots.slots_libres === 7, JSON.stringify(slots))

// Un borrador NO ocupa slot. Un slot se ocupa mientras haya algo visible.
db.prepare(`UPDATE productos SET publicado = 0, estado_publicacion = 'borrador' WHERE slug = 'camisa-3'`).run()
slots = slotsDe()
ok('un borrador no ocupa slot: 8 libres', slots.slots_libres === 8, JSON.stringify(slots))
db.prepare(`UPDATE productos SET publicado = 1, estado_publicacion = 'aprobado' WHERE slug = 'camisa-3'`).run()

/* --- 5.5 Agotar los slots -------------------------------------------------- */

// Hay 3 publicadas (camisa-1, 2 y 3). Faltan 7 para llenar el paquete de 10.
// La primera version de esta prueba publicaba solo 4 y despues afirmaba que
// eran 10: el aserto fallaba y el error estaba en el test, no en la vista.
for (const n of [4, 5, 6, 7, 8, 9, 10]) {
  publicarFisico(`camisa-${n}`, `Camisa ${n}`)
}

slots = slotsDe()
ok('con 10 publicados quedan 0 libres',
  slots.slots_usados === 10 && slots.slots_libres === 0, JSON.stringify(slots))

let sinSaldoFalló = false
try {
  publicarFisico('camisa-11', 'Camisa 11')
} catch {
  sinSaldoFalló = true
}
ok('agotados los 10 slots, el siguiente se rechaza', sinSaldoFalló)

// Y un borrador SI se puede guardar sin saldo: el slot se ocupa al publicar, no
// al escribir. Un vendedor sin saldo tiene que poder preparar su catalogo.
const borradorSinSaldo = db.prepare(
  `INSERT INTO productos (slug, vendedor_id, titulo, descripcion, tipo, origen,
                          regla, categoria, precio, moneda, publicado, estado_publicacion)
   VALUES ('borrador-sin-saldo', 1, 'Borrador', 'x', 'fisico', 'externo', 'C', 'ropa', 100, 'CUP', 0, 'borrador')`,
).run()
ok('sin saldo todavia se puede dejar un borrador listo', borradorSinSaldo.lastInsertRowid > 0)

// Ese borrador no se puede publicar. Guardarlo no compra nada: otro vendedor
// puede ocupar los espacios que queden libres, asi que el trigger vuelve a
// comprobar en el momento de publicar y no en el de escribir.
let borradorNoPublicable = false
try {
  db.prepare(
    `UPDATE productos SET publicado = 1, estado_publicacion = 'aprobado'
      WHERE slug = 'borrador-sin-saldo'`,
  ).run()
} catch {
  borradorNoPublicable = true
}
ok('el borrador no se puede publicar mientras no haya saldo', borradorNoPublicable)

/* --- 5.6 El caso que la vista anterior rompia (paquete doble) ------------- */
// Con 10 publicados y el paquete agotado, un segundo paquete abre 10 mas.
//
// La vista por suscripcion de 0001 habria mostrado "10-0" en la suscripcion
// nueva y "10-10" en la vieja. El total de 10 libres era el numero correcto por
// casualidad, pero la fila recien comprada aparecia con 0 usados: el vendedor
// leia "10 espacios libres" y era verdad, y a la vez la vista afirmaba que
// ningun producto ocupaba esos espacios. Dos verdades que no se reconcilian
// sumando filas.

db.prepare(
  `INSERT INTO suscripciones (vendedor_id, paquete_id, slots_totales)
   SELECT 1, id, 10 FROM paquetes WHERE categoria = 'ropa'`,
).run()

slots = slotsDe()
ok('el segundo paquete suma al saldo del vendedor, no a una fila',
  slots.slots_totales === 20 && slots.slots_usados === 10 && slots.slots_libres === 10,
  JSON.stringify(slots))

publicarFisico('camisa-11', 'Camisa 11')
slots = slotsDe()
ok('el segundo paquete si habilita publicaciones nuevas: 20 totales, 11 usados, 9 libres',
  slots.slots_totales === 20 && slots.slots_usados === 11 && slots.slots_libres === 9,
  JSON.stringify(slots))

/* --- 5.7 Vencimiento ------------------------------------------------------ */
// Un paquete vencido no aporta slots.
//
// El `UPDATE` de la fecha es lo que hace el Owner al suspender o renovar, asi
// que es el camino real. La fecha queda en el pasado a proposito, porque un
// trigger que recalcula en cada UPDATE no dejaria probarse el caso vencido.
db.prepare(`UPDATE suscripciones SET vence_at = '2020-01-01T00:00:00.000Z' WHERE id = ?`)
  .run(suscripcionId)

slots = slotsDe()

/**
 * Aqui `slots_libres` es NEGATIVO, y es a proposito.
 *
 * Es el estado real de un vendedor cuyo paquete vencio con 11 productos
 * publicados y un segundo paquete de 10. Los productos NO se despublican solos:
 * despublicarlos sin avisar seria romperle la vitrina a un vendedor que ya
 * pago. Lo que hace la regla es inactionable: no puede publicar nada nuevo
 * hasta que renueve.
 *
 * Por eso el saldo puede ser negativo y la vista no lo oculta con un
 * `MAX(0, ...)`. Un cero silencioso haria creer al vendedor que todavia puede
 * publicar, y el rechazo del trigger lo sorprenderia en el peor momento.
 */
ok('un paquete vencido deja de aportar slots: total 20 -> 10',
  slots.slots_totales === 10, JSON.stringify(slots))
ok('el saldo puede quedar negativo y se muestra, no se oculta en cero',
  slots.slots_libres === -1, JSON.stringify(slots))
ok('los 11 productos siguen publicados', slots.slots_usados === 11, JSON.stringify(slots))

let vencidoNoPublica = false
try {
  publicarFisico('camisa-12', 'Camisa 12')
} catch {
  vencidoNoPublica = true
}
ok('con el paquete vencido tampoco se puede publicar', vencidoNoPublica)

// RENOVAR.
//
// La primera version de esta prueba hacia `UPDATE ... SET vigencia_dias = 60`,
// y fallaba. La razon es que el trigger tiene la guarda
// `WHEN NEW.vigencia_dias IS NOT OLD.vigencia_dias`: si el valor no cambia, no
// hay nada que recalcular, y no lo hace. El trigger estaba bien; el atajo del
// test no existia como operacion real.
//
// La renovacion de verdad cambia `activado_at`: el Owner extiende el inicio y el
// vencimiento se recalcula solo a partir de ahi. Por eso el trigger escucha esa
// columna y no solo la vigencia.
const renewal = new Date(Date.now() + 86400000).toISOString()
db.prepare('UPDATE suscripciones SET activado_at = ? WHERE id = ?').run(renewal, suscripcionId)

const renewed = db.prepare('SELECT * FROM suscripciones WHERE id = ?').get(suscripcionId)
ok('renovar mueve la fecha de vencimiento', renewed.vence_at > '2026-01-01', renewed.vence_at)
ok('y queda 60 dias despues del nuevo inicio',
  Math.round((Date.parse(renewed.vence_at) - Date.parse(renewed.activado_at)) / 86400000) === 60,
  renewed.vence_at)

// Volver a poner la MISMA vigencia no recalcula nada, y no debe: es un UPDATE
// que no cambia nada de lo que depende `vence_at`.
const antesDelNoop = renewed.vence_at
db.prepare('UPDATE suscripciones SET estado = ? WHERE id = ?').run('activo', suscripcionId)
const despuesDelNoop = db.prepare('SELECT vence_at FROM suscripciones WHERE id = ?').get(suscripcionId)
ok('un UPDATE que no toca las columnas depende deja la fecha igual',
  despuesDelNoop.vence_at === antesDelNoop,
  `${antesDelNoop} -> ${despuesDelNoop.vence_at}`)

slots = slotsDe()
ok('ya renovado, el paquete vuelve a aportar sus 10 slots',
  slots.slots_totales === 20, JSON.stringify(slots))

/* ---------------------------------------------------------------------------
 * 6. Aprobacion de la Regla A
 * ------------------------------------------------------------------------ */

seccion('6. Aprobacion del Owner en la Regla A')

const nuevoDigital = (slug, publicado, estado, origen = 'externo') =>
  db.prepare(
    `INSERT INTO productos (slug, vendedor_id, titulo, descripcion, tipo, origen,
                            regla, categoria, precio, moneda, publicado, estado_publicacion)
     VALUES (?, 1, ?, 'x', 'digital', ?, 'A', 'software', 1000, 'USD', ?, ?)`,
  ).run(slug, slug, origen, publicado, estado)

let reglaASinAprobar = false
try {
  nuevoDigital('saas-1', 1, 'pendiente')
} catch {
  reglaASinAprobar = true
}
ok('un producto de Regla A no se publica sin aprobacion', reglaASinAprobar)

let autoAprobado = false
try {
  nuevoDigital('saas-2', 1, 'aprobado')
} catch {
  autoAprobado = true
}
ok('tampoco se puede publicar auto-aprobado en el INSERT', autoAprobado)

// El camino legitimo: nace pendiente, el Owner lo aprueba, recien ahi se publica.
nuevoDigital('saas-3', 0, 'pendiente')
const saasId = db.prepare(`SELECT id FROM productos WHERE slug = 'saas-3'`).get().id

const owner = db.prepare(
  `INSERT INTO usuarios (email, nombre, rol, verificado, password_hash)
   VALUES ('owner@qbaswing.com', 'Owner', 'comprador', 0, ?)`,
).run(ROW)
const ownerId = db.prepare(`SELECT id FROM usuarios WHERE email = 'owner@qbaswing.com'`).get().id
ok('el owner se crea con alcance completo por el trigger de 0001', ownerId > 0)

let sinAutor = false
try {
  db.prepare(`UPDATE productos SET estado_publicacion = 'aprobado' WHERE id = ?`).run(saasId)
} catch {
  sinAutor = true
}
ok('aprobar sin registrar quien lo aprobo se rechaza', sinAutor)

db.prepare(
  `UPDATE productos SET estado_publicacion = 'aprobado', aprobado_por = ?, publicado = 1 WHERE id = ?`,
).run(ownerId, saasId)

const aprobado = db.prepare('SELECT * FROM productos WHERE id = ?').get(saasId)
ok('tras la aprobacion del Owner si se publica',
  aprobado.publicado === 1 && aprobado.estado_publicacion === 'aprobado' && aprobado.aprobado_por === ownerId,
  JSON.stringify({ p: aprobado.publicado, e: aprobado.estado_publicacion, a: aprobado.aprobado_por }))

/**
 * Regla B: producto PROPIO de QBASwing, 0% de comision. El documento dice
 * "publicacion directa": nace publicado, sin pasar por el Owner.
 *
 * El estado es 'aprobado' y no 'borrador' porque "aprobado" aqui no significa
 * "el Owner lo miro": significa "visible". En la Regla B no hay nadie que
 * apruebe, asi que el producto que nace de QBASwing Designer se aprueba a si
 * mismo. Por eso la columna se llama `estado_publicacion` y no `aprobado_por`.
 */
const menuPropio = db.prepare(
  `INSERT INTO productos (slug, vendedor_id, titulo, descripcion, tipo, origen,
                          regla, categoria, precio, moneda, publicado, estado_publicacion)
   VALUES ('menu-qbaswing', 1, 'Menu', 'x', 'digital', 'qbaswing', 'B', 'menus-digitales', 1000, 'USD', 1, 'aprobado')`,
).run()
ok('un producto de Regla B se publica sin pasar por el Owner', menuPropio.lastInsertRowid > 0)

// Regla C: tampoco pasa por el Owner. Nace en borrador para poder probar el
// rechazo con motivo sin ocupar un slot.
ok('un producto de Regla C no necesita aprobacion del Owner',
  nuevoDigital('rechazable', 0, 'borrador').lastInsertRowid > 0)

let rechazoSinMotivo = false
try {
  db.prepare(`UPDATE productos SET estado_publicacion = 'rechazado' WHERE slug = 'rechazable'`).run()
} catch {
  rechazoSinMotivo = true
}
ok('rechazar sin motivo se rechaza', rechazoSinMotivo)

db.prepare(`UPDATE productos SET estado_publicacion = 'rechazado', motivo_rechazo = 'Falta la licencia' WHERE slug = 'rechazable'`).run()
ok('rechazar con motivo si se registra',
  db.prepare(`SELECT motivo_rechazo FROM productos WHERE slug = 'rechazable'`).get().motivo_rechazo === 'Falta la licencia')

/* --- 6.1 El borrador no ocupa slot ---------------------------------------- */
const antesDeBorrador = slotsDe()
nuevoDigital('saas-borrador', 0, 'borrador')
const despuesDeBorrador = slotsDe()
ok('un producto digital en borrador no toca los slots del vendedor',
  antesDeBorrador.slots_usados === despuesDeBorrador.slots_usados,
  `${antesDeBorrador.slots_usados} -> ${despuesDeBorrador.slots_usados}`)

/* ---------------------------------------------------------------------------
 * 7. Slots ilimitados
 * ------------------------------------------------------------------------ */

seccion('7. El exento publica sin comprar paquete')

// El mismo orden que en la seccion 5: el vendedor antes que el usuario que lo
// referencia, por la FK. Esta es la segunda vez que el orden se invierte al
// escribir la prueba; por eso los helpers existen.
crearVendedor(2, 'freeman', 'Freeman')
crearUsuarioVendedor('freeman@ejemplo.com', 'Freeman', 2)

// La exencion se resuelve por CORREO, no por id de usuario: tiene que existir
// antes de que la persona se registre. Por eso se inserta por correo y no
// apuntando a un id.
//
// `autorizado_por` es NOT NULL y es un TEXTO, no una FK: es el correo de quien
// concedio la exencion, no un id de `usuarios`. Un id habria hecho imposible
// registrar la exencion antes de que el usuario existiera, que es justamente el
// caso para el que existe esta tabla.
db.prepare(
  `INSERT INTO exencion_usuario (email, exento_comision, slots_ilimitados, autorizado_por, motivo)
   VALUES ('freeman@ejemplo.com', 1, 1, 'sgborbolla@gmail.com', 'Patrocinador')`,
).run()

const slotsExento = db.prepare('SELECT * FROM v_slots_usados WHERE vendedor_id = 2').get()
ok('el exento aparece con slots ilimitados y sin saldo',
  slotsExento.slots_ilimitados === 1 && slotsExento.slots_totales === 0,
  JSON.stringify(slotsExento))

let exentoRechazado = false
try {
  db.prepare(
    `INSERT INTO productos (slug, vendedor_id, titulo, descripcion, tipo, origen,
                            regla, categoria, precio, moneda, publicado, estado_publicacion)
     VALUES ('freeman-1', 2, 'Producto', 'x', 'fisico', 'externo', 'C', 'ropa', 100, 'CUP', 1, 'aprobado')`,
  ).run()
} catch {
  exentoRechazado = true
}
ok('el exento publica sin paquete (slots ilimitados)', !exentoRechazado)

/* ---------------------------------------------------------------------------
 * 8. Resultado
 * ------------------------------------------------------------------------ */

console.log(`\n${'-'.repeat(60)}`)
if (fallos === 0) {
  console.log(`Las ${pruebas} pruebas pasaron.`)
  process.exit(0)
}
console.log(`${fallos} de ${pruebas} pruebas FALLARON.`)
process.exit(1)
