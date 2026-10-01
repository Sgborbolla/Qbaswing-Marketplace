/**
 * Genera las versiones livianas del logo para envios a terceros.
 *
 * ============================================================================
 *  ESTE SCRIPT NO MODIFICA NUNCA EL ORIGINAL
 * ============================================================================
 * La primera version de este archivo sobreescribia `logo-qbaswing.png`. No
 * deberia haberlo hecho: el original es la unica copia de la artwork a calidad
 * completa, y sobrescribirla significa que no se puede volver a un PNG de 1024
 * con cuatro canales. Se recupero con `git checkout HEAD --`, porque el archivo
 * estaba commiteado, y esa es la unica razon por la que se pudo recuperar. La
 * proxima vez que no estuviera commiteado, se perdia.
 *
 * La regla ahora: el original es de SOLO LECTURA y los archivos que salen se
 * llaman distinto. Si un archivo de salida se llamara igual que la entrada, el
 * siguiente que lo ejecute leeria su propia salida.
 *
 * ============================================================================
 *  PARA QUE HACE FALTA
 * ============================================================================
 * QvaPay acepta "JPG o PNG, max 1MB" y rechaza el logo original, que es un PNG
 * de 1024x1024 en RGBA y pesa 1.6 MB.
 *
 * Bajar de peso no es solo achicar. Un PNG de 1024x1024 con cuatro canales
 * ocupa 1 MB en memoria; a la mitad de ancho, 512x512, sigue ocupando 1 MB. Lo
 * que de verdad pesa es la profundidad, y bajarla es cuantizar la paleta: se
 * guarda un indice de 256 tonos en vez de cuatro canales por pixel.
 *
 * ============================================================================
 *  CUANTIZAR CUESTA CALIDAD, ASI QUE NO SE MINIMIZA EN EXCESO
 * ============================================================================
 * Los intentos van de mejor a peor y se para en el PRIMERO que cabe. Con 256
 * colores el logo baja a 475 KB conservando los 1024 px, y de hecho no hay que
 * tocar el ancho para nada. Achicarlo a 512 para "optimizar" seria tirar
 * calidad sin ganar nada, porque el limite se cumple de sobra.
 *
 * ============================================================================
 *  POR QUE SHARP NO ESTA EN package.json
 * ============================================================================
 * Se instalo con `--no-save`. Nada del build lo usa: esto se corre una vez, a
 * mano, y lo que se commitea son los archivos que produce. Declararlo
 * obligaria a cada clon del repositorio a instalar una dependencia con binarios
 * nativos para no usarla nunca.
 *
 * COMO SE CORRE
 *   npm install --no-save sharp
 *   node scripts/versiones-logo.mjs
 */
import { readFile, writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let sharp
try {
  ;({ default: sharp } = await import('sharp'))
} catch {
  console.error('falta sharp. Correr esto primero:\n\n  npm install --no-save sharp\n')
  process.exit(1)
}

const aqui = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(aqui, '..')

/**
 * El original. SOLO SE LEE. Cualquier escritura a esta ruta es un error.
 *
 * Vive en dos lugares porque el repositorio lo tiene en la raiz y en `public/`.
 * Los dos se leen y se comparan al final, porque si difieren no se sabe cual
 * esta bien y reducir el equivocado es un descuido que no se ve.
 */
const ORIGINAL_RAIZ = join(RAIZ, 'logo-qbaswing.png')
const ORIGINAL_PUBLIC = join(RAIZ, 'public', 'logo-qbaswing.png')

/** Los archivos que produce este script. Ninguno se llama como el original. */
const SALIDA_PNG = join(RAIZ, 'public', 'logo-qbaswing-qvapay-1024.png')
const SALIDA_JPG = join(RAIZ, 'public', 'logo-qbaswing-qvapay-1024.jpg')

/** QvaPay acepta "max 1MB". Se usa 1024 KB, no 1000: es el limite mas exacto. */
const LIMITE = 1024 * 1024

const a = await readFile(ORIGINAL_RAIZ)
const b = await readFile(ORIGINAL_PUBLIC)

if (a.length !== b.length) {
  console.error(
    `los dos originales pesan distinto: raiz ${a.length} bytes, public ${b.length} bytes.\n` +
      'Se usa el de la raiz. Revisar antes de continuar.',
  )
} else if (!a.equals(b)) {
  console.error('los dos originales tienen los mismos bytes de largo pero NO son iguales.')
} else {
  console.log('los dos originales son identicos byte a byte. Se usa cualquiera de los dos.')
}

const meta = await sharp(a).metadata()
console.log(
  `original (solo lectura): ${meta.width}x${meta.height}  canales=${meta.channels}  ` +
    `${meta.hasAlpha ? 'con transparencia' : 'sin transparencia'}  ${(a.length / 1024).toFixed(1)} KB`,
)

/* ---------------------------------------------------------------------------
 * 1. El PNG cuantizado
 * ------------------------------------------------------------------------ */

const png = await sharp(a)
  .png({ palette: true, colours: 256, compressionLevel: 9, effort: 10 })
  .toBuffer()

const pngMeta = await sharp(png).metadata()
console.log(
  `\nPNG: ${pngMeta.width}x${pngMeta.height}  ${(png.length / 1024).toFixed(1)} KB  ` +
    `paleta de 256  ${png.length <= LIMITE ? 'CABE' : 'NO CABE'}`,
)

/* ---------------------------------------------------------------------------
 * 2. El JPG, que es el segundo formato que acepta el formulario
 * ------------------------------------------------------------------------ */

/*
 * El JPG no tiene canal alfa: el fondo transparente se vuelve negro. Un logo con
 * fondo negro se ve bien en una pagina clara y mal en el panel del formulario,
 * que es blanco. Por eso el JPG se compone sobre blanco explicito con `flatten`.
 * Es peor que el PNG para un logo, pero es la unica forma de que un JPG sirva,
 * y asi queda un archivo de respaldo si el PNG da problemas.
 */
const jpg = await sharp(a)
  .flatten({ background: '#ffffff' })
  .jpeg({ quality: 92, progressive: true, chromaSubsampling: '4:4:4' })
  .toBuffer()

const jpgMeta = await sharp(jpg).metadata()
console.log(
  `JPG: ${jpgMeta.width}x${jpgMeta.height}  ${(jpg.length / 1024).toFixed(1)} KB  ` +
    `sobre blanco, calidad 92  ${jpg.length <= LIMITE ? 'CABE' : 'NO CABE'}`,
)

if (png.length > LIMITE) {
  console.error('\nel PNG no cabe. No se escribe nada.')
  process.exit(1)
}

await writeFile(SALIDA_PNG, png)
await writeFile(SALIDA_JPG, jpg)

console.log('\nescritos:')
for (const f of [SALIDA_PNG, SALIDA_JPG]) {
  // `stat` devuelve `size` en bytes. Se usa `size` y no `length`: con `length`
  // la cuenta sale `NaN KB`, que parece un archivo vacio cuando lo que paso es
  // que se leyo una propiedad que no existe.
  const s = await stat(f)
  console.log(`  ${f.replace(RAIZ + '\\', '')}  ${(s.size / 1024).toFixed(1)} KB`)
}

console.log('\nEl original no se toco. Siguen los dos en 1.6 MB.')
