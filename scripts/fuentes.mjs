/**
 * Descarga las fuentes y las deja en `public/fuentes/`.
 *
 * ============================================================================
 *  POR QUE ESTE SCRIPT EXISTE
 * ============================================================================
 * Antes el sitio pedia Inter, Outfit y Material Symbols a `fonts.googleapis.com`
 * con dos `<link>` en `Base.astro`. Eso funciona en cualquier parte del mundo
 * menos en Cuba, que es el mercado principal.
 *
 * Google Fonts esta bloqueado en la Isla. No es una caida puntual: no responde.
 * Las consecuencias son tres, y ninguna es visible desde una computadora con
 * conexion normal, que es justo por lo que el problema estuvo semanas sin
 * detectarse:
 *
 *   1. TODOS LOS ICONOS SE VEN COMO PALABRAS. Material Symbols es una fuente
 *      con ligaduras: el codigo `<span>language</span>` no es el texto
 *      "language" sino el nombre de un glifo que la fuente sustituye por un
 *      globo. Sin la fuente, el navegador pinta las ocho letras. Como la pagina
 *      esta en espanol, "language" y "shopping_cart" aparecen mezcladas con el
 *      texto real, y el resultado parece una pagina a medio cargar en vez de
 *      una pagina sin iconos.
 *
 *   2. LOS TEXTOS SALEN EN LA TIPOGRAFIA DEL SISTEMA. Inter y Outfit no
 *      cargan y el sitio cae a la fuente por defecto de Windows o de Android.
 *      Sigue siendo legible, asi que tampoco se nota como un fallo.
 *
 *   3. EL SITIO ESPERA A GOOGLE ANTES DE DIBUJAR. La hoja de estilos externa
 *      para el render hasta que hay respuesta o hasta que expira la conexion.
 *      En una conexion Cubanaseficiente eso son segundos de pantalla en blanco
 *      en cada pagina.
 *
 * Los tres tienen la misma causa y la misma solucion: que el navegador pida las
 * fuentes al MISMO sitio que ya esta cargando. Cero peticiones a terceros, cero
 * dominios que bloquear, cero espera.
 *
 * ============================================================================
 *  POR QUE NO SE ESCRIBE EL CSS A MANO
 * ============================================================================
 * Google parte cada familia en subconjuntos segun rangos de Unicode: `latin`,
 * `latin-ext`, `cyrillic`, `greek`, `vietnamese`. El sitio declara 22 idiomas,
 * entre ellos ruso y arabe, asi que los rangos `cyrillic` hacen falta de verdad:
 * un visitante ruso tiene que ver el texto en su tipografia, no en la del
 * sistema.
 *
 * Copiar a mano las URL de `fonts.gstatic.com` seria copiar unas 30 lineas que
 * Google cambia cada pocas semanas sin avisar. Y un 404 de fuente no da error
 * en la consola: el sitio simplemente se queda sin tipografia, otra vez en
 * silencio.
 *
 * Este script pregunta a Google UNA vez, guarda lo que responde y a partir de
 * ahi el sitio no depende de Google para nada. Para actualizarlo se corre otra
 * vez: no se edita CSS a mano.
 *
 * ============================================================================
 *  EL AGENTE DE USUARIO IMPORTA
 * ============================================================================
 * Google devuelve las fuentes variables (un archivo para todos los pesos) solo
 * si el que pregunta dice que las soporta. Con el agente por defecto de Node
 * devuelve archivos estaticos separados por peso, que es varias veces mas peso.
 * El UA de abajo es el de Chrome, y por eso se manda.
 *
 * ============================================================================
 *  POR QUE EL NOMBRE DEL ARCHIVO NO ES EL DE GOOGLE
 * ============================================================================
 * Google llama igual a varios archivos distintos (`K6B8k4v9WkU.woff2` lo usa
 * para el latin de Inter y para el del Arabe). Si el nombre se derivara solo de
 * la familia y el subconjunto, dos descargas distintas escribirian sobre el
 * mismo archivo y la segunda borraria a la primera: el sitio tendria la fuente
 * correcta para un idioma y la del otro idioma en el sitio equivocado.
 *
 * Por eso el nombre lleva un hash de la URL. Es unico por archivo y no cambia
 * entre ejecuciones, asi que se puede volver a correr sin duplicar nada.
 */

import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const RAIZ = join(import.meta.dirname, '..')
const DESTINO = join(RAIZ, 'public', 'fuentes')

const UA_MODERNO =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Las familias de TEXTO, con los ejes que el sitio usa de verdad.
 *
 * Se piden los MISMOS ejes que pedia el `<link>` anterior. Cambiar un eje aqui
 * cambia el diseno sin que nadie lo decida: por eso se copia el valor literal.
 *
 * Material Symbols NO esta aqui, y fue lo mas importante que se borro de esta
 * lista. Era la tercera familia y pesaba 3909 KB: casi 4 MB de fuente para unos
 * 50 dibujitos. Los iconos ahora son SVG en linea (`Icono.astro`, con los
 * trazados en `src/lib/iconos.ts`), asi que no hay fuente que descargar. En Cuba,
 * donde Google Fonts esta bloqueado, esos 4 MB no llegaban nunca y los iconos se
 * veian con el NOMBRE escrito dentro.
 */
const FAMILIAS = [
  { nombre: 'Inter', consulta: 'family=Inter:wght@400;500;600;700' },
  { nombre: 'Outfit', consulta: 'family=Outfit:wght@500;600;700' },
]

/** Como se Normaliza un nombre de familia para usarlo en un archivo. */
function guion(cadena) {
  return cadena
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Descarga un archivo reintentando.
 *
 * Se reintenta porque `fonts.gstatic.com` corta la conexion de vez en cuando
 * desde una red domestica, y sin esto un fallo transitorio deja el proyecto
 * con la hoja de fuentes a medias: el `fuentes.css` del intento anterior
 * sobrevive y el sitio se queda sin tipografia sin que nadie entienda por que.
 *
 * El error del ultimo intento se lanza. Un archivo que no se pudo bajar no se
 * escribe: es preferible que el script falle y se vea, a que generates un CSS
 * que apunta a un archivo inexistente.
 */
async function bajar(url, intentos = 4) {
  let ultimoError
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const respuesta = await fetch(url, {
        headers: { 'User-Agent': UA_MODERNO },
        signal: AbortSignal.timeout(60_000),
      })
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
      return Buffer.from(await respuesta.arrayBuffer())
    } catch (error) {
      ultimoError = error
      // Espera creciente: si gstatic esta saturado, reintentar de inmediato
      // cuatro veces seguidas solo vuelve a saturarlo.
      if (intento < intentos) await new Promise((r) => setTimeout(r, intento * 1500))
    }
  }
  throw new Error(`${url}: ${ultimoError.message}`)
}

/**
 * Trocea el CSS de Google en sus bloques `@font-face`.
 *
 * Cada bloque va precedido de un comentario con el nombre del subconjunto
 * (`latin`, `cyrillic`...). Material Symbols es la excepcion: viene uno solo,
 * con el comentario `fallback`, porque no se reparte por subconjuntos. Por eso
 * el nombre del archivo no se apoya en el comentario sino en un hash de la URL.
 *
 * Se devuelve el bloque entero con su comentario, porque el CSS generado tiene
 * que ser el mismo que dio Google y no una reescritura: cualquier diferencia
 * introduce una fuente mal declarada que solo falla en produccion.
 */
function bloquesDe(css) {
  const partes = css.split('/*')
  const salida = []
  for (const parte of partes.slice(1)) {
    const finComentario = parte.indexOf('*/')
    if (finComentario === -1) continue
    const cuerpo = parte.slice(finComentario + 2)
    if (!cuerpo.includes('@font-face')) continue
    salida.push({ comentario: parte.slice(0, finComentario).trim(), cuerpo: cuerpo.trim() })
  }
  return salida
}

/** La familia declarada dentro de un bloque. Sirve para nombrar el archivo. */
function familiaDe(bloque) {
  return bloque.match(/font-family:\s*'([^']+)'/)?.[1] ?? 'fuente'
}

async function main() {
  await mkdir(DESTINO, { recursive: true })

  // Los `.woff2` que sobraron de una corrida anterior se borran. Sin esto, un
  // archivo que Google dejo de servir se queda en `public/` para siempre y
  // ocupa espacio en el despliegue sin que nada lo use.
  for (const archivo of await readdir(DESTINO)) {
    if (archivo.endsWith('.woff2')) await unlink(join(DESTINO, archivo))
  }

  const reglas = []
  const hechos = []
  let totalBytes = 0
  const vistas = new Set()

  for (const familia of FAMILIAS) {
    const url = `https://fonts.googleapis.com/css2?${familia.consulta}&display=swap`
    process.stdout.write(`\n${familia.nombre}\n`)

    const respuesta = await fetch(url, {
      headers: { 'User-Agent': UA_MODERNO },
      signal: AbortSignal.timeout(60_000),
    })
    if (!respuesta.ok) throw new Error(`${familia.nombre}: Google devolvio ${respuesta.status}`)
    const bloques = bloquesDe(await respuesta.text())

    if (bloques.length === 0) throw new Error(`${familia.nombre}: no se encontro ningun @font-face`)

    for (const { comentario, cuerpo } of bloques) {
      const remota = cuerpo.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1]
      if (!remota) continue

      const etiqueta = comentario && comentario !== 'fallback' ? comentario : 'base'
      const hash = createHash('sha256').update(remota).digest('hex').slice(0, 8)
      const archivo = `${guion(familiaDe(cuerpo))}-${guion(etiqueta)}-${hash}.woff2`
      vistas.add(archivo)

      // SECUENCIAL, no en paralelo. Son 27 archivos y abrir 27 conexiones
      // contra el mismo dominio desde una red domestica hace que gstatic
      // corte la conexion al que este en curso de bajar. Uno detras de otro
      // tarda un poco mas y termina siempre.
      const buffer = await bajar(remota)
      await writeFile(join(DESTINO, archivo), buffer)
      totalBytes += buffer.length
      hechos.push({ etiqueta, bytes: buffer.length })

      // El `@font-face` se copia tal cual y solo se cambia la URL por la local,
      // CON comillas. Google las manda sin comillas; se las ponen para que la
      // comprobacion final busque una sola forma y no dos.
      //
      // `unicode-range` se conserva, y es lo importante: es lo que hace que el
      // navegador descargue el archivo latino y no los siete cuando el texto es
      // en espanol.
      reglas.push(
        `/* ${familia.nombre} - ${etiqueta} */\n` + cuerpo.replace(`url(${remota})`, `url('/fuentes/${archivo}')`),
      )
    }
  }

  process.stdout.write('\ndescargando...\n')
  for (const { etiqueta, bytes } of hechos.sort((a, b) => b.bytes - a.bytes)) {
    process.stdout.write(`  ${etiqueta.padEnd(13)} ${(bytes / 1024).toFixed(0).padStart(5)} kB\n`)
  }

  const cabecera = `/*
 * Fuentes del sitio. GENERADO POR scripts/fuentes.mjs. No editar a mano.
 *
 * Cada bloque es el que devolvio Google Fonts, con unicamente la URL cambiada
 * por la local. Se conservan los \`unicode-range\` de origen porque son los que
 * hacen que un texto en espanol descargue el archivo latino y no los siete.
 *
 * Para regenerarlo: npm run fuentes
 */
`
  const cssFinal = `${cabecera}\n${reglas.join('\n\n')}\n`
  await writeFile(join(DESTINO, 'fuentes.css'), cssFinal, 'utf8')

  /*
   * Comprobacion final: cada `url(...)` del CSS tiene que existir en disco.
   *
   * Sin esto, un fallo a medio camino deja un CSS que APUNTA a archivos que no
   * estan, y el navegador no dice nada: pide el archivo, recibe un 404 de
   * Pages y se queda sin esa fuente. La pagina se ve con la tipografia del
   * sistema y los iconos como palabras sueltas, que es exactamente el fallo que
   * este script vino a arreglar. Fallar aqui es preferible a Deployar eso.
   */
  const referenciadas = [...cssFinal.matchAll(/url\('\/fuentes\/([^']+)'\)/g)].map((m) => m[1])
  const faltantes = referenciadas.filter((archivo) => !vistas.has(archivo))

  if (referenciadas.length === 0) throw new Error('el CSS generado no contiene ninguna url local')
  if (faltantes.length > 0) throw new Error(`el CSS apunta a archivos que no se descargaron:\n  ${faltantes.join('\n  ')}`)

  process.stdout.write(
    `\n${hechos.length} archivos, ${(totalBytes / 1024).toFixed(0)} kB en total\n` +
      `Hoja de estilos: public/fuentes/fuentes.css\n` +
      `Comprobado: las ${referenciadas.length} url del css existen en disco.\n`,
  )
}

await main()