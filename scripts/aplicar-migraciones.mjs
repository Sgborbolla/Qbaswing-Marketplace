#!/usr/bin/env node
/**
 * Aplica las migraciones SQL a la base D1 remota por la API de Cloudflare.
 *
 * ============================================================================
 *  POR QUE EXISTE ESTE SCRIPT
 * ============================================================================
 * `wrangler d1 migrations apply` es la via normal, pero `wrangler` no arranca en
 * Termux/Android: `workerd` no tiene binario para `android arm64` y su
 * `install.js` aborta con "Unsupported platform". Como el despliegue tiene que
 * salir de este equipo, se habla directamente con la API de D1.
 *
 * ============================================================================
 *  COMO SABE QUE YA ESTA APLICADA
 * ============================================================================
 * El script crea su propia tabla `_migraciones` y anota ahi cada archivo cuando
 * termina. Al volver a correr, salta las que ya estan. No usa la tabla
 * `d1_migrations` de wrangler a proposito: esa la escribe wrangler y mezclar las
 * dos dejaria la cuenta de migraciones en un estado que nadie entiende.
 *
 * La migracion se aplica ENTERA en una sola llamada. La API de D1 acepta varios
 * statements separados por `;` y los ejecuta en orden; si uno falla, devuelve el
 * error y se detiene, que es lo que hace falta para no dejar el esquema a medias.
 *
 * Uso:
 *   CLOUDFLARE_API_TOKEN=... node scripts/aplicar-migraciones.mjs
 *   CLOUDFLARE_API_TOKEN=... node scripts/aplicar-migraciones.mjs --rehacer
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const carpeta = join(raiz, 'migrations')

const CUENTA = process.env.CLOUDFLARE_ACCOUNT_ID ?? 'c332f6e7dbafcb44a0b3cec4a2f981e8'
const BASE = process.env.QBASWING_D1_ID ?? '7c782a19-f3bb-4107-819f-82b6b08d14d1'
const TOKEN = process.env.CLOUDFLARE_API_TOKEN

if (!TOKEN) {
  console.error('Falta CLOUDFLARE_API_TOKEN en el entorno.')
  process.exit(1)
}

const URL = `https://api.cloudflare.com/client/v4/accounts/${CUENTA}/d1/database/${BASE}/query`

/**
 * Ejecuta SQL y devuelve el `result` de la API.
 *
 * `sql` puede llevar varios statements. Si la API contesta `success: false` o
 * algun subresultado falla, se lanza con el detalle, para que el error diga que
 * migracion rompio y no solo "algo fallo".
 */
async function consulta(sql) {
  const respuesta = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  })

  let datos
  try {
    datos = await respuesta.json()
  } catch {
    throw new Error(`La API no devolvio JSON (HTTP ${respuesta.status}).`)
  }

  const fallo =
    !datos.success ||
    (Array.isArray(datos.errors) && datos.errors.length > 0) ||
    (Array.isArray(datos.result) && datos.result.some((r) => r && r.success === false))

  if (fallo) {
    const detalle = JSON.stringify(datos.errors ?? datos.result ?? datos)
    throw new Error(detalle)
  }

  return datos.result
}

async function principal() {
  const rehacer = process.argv.includes('--rehacer')

  console.log('=== aplicar migraciones a D1 ===')
  console.log(`cuenta:  ${CUENTA}`)
  console.log(`base:    ${BASE}`)
  console.log('')

  await consulta(
    `CREATE TABLE IF NOT EXISTS _migraciones (
       nombre      TEXT PRIMARY KEY,
       aplicado_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     )`,
  )

  if (rehacer) {
    await consulta('DELETE FROM _migraciones')
    console.log('--rehacer: se olvida el registro de migraciones aplicadas.\n')
  }

  const aplicadas = new Set(
    (await consulta('SELECT nombre FROM _migraciones'))
      .flatMap((r) => r.results ?? [])
      .map((f) => f.nombre),
  )

  const archivos = readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let hechas = 0

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) {
      console.log(`  ${archivo}: ya aplicada`)
      continue
    }

    const sql = readFileSync(join(carpeta, archivo), 'utf8')

    try {
      await consulta(sql)
      await consulta(
        `INSERT OR REPLACE INTO _migraciones (nombre) VALUES ('${archivo.replace(/'/g, "''")}')`,
      )
      hechas++
      console.log(`  ${archivo}: OK`)
    } catch (error) {
      console.error(`\n  ${archivo}: FALLO`)
      console.error(`  ${error instanceof Error ? error.message : error}`)
      console.error('\nSe detiene aqui. Corrige y vuelve a lanzar; lo ya aplicado no se repite.')
      process.exit(1)
    }
  }

  console.log('')
  console.log(`migraciones aplicadas en esta pasada: ${hechas}`)
  console.log(`total en el registro:                 ${aplicadas.size + hechas}`)
}

principal()
