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
 * TRES NIVELES DE PERMISO, DE MAS A MENOS AMPLIO
 * ============================================================================
 *
 *   1. `PERMITIDOS`: archivos donde CUALQUIER caracter no latino es legitimo.
 *      Los nombres de los 22 idiomas tienen que estar en su alfabeto: el chino
 *      simplificado en `idiomas.ts` no es un intruso, es el nombre correcto del
 *      idioma, y ponerlo en latin seria un error.
 *
 *   2. `BLOQUES`: archivos donde el alfabeto permitido depende del trozo de
 *      codigo en el que se esta. `diccionario.ts` guarda todas las traducciones
 *      juntas: dentro del bloque `RU` (una traduccion al ruso) un cirilico es el
 *      contenido, y en el bloque `EN` es una letra que se ha colado en un texto
 *      en ingles. Lo que no se puede es fuera de cualquier bloque, donde estan
 *      los comentarios y las cadenas en espanol.
 *
 *   3. Todo lo demas: solo alfabeto latino.
 *
 * El motivo de cada permiso va en el propio objeto: una lista blanca sin razon
 * es una lista blanca que se va a ampliar sin pensar. Si manana hace falta
 * japones en otro sitio, hay que anadir el archivo o el bloque a proposito y no
 * relajar la comprobacion entera.
 *
 * La regla de oro, en una linea: texto traducido intencional si, en su bloque;
 * caracteres corruptos fuera de las claves de traduccion, cero.
 *
 * ============================================================================
 * COMO SE MIDE (Y POR QUE UNA SOLA EXPRESION REGULAR)
 * ============================================================================
 * El primer borrador recorria linea a linea y letra a letra de cada rango:
 * unos 21.000 sondeos por linea de codigo. Con el repo actual tardaba 43
 * segundos, y con las 14 traducciones anadidas al diccionario se iria por
 * encima del minuto en cada guardado. Ahora hay UNA sola expresion con los 18
 * rangos, el motor de regex hace una pasada por linea, y solo cuando hay un
 * caracter no latino se mira de que rango viene.
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
}

/**
 * Alfabetos que cada idioma puede usar dentro de su propio bloque de
 * traduccion. Un idioma que no este aqui (es, en, pt, fr, de, it, ca, gl, eu)
 * no tiene alfabetos propios: lo no latino que aparezca en su bloque es un
 * intruso, y lo que este fuera de cualquier bloque tambien lo es.
 */
const CHINO = [
  'CJK radicals',
  'puntuacion CJK',
  'CJK extension A',
  'ideogramas CJK (chino)',
  'CJK compatibilidad',
  'ancho completo CJK',
]
const JAPONES = ['kana (japones)', ...CHINO]
const COREANO = ['hangul jamo', 'hangul (coreano)']

/**
 * Archivos donde el alfabeto depende del bloque y no del archivo entero.
 *
 * `cabecera` reconoce la linea que abre cada traduccion
 * (`const RU: Diccionario = {`) y el cierre de llave a la columna cero la
 * vuelve a cerrar: lo que queda entre medias pertenece al idioma de esa
 * traduccion, y lo que queda fuera, a los comentarios del archivo.
 *
 * OJO: si se anade un idioma cambiando la forma en que se declara —por meter
 * el objeto directo dentro de `DICCIONARIOS`, por ejemplo— `cabecera` deja de
 * reconocerlo y el bloque se toma como espanol. El efecto es el que se quiere:
 * el texto del idioma nuevo saldria marcado como intruso, que es visible en la
 * primera ejecucion y no en produccion.
 */
const BLOQUES = {
  'src/i18n/diccionario.ts': {
    motivo:
      'las 22 traducciones viven aqui: cada bloque admite su alfabeto (ruso, arabe, chino, japones, coreano) y los comentarios, en espanol, no admiten ninguno',
    cabecera: /^(?:export\s+)?const\s+([A-Z]{2}(?:_[A-Z]{2})?):\s*Diccionario\b/,
    alfabetos: {
      RU: ['cirilico (ruso)'],
      AR: ['arabe', 'arabe extendido'],
      ZH_CN: CHINO,
      ZH_TW: CHINO,
      JA: JAPONES,
      KO: COREANO,
    },
  },
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

/** Los 18 rangos de arriba en una sola expresion, con la bandera global. */
const RE_NO_LATINO = new RegExp(
  `[${RANGOS.map(([i, f]) => `\\u{${i.toString(16)}}-\\u{${f.toString(16)}}`).join('')}]`,
  'gu',
)

function nombreDeRango(puntoDeCodigo) {
  const rango = RANGOS.find(([inicio, fin]) => puntoDeCodigo >= inicio && puntoDeCodigo <= fin)
  return rango ? rango[2] : 'desconocido'
}

const intrusos = []
const vistos = new Set()

function revisarArchivo(ruta) {
  const rel = relative(raiz, ruta).replace(/\\/g, '/')
  if (Object.hasOwn(PERMITIDOS, rel)) return

  let texto
  try {
    texto = readFileSync(ruta, 'utf8')
  } catch {
    return
  }

  const config = Object.hasOwn(BLOQUES, rel) ? BLOQUES[rel] : null
  /** Alfabetos que admite el bloque actual, o `null` si no estamos en uno. */
  let admitidos = null

  texto.split(/\r?\n/).forEach((linea, i) => {
    if (config) {
      const cabecera = linea.match(config.cabecera)
      if (cabecera) admitidos = config.alfabetos[cabecera[1]] ?? null
      // Cierre de objeto a la columna cero: se acaba el bloque de traduccion.
      else if (/^\}\s*$/.test(linea)) admitidos = null
    }

    for (const coincidencia of linea.matchAll(RE_NO_LATINO)) {
      const nombre = nombreDeRango(coincidencia[0].codePointAt(0))
      if (admitidos && admitidos.includes(nombre)) continue

      // Un intruso por linea y alfabeto: la misma linea no se dos veces.
      const clave = `${rel}|${i + 1}|${nombre}`
      if (vistos.has(clave)) continue
      vistos.add(clave)

      intrusos.push({ archivo: rel, linea: i + 1, alfabeto: nombre, texto: linea.trim() })
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
for (const [archivo, config] of Object.entries(BLOQUES)) {
  console.log(`  por bloque ${archivo}\n             ${config.motivo}\n`)
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
