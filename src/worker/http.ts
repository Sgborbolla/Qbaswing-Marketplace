/**
 * Utilidades de respuesta HTTP del Worker.
 *
 * ============================================================================
 *  POR QUE ESTO NO ESTA EN `index.ts`
 * ============================================================================
 * Porque `index.ts` importa los routers, y si los routers importan de `index.ts`
 * se forma un ciclo. El ciclo funciona mientras el modulo se cargue en el orden
 * correcto, y un dia deja de funcionar segun que import se mire primero: el
 * error que sale es "`json is not a function`" en una linea que no tiene nada que
 * ver con JSON, y cuesta media hora encontrarlo.
 *
 * Los cuatro routers (`catalogo`, `plataforma`, `salud`, `webhooks`) y el quinto,
 * `identidad`, necesitan `json()`. Todos la tenian importada del `index`.
 *
 * ============================================================================
 *  POR QUE `index.ts` NO EXPORTA NADA MAS
 * ============================================================================
 * `index.ts` antes terminaba con `export { VENTANA_TIMESTAMP_SEG, numero }` para
 * que los routers tuvieran esas cosas a mano. Eso es lo que rompia
 * `wrangler dev` en local, con un error que no menciona nada de esto:
 *
 *   Incorrect type for map entry 'VENTANA_TIMESTAMP_SEG': the provided value is
 *   not of type 'function or ExportedHandler'.
 *
 * Workerd construye un mapa donde CADA export con nombre es un punto de entrada,
 * y un numero constante no es ni una funcion ni un handler. En produccion lo
 * toleraba; en local, no. Los routers ya importan `VENTANA_TIMESTAMP_SEG` de
 * `./constantes` y `numero` de `./entorno`, que es donde nacen, asi que la
 * reexportacion no hacia falta para nada.
 *
 * La leccion queda escrita aqui: un `export` de mas en el entrypoint no es
 * inocuo, es una entrada mas del mapa de modulos.
 */

/* ===========================================================================
 * Respuesta
 * ======================================================================== */

/**
 * Respuesta JSON con las cabeceras que la API siempre manda.
 *
 * `Cache-Control: no-store` en todas, sin excepcion, por una razon concreta: el
 * catalogo cambia cuando el Owner aprueba un producto, y un indice desactualizado
 * es peor que uno lento. El Owner aprueba, recarga, y no ve el producto, y no
 * entiende por que.
 */
export function json(cuerpo: unknown, status = 200, cabeceras: HeadersInit = {}): Response {
  const h = new Headers(cabeceras)
  h.set('Content-Type', 'application/json; charset=utf-8')
  h.set('Cache-Control', 'no-store')
  h.set('X-Content-Type-Options', 'nosniff')
  return new Response(JSON.stringify(cuerpo), { status, headers: h })
}

/* ===========================================================================
 * Entrada
 * ======================================================================== */

/**
 * Lee un parametro de query, acotado.
 *
 * El maximo no es decorativo: sin el, `?por_pagina=999999` hace que la API
 * tenga que procesar una consulta enorme, y en el plan gratuito eso se paga con
 * limites de lectura. Ademas `NaN` cae al valor por defecto en vez de romper la
 * consulta.
 */
export function enteroDeQuery(url: URL, nombre: string, defecto: number, maximo: number): number {
  const crudo = url.searchParams.get(nombre)
  if (crudo === null) return defecto
  const n = Number.parseInt(crudo, 10)
  if (!Number.isFinite(n) || n < 0) return defecto
  return Math.min(n, maximo)
}

/**
 * `decodeURIComponent` que no lanza.
 *
 * Un slug con `%ZZ` es un 404, no un 500. Si esto lanzara, un enlace escrito a
 * mano con un caracter raro tiraria el Worker entero y se veria como una caída,
 * cuando lo unico que paso es que el enlace esta mal.
 *
 * El limite de 200 caracteres evita que alguien mande un slug de un megabyte
 * para que se compare contra la base.
 */
export function decodificar(valor: string): string | null {
  try {
    const limpio = decodeURIComponent(valor)
    return limpio.length > 0 && limpio.length <= 200 ? limpio : null
  } catch {
    return null
  }
}