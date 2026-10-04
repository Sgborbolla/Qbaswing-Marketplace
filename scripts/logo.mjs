/**
 * Genera todas las versiones del logo que sirve el sitio, desde un unico original.
 *
 * ============================================================================
 *  EL ORIGINAL NO SE TOCA NUNCA
 * ============================================================================
 * `logotipo 2.jpg` es la unica copia de la artwork. Este script solo lo lee.
 * Nada aqui escribe sobre el, ni con `--force`, ni por accidente: los nombres
 * de salida son todos distintos del de entrada.
 *
 * La regla existe porque ya se perdio una vez. La primera version de
 * `versiones-logo.mjs` sobreescribia `logo-qbaswing.png` con una version
 * cuantizada, y la recuperacion fue posible solo porque el archivo estaba
 * commiteado. Si no lo hubiera estado, se perdia para siempre.
 *
 * ============================================================================
 *  QUE PRODUCE Y PARA QUE CADA COSA
 * ============================================================================
 * El sitio usa el logo en cuatro sitios con requisitos distintos, y confundirlos
 * es un fallo que no se ve hasta que pasa:
 *
 *   logo-qbaswing.webp         512  El `<img>` de la cabecera, el pie y el 404.
 *                                    Se ve a 32, 40 y 96 px, o sea hasta 288 px
 *                                    en una pantalla de telefono con densidad 3.
 *                                    512 cubre eso con holgura.
 *
 *   logo-qbaswing-og.jpg      1024  La imagen de Open Graph. Es la que ven los
 *                                    messengers y las redes al compartir un
 *                                    enlace. ESTOS NO LEEN WEBP: es el unico
 *                                    motivo por que existe un JPG aparte.
 *
 *   apple-touch-icon.png        180  El icono que iOS pone en la pantalla de
 *                                    inicio. iOS NO ACEPTA WEBP ni JPG aqui: lo
 *                                    descarta y usa una captura borrosa de la
 *                                    pagina.
 *
 *   favicon.png                 32  La pestaña. Se declara tambien el tamano en
 *                                    el `type` del `<link>` porque hay navegadores
 *                                    que eligen archivo por la extension.
 *
 *   logo-qbaswing-qvapay-*    1024  El formulario de QvaPay pide "JPG o PNG,
 *                                    max 1MB". QvaPay no se va a montar (no hay
 *                                    credenciales y no hay con que pagarla), asi
 *                                    que estos dos archivos no los usa nadie: se
 *                                    siguen generando para que, si algun dia se
 *                                    abre esa puerta, no haya que buscar el logo
 *                                    compatible otra vez.
 *
 * ============================================================================
 *  POR QUE EL `.webp` Y NO EL `.png` PARA MOSTRAR
 * ============================================================================
 * El original es un JPG de 1.37 MB para 1024 px, y se muestra a 40 px. Servir
 * 1.37 MB para un cuadrado de 40 px es la razon por la que una conexion
 * Cubanaseficiente se atasca en la cabecera antes de pintar nada.
 *
 * WebP a 512 px baja de 1.37 MB a unas decenas de kB con diferencia que a 40 px
 * no se ve. Y `object-contain` mas el fondo del contenedor hacen que el recorte
 * no se note.
 *
 * ============================================================================
 *  ESTE ARCHIVO NO ES UNA DEPENDENCIA DEL BUILD
 * ============================================================================
 * Nada de lo que hay en `astro build` usa `sharp`. Esto se corre a mano y lo que
 * se commitea son los archivos que produce. Por eso `sharp` va con
 * `--no-save` y no esta en `package.json`: declararla obligaria a cada clon del
 * repositorio a instalar una dependencia con binarios nativos para no usarla
 * nunca.
 *
 * COMO SE CORRE
 *   npm install --no-save sharp
 *   npm run logo
 */
import { readFile, writeFile, stat, rm } from 'node:fs/promises'
import { join } from 'node:path'

let sharp
try {
  ;({ default: sharp } = await import('sharp'))
} catch {
  console.error('falta sharp. Correr esto primero:\n\n  npm install --no-save sharp\n')
  process.exit(1)
}

const RAIZ = join(import.meta.dirname, '..')

/** El original. SOLO LECTURA. */
const ORIGINAL = join(RAIZ, 'logotipo 2.jpg')

/** Lo que el sitio servia hasta ahora, y que sale de la aplicacion al replace. */
const VIEJOS = [
  join(RAIZ, 'public', 'logo-qbaswing.png'),
  join(RAIZ, 'logo-qbaswing.png'),
  join(RAIZ, 'public', 'logo-qbaswing-qvapay-1024.png'),
  join(RAIZ, 'public', 'logo-qbaswing-qvapay-1024.jpg'),
]

/**
 * Las salidas.
 *
 * `aplicar` es una funcion y no un objeto de formato porque `sharp.toFormat()`
 * recibe el formato como segundo argumento y no como un objeto suelto: pasarselo
 * como objeto devuelve un error que no menciona el formato. Escribiendo la
 * cadena de una vez por entrada no hay forma de confundirlo.
 */
const SALIDAS = [
  {
    nombre: 'logo-qbaswing.webp',
    alto: 512,
    aplicar: (p) => p.webp({ quality: 86 }),
    nota: 'el <img> de la cabecera, el pie y el 404',
  },
  {
    nombre: 'logo-qbaswing-og.jpg',
    alto: 1024,
    aplicar: (p) => p.jpeg({ quality: 90, progressive: true }),
    nota: 'og:image, que los previsualizadores no leen en webp',
  },
  {
    nombre: 'apple-touch-icon.png',
    alto: 180,
    aplicar: (p) => p.png({ compressionLevel: 9 }),
    nota: 'iOS acepta solo png aqui',
  },
  {
    nombre: 'favicon.png',
    alto: 32,
    aplicar: (p) => p.png({ compressionLevel: 9, palette: true }),
    nota: 'la pestaña del navegador',
  },
  {
    nombre: 'logo-qbaswing-qvapay-1024.png',
    alto: 1024,
    aplicar: (p) => p.png({ palette: true, colours: 256, compressionLevel: 9, effort: 10 }),
    nota: 'formulario de QvaPay, sin usar',
  },
  {
    nombre: 'logo-qbaswing-qvapay-1024.jpg',
    alto: 1024,
    aplicar: (p) => p.jpeg({ quality: 92, progressive: true }),
    nota: 'respaldo del anterior, sin usar',
  },
]

const original = await readFile(ORIGINAL)
const meta = await sharp(original).metadata()

console.log(
  `original (solo lectura): ${meta.width}x${meta.height}  ` +
    `${meta.hasAlpha ? 'con transparencia' : 'SIN transparencia'}  ` +
    `${(original.length / 1024).toFixed(0)} KB  ${ORIGINAL.replace(RAIZ + '\\', '')}`,
)

if (meta.width !== meta.height) {
  console.error(`\nEl original no es cuadrado (${meta.width}x${meta.height}) y se recortaria.`)
  console.error('No se escribe nada. Corregir el archivo antes de seguir.')
  process.exit(1)
}

const hechos = []

for (const salida of SALIDAS) {
  const destino = join(RAIZ, 'public', salida.nombre)

  const buffer = await salida.aplicar(
    sharp(original).resize({ width: salida.alto, height: salida.alto, fit: 'contain' }),
  ).toBuffer()

  await writeFile(destino, buffer)
  const s = await stat(destino)
  hechos.push({ nombre: salida.nombre, kb: s.size / 1024, nota: salida.nota })
}

/*
 * Los archivos del logo anterior se borran, no se dejan.
 *
 * Es tentador conservarlos "por si acaso", pero un archivo viejo en `public/`
 * es un archivo que `astro build` copia a `dist/` y que `wrangler pages deploy`
 * sube. Siguen ocupando espacio, siguen siendo descargables por URL aunque nadie
 * los enlace, y son la clase de cosa que un dia se vuelve a enlazar sin querer.
 */
const borrados = []
for (const viejo of VIEJOS) {
  try {
    await rm(viejo)
    borrados.push(viejo.replace(RAIZ + '\\', ''))
  } catch {
    // No existia. No es un fallo: la lista incluye los dos sitios donde el
    // original vivia y no siempre estan los dos.
  }
}

console.log('\nescritos:')
for (const h of hechos) {
  console.log(`  ${h.nombre.padEnd(32)} ${h.kb.toFixed(0).padStart(4)} KB   ${h.nota}`)
}

if (borrados.length > 0) {
  console.log('\nborrados (el logo anterior):')
  for (const b of borrados) console.log(`  ${b}`)
}

console.log('\nEl original no se toco.')