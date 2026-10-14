/**
 * Generacion de slugs unicos para tiendas y productos.
 *
 * ============================================================================
 *  POR QUE ES UN ARCHIVO APARTE
 * ============================================================================
 * Lo usan dos routers distintos, `registro` (para el slug de la tienda nueva) y
 * `panel-productos` (para el slug del producto). El slug es parte de la URL
 * publica: `/vendedor/<slug>` y `/producto/<slug>`. Si cada router tuviera su
 * propia receta, un producto y una tienda podrian normalizar el mismo texto de
 * formas distintas y una de las dos acabaria con acentos o espacios en la URL.
 *
 * ============================================================================
 *  POR QUE LA UNICIDAD SE COMPRUEBA CONTRA LA BASE Y NO CON UN CONTADOR
 * ============================================================================
 * Un contador en memoria no sobrevive entre peticiones: cada peticion de un
 * Worker puede atenderla una instancia distinta. La unica verdad de "que slugs
 * existen" es la tabla. Se prueba el candidato, y si choca se le anade `-2`,
 * `-3`... hasta que entra. Con 50 intentos de sobra; si aun asi chocan, se
 * cierra con un sufijo aleatorio en vez de dejar la peticion colgada.
 */

/**
 * Convierte texto en un slug de URL.
 *
 * `normalize('NFD')` separa las letras de sus acentos y el `replace` borra las
 * marcas: `Camion` -> `camion`, no `cami-n`. Sin esto, un nombre con tilde daria
 * un slug con guion donde iba una vocal, que se lee mal y no se adivina.
 *
 * Todo lo que no sea `a-z0-9` se vuelve guion, los guiones sobrantes de los
 * extremos se quitan, y se corta a 60 caracteres para que la URL no crezca sin
 * limite. El recorte se hace DESPUES de quitar guiones para no dejar uno suelto
 * al final.
 */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/** Las dos tablas con slug. Es una union y no un `string` a proposito: cierra la
 *  interpolacion de tabla a un conjunto conocido. */
export type TablaConSlug = 'productos' | 'vendedores'

/**
 * Devuelve un slug libre en `tabla` a partir de `base`.
 *
 * `respaldo` es el texto que se usa cuando `base` normaliza a vacio (un nombre
 * solo de emojis o signos). Sin el, el slug seria la cadena vacia y la URL
 * quedaria en `/vendedor/`, que no distingue de la raiz.
 */
export async function slugUnico(
  db: D1Database,
  tabla: TablaConSlug,
  base: string,
  respaldo = 'tienda',
): Promise<string> {
  const limpio = aSlug(base) || respaldo

  for (let i = 0; i < 50; i += 1) {
    const candidato = i === 0 ? limpio : `${limpio}-${i + 1}`
    const ocupado = await db
      .prepare(`SELECT 1 FROM ${tabla} WHERE slug = ? LIMIT 1`)
      .bind(candidato)
      .first()
    if (!ocupado) return candidato
  }

  return `${limpio}-${Date.now().toString(36)}`
}
