/**
 * Genera las miniaturas de producto de `public/imagenes/`.
 *
 * ============================================================================
 *  POR QUE UN GENERADOR Y NO 22 ARCHIVOS SUELTOS
 * ============================================================================
 * Las 22 miniaturas son la misma figura con otro color y otro dibujo. Escritas a
 * mano, la diferencia entre una y otra es una letra de mas en un `rx` y esa
 * diferencia no se ve hasta que alguien compara las dos juntas en la pagina. Aqui
 * el lienzo, el radio de esquina y el trazo base son UNA sola constante, y lo que
 * cambia es solo la paleta y el glifo, que es lo unico que debe cambiar.
 *
 * El archivo generado se versiona: el sitio no puede depender de ejecutar un
 * script para arrancar, y `public/` se copia tal cual a `dist/`. Este script es
 * la fuente de verdad y los `.svg` de `public/imagenes/` son su salida.
 *
 * ============================================================================
 *  POR QUE SVG Y NO FOTOS
 * ============================================================================
 * No hay fotos de productos porque no hay productos publicados todavia, y
 * poner fotos de stock seria exactamente el dato ficticio que este proyecto
 * prohibio. Un SVG dibuja una categoria (una camiseta, un portatil), no afirma
 * que alguien este vendiendo algo concreto. Ademas pesa ~1 KB, no pide nada a
 * terceros (Google no se puede usar desde Cuba) y se ve nitida a 40 px y a 160.
 *
 * ============================================================================
 *  COLORES
 * ============================================================================
 * Fondo pastel y tinta saturada del mismo tono: el fondo no compite con el texto
 * de la tarjeta que lo rodea y la tinta si se ve. Nada de colores de marca
 * saturados en superficie grande, que es lo que convierte una tarjeta en un
 * cartel.
 *
 * Uso:  node scripts/imagenes.mjs
 */

import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const DESTINO = join(AQUI, '..', 'public', 'imagenes')

/** Lienzo. 96x96 y radio 22: mismo aspecto que usan las tarjetas. */
const LIENZO = 96
const RADIO_ESQUINA = 22

/**
 * Paleta por miniatura: `fondo` y `tinta` del mismo tono.
 *
 * El orden del objeto es el orden en que se escriben los ficheros, y ese orden
 * es el que se usa despues para elegir que miniatura toca en cada tarjeta.
 */
const PALETA = {
  /* --- Fisicos: las diez categorias del paquete de 60 dias --- */
  ropa: { fondo: '#FDECF1', tinta: '#D97A9B' },
  calzado: { fondo: '#FFF2E6', tinta: '#DE9154' },
  belleza: { fondo: '#F5EDFC', tinta: '#A97FD8' },
  joyeria: { fondo: '#FFF8E3', tinta: '#D3A244' },
  hogar: { fondo: '#EAF6EF', tinta: '#6EB191' },
  electronica: { fondo: '#EAF1FD', tinta: '#7399DE' },
  electrodomesticos: { fondo: '#EDF2F7', tinta: '#8398B3' },
  informatica: { fondo: '#E8F4F6', tinta: '#5EA9B8' },
  automotriz: { fondo: '#F2EEFC', tinta: '#9785DC' },
  construccion: { fondo: '#FDF0E6', tinta: '#D98E57' },

  /* --- Digitales --- */
  software: { fondo: '#E9F2FD', tinta: '#7299E0' },
  plantilla: { fondo: '#ECF0FE', tinta: '#8590E4' },
  ebook: { fondo: '#FDF0EC', tinta: '#D98171' },
  curso: { fondo: '#EAF7F0', tinta: '#5FB48C' },
  audio: { fondo: '#F8EDFC', tinta: '#B97DD4' },
  grafico: { fondo: '#FDF3E7', tinta: '#D99C5E' },
  codigo: { fondo: '#E9F6F3', tinta: '#5FB2A6' },
  servicio: { fondo: '#FDEEF3', tinta: '#D97E9B' },

  /* --- Estados vacios y pasos del vendedor --- */
  carrito: { fondo: '#EDF3FD', tinta: '#6F97DC' },
  paquete: { fondo: '#F1F0FC', tinta: '#8D8BD4' },
  dinero: { fondo: '#EAF7EE', tinta: '#68B081' },
  cuenta: { fondo: '#FDF1E9', tinta: '#D8906A' },
}

/**
 * El dibujo de cada miniatura, en las coordenadas del lienzo de 96.
 *
 * `T` es la tinta y `F` el fondo, sustituidos al escribir. Un elemento con
 * `opacity` sobre `F` es como se consigue el segundo tono sin incluir un tercer
 * color en la paleta.
 */
const DIBUJOS = {
  /* Camiseta: cuerpo, mangas y escote. */
  ropa: [
    '<path d="M36 26 L24 33 L29 45 L36 41 V70 H60 V41 L67 45 L72 33 L60 26 C56 32 40 32 36 26 Z" fill="T"/>',
    '<path d="M40 25 C44 32 52 32 56 25 Z" fill="F"/>',
    '<path d="M39 56 H57 M39 63 H51" stroke="F" stroke-width="3" stroke-linecap="round" opacity="0.75"/>',
  ],

  /* Zapatilla: suela, cuerpo y cordones. */
  calzado: [
    '<path d="M26 61 V51 C30 49 34 45 40 43 L48 41 L55 47 L66 51 C70 53 72 55 72 59 V61 Z" fill="T"/>',
    '<rect x="21" y="59" width="55" height="10" rx="5" fill="T" opacity="0.55"/>',
    '<path d="M41 47 L48 51 M45 44 L52 48" stroke="F" stroke-width="2.5" stroke-linecap="round"/>',
  ],

  /* Frasco de cosmético: tapa, cuello, cuerpo y etiqueta. */
  belleza: [
    '<rect x="41" y="21" width="14" height="12" rx="4" fill="T"/>',
    '<rect x="44" y="32" width="8" height="6" fill="T" opacity="0.6"/>',
    '<rect x="32" y="36" width="32" height="36" rx="11" fill="T"/>',
    '<rect x="38" y="47" width="20" height="14" rx="5" fill="F" opacity="0.88"/>',
  ],

  /* Anillo con gema. */
  joyeria: [
    '<circle cx="48" cy="58" r="14" fill="none" stroke="T" stroke-width="7"/>',
    '<path d="M48 21 L57 31 L48 41 L39 31 Z" fill="T" opacity="0.8"/>',
    '<path d="M41 31 H55" stroke="F" stroke-width="2" opacity="0.7"/>',
  ],

  /* Sillon: respaldo, brazos y asiento. */
  hogar: [
    '<rect x="30" y="29" width="36" height="25" rx="9" fill="T"/>',
    '<rect x="19" y="43" width="11" height="27" rx="5.5" fill="T" opacity="0.6"/>',
    '<rect x="66" y="43" width="11" height="27" rx="5.5" fill="T" opacity="0.6"/>',
    '<rect x="24" y="49" width="48" height="17" rx="7" fill="T"/>',
    '<rect x="27" y="66" width="5" height="7" rx="2" fill="T" opacity="0.5"/>',
    '<rect x="64" y="66" width="5" height="7" rx="2" fill="T" opacity="0.5"/>',
  ],

  /* Auriculares: arco y dos almohadillas. */
  electronica: [
    '<path d="M26 58 V50 A22 22 0 0 1 70 50 V58" fill="none" stroke="T" stroke-width="7" stroke-linecap="round"/>',
    '<rect x="18" y="50" width="14" height="22" rx="7" fill="T"/>',
    '<rect x="64" y="50" width="14" height="22" rx="7" fill="T"/>',
    '<rect x="23" y="56" width="4" height="10" rx="2" fill="F" opacity="0.7"/>',
  ],

  /* Lavadora: cuerpo, panel y puerta. */
  electrodomesticos: [
    '<rect x="27" y="23" width="42" height="50" rx="9" fill="T"/>',
    '<rect x="33" y="29" width="15" height="6" rx="3" fill="F" opacity="0.88"/>',
    '<circle cx="62" cy="32" r="4" fill="F" opacity="0.88"/>',
    '<circle cx="48" cy="54" r="14" fill="F" opacity="0.9"/>',
    '<circle cx="48" cy="54" r="8" fill="T" opacity="0.45"/>',
  ],

  /* Portatil: pantalla, interior y base. */
  informatica: [
    '<rect x="29" y="25" width="38" height="28" rx="5" fill="T"/>',
    '<rect x="34" y="30" width="28" height="18" rx="2" fill="F" opacity="0.85"/>',
    '<rect x="21" y="53" width="54" height="9" rx="4.5" fill="T" opacity="0.7"/>',
    '<rect x="41" y="56" width="14" height="3" rx="1.5" fill="F" opacity="0.8"/>',
  ],

  /* Coche: carroceria, ventanillas y ruedas. */
  automotriz: [
    '<path d="M22 60 V54 C22 51 24 49 27 49 L33 49 L39 41 C40 40 42 39 44 39 H56 C58 39 60 40 61 41 L67 49 L70 50 C72 51 74 53 74 55 V60 Z" fill="T"/>',
    '<path d="M37 48 L42 42 H47 V48 Z" fill="F" opacity="0.85"/>',
    '<path d="M51 42 H56 L61 48 H51 Z" fill="F" opacity="0.85"/>',
    '<circle cx="34" cy="62" r="8" fill="F"/>',
    '<circle cx="34" cy="62" r="4" fill="T"/>',
    '<circle cx="62" cy="62" r="8" fill="F"/>',
    '<circle cx="62" cy="62" r="4" fill="T"/>',
  ],

  /* Casco de obra: copa, cresta y ala. */
  construccion: [
    '<path d="M26 58 A22 22 0 0 1 70 58 Z" fill="T"/>',
    '<rect x="44" y="38" width="8" height="20" rx="4" fill="F" opacity="0.5"/>',
    '<rect x="21" y="56" width="54" height="9" rx="4.5" fill="T"/>',
  ],

  /* Ventana de aplicacion: barra con puntos y dos lineas de contenido. */
  software: [
    '<rect x="22" y="27" width="52" height="42" rx="8" fill="T"/>',
    '<path d="M30 27 H66 A8 8 0 0 1 74 35 V38 H22 V35 A8 8 0 0 1 30 27 Z" fill="F" opacity="0.4"/>',
    '<circle cx="31" cy="32.5" r="2.5" fill="T"/>',
    '<circle cx="39" cy="32.5" r="2.5" fill="T" opacity="0.6"/>',
    '<circle cx="47" cy="32.5" r="2.5" fill="T" opacity="0.6"/>',
    '<rect x="30" y="46" width="36" height="5" rx="2.5" fill="F" opacity="0.75"/>',
    '<rect x="30" y="56" width="24" height="5" rx="2.5" fill="F" opacity="0.75"/>',
  ],

  /* Maqueta de pagina: cabecera y dos columnas. */
  plantilla: [
    '<rect x="22" y="27" width="52" height="42" rx="8" fill="T"/>',
    '<rect x="28" y="33" width="40" height="9" rx="4.5" fill="F" opacity="0.85"/>',
    '<rect x="28" y="47" width="18" height="16" rx="5" fill="F" opacity="0.55"/>',
    '<rect x="50" y="47" width="18" height="16" rx="5" fill="F" opacity="0.55"/>',
  ],

  /* Libro abierto: dos paginas con lomo. */
  ebook: [
    '<path d="M46 33 C41 28 34 26 25 26 V62 C34 62 41 64 46 69 Z" fill="T"/>',
    '<path d="M50 33 C55 28 62 26 71 26 V62 C62 62 55 64 50 69 Z" fill="T" opacity="0.7"/>',
    '<path d="M32 38 H41 M32 45 H41 M55 38 H64 M55 45 H64" stroke="F" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>',
  ],

  /* Birrete: toga, botonadura y cordel. */
  curso: [
    '<path d="M48 26 L75 39 L48 52 L21 39 Z" fill="T"/>',
    '<path d="M33 44 V57 C33 57 39 63 48 63 C57 63 63 57 63 57 V44 L48 51 Z" fill="T" opacity="0.7"/>',
    '<path d="M69 41 V55" stroke="T" stroke-width="3" stroke-linecap="round"/>',
    '<circle cx="69" cy="59" r="4.5" fill="T"/>',
  ],

  /* Nota musical: cabeza, asta y bandera. */
  audio: [
    '<ellipse cx="37" cy="61" rx="12" ry="9" transform="rotate(-15 37 61)" fill="T"/>',
    '<rect x="47" y="26" width="5" height="36" rx="2.5" fill="T"/>',
    '<path d="M52 27 C61 30 67 35 67 43 C64 37 58 34 52 33 Z" fill="T" opacity="0.75"/>',
  ],

  /* Lapiz: cuerpo y punta. */
  grafico: [
    '<path d="M32 66 L36 52 L60 28 L68 36 L44 60 Z" fill="T"/>',
    '<path d="M32 66 L36 52 L44 60 Z" fill="F" opacity="0.88"/>',
    '<path d="M32 66 L35 60.5 L39.5 64 Z" fill="T"/>',
  ],

  /* Angle brackets y barra. */
  codigo: [
    '<path d="M40 31 L26 48 L40 65" fill="none" stroke="T" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M56 31 L70 48 L56 65" fill="none" stroke="T" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M52 28 L44 68" fill="none" stroke="T" stroke-width="5.5" stroke-linecap="round" opacity="0.6"/>',
  ],

  /* Burbuja de mensaje con tres puntos. */
  servicio: [
    '<path d="M32 26 H64 A10 10 0 0 1 74 36 V50 A10 10 0 0 1 64 60 H54 L44 70 V60 H32 A10 10 0 0 1 22 50 V36 A10 10 0 0 1 32 26 Z" fill="T"/>',
    '<circle cx="37" cy="43" r="3.5" fill="F" opacity="0.9"/>',
    '<circle cx="48" cy="43" r="3.5" fill="F" opacity="0.9"/>',
    '<circle cx="59" cy="43" r="3.5" fill="F" opacity="0.9"/>',
  ],

  /* Carrito de compra. */
  carrito: [
    '<path d="M25 29 H34 L41 58 H65 L72 37 H38" fill="none" stroke="T" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    '<circle cx="45" cy="68" r="5.5" fill="T"/>',
    '<circle cx="63" cy="68" r="5.5" fill="T"/>',
  ],

  /* Caja de envio con cinta. */
  paquete: [
    '<rect x="25" y="41" width="46" height="31" rx="6" fill="T"/>',
    '<rect x="21" y="29" width="54" height="15" rx="6" fill="T" opacity="0.7"/>',
    '<rect x="44" y="29" width="8" height="43" fill="F" opacity="0.88"/>',
  ],

  /* Billete. */
  dinero: [
    '<rect x="21" y="33" width="54" height="32" rx="7" fill="T"/>',
    '<circle cx="48" cy="49" r="10" fill="F" opacity="0.9"/>',
    '<circle cx="48" cy="49" r="5" fill="T"/>',
    '<rect x="26" y="39" width="7" height="20" rx="3.5" fill="F" opacity="0.45"/>',
    '<rect x="63" y="39" width="7" height="20" rx="3.5" fill="F" opacity="0.45"/>',
  ],

  /* Persona: cabeza y hombros. */
  cuenta: [
    '<circle cx="48" cy="39" r="14" fill="T"/>',
    '<path d="M25 73 C25 59 35 52 48 52 C61 52 71 59 71 73 Z" fill="T"/>',
  ],
}

/** Rellena `T` y `F` en un trozo de dibujo. */
function pintar(elemento, tinta, fondo) {
  return elemento.replaceAll('"T"', `"${tinta}"`).replaceAll('"F"', `"${fondo}"`)
}

function svg(nombre) {
  const { fondo, tinta } = PALETA[nombre]
  const cuerpo = DIBUJOS[nombre].map((e) => '  ' + pintar(e, tinta, fondo)).join('\n')
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">',
    `  <rect width="${LIENZO}" height="${LIENZO}" rx="${RADIO_ESQUINA}" fill="${fondo}"/>`,
    cuerpo,
    '</svg>',
    '',
  ].join('\n')
}

const nombres = Object.keys(PALETA)

/* Quitar lo que ya no esta en la paleta: un fichero huerfano es una miniatura
   que sigue en `dist/` despues de borrarla del generador. */
mkdirSync(DESTINO, { recursive: true })
for (const viejo of readdirSync(DESTINO)) {
  if (viejo.endsWith('.svg') && !nombres.includes(viejo.replace(/\.svg$/, ''))) {
    rmSync(join(DESTINO, viejo))
  }
}

for (const nombre of nombres) {
  writeFileSync(join(DESTINO, `${nombre}.svg`), svg(nombre), 'utf8')
}

console.log(`${nombres.length} miniaturas en public/imagenes/`)
