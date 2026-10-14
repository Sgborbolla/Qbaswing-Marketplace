/**
 * Las monedas con las que se puede cobrar.
 *
 * ============================================================================
 *  POR QUE UNA LISTA Y NO TEXTO LIBRE
 * ============================================================================
 * Un vendedor de Mexico cobra en pesos, uno de Argentina en pesos argentinos,
 * uno de Brasil en reales. El marketplace no puede obligar a nadie a poner sus
 * precios en CUP o USD: quien no ve su moneda, no vende. Por eso esta lista.
 *
 * Pero SI es una lista cerrada y no un campo de texto:
 *
 *   1. El precio se guarda en ENTEROS de la unidad menor. Para escribir bien
 *      "10,50" hay que dividir entre 100; para CLP, JPY o KRW NO se divide. Si
 *      el simbolo fuera texto libre, nadie sabria cuantos decimales tiene y un
 *      "1000" podria ser mil pesos o diez pesos con cincuenta. El numero que ve
 *      el comprador saldria mal, y el precio es justo lo que decide la compra.
 *
 *   2. Los pagos y la comision de la plataforma se liquidan en CUP, USD o EUR
 *      (las que soportan QvaPay y TropiPay). Cada moneda sabe a cual de esas
 *      tres se «acerca» para contabilidad: es el `bucket`. Un precio en MXN se
 *      contabiliza como USD; uno en la misma moneda cubana, como CUP.
 *
 *   3. Un texto libre acaba con veinte formas de escribir lo mismo: "usd",
 *      "USD", "dolares", "$". La lista fija el codigo una vez.
 *
 * ============================================================================
 *  LOS DECIMALES
 * ============================================================================
 * `decimales` es cuantos digitos van DESPUES de la coma en la unidad principal.
 * Casi todas usan 2. Las que no: el peso cubano se maneja en enteros (0), y el
 * yen, el won, el peso chileno y el guaraní no tienen centimos (0).
 *
 * Este numero NO es decorativo: `formatearPrecio` lo usa para dividir el entero
 * guardado. Cambiarlo mal es mostrar un precio cien veces mas caro.
 *
 * ============================================================================
 *  EL ORDEN
 * ============================================================================
 * CUP y USD primero porque son las de esta casa; EUR detras; despues el resto
 * por lo usadas que son en el comercio internacional. El selector del panel
 * respeta este orden, asi que quien vende en Cuba ve lo suyo arriba.
 */

export interface Moneda {
  /** Codigo ISO 4217, en mayusculas. Es lo que se guarda en la base. */
  codigo: string
  /** Como se lee en voz alta. Para el desplegable del panel. */
  nombre: string
  /** El simbolo que va detras del numero. `$`, `€`, `R$`... */
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
  { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: 'MXN', decimales: 2 },
  { codigo: 'ARS', nombre: 'Peso argentino', simbolo: 'ARS', decimales: 2 },
  { codigo: 'COP', nombre: 'Peso colombiano', simbolo: 'COP', decimales: 2 },
  { codigo: 'CLP', nombre: 'Peso chileno', simbolo: 'CLP', decimales: 0 },
  { codigo: 'PEN', nombre: 'Sol peruano', simbolo: 'S/', decimales: 2 },
  { codigo: 'BRL', nombre: 'Real brasileño', simbolo: 'R$', decimales: 2 },
  { codigo: 'UYU', nombre: 'Peso uruguayo', simbolo: '$U', decimales: 2 },
  { codigo: 'BOB', nombre: 'Boliviano', simbolo: 'Bs', decimales: 2 },
  { codigo: 'PYG', nombre: 'Guaraní paraguayo', simbolo: '₲', decimales: 0 },
  { codigo: 'VES', nombre: 'Bolívar venezolano', simbolo: 'Bs.', decimales: 2 },
  { codigo: 'DOP', nombre: 'Peso dominicano', simbolo: 'RD$', decimales: 2 },
  { codigo: 'GBP', nombre: 'Libra esterlina', simbolo: 'GBP', decimales: 2 },
  { codigo: 'CAD', nombre: 'Dólar canadiense', simbolo: 'CAD', decimales: 2 },
  { codigo: 'CHF', nombre: 'Franco suizo', simbolo: 'CHF', decimales: 2 },
  { codigo: 'JPY', nombre: 'Yen japonés', simbolo: '¥', decimales: 0 },
  { codigo: 'CNY', nombre: 'Yuan chino', simbolo: '¥', decimales: 2 },
  { codigo: 'KRW', nombre: 'Won surcoreano', simbolo: '₩', decimales: 0 },
  { codigo: 'INR', nombre: 'Rupia india', simbolo: '₹', decimales: 2 },
  { codigo: 'RUB', nombre: 'Rublo ruso', simbolo: '₽', decimales: 2 },
  { codigo: 'TRY', nombre: 'Lira turca', simbolo: '₺', decimales: 2 },
  { codigo: 'ZAR', nombre: 'Rand sudafricano', simbolo: 'ZAR', decimales: 2 },
  { codigo: 'NGN', nombre: 'Naira nigeriana', simbolo: '₦', decimales: 2 },
  { codigo: 'EGP', nombre: 'Libra egipcia', simbolo: 'E£', decimales: 2 },
  { codigo: 'AED', nombre: 'Dírham emiratí', simbolo: 'AED', decimales: 2 },
  { codigo: 'SAR', nombre: 'Riyal saudí', simbolo: 'SAR', decimales: 2 },
  { codigo: 'AUD', nombre: 'Dólar australiano', simbolo: 'AUD', decimales: 2 },
  { codigo: 'SEK', nombre: 'Corona sueca', simbolo: 'SEK', decimales: 2 },
  { codigo: 'NOK', nombre: 'Corona noruega', simbolo: 'NOK', decimales: 2 },
  { codigo: 'PLN', nombre: 'Esloti polaco', simbolo: 'PLN', decimales: 2 },
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
 * CUP y EUR se quedan en la suya. Todo lo demas cae en USD, que es la moneda
 * en la que QvaPay y TropiPay liquidan y sobre la que se calcula la comision.
 * Es una aproximacion contable honesta: convertir de verdad exigiria un tipo de
 * cambio, y el tipo de cambio cambia todos los dias. Lo que el comprador paga,
 * eso si, es exactamente lo que dice la ficha.
 */
export function bucketDe(codigo: string | null | undefined): BucketMoneda {
  const c = monedaDe(codigo).codigo
  if (c === 'CUP') return 'CUP'
  if (c === 'EUR') return 'EUR'
  return 'USD'
}
