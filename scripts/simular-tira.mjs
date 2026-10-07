/**
 * Comprueba la tira de productos del hero sin abrir el navegador.
 *
 * ============================================================================
 *  POR QUE NO SE COMPRUEBA EN EL NAVEGADOR
 * ============================================================================
 * Las ocho tarjetas cambian de foto con `producto-ciclo`, una animacion de 18 s.
 * Con la pestana oculta Chrome congela el reloj de animaciones:
 * `document.timeline.currentTime` se queda en 0 y todo lo que se mida es el
 * instante 0, que parece correcto aunque no lo sea. En local la pestana suele
 * estar visible y la medicion pasa; en CI o con la ventana minimizada no, y la
 * comprobacion dejaria de comprobar.
 *
 * Aqui se replica la matematica de los keyframes con los datos REALES de
 * `src/data/tira.ts` (el mismo modulo que usa la pagina), que es la unica forma
 * de saber que pasan las tres reglas sin depender de que el reloj avance.
 *
 * ============================================================================
 *  LAS TRES REGLAS
 * ============================================================================
 *   1. COBERTURA. La opacidad compuesta de la tarjeta vale 1 en todo instante.
 *      Si fuera menor se veria el fondo azul de la tarjeta un instante en cada
 *      cambio, que es un destello cada 6 s en ocho sitios a la vez.
 *
 *   2. SIN HUECOS. En todo instante hay al menos una foto visible. Una tarjeta
 *      vacia es un cuadrado de color en medio de la tira.
 *
 *   3. VECINAS DISTINTAS. Dos tarjetas vecinas no enseñan la misma foto a la
 *      vez, en las dos maquetas: 4 columnas en movil (horizontal, vertical y
 *      diagonal) y 8 en escritorio (horizontal, mas las parejas que comparten
 *      las tres fotos).
 *
 * ============================================================================
 *  COMO SE CORRE
 * ============================================================================
 *   npm run validar:tira     (tambien entra en `npm run validar:todo`)
 *
 * Sale con codigo distinto de 0 si algo falla, asi que sirve para CI.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIRA } from '../src/data/tira.ts'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const CARPETA_FOTOS = join(RAIZ, 'public', 'imagenes', 'productos')

/** Duracion de `producto-ciclo`, en segundos. */
const DURACION = 18
/** Paso de la simulacion, en segundos. 0,01 deja 1.800 muestras por ciclo. */
const PASO = 0.01
/** El error que se tolera al comparar una cobertura con 1. */
const EPSILON = 0.000001

/**
 * Opacidad de una foto a `e` segundos de su retraso.
 *
 * Es la traduccion literal de los puntos de `@keyframes producto-ciclo`:
 * entra en 0,7 s (3,889 %), se queda encendida hasta 6,7 s (37,222 %) y se
 * disuelve en 0,7 s, hasta el 41,111 % (7,4 s). Nota que NO se apaga mientras
 * entra la siguiente: por eso la cobertura vale 1.
 */
function opacidad(e) {
  const t = ((e % DURACION) + DURACION) % DURACION
  if (t < 0.7) return t / 0.7
  if (t < 6.7) return 1
  if (t < 7.4) return 1 - (t - 6.7) / 0.7
  return 0
}

/** Pares de tarjetas que pueden verse juntas en alguna de las dos maquetas. */
function paresVecinas() {
  const n = TIRA.length
  const pares = new Set()
  const add = (a, b) => pares.add(a < b ? `${a}-${b}` : `${b}-${a}`)
  for (let k = 0; k < n; k++) {
    if (k % 4 !== 3) add(k, k + 1)   // horizontal en 4 columnas
    if (k < n - 1) add(k, k + 1)     // horizontal en 8 columnas
    if (k + 4 < n) {
      add(k, k + 4)                   // vertical en 4 columnas
      add(k, k + 5)                   // diagonal
      if (k % 4 !== 3) add(k + 1, k + 4)
      if (k % 4 !== 0) add(k, k + 5)
    }
  }
  return [...pares].map((p) => p.split('-').map(Number))
}

function main() {
  const fallos = []

  // --- Estructura de los datos -------------------------------------------
  if (TIRA.length !== 8) fallos.push(`la tira tiene ${TIRA.length} tarjetas y deberia tener 8`)

  for (const [k, tarjeta] of TIRA.entries()) {
    if (tarjeta.length !== 3) {
      fallos.push(`la tarjeta ${k} apila ${tarjeta.length} fotos y deberia apilar 3`)
      continue
    }
    const fotos = tarjeta.map((f) => f.src.split('/').pop())
    if (new Set(fotos).size !== fotos.length) {
      fallos.push(`la tarjeta ${k} apila la misma foto dos veces: ${fotos.join(', ')}`)
    }
    for (const foto of fotos) {
      if (!existsSync(join(CARPETA_FOTOS, foto))) {
        fallos.push(`la tarjeta ${k} apila ${foto}, que no existe en public/imagenes/productos`)
      }
    }
  }

  const pares = paresVecinas()

  // --- Simulacion ---------------------------------------------------------
  let peorCobertura = 1
  let instantesSinFoto = 0
  const repetidas = new Map()
  const muestra = (t) =>
    TIRA.map((tarjeta) =>
      tarjeta.map((foto) => ({
        nombre: foto.src.split('/').pop(),
        o: opacidad(t - parseFloat(foto.retraso)),
      })),
    )

  for (let t = 0; t < DURACION; t += PASO) {
    const dominante = muestra(t).map((fotos) => {
      // La ultima en el DOM tapa a las anteriores: la que domina es la ultima
      // con opacidad suficiente para verse por encima.
      const visible = [...fotos].reverse().find((f) => f.o > 0.5)
      const cobertura = 1 - fotos.reduce((acc, f) => acc * (1 - f.o), 1)
      if (cobertura < peorCobertura) peorCobertura = cobertura
      if (cobertura <= EPSILON) instantesSinFoto++
      return visible?.nombre ?? null
    })

    for (const [a, b] of pares) {
      if (dominante[a] && dominante[a] === dominante[b]) {
        const clave = `${a}/${b}`
        const dato = repetidas.get(clave) ?? { veces: 0, primero: t, ultimo: t, foto: dominante[a] }
        dato.veces++
        dato.ultimo = t
        repetidas.set(clave, dato)
      }
    }
  }

  // --- Resultado ----------------------------------------------------------
  const coberturaOk = peorCobertura > 1 - EPSILON
  const huecosOk = instantesSinFoto === 0
  const vecinasOk = repetidas.size === 0

  console.log('tira del hero: 8 tarjetas x 3 fotos, ciclo de 18 s')
  console.log(`  pares de vecinas comprobados : ${pares.length}`)
  console.log(`  muestras                     : ${Math.round(DURACION / PASO)}`)
  console.log(`  cobertura minima             : ${peorCobertura.toFixed(6)}` +
    (coberturaOk ? '  (nunca se ve el fondo)' : '  *** SE VE EL FONDO ***'))
  console.log(`  instantes sin ninguna foto   : ${instantesSinFoto}` +
    (huecosOk ? '  (nunca hay hueco)' : '  *** HAY HUECOS ***'))
  console.log(`  instantes con dos vecinas igual: ${[...repetidas.values()].reduce((s, d) => s + d.veces, 0)}` +
    (vecinasOk ? '  (ninguna)' : '  *** VECINAS IGUALES ***'))

  for (const [par, d] of repetidas) {
    const [a, b] = par.split('/')
    console.log(`      tarjetas ${a} y ${b} enseñan "${d.foto}" entre ${d.primero.toFixed(2)} s y ` +
      `${d.ultimo.toFixed(2)} s (${d.veces} muestras)`)
  }

  if (!coberturaOk) {
    console.log('\nCon la salida solapada con la entrada, la suma de opacidades seria 1 y la')
    console.log('cobertura cairia a 0,75 a mitad de cada fundido. La salida tiene que empezar')
    console.log('cuando la entrada ya ha terminado.')
  }
  if (fallos.length) {
    console.log('\nDatos:')
    for (const f of fallos) console.log(`  - ${f}`)
  }

  const todoOk = coberturaOk && huecosOk && vecinasOk && fallos.length === 0
  console.log(`\n${todoOk ? 'TIRA CORRECTA' : 'LA TIRA TIENE FALLOS'}`)
  process.exit(todoOk ? 0 : 1)
}

main()
