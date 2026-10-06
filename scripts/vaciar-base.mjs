/**
 * Genera el SQL que deja la base remota como una hoja en blanco.
 *
 * Se escribe aparte porque este es el unico paso que no conviene hacer a mano:
 * la lista de tablas sale de la base, no de un papel. Si se escribe de memoria
 * y se olvida una, la migracion siguiente choca contra ella y el fallo aparece a
 * mitad de la reconstruccion, no al principio.
 *
 * Lo que NO se tira:
 *   `_cf_KV`         -> es del namespace de KV, lo gestiona Cloudflare.
 *   `sqlite_sequence` -> la gestiona SQLite; se reinicia sola con sus tablas.
 *
 * Lo que SI se tira, y hay que ser explicito en por que:
 *   `d1_migrations`  -> si se deja, `migrations apply` cree que 0001..0005 ya
 *                       estan aplicadas y solo corre de 0006 en adelante, que es
 *                       exactamente el bug que hay que arreglar. Se tira para que
 *                       las 17 se apliquen en orden y la tabla vuelva a decir la
 *                       verdad.
 */

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const BASE = 'C:\\qbaswing-marketplace'
const SALIDA = 'C:\\Users\\1\\AppData\\Local\\Temp\\opencode\\vaciar.sql'

const CONSULTA = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

/**
 * Por que esto es un comando con comillas y no `execFileSync` con argumentos.
 *
 * En Windows hacen falta las dos cosas, y cada una sola no basta:
 *
 *   `execFileSync('npx.cmd', [...])` sin `shell` -> EINVAL, porque Node no
 *   ejecuta por si solo los ejecutables por lote (`.cmd`).
 *
 *   El mismo con `shell: true` -> wrangler ve la consulta partida por espacios y
 *   contesta "Unknown arguments: name, FROM, sqlite_master". Al pasar por el
 *   shell, Node une los argumentos con espacios y pierde las comillas.
 *
 * Asi que el comando va como una sola cadena, con la consulta YA entre comillas
 * dobles. El SQL usa comillas simples, que para `cmd.exe` no son comillas: por
 * eso sobrevive.
 */
const salida = execSync(
  `npx wrangler d1 execute qbaswing_marketplace -c wrangler.api.toml --remote --command "${CONSULTA}"`,
  {
    cwd: BASE,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

const tablas = [...salida.matchAll(/"name":\s*"([^"]+)"/g)].map((m) => m[1])

const CONSERVAR = new Set(['_cf_KV', 'sqlite_sequence'])
const tirar = tablas.filter((t) => !CONSERVAR.has(t))

const sql = [
  '-- Generado por scripts/vaciar-base.mjs. No editar a mano.',
  `-- Tablas en remoto: ${tablas.length}. Se tiran ${tirar.length}.`,
  '',
  'PRAGMA foreign_keys = OFF;',
  ...tirar.map((t) => `DROP TABLE IF EXISTS "${t}";`),
  '',
].join('\n')

writeFileSync(SALIDA, sql, 'utf8')

console.log(`tablas en remoto: ${tablas.length}`)
console.log(`se conservan:     ${[...CONSERVAR].filter((t) => tablas.includes(t)).join(', ')}`)
console.log(`se tiran:         ${tirar.length}`)
console.log(`escrito:          ${SALIDA}`)