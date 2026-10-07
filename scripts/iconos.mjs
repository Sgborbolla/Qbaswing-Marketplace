/**
 * Descarga los iconos que usa el sitio y escribe `src/lib/iconos.ts`.
 *
 * ============================================================================
 *  POR QUE HAY QUE HACER ESTO
 * ============================================================================
 * Los iconos estaban en Material Symbols, una fuente con ligaduras: el
 * `<span class="material-symbols-outlined">shopping_cart</span>` no es el texto
 * "shopping_cart", es el nombre de un glifo que la fuente sustituye por un
 * dibujo. Esa fuente, variable y con todos los ejes, pesa 3909 KB.
 *
 * Son casi 4 MB. En una conexion Cubanaseficiente, el navegador tiene que
 * esperar a que se descarguen antes de pintar los iconos, y como la fuente es
 * la ultima peticion, la pagina aparece con un hueco donde deberia haber un
 * dibujo. Ademas, si la fuente no llega, los iconos no desaparecen: se ven las
 * PALABRAS, porque el texto esta en el HTML. "shopping_cart" escrito en medio de
 * una pagina en espanol parece una pagina a medio cargar.
 *
 * Con SVG en linea no hay fuente, no hay descarga y no hay texto de reserva:
 * cada icono son 300 a 900 bytes de `d="..."` dentro de la pagina que ya se
 * esta descargando. Los 44 iconos del sitio ocupan unos 25 KB en total.
 *
 * ============================================================================
 *  DE DONDE SALEN LOS TRAZADOS
 * ============================================================================
 * Del endpoint oficial de Google, uno por icono:
 *
 *   https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/<nombre>/default/24px.svg
 *
 * NO se escriben a mano. Un trazado inventado se ve "parecido" hasta que se
 * compara con el original, y en un sitio con la bandera de Cuba en la cabecera
 * un icono medio bien puesto se nota. Estos son los archivos que publica Google,
 * byte a byte.
 *
 * El `viewBox` de estos iconos es `0 -960 960 960`, no el `0 0 24 24` de los
 * SVG habituales: la fuente trabaja con la Y hacia arriba y el SVG con la Y
 * hacia abajo. Por eso el componente `Icono.astro` copia ese `viewBox` tal cual
 * y no "lo arregla" por unaconversion que lo dejaria del reves.
 *
 * ============================================================================
 *  LA COMPROBACION QUE IMPORTANTA
 * ============================================================================
 * Al final se releen TODOS los `.astro` del proyecto y se busca cada nombre de
 * icono que aparece. Si alguno no esta en el mapa generado, el script falla.
 *
 * Sin esa comprobacion, un icono nuevo que alguien escriba en un `.astro` llega
 * a produccion sin trazado: `ICONOS[nombre]` es `undefined`, el `path` se
 * queda sin `d`, y sale un cuadrado de 24x24 vacio. No hay error, ni en la
 * consola ni en el build. Con la comprobacion, falla antes.
 *
 * ============================================================================
 *  NO ES UNA DEPENDENCIA DEL BUILD
 * ============================================================================
 * Esto se corre a mano y lo que se commitea es `src/lib/iconos.ts`. Nada de
 * `astro build` necesita red, ni Google, ni este archivo.
 *
 * COMO SE CORRE
 *   npm run iconos
 */
import { writeFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const RAIZ = join(import.meta.dirname, '..')
const SRC = join(RAIZ, 'src')
const DESTINO = join(SRC, 'lib', 'iconos.ts')

/** De donde sale cada SVG. */
const PLANTILLA =
  'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/{nombre}/default/24px.svg'

/**
 * Iconos que el escaneo del HTML NO puede ver.
 *
 * Son los que se arman con JavaScript dentro del navegador: el carrito y el panel
 * de cuenta dibujan su contenido cuando llegan los datos, asi que en el archivo
 * `.astro` aparece el NOMBRE como argumento de una funcion
 * (`simbolo('remove', ...)`, `tarjeta('Mi tienda', 'storefront')`) y no dentro de
 * una etiqueta. Ningun regex que mire el HTML los encuentra.
 *
 * Van escritos a mano y por eso son una lista, no un descubrimiento. La red de
 * seguridad es el tipo: `crearIcono(nombre: NombreIcono)` no compila con un
 * nombre que no este en el mapa, asi que si alguien escribe un icono nuevo en
 * JavaScript y no lo anade aqui, `astro check` lo dice.
 */
const DESDE_JAVASCRIPT = [
  'add',
  'remove',
  'delete',
  'lock',
  'badge',
  'percent',
  'history',
  'shield_person',
]

/**
 * Iconos que se muestran RELLENOS.
 *
 * Antes era una regla de CSS que ponia el eje `FILL` a 1:
 *
 *   .tile-icono > .material-symbols-outlined { font-variation-settings: 'FILL' 1, ... }
 *
 * Ese eje pertenece a la fuente variable. Un SVG no tiene ejes, asi que no hay
 * forma de pasarlo: el relleno tiene que venir en el trazado. Google publica
 * los dos trazados del mismo icono, y por eso se descargan los dos.
 *
 * Son solo los iconos de las baldosas de la portada, que es el unico sitio que
 * los usa rellenos. No se descargan los 52 rellenos porque seriam otros 15 KB
 * en el sitio para seis iconos que se ven una vez.
 *
 * Van declarados y no se descubren porque no se pueden descubrir: el codigo dice
 * `relleno` como una propiedad del componente, no como el nombre de un icono
 * distinto, asi que un escaneo del HTML no los separaria.
 *
 * Si Google no publica la variante rellena de alguno, el script falla al pedir
 * esa URL, que es exactamente lo que tiene que pasar en vez de dejar el icono
 * sin relleno sin avisar.
 */
const RELLENOS = ['code', 'checkroom', 'payments', 'timer', 'storefront', 'verified_user']

/** Todos los `.astro` del proyecto, en una lista. */
/**
 * Los archivos donde puede haber un nombre de icono.
 *
 * `.astro` Y `.ts`, no solo `.astro`. Los iconos de redes sociales viven en
 * `src/lib/plataforma.ts` (`REDES_INICIALES`), que es un modulo de datos, y se
 * pintan desde el pie. Escaneando solo los `.astro` el mapa sale sin esos seis y
 * el fallo aparece en el componente, lejos de la causa.
 */
const EXTENSIONES = ['.astro', '.ts']

async function archivosAstro(directorio) {
  const encontrados = []
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    const completa = join(directorio, entrada.name)
    if (entrada.isDirectory()) encontrados.push(...(await archivosAstro(completa)))
    else if (EXTENSIONES.some((ext) => entrada.name.endsWith(ext))) encontrados.push(completa)
  }
  return encontrados
}

/**
 * Saca los nombres de icono que aparecen en el codigo.
 *
 * Hay cuatro formas de escribir uno y todas tienen que salir. Las tres primeras
 * eran del sistema con fuente; la cuarta es la que creo `Icono.astro` y es la
 * que manda ahora:
 *
 *   1. `<span class="material-symbols-outlined">nombre</span>` en una linea.
 *   2. Igual, pero con el nombre en la linea de abajo, que es como esta
 *      formateado el codigo del proyecto.
 *   3. `{ICONO.clave}`, donde `clave` esta en un objeto `const ICONO = { clave: 'nombre' }`.
 *   4. `<Icono nombre="nombre" />`, ya sea el nombre literal o `nombre={ICONO.clave}`.
 *
 * La 4 es la importante. Sin ella, el script no ve NADA en un proyecto ya
 * migrado: no quedan `<span>` que leer, `DESDE_JAVASCRIPT` sigue dando los
 * mismos ocho, y genera un mapa con ocho iconos. `Icono.astro` deja de
 * compilar por los que faltan, que es como se detecta: un error de tipos en vez
 * de un cuadrado vacio en pantalla.
 *
 * La 3 es la que mas se escapa de las otras: si solo se buscan los `<span>`
 * literales, los quince iconos de la portada no aparecen en la lista.
 */
/**
 * Quita los comentarios del código antes de buscar nombres.
 *
 * Sin esto, cualquier ejemplo que aparezca en un comentario entra en el mapa.
 * Pasa de verdad: al escribir la nota de por que `facebook` no se usa, el ejemplo
 * `icono: 'faceboolk'` (a proposito, con dos eles) salio de un 404 al intentar
 * descargarlo, porque el escaner leyo el comentario como si fuera codigo.
 *
 * Se borran los comentarios de linea y de bloque. Es una cuenta de mas, pero es
 * la unica forma de que escribir documentacion no cambie el resultado del
 * script.
 */
function sinComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function nombresEn(codigo) {
  const contenido = sinComentarios(codigo)
  const nombres = new Set()

  // 4: el nombre que se le pasa al componente.
  for (const m of contenido.matchAll(/<Icono\s+nombre\s*=\s*"([a-z_0-9]+)"/g)) nombres.add(m[1])

  // 1 y 2: el nombre en la misma linea o en la siguiente, con espacios de por
  // medio. Se permiten lineas en blanco entre el `>` y el nombre porque asi es
  // como lo formatea el proyecto.
  const conNombres = /material-symbols-outlined[^>]*>\s*(?:<!--.*?-->\s*)?([a-z_0-9]+)\s*</gs
  for (const m of contenido.matchAll(conNombres)) nombres.add(m[1])

  // El caso de "el nombre esta en la linea de abajo": el `>` cierra el span en
  // una linea y el nombre va en la siguiente, sin `<` detras porque el `</span>`
  // se compta como parte del patron de arriba en cuanto hay espacios y saltos.
  const siguienteLinea = /material-symbols-outlined[^>]*>\s*\n\s*([a-z_0-9]+)\s*\n\s*<\/span>/g
  for (const m of contenido.matchAll(siguienteLinea)) nombres.add(m[1])

  // 3: los mapas `clave: 'nombre'`. Se toman SOLO dentro de un objeto que se
  // llame ICONO, para no confundir un `tipo: 'texto'` cualquiera con un icono.
  for (const bloque of contenido.matchAll(/const\s+ICONO\w*\s*=\s*\{([^}]*)\}/gs)) {
    for (const m of bloque[1].matchAll(/([a-zA-Z_0-9]+)\s*:\s*'([a-z_0-9]+)'/g)) nombres.add(m[2])
  }

  // 5: los campos que se llaman `icono`. Es lo que usan `REDES_INICIALES` en
  // `plataforma.ts`, que es un array de objetos y no un mapa `ICONO`, asi que la
  // forma de arriba no lo ve. Sin esta linea, los seis iconos de redes sociales
  // del pie no estan en el mapa y el `Icono` del pie no compila.
  for (const m of contenido.matchAll(/\bicono\s*:\s*'([a-z_0-9]+)'/g)) nombres.add(m[1])

  return nombres
}

/** Descarga un icono con reintentos, por la misma razon que en `fuentes.mjs`. */
async function bajar(url, intentos = 4) {
  let ultimoError
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(45_000) })
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
      return await respuesta.text()
    } catch (error) {
      ultimoError = error
      if (intento < intentos) await new Promise((r) => setTimeout(r, intento * 1200))
    }
  }
  throw new Error(`${url}: ${ultimoError.message}`)
}

async function main() {
  const archivos = await archivosAstro(SRC)
  const usados = new Set()

  for (const archivo of archivos) {
    const { readFile } = await import('node:fs/promises')
    for (const nombre of nombresEn(await readFile(archivo, 'utf8'))) usados.add(nombre)
  }

  // Los de JavaScript no aparecen en ningun HTML: se anaden aqui.
  for (const nombre of DESDE_JAVASCRIPT) usados.add(nombre)

  // Los rellenos son una segunda pasada sobre una lista declarada.
  for (const nombre of RELLENOS) {
    if (!usados.has(nombre)) {
      throw new Error(
        `${nombre} esta en la lista de rellenos pero no se usa en ninguna pagina. ` +
          'Sobra en el sitio, y un icono que no se muestra tambien pesa.',
      )
    }
  }

  const lista = [...usados].sort()
  console.log(`\n${lista.length} iconos referenciados en ${archivos.length} archivos .astro\n`)

  const trazados = []

  /**
   * Pide un trazado a Google y devuelve el `d` con su `viewBox`.
   *
   * `estilo` es `default` o `fill1`. Los dos tienen que salir del MISMO
   * `viewBox`: si el relleno viniera con otro, habria que guardarlo por icono y
   * el `viewBox` unico de `Icono.astro` dejaria de servir.
   */
  async function pedir(nombre, estilo) {
    const url = PLANTILLA.replace('{nombre}', nombre).replace('/default/', `/${estilo}/`)
    const svg = await bajar(url)
    const d = svg.match(/<path[^>]*\bd="([^"]+)"/)?.[1]
    if (!d) throw new Error(`${nombre}/${estilo}: el svg de Google no trae ningun atributo d`)
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]
    if (!viewBox) throw new Error(`${nombre}/${estilo}: el svg de Google no trae viewBox`)
    return { d, viewBox }
  }

  for (const nombre of lista) {
    const { d, viewBox } = await pedir(nombre, 'default')
    trazados.push({ nombre, d, viewBox })
    process.stdout.write(`  ${nombre.padEnd(22)} ${d.length.toString().padStart(4)} bytes de trazado\n`)
  }

  const rellenos = []
  for (const nombre of RELLENOS) {
    const { d, viewBox } = await pedir(nombre, 'fill1')
    rellenos.push({ nombre, d, viewBox })
    process.stdout.write(`  ${`${nombre} (relleno)`.padEnd(22)} ${d.length.toString().padStart(4)} bytes de trazado\n`)
  }

  // El viewBox tiene que ser el mismo para todos. Si no lo fuera, `Icono.astro`
  // tendria que guardarlo por icono, y un unico `viewBox` en el componente seria
  // una suposicion que un dia se rompe en un solo icono y en ninguno mas.
  const viewBoxes = new Set([...trazados, ...rellenos].map((t) => t.viewBox))
  if (viewBoxes.size !== 1) {
    throw new Error(`Google devuelve distintos viewBox: ${[...viewBoxes].join(' | ')}`)
  }

  const lineas = trazados.map((t) => `  ${t.nombre}: '${t.d}',`)
  const lineasRelleno = rellenos.map((t) => `  ${t.nombre}: '${t.d}',`)
  const total =
    [...trazados, ...rellenos].reduce((suma, t) => suma + t.d.length, 0)

  const contenido = `/**
 * Trazados de los iconos del sitio.
 *
 * ============================================================================
 *  GENERADO POR scripts/iconos.mjs — NO EDITAR A MANO
 * ============================================================================
 * Cada \`d\` es el atributo del SVG que publica Google para ese icono de Material
 * Symbols, copiado tal cual. Para agregar un icono: se escribe en el .astro, se
 * corre \`npm run iconos\`, y el script falla si el nombre no existe en Google.
 *
 * viewBox de todos: \`${[...viewBoxes][0]}\`. No es el habitual \`0 0 24 24\`: la
 * fuente trabaja con la Y hacia arriba y el SVG con la Y hacia abajo, asi que
 * ese rectangulo es el que recorta el dibujo en su sitio.
 *
 * Se guardan aqui y no como archivos sueltos porque son unos 17 KB en total y
 * docenas de peticiones menos en cada pagina.
 *
 * Antes esto era una fuente de 3909 KB con ligaduras: el nombre del icono viajaba
 * dentro del HTML y la fuente lo cambiaba por un dibujo. En Cuba, donde Google
 * Fonts esta bloqueado, no llegaba la fuente y se veia el NOMBRE escrito.
 */

export const ICONOS = {
${lineas.join('\n')}
} as const

/**
 * Los mismos iconos, pero rellenos.
 *
 * Solo los ${rellenos.length} que salen en las baldosas de la portada. El relleno
 * antes era el eje \`FILL\` de la fuente variable; un SVG no tiene ejes, asi que
 * el relleno tiene que venir en el trazado. Por eso son dos mapas y no uno con
 * una bandera.
 *
 * Un icono que no esta aqui NO TIENE relleno. \`Icono.astro\` no falla si se pide
 * \`relleno\` de uno: cae al trazado normal. Es a proposito: un icono en perfil
 * dibujado se veria igual de bien que uno relleno, y negarle el relleno a
 * proposito no es un error.
 */
export const ICONOS_RELLENOS: Partial<Record<NombreIcono, string>> = {
${lineasRelleno.join('\n')}
}

export type NombreIcono = keyof typeof ICONOS

/**
 * El viewBox que comparten todos los iconos.
 *
 * Sin las comillas de acento del comentario de mas arriba: al ser el valor de un
 * atributo SVG, unas backticks literales lo hacen invalido y el navegador lo
 * ignora, con el resultado de que cada icono se pinta a escala 1:1 de 960
 * unidades dentro de una caja de 13 px y sale en blanco.
 */
export const VIEWBOX_ICONO = '${[...viewBoxes][0]}'
`
  await writeFile(DESTINO, contenido, 'utf8')

  console.log(
    `\nescrito: ${relative(RAIZ, DESTINO)}\n` +
      `${trazados.length} iconos + ${rellenos.length} rellenos, ${(total / 1024).toFixed(1)} KB de trazados\n` +
      `viewBox comun: ${[...viewBoxes][0]}`,
  )
}

await main()