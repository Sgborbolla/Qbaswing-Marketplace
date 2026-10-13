#!/usr/bin/env node
/**
 * Despliega el Worker `qbaswing-api` por la API de Cloudflare.
 *
 * ============================================================================
 *  POR QUE EXISTE ESTE SCRIPT
 * ============================================================================
 * Misma razon que `aplicar-migraciones.mjs`: `wrangler` no corre en
 * Termux/Android (`workerd` no tiene binario `android arm64`). El Worker se sube
 * por `PUT /workers/scripts/{nombre}` con el bundle que produce `esbuild`.
 *
 * ============================================================================
 *  COMO NO SE BORRAN LOS SECRETOS
 * ============================================================================
 * Un upload de Worker REEMPLAZA todos los bindings. Los secretos
 * (`QBASWING_SECRETO_FIRMA`, `QVAPAY_APP_SECRET`, `TROPIPAY_*`) no se pueden
 * reenviar porque no se pueden leer. Para que sobrevivan se manda
 * `keep_bindings: ["secret_text"]`, que le dice a Cloudflare que conserve los
 * bindings de tipo secreto del despliegue anterior. Los demas (D1, KV y las
 * variables publicas) SI se reenvian aqui, que es justo lo que permite cambiar
 * el `database_id` del binding `DB` sin tocar los secretos.
 *
 * Lo que este script NO hace:
 *   - Subir secretos. Se quedan como estan; para cambiarlos hay que usar la
 *     consola o `wrangler secret put` desde una maquina donde wrangler arranque.
 *   - Empaquetar. Espera `dist-worker-index.js` ya generado:
 *       npx esbuild src/worker/index.ts --bundle --format=esm \
 *         --platform=neutral --target=es2022 --conditions=worker,browser \
 *         --outfile=dist-worker-index.js
 *
 * Uso:
 *   CLOUDFLARE_API_TOKEN=... node scripts/desplegar-worker.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = join(raiz, 'dist-worker-index.js')

const CUENTA = process.env.CLOUDFLARE_ACCOUNT_ID ?? 'c332f6e7dbafcb44a0b3cec4a2f981e8'
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const NOMBRE = process.env.QBASWING_WORKER ?? 'qbaswing-api'

if (!TOKEN) {
  console.error('Falta CLOUDFLARE_API_TOKEN en el entorno.')
  process.exit(1)
}

if (!existsSync(bundle)) {
  console.error(`No existe el bundle: ${bundle}`)
  console.error('Empaqueta primero con esbuild (ver cabecera de este archivo).')
  process.exit(1)
}

/*
 * Los bindings NO secretos, en el mismo orden que `wrangler.worker.toml`. Si un
 * dia se cambia algo alli, hay que cambiarlo aqui: este script es el que de
 * verdad despliega, y el `.toml` es la fuente de verdad legible.
 */
const metadata = {
  main_module: 'index.js',
  compatibility_date: '2026-10-01',
  compatibility_flags: ['nodejs_compat'],
  keep_bindings: ['secret_text'],
  bindings: [
    {
      type: 'plain_text',
      name: 'ALLOWED_ORIGIN',
      text: 'https://qbaswing-marketplace.pages.dev,http://localhost:4321,http://localhost:4322,http://127.0.0.1:4321',
    },
    {
      type: 'kv_namespace',
      name: 'ARCHIVOS',
      namespace_id: 'd17446bd79644534baad1a185830ad6e',
    },
    {
      type: 'd1',
      name: 'DB',
      id: '7c782a19-f3bb-4107-819f-82b6b08d14d1',
    },
    { type: 'plain_text', name: 'EXPIRACION_ENLACE_SEG', text: '300' },
    { type: 'plain_text', name: 'VENTANA_TIMESTAMP_SEG', text: '300' },
    {
      type: 'plain_text',
      name: 'PUBLIC_API_BASE',
      text: 'https://qbaswing-api.sgborbolla.workers.dev',
    },
  ],
}

async function principal() {
  console.log('=== desplegar Worker ===')
  console.log(`cuenta:  ${CUENTA}`)
  console.log(`worker:  ${NOMBRE}`)
  console.log(`bundle:  ${bundle}`)
  console.log('')

  const codigo = readFileSync(bundle)

  const forma = new FormData()
  forma.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  )
  forma.append(
    'index.js',
    new Blob([codigo], { type: 'application/javascript+module' }),
    'index.js',
  )

  const respuesta = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CUENTA}/workers/scripts/${NOMBRE}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: forma,
    },
  )

  let datos
  try {
    datos = await respuesta.json()
  } catch {
    throw new Error(`La API no devolvio JSON (HTTP ${respuesta.status}).`)
  }

  if (!datos.success) {
    console.error('El despliegue fallo:')
    console.error(JSON.stringify(datos.errors ?? datos, null, 2))
    process.exit(1)
  }

  const r = datos.result ?? {}
  console.log('Despliegue OK.')
  console.log(`  id:      ${r.id ?? '(sin id)'}`)
  console.log(`  etag:    ${r.etag ?? '(sin etag)'}`)
  console.log(`  subdominio disponible: ${r.available_on_subdomain ?? '?'}`)
}

principal()
