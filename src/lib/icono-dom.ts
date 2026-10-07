/**
 * Iconos en SVG para el JavaScript del navegador.
 *
 * ============================================================================
 *  POR QUE HACE FALTA, SI YA ESTA `Icono.astro`
 * ============================================================================
 * `Icono.astro` se ejecuta en el servidor y escribe HTML. Varias partes del sitio
 * arman HTML DENTRO del navegador: el carrito se dibuja cuando llegan los datos
 * de la API, y el panel de cuenta monta sus tarjetas al pulsar. Ahi no hay un
 * componente de Astro que renderizar, hay que crear el nodo a mano.
 *
 * Antes esos iconos sehacian con `<span class="material-symbols-outlined">` y
 * `textContent = 'shopping_cart'`, que es lo que hacia falta mientras los iconos
 * fueran una fuente. Con la fuente fuera, hay que crear el `<svg>`.
 *
 * ============================================================================
 *  EL ARGUMENTO ES UN TIPO, NO UN `string`
 * ============================================================================
 * `nombre: NombreIcono` y no `nombre: string`. Es lo que hace que esto no se
 * rompa en silencio:
 *
 * Con `string`, escribir `crearIcono('cesta', ...)` compila, en produccion
 * `ICONOS['cesta']` es `undefined`, el `<path>` queda sin `d`, y sale un
 * rectangulo vacio. No hay error en la consola ni en el build. El boton se ve
 * there, con su texto, y su icono no aparece nunca.
 *
 * Con el tipo, `astro check` falla diciendo que `'cesta'` no es un
 * `NombreIcono`, y salta antes de que se escriba una linea de la pagina.
 *
 * ============================================================================
 *  POR QUE NO SE USA `innerHTML` CON LA RUTA DEL `d`
 * ============================================================================
 * Se podria hacer `nodo.innerHTML = '<path d="' + ICONOS[nombre] + '"/>'`, que es
 * mas corto. No se hace: aunque hoy los trazados vengan de un archivo generado y
 * no de un usuario, un `innerHTML` con un valor interpolado es la forma en que un
 * XSS se cuela cuando el valor deja de ser tan confiable. `setAttribute` no
 * interpreta nada: escribe lo que le dan.
 */

import { ICONOS, ICONOS_MARCA, VIEWBOX_ICONO, type NombreIcono } from './iconos'

/** Crea un `<svg>` de icono, listo para meter en el DOM. */
export function crearIcono(nombre: NombreIcono, clase = ''): SVGElement {
  const NS = 'http://www.w3.org/2000/svg'

  // Los logotipos traen su propio viewBox (son SVG normales de 0 0 24 24) y los
  // de la fuente usan el comun. Mismo criterio que `Icono.astro`: el rectangulo
  // lo manda el mapa al que pertenece el nombre, no uno fijo para todos.
  const marca = nombre in ICONOS_MARCA ? ICONOS_MARCA[nombre as keyof typeof ICONOS_MARCA] : null

  const svg = document.createElementNS(NS, 'svg')
  // `1em` en los dos ejes para que el tamano lo siga mandando el `font-size` del
  // contenedor, igual que hace `Icono.astro`. Si aqui se pusiera un ancho fijo,
  // el `text-[18px]` de la clase dejaria de funcionar sin que nadie lo note.
  svg.setAttribute('viewBox', marca ? marca.viewBox : VIEWBOX_ICONO)
  svg.setAttribute('width', '1em')
  svg.setAttribute('height', '1em')
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('class', `inline-block shrink-0 ${clase}`.trim())

  const trazo = document.createElementNS(NS, 'path')
  trazo.setAttribute('d', marca ? marca.d : ICONOS[nombre as keyof typeof ICONOS])
  svg.append(trazo)

  return svg
}