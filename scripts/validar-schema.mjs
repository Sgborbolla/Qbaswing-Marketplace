/**
 * Valida db/schema.sql contra un SQLite real, en memoria.
 *
 * ============================================================================
 * POR QUE ESTE SCRIPT EXISTE
 * ============================================================================
 * El esquema tiene triggers, CHECK y FK. Nada de eso se comprueba leyendo el
 * archivo: un `;` de mas, una coma que falta o un `CHECK` que referencia una
 * tabla declarada despues son errores que solo aparecen cuando D1 intenta
 * aplicar el esquema en produccion, que es el peor momento posible.
 *
 * Ademas hace lo que un `sqlite3 schema.sql` no alcanza: verificar las
 * ASERCIONES. Que el esquema cargue no dice nada de si hace lo que dice. Por eso
 * despues de aplicar el esquema se ejecutan pruebas que fallan si una regla de
 * negocio se rompio: por ejemplo, que un POST de registro con rol='owner' sea
 * rechazado, que un correo preautorizado reciba el rol solo, y que los dos
 * exentos queden con las dos banderas en 1.
 *
 * UN SOLO ARCHIVO, DOS USOS
 * El esquema vive en `migrations/0001_esquema_inicial.sql` y no en un
 * `db/schema.sql` mas una copia en `migrations/`. Antes eran dos archivos
 * identicos, y dos archivos identicos divergen: uno se editaba y el otro se
 * quedaba atras, sin que nada avisara. El directorio tiene que llamarse
 * `migrations/` porque D1 no admite `migrations_dir` en el `.toml`; dentro, el
 * archivo es a la vez la migracion que aplica Wrangler y la documentacion que
 * se lee para entender el modelo.
 *
 * Uso:  npm run validar
 * Sale con codigo 1 si algo falla.
 */

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const rutaEsquema = join(aqui, '..', 'migrations', '0001_esquema_inicial.sql')

const Owners = {
  creador: 'sgborbolla@gmail.com',
  patrocinador: 'frankfreemansariol2016@gmail.com',
}

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

/* ---------------------------------------------------------------------------
 * 1. Cargar el esquema
 * ------------------------------------------------------------------------ */

seccion('1. Carga del esquema')

const db = new DatabaseSync(':memory:')
const sql = readFileSync(rutaEsquema, 'utf8')

try {
  db.exec(sql)
  console.log('  ok   schema.sql se ejecuto completo')
  pruebas++
} catch (error) {
  console.error(`  FALLA el esquema no se pudo aplicar: ${error.message}`)
  process.exit(1)
}

/* ---------------------------------------------------------------------------
 * 2. Lo que tiene que existir
 * ------------------------------------------------------------------------ */

seccion('2. Objetos que tienen que existir')

const tablas = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
  .all()
  .map((r) => r.name)

for (const t of [
  'usuarios',
  'owner_registro_preautorizado',
  'exencion_usuario',
  'configuracion',
  'vendedores',
  'webhooks_recibidos',
]) {
  ok(`tabla ${t}`, tablas.includes(t))
}

const triggers = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger'`)
  .all()
  .map((r) => r.name)

ok(
  'trigger anti-autopromocion',
  triggers.includes('trg_usuarios_no_autopromocion'),
  `triggers actuales: ${triggers.join(', ')}`,
)

/* ---------------------------------------------------------------------------
 * 3. Permisos: solo el creador es owner
 * ------------------------------------------------------------------------ */

seccion('3. El unico owner es el creador')

const ownerRows = db
  .prepare(`SELECT email, alcance FROM owner_registro_preautorizado WHERE activo = 1`)
  .all()

ok('hay exactamente 1 owner registrado', ownerRows.length === 1, `hay ${ownerRows.length}`)
ok(
  'el owner es sgborbolla',
  ownerRows[0]?.email === Owners.creador,
  `es ${ownerRows[0]?.email}`,
)
ok('el owner tiene alcance completo', ownerRows[0]?.alcance === 'completo')

ok(
  'el patrocinador NO esta en la tabla de owners',
  !ownerRows.some((r) => r.email === Owners.patrocinador),
  'si aparece, habria que quitarlo de owner_registro_preautorizado',
)

/* ---------------------------------------------------------------------------
 * 4. Exenciones: mismo trato economico para los dos
 * ------------------------------------------------------------------------ */

seccion('4. Exenciones economicas')

const exentos = db
  .prepare(
    `SELECT email, exento_comision, slots_ilimitados FROM exencion_usuario WHERE activo = 1
     ORDER BY email`,
  )
  .all()

ok('hay 2 exentos', exentos.length === 2, `hay ${exentos.length}`)

for (const email of [Owners.creador, Owners.patrocinador]) {
  const fila = exentos.find((e) => e.email === email)
  ok(`${email} exento de comision`, fila?.exento_comision === 1)
  ok(`${email} con slots ilimitados`, fila?.slots_ilimitados === 1)
}

/* ---------------------------------------------------------------------------
 * 5. Un usuario corriente paga: es el caso que no debe romperse
 * ------------------------------------------------------------------------ */

seccion('5. Un usuario corriente NO esta exento')

/**
 * `password_hash` es NOT NULL. No se pone un hash de verdad porque a este
 * script no le importa la contrasena: le importa que el alta sea legal. Lo que
 * se prueba es el ROL y la EXENCION, que es donde esta la logica que importa.
 */
const HASH = 'x'.repeat(64)

db.prepare(
  `INSERT INTO usuarios (email, nombre, rol, verificado, password_hash)
   VALUES ('cliente@ejemplo.com', 'Cliente', 'comprador', 1, ?)`,
).run(HASH)

const huerfano = db
  .prepare(`SELECT COUNT(*) AS n FROM exencion_usuario WHERE email = 'cliente@ejemplo.com'`)
  .get()
ok('no tiene exencion', huerfano.n === 0)

/* ---------------------------------------------------------------------------
 * 6. Alta de los dos correos y lo que cada uno recibe
 * ------------------------------------------------------------------------ */

seccion('6. Registro: el creador entra como owner')

db.prepare(
  `INSERT INTO usuarios (email, nombre, rol, verificado, password_hash)
   VALUES (?, 'Creador', 'comprador', 0, ?)`,
).run(Owners.creador, HASH)

const creador = db.prepare(`SELECT rol, verificado FROM usuarios WHERE email = ?`).get(Owners.creador)
ok('el creador recibio rol owner', creador.rol === 'owner', `rol=${creador.rol}`)
ok('el creador quedo verificado', creador.verificado === 1)

seccion('7. Registro: el patrocinador entra como usuario comun')

db.prepare(
  `INSERT INTO usuarios (email, nombre, rol, verificado, password_hash)
   VALUES (?, 'Patrocinador', 'comprador', 0, ?)`,
).run(Owners.patrocinador, HASH)

const patrocinador = db
  .prepare(`SELECT rol, verificado FROM usuarios WHERE email = ?`)
  .get(Owners.patrocinador)
ok('el patrocinador NO recibio owner', patrocinador.rol !== 'owner', `rol=${patrocinador.rol}`)
ok('el patrocinador quedo como comprador', patrocinador.rol === 'comprador', `rol=${patrocinador.rol}`)
ok('el patrocinador no quedo auto-verificado', patrocinador.verificado === 0)

/* ---------------------------------------------------------------------------
 * 8. Nadie mas puede autopromoverse
 * ------------------------------------------------------------------------ */

seccion('8. La autopromocion falla')

let promoFalló = false
try {
  db.prepare(
    `INSERT INTO usuarios (email, nombre, rol, verificado, password_hash)
     VALUES ('atrevido@ejemplo.com', 'Atrevido', 'owner', 1, ?)`,
  ).run(HASH)
} catch {
  promoFalló = true
}
ok('INSERT con rol owner sin autorizacion fue rechazado', promoFalló)

let updateFalló = false
try {
  db.prepare(`UPDATE usuarios SET rol = 'owner' WHERE email = 'cliente@ejemplo.com'`).run()
} catch {
  updateFalló = true
}
ok('UPDATE a owner sin autorizacion fue rechazado', updateFalló)

const sinPermiso = db.prepare(`SELECT rol FROM usuarios WHERE email = 'cliente@ejemplo.com'`).get()
ok('el usuario corriente sigue siendo comprador', sinPermiso.rol === 'comprador', `rol=${sinPermiso.rol}`)

/* ---------------------------------------------------------------------------
 * 9. Idempotencia: re-aplicar el esquema no rompe nada
 * ------------------------------------------------------------------------ */

seccion('9. Re-aplicar el esquema es seguro')

try {
  db.exec(sql)
  ok('el esquema se aplico dos veces sin error', true)
} catch (error) {
  ok('el esquema se aplico dos veces sin error', false, error.message)
}

const ownersFinales = db
  .prepare(`SELECT COUNT(*) AS n FROM owner_registro_preautorizado`)
  .get()
ok('sigue habiendo 1 owner tras re-aplicar', ownersFinales.n === 1, `hay ${ownersFinales.n}`)

const exentosFinales = db
  .prepare(`SELECT COUNT(*) AS n FROM exencion_usuario`)
  .get()
ok('siguen habiendo 2 exentos tras re-aplicar', exentosFinales.n === 2, `hay ${exentosFinales.n}`)

/* ---------------------------------------------------------------------------
 * Resultado
 * ------------------------------------------------------------------------ */

console.log(`\n${'-'.repeat(60)}`)
if (fallos === 0) {
  console.log(`Las ${pruebas} pruebas pasaron.`)
  process.exit(0)
}
console.log(`${fallos} de ${pruebas} pruebas FALLARON.`)
process.exit(1)