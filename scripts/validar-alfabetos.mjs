/**
 * Revisa que no se colen caracteres de otros alfabetos.
 *
 * ============================================================================
 * POR QUE ESTE SCRIPT EXISTE
 * ============================================================================
 * Es un defecto que se repite: al generar archivos se cuelan palabras en
 * chino o en cirilico dentro de comentarios en espanol. Pasaron varios:
 *
 *   - un nombre de variable con dos erres cirilicas en vez de dos eses
 *   - tres palabras en chino en `pagos.ts` y en `i18n`
 *   - dos ideogramas delante de "otro scope" en CREDENCIALES.txt
 *   - un ideograma en medio de una frase de esta misma suite
 *
 * No rompen el codigo. Eso es lo que los hace peligrosos: el proyecto compila,
 * los tests pasan, y el archivo queda con una frase que en espanol no significa
 * nada. Nadie lo nota hasta que lo lee otro.
 *
 * ============================================================================
 * POR QUE ESTE ARCHIVO NO CONTIENE NI UN SOLO CARACTER SOSPECHOSO
 * ============================================================================
 * Los ejemplos de arriba no estan escritos con los caracteres literales: en este
 * archivo no aparece ninguno. Por dos razones, ambas importantes:
 *
 *   1. Si el script contuviera el ejemplo, se detectaria a si mismo y fallaria
 *      en cada ejecucion, que es la forma mas rapida de que nadie lo use.
 *   2. Los rangos Unicode de abajo ya nombran cada alfabeto en espanol, asi que
 *      el comentario no pierde nada sin el ejemplo literal.
 *
 * Cuando hubo que corregir uno de verdad, se corrigio en el archivo destino, no
 * aqui. Este archivo no lleva registro de los intrusos: lleva la regla.
 *
 * ============================================================================
 * POR QUE HAY UNA LISTA BLANCA
 * ============================================================================
 * Los NOMBRES DE LOS IDIOMAS tienen que estar en su alfabeto. El chino
 * simplificado en `idiomas.ts` no es un intruso: es el nombre correcto del
 * idioma, y ponerlo en latin seria un error. Lo mismo con los codigos de dos
 * letras del selector.
 *
 * Asi que la lista blanca es explicita y por ARCHIVO, no por rango global: si
 * manana hace falta japones en otro lado, hay que anadir el archivo a proposito
 * y no relajar la comprobacion entera.
 *
 * Uso:  npm run validar:alfabetos
 * Sale con codigo 1 si algo no esta permitido.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = join(aqui, '..')

/**
 * Archivos donde un caracter de otro alfabeto es legitimo.
 *
 * El motivo va en el mismo objeto: una lista blanca sin razon es una lista
 * blanca que se va a ampliar sin pensar.
 */
const PERMITIDOS = {
  'src/i18n/idiomas.ts':
    'los 22 idiomas se nombran en su propio alfabeto: chino simplificado y tradicional, japones, coreano, cirilico y arabe',
  'src/components/SelectorIdioma.astro':
    'codigos de dos letras y nombres de idioma en su alfabeto, para que el selector los muestre bien',
  'src/i18n/diccionario.ts':
    'solo espanol por ahora; si se traduce, las claves estrangeas van con la misma regla que idiomas.ts',
}

const IGNORAR_DIRECTORIOS = new Set([
  'node_modules', '.git', 'dist', '.astro', '_astro', '.wrangler',
])

const EXTENSIONES = /\.(ts|tsx|astro|sql|mjs|js|toml|md|json|css|txt|ps1)$/i

/**
 * Rangos que se consideran intrusos.
 *
 * Solo se revisa lo que esta FUERA del alfabeto latino. Los acentos, la enye y
 * la dieresis son espanol corriente y no se comprueban: una lista que marcara
 * `diseño` como sospechoso dejaria de usarse en una semana.
 */
const RANGOS = [
  [0x2e80, 0x2fff, 'CJK radicals'],
  [0x3000, 0x303f, 'puntuacion CJK'],
  [0x3040, 0x30ff, 'kana (japones)'],
  [0x3130, 0x318f, 'hangul jamo'],
  [0x3400, 0x4dbf, 'CJK extension A'],
  [0x4e00, 0x9fff, 'ideogramas CJK (chino)'],
  [0xa000, 0xa4cf, 'yi'],
  [0xac00, 0xd7af, 'hangul (coreano)'],
  [0xf900, 0xfaff, 'CJK compatibilidad'],
  [0xff00, 0xffef, 'ancho completo CJK'],
  [0x0400, 0x04ff, 'cirilico (ruso)'],
  [0x0370, 0x03ff, 'griego'],
  [0x0590, 0x05ff, 'hebreo'],
  [0x0600, 0x06ff, 'arabe'],
  [0x0750, 0x077f, 'arabe extendido'],
  [0x0900, 0x097f, 'devanagari (hindi)'],
  [0x0e00, 0x0e7f, 'tailandes'],
  [0xfffd, 0xfffd, 'caracter de reemplazo U+FFFD'],
]

const intrusos = []

function revisarArchivo(ruta) {
  const rel = relative(raiz, ruta).replace(/\\/g, '/')
  if (Object.hasOwn(PERMITIDOS, rel)) return

  let texto
  try {
    texto = readFileSync(ruta, 'utf8')
  } catch {
    return
  }

  texto.split(/\r?\n/).forEach((linea, i) => {
    for (const [inicio, fin, nombre] of RANGOS) {
      for (let c = inicio; c <= fin; c++) {
        const caracter = String.fromCodePoint(c)
        if (linea.includes(caracter)) {
          intrusos.push({ archivo: rel, linea: i + 1, alfabeto: nombre, texto: linea.trim() })
          break
        }
      }
    }
  })
}

function visitar(dir) {
  let entradas
  try {
    entradas = readdirSync(dir)
  } catch {
    return
  }
  for (const entrada of entradas) {
    if (IGNORAR_DIRECTORIOS.has(entrada)) continue
    const ruta = join(dir, entrada)
    let st
    try {
      st = statSync(ruta)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      visitar(ruta)
    } else if (EXTENSIONES.test(entrada)) {
      revisarArchivo(ruta)
    }
  }
}

visitar(raiz)

console.log('Alfabetos revisionados.\n')

for (const [archivo, motivo] of Object.entries(PERMITIDOS)) {
  console.log(`  permitido  ${archivo}\n             ${motivo}\n`)
}

if (intrusos.length === 0) {
  console.log('  ok   ningun caracter fuera del alfabeto latino')
  console.log('\n' + '-'.repeat(60))
  console.log('Limpio.')
  process.exit(0)
}

console.log('')
for (const i of intrusos) {
  console.log(`  FALLA ${i.archivo}:${i.linea}  [${i.alfabeto}]`)
  console.log(`         ${i.texto.slice(0, 110)}`)
}
console.log('\n' + '-'.repeat(60))
console.log(`${intrusos.length} linea(s) con intrusos.`)
process.exit(1)
