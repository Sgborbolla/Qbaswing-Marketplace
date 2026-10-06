/**
 * Formateo de dinero y fechas para la interfaz.
 *
 * ============================================================================
 *  POR QUE ESTO NO ESTA EN `api.ts`
 * ============================================================================
 * `api.ts` traduce lo que devuelve la API a los tipos del dominio: sus
 * entradas son datos crudos. Aqui las entradas son valores ya tipados y la
 * salida es texto que se ve. La linea que separa los dos archivos es donde
 * empieza a decidir el idioma de quien lee.
 *
 * Un archivo de formato que ademas pide datos a la API obliga a elegir al
 * importar: o se importa `formatearPrecio` y arrastra una llamada de red, o
 * se reimplementa el precio en la pagina.
 *
 * ============================================================================
 *  POR QUE NO SE USA `Intl` A SECAS
 * ============================================================================
 * Si, se usa. Pero con tres parametros que no son los de por defecto, porque
 * los de por defecto estan mal para un marketplace cubano:
 *
 *   -1. El separador de miles de `es-CU` produce `1.000` y el de `es-ES`
 *      produce `1.000` tambien, pero `en-US` produce `1,000`. Un precio que
 *      cambia de forma segun donde se mire confunde, asi que se fija el locale
 *      a `es-CU` en toda la aplicacion y se documenta. Cuando el sitio tenga
 *      ingles de verdad habra que decidir por idioma y por el locale que le
 *      toque, no cambiar el formato a mano.
 *
 *   -2. `Intl` recorta los decimales: 1000.50 se pinta como `1.000,5` o como
 *      `1.000` segun el numero de digitos significativos, no segun los decimales
 *      reales. Un precio de `250.50` CUP tiene fifty centavos de informacion y
 *      perderlos cambia lo que el comprador ve.
 *
 *   -3. El precio es un entero o un numero con dos decimales, nunca mas. Se
 *      decide aqui y no en cada pagina, para que no aparezca un `.00` en una
 *      tarjeta y no en otra.
 */

/** Locale unico del sitio. Ver nota 1 del bloque de arriba. */
const LOCALE = 'es-CU'

/**
 * Los simbolos de cada moneda, escritos y no deducidos.
 *
 * `Intl` deduciria los de `CUP` y `EUR` bien, pero el de `CUP` sale como `CUP`
 * y el de `EUR` como `€`, y una lista de precios donde uno lleva simbolo y los
 * otros tres llevan codigo se lee como dos sistemas distintos. Se escribe la
 * lista entera para que el mismo tratamiento.
 */
export const SIMBOLO_MONEDA: Record<'CUP' | 'USD' | 'EUR', string> = {
  CUP: 'CUP',
  USD: 'USD',
  EUR: 'EUR',
}

/**
 * Dos decimales fijos, para las monedas que se guardan en la unidad menor.
 *
 * No se le pasa esto a `formatearNumero` porque esa funcion recorta los
 * decimales cuando el numero resulta entero: 10 dolares saldria escrito "10"
 * y no "10,00". Recortar es lo correcto en CUP, donde el entero ya es la
 * moneda, pero en USD y EUR "10 USD" junto a "10,50 USD" en la misma lista se
 * leen como dos precios con reglas distintas.
 */
const FORMATO_DOS_DECIMALES = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formatea un precio.
 *
 * ============================================================================
 *  LA UNIDAD EN QUE SE GUARDA Y LA QUE SE ESCRIBE
 * ============================================================================
 * La base guarda enteros de la unidad menor: 250 CUP es `250` y $10.00 USD es
 * `1000`. La conversion al texto la hace el frontend, y este es el sitio donde.
 *
 * Durante un tiempo no se hacia. `formatearPrecio(1000, 'USD')` devolvia
 * "1.000 USD" para un paquete que cuesta diez dolares, y salia asi en la pagina
 * de paquetes, en la del producto y en la del vendedor: el precio equivocado
 * en el sitio que decide si alguien compra. No se veia con CUP, que se guarda
 * y se escribe en la misma unidad, y por eso estuvo tanto tiempo sin notarse:
 * solo se rompia en las dos monedas que casi nadie miraba.
 *
 * CUP no se divide: el Documento Maestro la guarda en enteros y en enteros se
 * escribe, sin decimales. USD y EUR se dividen entre 100 y se escriben siempre
 * con dos, tambien cuando el resultado es entero.
 *
 * `vitalicia` no se pide aqui: es una condicion de la compra, no del numero.
 */
export function formatearPrecio(monto: number, moneda: 'CUP' | 'USD' | 'EUR'): string {
  const simbolo = SIMBOLO_MONEDA[moneda]
  if (!Number.isFinite(monto)) return `precio no disponible ${simbolo}`
  if (moneda !== 'CUP') return `${FORMATO_DOS_DECIMALES.format(monto / 100)} ${simbolo}`
  return `${formatearNumero(monto)} ${simbolo}`
}

/**
 * El numero solo, sin moneda. Para cuando el simbolo va aparte en el marcado.
 */
export function formatearNumero(monto: number, decimales = 2): string {
  if (!Number.isFinite(monto)) return 'no disponible'
  const limpio = Number.isInteger(monto) ? 0 : decimales
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: limpio,
    maximumFractionDigits: limpio,
  }).format(monto)
}

/**
 * Un precio de 0 no se muestra como `0 CUP`.
 *
 * En un paquete, un precio en cero significa "esta categoria todavia no tiene
 * precio puesto por el Owner". Pintarlo como `0 CUP` es una oferta de regalo
 * publicada, que es justo el error que este proyecto no quiere cometer. Se
 * escribe "no disponible" y ya.
 *
 * Ojo con el otro lado: en el carrito, un total de 0 puede ser legitimo si todo
 * lo comprado es de Regla B o C con precio 0. Por eso esta funcion no se
 * invoca ahi: en el total el 0 se muestra, porque ahi significa de verdad que
 * no hay que pagar.
 */
export function precioONoDisponible(
  monto: number,
  moneda: 'CUP' | 'USD' | 'EUR',
): { hay: boolean; texto: string } {
  if (monto === 0) return { hay: false, texto: 'no disponible' }
  return { hay: true, texto: formatearPrecio(monto, moneda) }
}

/**
 * Fechas en texto largo, en espanol, sin depender del locale del sistema.
 *
 * `toLocaleDateString` sin locale da la fecha en el idioma del navegador, que
 * en un equipo en ingles muestra "September 30, 2026" en una pagina que esta
 * en espanol. Se pasa el locale explicito siempre.
 */
export function formatearFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'fecha no disponible'
  return new Intl.DateTimeFormat(LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/** Fecha corta, para listas y metadatos donde la larga no cabe. */
export function formatearFechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return new Intl.DateTimeFormat(LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Cuanto falta para que caduque, en palabras.
 *
 * Para los cinco minutos del enlace de descarga. Un numero ("300 s") obliga a
 * hacer la cuenta; "5 minutos" se entiende. Y se dice `caducado` en pasado, no
 * `0 s`, porque un enlace caducado que muestra "0 s" parece un contador que va
 * a arrancar otra vez.
 */
export function textoDeCaducidad(segundosRestantes: number): string {
  if (segundosRestantes <= 0) return 'caducado'
  const min = Math.floor(segundosRestantes / 60)
  const seg = segundosRestantes % 60
  if (min === 0) return `${seg} segundo${seg === 1 ? '' : 's'}`
  if (seg === 0) return `${min} minuto${min === 1 ? '' : 's'}`
  return `${min} min ${seg} s`
}

/**
 * Un texto largo se corta en un numero de palabras, sin partir ninguna.
 *
 * Lo usan las fichas de producto del catalogo, donde todas las tarjetas tienen
 * la misma altura y una descripcion de cuarenta palabras rompe la retícula. Se
 * corta en el ultimo espacio antes del limite, no con `slice`, que parte
 * palabras por la mitad y deja una letra suelta colgando.
 */
export function recortar(texto: string, palabras = 28): string {
  const limpio = texto.trim()
  if (limpio === '') return ''
  const partes = limpio.split(/\s+/)
  if (partes.length <= palabras) return limpio
  return `${partes.slice(0, palabras).join(' ')}...`
}
