#!/usr/bin/env node
/**
 * Sube `dist/` a Cloudflare Pages partiendo la subida en cubos pequenos.
 *
 * ============================================================================
 *  POR QUE EXISTE ESTE SCRIPT
 * ============================================================================
 * `wrangler pages deploy` agrupa los ficheros en cubos de hasta 40 MB y sube
 * cada cubo en UN SOLO `POST /pages/assets/upload`, con el contenido en base64
 * dentro de un JSON. Un `dist` de 22 MB sale como un cuerpo de ~30 MB.
 *
 * `undici` corta una peticion si no llegan las cabeceras en 300 segundos. En
 * una linea de 13 KB/s esos 30 MB necesitan unos 38 minutos, asi que la
 * peticion muere siempre a los 5 minutos con `HeadersTimeout`, wrangler
 * reintenta el MISMO cubo gigante cinco veces y vuelve a morir. No es una
 * caida puntual de Cloudflare: es una subida lenta chocando con un limite
 * fijo del cliente.
 *
 * La unica perilla que existe es el tamano del cubo, y no hay flag ni variable
 * de entorno que la mueva: son constantes escritas en el propio bundle. Este
 * script las cambia antes de lanzar la subida, y lo hace de forma idempotente,
 * de modo que volver a instalar `node_modules` no deja nada roto: basta con
 * volver a pasar por aqui.
 *
 * Cambios aplicados sobre `node_modules/wrangler/wrangler-dist/cli.js`:
 *
 *   MAX_BUCKET_SIZE            40 MB  ->  256 KB
 *   BULK_UPLOAD_CONCURRENCY     3     ->  1
 *
 * El cubo pequeño es lo que evita el corte: 256 KB de fichero salen como
 * ~341 KB de JSON, unos 26 segundos a 13 KB/s, holgados dentro de los 300.
 *
 * Bajar la concurrencia de 3 a 1 no cuesta tiempo. La subida esta limitada por
 * el ancho de banda, no por las peticiones, y con tres cubos abiertos a la vez
 * cada uno recibe un tercio de la linea: se tarda lo mismo pero cada peticion
 * se acerca tres veces mas al limite. Con una sola, la linea entera va para la
 * que esta en curso.
 *
 * ============================================================================
 *  POR QUE REINTENTAR TAMBIEN AYUDA
 * ============================================================================
 * Antes de subir, wrangler pregunta a la API que ficheros faltan
 * (`/pages/assets/check-missing`). Todo lo que ya llego en un intento anterior
 * se salta, asi que un corte a mitad de camino no borra el avance: el siguiente
 * intento sigue por donde iba. Por eso el bucle de reintentos aqui no es una
 * chapuza, es la forma natural de terminar en una linea inestable.
 *
 * Uso:
 *   node scripts/subir-pages.mjs
 *   npm run subir
 */

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(raiz, 'node_modules', 'wrangler', 'wrangler-dist', 'cli.js')

const INTENTOS = 8
const ESPERA_ENTRE_INTENTOS_SEG = 20

/** Cambios que queremos en el bundle. Buscar y reemplazar en binario. */
const CAMBIOS = [
  {
    que: 'MAX_BUCKET_SIZE',
    antes: 'MAX_BUCKET_SIZE = 40 * 1024 * 1024',
    despues: 'MAX_BUCKET_SIZE = 256 * 1024',
    yaPuesto: 'MAX_BUCKET_SIZE = 256 * 1024',
  },
  {
    que: 'BULK_UPLOAD_CONCURRENCY2',
    antes: 'BULK_UPLOAD_CONCURRENCY2 = 3',
    despues: 'BULK_UPLOAD_CONCURRENCY2 = 1',
    yaPuesto: 'BULK_UPLOAD_CONCURRENCY2 = 1',
  },
]

/**
 * Sustituye en un `Buffer`, no en texto.
 *
 * Se hace asi y no con `readFileSync(..., 'utf8')` porque el bundle mide 14 MB
 * y decodificarlo a string y volver a escribirlo pasaria cualquier byte
 * invalido por `U+FFFD`, que es corromper el fichero de wrangler entero para
 * cambiar dos numeros. Los patrones son ASCII puro, asi que buscarlos en bytes
 * es correcto y no toca nada mas.
 */
function sustituir(buf, buscar, poner) {
  const a = Buffer.from(buscar, 'ascii')
  const b = Buffer.from(poner, 'ascii')
  const trozos = []
  let desde = 0
  let hechos = 0
  for (;;) {
    const i = buf.indexOf(a, desde)
    if (i < 0) break
    trozos.push(buf.subarray(desde, i), b)
    desde = i + a.length
    hechos++
  }
  if (hechos === 0) return { buf, hechos }
  trozos.push(buf.subarray(desde))
  return { buf: Buffer.concat(trozos), hechos }
}

function parchear() {
  if (!existsSync(cli)) {
    console.error(`No encuentro el bundle de wrangler en:\n  ${cli}`)
    return false
  }

  let buf = readFileSync(cli)
  let cambios = 0

  for (const c of CAMBIOS) {
    const r = sustituir(buf, c.antes, c.despues)
    if (r.hechos > 0) {
      buf = r.buf
      cambios += r.hechos
      console.log(`  ${c.que}: ${c.antes}  ->  ${c.despues}`)
    } else {
      const comprobado = sustituir(buf, c.yaPuesto, c.yaPuesto)
      if (comprobado.hechos > 0) {
        console.log(`  ${c.que}: ya estaba en ${c.despues}`)
      } else {
        console.error(
          `\nNo encontre "${c.antes}" ni "${c.yaPuesto}" en el bundle de wrangler.\n` +
            `Wrangler ha cambiado desde que se escribio este script y hay que mirar\n` +
            `de nuevo como agrupa los cubos antes de subirlos.`,
        )
        return false
      }
    }
  }

  if (cambios > 0) {
    writeFileSync(cli, buf)
    console.log(`  parcheado (${cambios} cambio${cambios === 1 ? '' : 's'})\n`)
  }
  return true
}

function subir(intento) {
  return new Promise((resolver) => {
    console.log(`\n=== intento ${intento} de ${INTENTOS}  ${new Date().toLocaleTimeString()} ===\n`)
    const hijo = spawn('npx', ['wrangler', 'pages', 'deploy', 'dist', '--commit-dirty=true'], {
      cwd: raiz,
      stdio: 'inherit',
      shell: true,
    })
    hijo.on('exit', (codigo) => resolver(codigo ?? 1))
    hijo.on('error', (error) => {
      console.error(`No pude arrancar wrangler: ${error.message}`)
      resolver(1)
    })
  })
}

const pausa = (seg) => new Promise((r) => setTimeout(r, seg * 1000))

console.log('=== subir dist/ a Cloudflare Pages ===')
if (!parchear()) process.exit(1)

for (let intento = 1; intento <= INTENTOS; intento++) {
  const codigo = await subir(intento)
  if (codigo === 0) {
    console.log(`\nSubida terminada en el intento ${intento}.`)
    process.exit(0)
  }
  if (intento < INTENTOS) {
    console.log(`\nFallo el intento ${intento} (codigo ${codigo}). Ya subido se queda: el siguiente\n` +
      `empieza por lo que falta. Espero ${ESPERA_ENTRE_INTENTOS_SEG} segundos.`)
    await pausa(ESPERA_ENTRE_INTENTOS_SEG)
  }
}

console.error(`\nNo se pudo subir tras ${INTENTOS} intentos.`)
process.exit(1)
