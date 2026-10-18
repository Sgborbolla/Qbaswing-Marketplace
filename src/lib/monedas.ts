/**
 * Las monedas con las que se puede cobrar.
 *
 * ============================================================================
 *  SOLO TRES: CUP, USD Y EUR
 * ============================================================================
 * Son las tres en las que de verdad se puede cobrar en este sitio:
 *
 *   - CUP y USD son la moneda de casa (Cuba) y la de fuera; EUR completa el
 *     trio de las que cualquier cliente necesita ver.
 *   - QvaPay y TropiPay, los dos cobradores, liquidan en CUP, USD o EUR.
 *   - El sitio NO tiene tipo de cambio (a proposito, ver `PanelCuenta.astro`).
 *     Una cuarta moneda exigiria inventar un cambio que alguien tendria que
 *     actualizar todos los dias, y un cambio mal puesto es un precio mal cobrado.
 *
 * Por eso es una lista cerrada y no texto libre:
 *
 *   1. El precio se guarda en ENTEROS de la unidad menor. CUP no tiene
 *      centimos y USD si: si el simbolo fuera texto libre, nadie sabria cuantos
 *      decimales tiene y un "1000" podria ser mil pesos o diez pesos con
 *      cincuenta. El numero que ve el comprador saldria mal, y el precio es
 *      justo lo que decide la compra.
 *
 *   2. Los pagos y la comision de la plataforma se liquidan en estas tres
 *      monedas, y cada una sabe a cual de ellas se "acerca" para contabilidad:
 *      es el `bucket`. CUP va a CUP, EUR va a EUR, y todo lo demas (que aqui no
 *      hay) iria a USD.
 *
 *   3. Un texto libre acaba con veinte formas de escribir lo mismo: "usd",
 *      "USD", "dolares", "$". La lista fija el codigo una vez.
 *
 * ============================================================================
 *  LOS DECIMALES
 * ============================================================================
 * `decimales` es cuantos digitos van DESPUES de la coma en la unidad principal.
 * Casi todas usan 2. Las que no: el peso cubano se maneja en enteros (0).
 *
 * Este numero NO es decorativo: `formatearPrecio` lo usa para dividir el entero
 * guardado. Cambiarlo mal es mostrar un precio cien veces mas caro.
 *
 * ============================================================================
 *  EL ORDEN
 * ============================================================================
 * CUP y USD primero porque son las de esta casa; EUR detras. El selector del
 * panel respeta este orden, asi que quien vende en Cuba ve lo suyo arriba.
 */

export interface Moneda {
  /** Codigo ISO 4217, en mayusculas. Es lo que se guarda en la base. */
  codigo: string
  /** Como se lee en voz alta. Para el desplegable del panel. */
  nombre: string
  /** El simbolo que va detras del numero. `$`, `€`... */
  simbolo: string
  /** Decimales de la unidad principal. `0` para las que no llevan centimos. */
  decimales: 0 | 2
}

/** A que moneda «fuerte» se contabiliza cada codigo para la comision. */
export type BucketMoneda = 'CUP' | 'USD' | 'EUR'

export const MONEDAS: readonly Moneda[] = [
  { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', decimales: 0 },
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD', decimales: 2 },
  { codigo: 'EUR', nombre: 'Euro', simbolo: 'EUR', decimales: 2 },
] as const

/** El indice por codigo, para no recorrer la lista en cada precio. */
const POR_CODIGO = new Map<string, Moneda>(MONEDAS.map((m) => [m.codigo, m]))

/**
 * La moneda por defecto de la casa.
 *
 * Es la que se usa cuando un producto viejo no trae codigo (se guardo antes de
 * que existiera esta lista) o cuando llega uno que no conocemos.
 */
export const MONEDA_POR_DEFECTO = 'CUP'

/** `true` si el codigo esta en la lista. Se usa al validar en el Worker. */
export function esMonedaValida(codigo: string): boolean {
  return POR_CODIGO.has(codigo)
}

/** La ficha de una moneda, o la de por defecto si el codigo no se conoce. */
export function monedaDe(codigo: string | null | undefined): Moneda {
  return POR_CODIGO.get(codigo ?? '') ?? POR_CODIGO.get(MONEDA_POR_DEFECTO)!
}

/** Cuantos decimales tiene. Para dividir el entero guardado. */
export function decimalesDe(codigo: string | null | undefined): number {
  return monedaDe(codigo).decimales
}

/** El simbolo que va detras del numero. */
export function simboloDe(codigo: string | null | undefined): string {
  return monedaDe(codigo).simbolo
}

/**
 * A que moneda fuerte se contabiliza.
 *
 * CUP y EUR se quedan en la suya; USD va a USD, que es la moneda en la que
 * QvaPay y TropiPay liquidan y sobre la que se calcula la comision.
 */
export function bucketDe(codigo: string | null | undefined): BucketMoneda {
  const c = monedaDe(codigo).codigo
  if (c === 'CUP') return 'CUP'
  if (c === 'EUR') return 'EUR'
  return 'USD'
}
