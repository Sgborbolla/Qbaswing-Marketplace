/**
 * Los precios de un producto en varias monedas.
 *
 * ============================================================================
 *  POR QUE EXISTE
 * ============================================================================
 * Un producto puede ofrecerse en CUP, USD y EUR a la vez. Los precios viven en
 * tres columnas (`productos.precio_cup`, `precio_usd`, `precio_eur`), igual que
 * en los paquetes de espacios. `NULL` significa "esta moneda no se ofrece"; `0`
 * se trata igual que `NULL` a la hora de pintar, porque el sitio ya usa el 0
 * como "sin precio puesto" (`PanelCuenta.astro`).
 *
 * Estas tres y no más: son las que de verdad se pueden cobrar. QvaPay y
 * TropiPay liquidan en CUP, USD o EUR, y el sitio no tiene tipo de cambio (a
 * proposito, ver `PanelCuenta.astro`). Ofrecer una cuarta moneda exigiria
 * inventar un cambio que alguien tendria que mantener todos los dias.
 *
 * ============================================================================
 *  EL PRECIO BASE
 * ============================================================================
 * `productos.precio` y `productos.moneda` siguen existiendo, pero dejan de ser
 * algo que el vendedor teclea: se DERIVAN de las tres columnas. El base es el
 * precio de la primera moneda con precio, en el orden CUP, USD, EUR. Sirve para
 * lo unico que un solo numero puede servir sin mentir: ordenar el catalogo, el
 * filtro de precio de cada categoria y como moneda por defecto del carrito.
 *
 * Este modulo es puro (no toca la base ni el DOM) para que lo puedan usar el
 * Worker y las paginas `.astro` sin duplicar la regla del base.
 */

/** Las tres monedas en las que se puede poner precio a un producto. */
export const MONEDAS_PRINCIPALES = ['CUP', 'USD', 'EUR'] as const

export type MonedaPrincipal = (typeof MONEDAS_PRINCIPALES)[number]

/** Un precio por cada moneda principal. `null` = no se ofrece en esa moneda. */
export interface PreciosProducto {
  CUP: number | null
  USD: number | null
  EUR: number | null
}

/** Orden de prioridad para elegir el precio base. */
export const PRIORIDAD_BASE: readonly MonedaPrincipal[] = MONEDAS_PRINCIPALES

/** `true` si el valor es una de las tres monedas principales. */
export function esMonedaPrincipal(valor: unknown): valor is MonedaPrincipal {
  return typeof valor === 'string' && (MONEDAS_PRINCIPALES as readonly string[]).includes(valor)
}

/**
 * Los tres precios de una fila con las columnas crudas de la base.
 *
 * Acepta cualquier registro y convierte lo que no sea un numero finito a `null`,
 * para que una fila vieja (sin las columnas) o un dato raro no rompa la pagina.
 */
export function preciosDeFila(fila: {
  precio_cup?: unknown
  precio_usd?: unknown
  precio_eur?: unknown
}): PreciosProducto {
  return {
    CUP: numeroON(fila.precio_cup),
    USD: numeroON(fila.precio_usd),
    EUR: numeroON(fila.precio_eur),
  }
}

/** El primer precio, convertido a numero, o `null`. */
function numeroON(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : null
}

/** `true` si hay al menos una moneda con precio mayor que cero. */
export function tieneAlgunPrecio(precios: PreciosProducto): boolean {
  return MONEDAS_PRINCIPALES.some((m) => (precios[m] ?? 0) > 0)
}

/**
 * La moneda del precio base: la primera con precio > 0, o CUP si ninguna.
 *
 * Devolver CUP cuando no hay ningun precio no esconde nada: el precio sera 0 y
 * el sitio lo pinta como "sin precio / no disponible", que es la verdad.
 */
export function monedaBaseDe(precios: PreciosProducto): MonedaPrincipal {
  for (const m of PRIORIDAD_BASE) if ((precios[m] ?? 0) > 0) return m
  return 'CUP'
}

/** El precio base, ya como numero. `0` si no hay ninguno. */
export function precioBaseDe(precios: PreciosProducto): number {
  const m = monedaBaseDe(precios)
  return precios[m] ?? 0
}

/**
 * Las monedas con precio, en orden, con su monto. Para pintar la ficha.
 *
 * Se descartan los `0` y los `null`, igual que hace `vender.astro` con los
 * paquetes: un `0` pintado al lado de un precio real se lee como "gratis".
 */
export function listaDePrecios(
  precios: PreciosProducto,
): Array<{ moneda: MonedaPrincipal; monto: number }> {
  return MONEDAS_PRINCIPALES.filter((m) => (precios[m] ?? 0) > 0).map((m) => ({
    moneda: m,
    monto: precios[m] as number,
  }))
}
