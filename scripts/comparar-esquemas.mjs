/**
 * Compara el esquema de REMOTO con el de LOCAL y dice si son iguales.
 *
 * Es la comprobacion que faltaba cuando `migrations apply --remote` fallo en la
 * 0006 con "duplicate column name: email". En ese momento no habia forma de
 * saber si la columna faltaba de verdad o si ya estaba ahi. Este script no aplica
 * nada: solo mira las dos listas y las coteja.
 *
 * Compara nombres de tabla y, dentro de cada tabla, nombres de columna. No
 * compara tipos ni indices a proposito: aqui se busca que falte una tabla o una
 * columna, no que el texto coincida letra a letra.
 *
 * Sale con codigo 1 si hay diferencias, para poder encadenarlo en un script sin
 * tener que leer la salida.
 */

import { execSync } from 'node:child_process'

const BASE = 'C:\\qbaswing-marketplace'

/**
 * En Windows el SQL viaja como UNA cadena con la consulta ya entre comillas
 * dobles, no como argumentos sueltos. El motivo esta en scripts/vaciar-base.mjs:
 * al pasar por el shell, Node pierde las comillas y wrangler ve la consulta
 * partida por espacios.
 *
 * `--json` es lo que hace util esto: sin el, wrangler imprime las filas en un
 * formato pensado para leerse a ojo y no se puede parsear de forma fiable.
 */
function consultar(destino, sql) {
  const salida = execSync(
    `npx wrangler d1 execute qbaswing_marketplace -c wrangler.api.toml ${destino} --json --command "${sql}"`,
    { cwd: BASE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return JSON.parse(salida)[0]?.results?.[0]?.r
}

/**
 * Una consulta por lista.
 *
 * `group_concat` con `|` como separador porque D1 no permite muchos `UNION` en un
 * `SELECT` compuesto (`too many terms in compound SELECT` a partir de muy pocos).
 * Traer los nombres en un solo texto partido despues esquiva ese limite y hace
 * falta UNA sola llamada por lista.
 *
 * Se filtran las tablas internas. No es cosmetico: son las que hacen que el
 * cotejo de antes diera 7 diferencias que no eran diferencias.
 *
 *   `_cf_KV`        -> el namespace de KV, en remoto.
 *   `_cf_METADATA`  -> metadatos de D1, en local.
 *   `d1_migrations` -> el registro de Wrangler. Solo existe en uno de los dos
 *                      segun se haya aplicado con `migrations apply` o a mano, y
 *                      que este o no no dice nada del esquema.
 *
 * `_cf_` se separa con `substr` y no con `LIKE '\\_cf\\_%'` porque en SQLite el
 * caracter de escape de `LIKE` hay que declararlo (`ESCAPE '\'`), y el comando
 * entero viaja por una cadena de `cmd.exe`, donde las barras invertidas se
 * duplican solas. Con `substr` no hay escapes que puedan romperse.
 *
 * `sqlite_%` fuera tambien: `sqlite_sequence` la gestiona SQLite.
 */
const Q_TABLAS =
  "SELECT group_concat(name, '|') AS r FROM sqlite_master WHERE type='table'" +
  " AND name NOT LIKE 'sqlite_%'" +
  " AND name <> 'd1_migrations'" +
  " AND substr(name, 1, 3) <> '_cf'"

/**
 * `pragma_table_info` NO acepta un nombre de tabla variable, asi que las
 * columnas se piden una por una. Son 29 tablas, y a este precio compensa mas que
 * pelearse con el limite de `UNION` compuesto de D1.
 */
function columnas(destino, tabla) {
  const sql = `SELECT group_concat(name, '|') AS r FROM pragma_table_info('${tabla}')`
  const crudo = consultar(destino, sql)
  return crudo ? crudo.split('|').filter(Boolean).sort() : []
}

function tablas(destino) {
  const crudo = consultar(destino, Q_TABLAS)
  return crudo ? crudo.split('|').filter(Boolean).sort() : []
}

const locales = tablas('--local')
const remotas = tablas('--remote')

console.log(`LOCAL  : ${locales.length} tablas`)
console.log(`REMOTO : ${remotas.length} tablas`)

const soloLocal = locales.filter((t) => !remotas.includes(t))
const soloRemoto = remotas.filter((t) => !locales.includes(t))

let diferencias = soloLocal.length + soloRemoto.length

if (soloLocal.length) console.log(`\nfaltan en remoto: ${soloLocal.join(', ')}`)
if (soloRemoto.length) console.log(`sobran en remoto: ${soloRemoto.join(', ')}`)

for (const tabla of locales) {
  if (!remotas.includes(tabla)) continue

  const enLocal = columnas('--local', tabla)
  const enRemoto = columnas('--remote', tabla)

  const faltan = enLocal.filter((c) => !enRemoto.includes(c))
  const sobran = enRemoto.filter((c) => !enLocal.includes(c))

  if (!faltan.length && !sobran.length) continue

  diferencias += faltan.length + sobran.length
  console.log(`\n${tabla}:`)
  if (faltan.length) console.log(`  faltan: ${faltan.join(', ')}`)
  if (sobran.length) console.log(`  sobran: ${sobran.join(', ')}`)
}

console.log(diferencias === 0 ? '\nLos dos esquemas son iguales.' : `\n${diferencias} diferencias.`)
process.exit(diferencias === 0 ? 0 : 1)