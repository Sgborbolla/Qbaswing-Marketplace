/**
 * Router del catalogo publico: productos, categorias, vendedores y paquetes.
 *
 * ============================================================================
 *  LA CONDICION DE VISIBILIDAD, EN UN SOLO LUGAR
 * ============================================================================
 * Un producto aparece en el catalogo si y solo si:
 *
 *     publicado = 1  AND  estado_publicacion = 'aprobado'
 *
 * Las dos columnas hacen falta. `publicado` es el interruptor que mueve el
 * vendedor; `estado_publicacion` es el circuito que audita el Owner. Un producto
 * de Regla A puede estar aprobado y despublicado (el Owner lo aprobo, el
 * vendedor lo Oculta), y uno de Regla B visible tiene `aprobado` sin que nadie
 * lo haya mirado. Quitar cualquiera de las dos condiciones cambia el
 * comportamiento en un caso real.
 *
 * Esa regla se escribe en una constante, `WHERE_VISIBLE`, y se interpola. Copiar
 * la cadena en cada consulta es como nacen los "productos fantasma": un listado
 * que se forgotten de una de las dos y muestra borradores.
 *
 * ============================================================================
 *  POR QUE EL PRECIO ES UN ENTERO Y NO UN DECIMAL
 * ============================================================================
 * El Documento Maestro guarda los precios en la unidad menor: 250 CUP se guarda
 * como `250`, y 10.00 USD como `1000`. La conversion a texto la hace el
 * frontend, no la API. Si la API devolviera `"10.00"`, cada pantalla tendria que
 * volver a parsear, y un `parseFloat` mal hecho en un componente daria `$10`.
 *
 * El precio sale tal cual de la base, junto con `moneda`, para que el sitio
 * decida el formato. La API no sabe si el visitante esta en Cuba o en Berlin.
 *
 * ============================================================================
 *  ESTADOS VACIOS REALES
 * ============================================================================
 * La base no tiene productos todavia. Este router devuelve
 * `{ productos: [], total: 0, pagina: 1 }`, que es la verdad. No hay un
 * producto de ejemplo "para que se vea algo", y no lo va a haber: en un
 * marketplace, un producto inventado en la portada es una persona a la que se le
 * esta cobrando por algo que no existe.
 */

import { enteroDeQuery, json } from '../http'
import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'

/**
 * La condicion de visibilidad. Sin punto y coma: va pegada a otras condiciones
 * con `AND`, y un `;` en el medio haria fallar la consulta.
 */
const WHERE_VISIBLE = 'p.publicado = 1 AND p.estado_publicacion = ' + "'aprobado'"

/** Tope de la pagina. 100 filas de catalogo ya es un listado que nadie recorre. */
const MAXIMO_POR_PAGINA = 100

/** Parametro extra que selecciona el detalle por slug. */
export interface FiltroDetalle {
  slug?: string
}

export async function responderCatalogo(
  ruta: string,
  peticion: Request,
  env: Env,
  soloLectura: boolean,
  filtro: FiltroDetalle = {},
): Promise<Response> {
  if (!soloLectura) {
    throw new ErrorApi(
      'no_implementado',
      'La escritura todavia no esta disponible.',
      501,
    )
  }

  switch (ruta) {
    case '/api/productos':
      return filtro.slug
        ? json({ ok: true, producto: await productoPorSlug(env, filtro.slug) })
        : json(await listarProductos(peticion, env))
    case '/api/vendedores':
      return filtro.slug
        ? json({ ok: true, vendedor: await vendedorPorSlug(env, filtro.slug) })
        : json(await listarVendedores(peticion, env))
    case '/api/categorias':
      return json({ ok: true, categorias: await categorias(env) })
    case '/api/paquetes':
      return json({ ok: true, paquetes: await paquetes(env) })
    default:
      throw ErrorApi.noEncontrado('Esa ruta')
  }
}

/* ===========================================================================
 * Productos
 * ======================================================================== */

/**
 * Listado del catalogo.
 *
 * Cada producto trae la primera imagen y el nombre del vendedor porque el
 * frontend los necesita SIEMPRE para pintar una tarjeta. Hacer una peticion por
 * producto para eso serian 24 consultas para una pagina de 24 tarjetas.
 */
async function listarProductos(peticion: Request, env: Env) {
  const url = new URL(peticion.url)
  const pagina = enteroDeQuery(url, 'pagina', 1, 1000)
  const porPagina = enteroDeQuery(url, 'por_pagina', 24, MAXIMO_POR_PAGINA)
  const categoria = url.searchParams.get('categoria')
  const tipo = url.searchParams.get('tipo')
  const busqueda = url.searchParams.get('q')
  const ordenar = url.searchParams.get('ordenar')
  const destacado = url.searchParams.get('destacado')

  // Cada filtro se valida contra una lista cerrada ANTES de llegar al SQL. Con
  // parametros Prepare elInjection no ocurre, pero un `tipo = 'cualquiera'`
  // devolveria una lista vacia sin explicar por que, y un `ORDER BY` construido
  // con texto del usuario si seria unInjection.
  const condiciones: string[] = [WHERE_VISIBLE]
  const valores: unknown[] = []

  if (categoria) {
    condiciones.push('p.categoria = ?')
    valores.push(categoria.slice(0, 60))
  }
  if (tipo === 'digital' || tipo === 'fisico' || tipo === 'servicio') {
    condiciones.push('p.tipo = ?')
    valores.push(tipo)
  }
  if (destacado === '1') {
    condiciones.push('p.destacado = 1')
  }
  if (busqueda) {
    // LIKE con `%` y `_` del usuario se escapan: si no, buscar "50%" trae
    // cualquier cosa y "a_b" trae todas las que tienen cualquier letra. En una
    // busqueda eso no es un fallo grave, pero devuelve resultados que no
    // corresponden con lo escrito y el usuario lo nota.
    const patron = `%${escaparLike(busqueda.slice(0, 80))}%`
    condiciones.push("(p.titulo LIKE ? ESCAPE '\\' OR p.descripcion LIKE ? ESCAPE '\\')")
    valores.push(patron, patron)
  }

  const donde = condiciones.join(' AND ')

  // El ORDER BY es una lista cerrada, no texto del usuario. Los tres criterios
  // son los unicos que el Documento Maestro menciona: destacados primero, luego
  // lo nuevo, luego lo barato.
  const ordenSql =
    ordenar === 'precio_asc'
      ? 'p.precio ASC, p.id ASC'
      : ordenar === 'precio_desc'
        ? 'p.precio DESC, p.id DESC'
        : ordenar === 'nuevo'
          ? 'p.creado_at DESC, p.id DESC'
          : 'p.destacado DESC, p.creado_at DESC, p.id DESC'

  const total = await contar(env, `SELECT COUNT(*) AS n FROM productos p WHERE ${donde}`, valores)

  const desplazamiento = (pagina - 1) * porPagina
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.slug, p.titulo, p.descripcion, p.tipo, p.origen, p.regla,
            p.categoria, p.precio, p.precio_anterior, p.moneda, p.destacado,
            p.vitalicia, p.creado_at,
            v.slug AS vendedor_slug, v.nombre_comercial AS vendedor_nombre,
            (SELECT i.url
               FROM producto_imagenes i
              WHERE i.producto_id = p.id
              ORDER BY i.orden, i.id
              LIMIT 1) AS imagen
       FROM productos p
       JOIN vendedores v ON v.id = p.vendedor_id
      WHERE ${donde}
      ORDER BY ${ordenSql}
      LIMIT ? OFFSET ?`,
  )
    .bind(...valores, porPagina, desplazamiento)
    .all()

  return {
    ok: true,
    productos: results,
    total,
    pagina,
    por_pagina: porPagina,
    // `paginas: 0` en vez de division por cero cuando no hay nada. El frontend
    // hace `paginas > 1` para pintar la paginacion, y un `NaN` ahi se compara
    // siempre en falso y deja los controles en un estado raro.
    paginas: total === 0 ? 0 : Math.ceil(total / porPagina),
  }
}

/** Detalle de un producto. 404 si no existe O si no es visible. */
async function productoPorSlug(env: Env, slug: string) {
  const fila = await env.DB.prepare(
    `SELECT p.id, p.slug, p.titulo, p.descripcion, p.descripcion_larga,
            p.tipo, p.origen, p.regla, p.categoria, p.precio, p.precio_anterior,
            p.moneda, p.destacado, p.vitalicia, p.creado_at, p.actualizado_at,
            v.slug AS vendedor_slug, v.nombre_comercial AS vendedor_nombre,
            v.ubicacion AS vendedor_ubicacion, v.verificado AS vendedor_verificado,
            d.stack, d.licencia, d.version, d.ultima_actualizacion, d.demo_url,
            d.formato_entrega,
            f.stock, f.envio, f.processing_time, f.peso_kg,
            s.modalidad, s.duracion_estimada, s.incluye
       FROM productos p
       JOIN vendedores v ON v.id = p.vendedor_id
       LEFT JOIN detalles_digitales d ON d.producto_id = p.id
       LEFT JOIN detalles_fisicos    f ON f.producto_id = p.id
       LEFT JOIN detalles_servicio   s ON s.producto_id = p.id
      WHERE ${WHERE_VISIBLE} AND p.slug = ?`,
  )
    .bind(slug)
    .first<Record<string, unknown>>()

  // Mismo 404 para "no existe" y para "existe pero no es visible". Distinguirlos
  // deja adivinar que un producto esta pendiente de aprobacion, que es
  // informacion del negocio de otro vendedor.
  if (!fila) throw ErrorApi.noEncontrado('Ese producto')

  const imagenes = await env.DB.prepare(
    `SELECT url, alt FROM producto_imagenes WHERE producto_id = ? ORDER BY orden, id`,
  )
    .bind(fila.id as number)
    .all()

  // Lo que la Regla A obliga: este producto NO se puede pagar directo al autor.
  // Se manda explicito para que el frontend no ofrezca la opcion por inercia.
  const requierePasarela = fila.regla === 'A'

  return { ...fila, imagenes: imagenes.results, requiere_pasarela_plataforma: requierePasarela }
}

/* ===========================================================================
 * Vendedores
 * ======================================================================== */

/**
 * Listado de vendedores.
 *
 * ============================================================================
 *  POR QUE ES `LEFT JOIN` Y NO `JOIN`
 * ============================================================================
 * Esto era un `INNER JOIN` con condicion en el `WHERE`, y solo entraban los que
 * tenian al menos un producto visible. Estaba justificado en el comentario
 * original: un perfil con cero publicaciones es una ficha a medio montar.
 *
 * El problema es que esa decision no estaba en un solo sitio, sino dos, y las
 * dos no decian lo mismo. `vendedorPorSlug`, el detalle, NO tiene esa
 * condicion: busca por slug y devuelve el vendedor aunque tenga cero productos,
 * y la pagina ya sabe pintar ese estado ("todavia no tiene productos
 * visibles"). El listado, en cambio, lo excluia.
 *
 * La consecuencia concreta era que `getStaticPaths` —que pide ESTE listado para
 * decidir que paginas se generan— no incluia al vendedor, asi que su ficha
 * nunca se creaba y `/vendedor/<slug>` daba 404. El endpoint de detalle servia
 * una pagina que nadie podia alcanzar.
 *
 * Con `LEFT JOIN` las dos vistas dejan de contradecirse. Y la condicion de
 * visibilidad se va al `ON`, no al `WHERE`: en un `LEFT JOIN`, cualquier
 * columna de `p` en el `WHERE` convierte la union otra vez en interior y
 * volvemos al mismo sitio.
 *
 * Que salga un vendedor con 0 productos en el listado no es un estado
 * disimulado: `productos_publicados` se cuenta con `COUNT(p.id)`, que cuenta
 * solo las filas visibles, y la pagina lo escribe tal cual. Un vendedor sin
 * nada publicado se ve como lo que es.
 *
 * Que el listado muestre tiendas vacias es además lo honesto aqui: con un
 * catalogo recien estrenado, esconder al unico vendedor deja la seccion de
 * vendedores en blanco y el sitio parece caido.
 */
async function listarVendedores(peticion: Request, env: Env) {
  const url = new URL(peticion.url)
  const pagina = enteroDeQuery(url, 'pagina', 1, 1000)
  const porPagina = enteroDeQuery(url, 'por_pagina', 24, MAXIMO_POR_PAGINA)

  // La visibilidad vive en el `ON` y no en un `WHERE`: ver el comentario.
  const UNION = `LEFT JOIN productos p ON p.vendedor_id = v.id AND ${WHERE_VISIBLE}`

  const total = await contar(
    env,
    `SELECT COUNT(DISTINCT v.id) AS n
       FROM vendedores v
       ${UNION}`,
    [],
  )

  const { results } = await env.DB.prepare(
    `SELECT v.slug, v.nombre, v.nombre_comercial, v.descripcion, v.avatar_url,
            v.ubicacion, v.verificado,
            COUNT(p.id) AS productos_publicados
       FROM vendedores v
       ${UNION}
      GROUP BY v.id
      ORDER BY v.verificado DESC, v.nombre_comercial COLLATE NOCASE ASC, v.id ASC
      LIMIT ? OFFSET ?`,
  )
    .bind(porPagina, (pagina - 1) * porPagina)
    .all()

  return { ok: true, vendedores: results, total, pagina, por_pagina: porPagina }
}

async function vendedorPorSlug(env: Env, slug: string) {
  const fila = await env.DB.prepare(
    `SELECT v.slug, v.nombre, v.nombre_comercial, v.descripcion, v.avatar_url,
            v.ubicacion, v.verificado, v.creado_at
       FROM vendedores v
      WHERE v.slug = ?`,
  )
    .bind(slug)
    .first<Record<string, unknown>>()

  if (!fila) throw ErrorApi.noEncontrado('Ese vendedor')

  const productos = await env.DB.prepare(
    `SELECT p.id, p.slug, p.titulo, p.tipo, p.categoria, p.precio, p.moneda,
            (SELECT i.url FROM producto_imagenes i
              WHERE i.producto_id = p.id ORDER BY i.orden, i.id LIMIT 1) AS imagen
       FROM productos p
      WHERE ${WHERE_VISIBLE} AND p.vendedor_id = (SELECT id FROM vendedores WHERE slug = ?)
      ORDER BY p.creado_at DESC, p.id DESC`,
  )
    .bind(slug)
    .all()

  return { ...fila, productos: productos.results }
}

/* ===========================================================================
 * Categorias y paquetes
 * ======================================================================== */

/**
 * Categorias con conteo real de productos publicados.
 *
 * No hay tabla de categorias: la categoria es texto en `productos.categoria`.
 * Derivar la lista de los productos que existen es lo correcto, porque una
 * categoria con cero productos no lleva a ninguna parte y solo agrega ruido al
 * menu.
 *
 * `precio_minimo` y `precio_maximo` vienen de los productos visibles de cada
 * categoria, no de la tabla `paquetes`. Son dos cosas distintas con el mismo
 * nombre: los paquetes son el precio de un espacio de venta, y el precio de un
 * producto no tiene nada que ver. Confundirlas haria que el filtro de precio
 * mostrara el precio del paquete.
 */
async function categorias(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT p.categoria AS nombre,
            COUNT(*) AS productos,
            MIN(p.precio) AS precio_minimo,
            MAX(p.precio) AS precio_maximo
       FROM productos p
      WHERE ${WHERE_VISIBLE}
      GROUP BY p.categoria
      ORDER BY productos DESC, p.categoria ASC`,
  ).all()

  return results
}

/**
 * Paquetes de espacios, con el precio de cada moneda.
 *
 * Sale de la base y no de `constantes.ts` a proposito: el Documento Maestro deja
 * dos categorias con precio configurable, y el Owner las cambia desde el panel.
 * Si la lista estuviera en el codigo, editar un precio exigiria redesplegar.
 */
async function paquetes(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT nombre, categoria, slots, vigencia_dias,
            precio_cup, precio_usd, precio_eur,
            precio_configurable, caracteristicas
       FROM paquetes
      WHERE activo = 1
      ORDER BY slots DESC, precio_cup ASC, id ASC`,
  ).all()

  return results
}

/* ===========================================================================
 * Utilidades
 * ======================================================================== */

/** Cuenta filas de una consulta con los mismos parametros del listado. */
async function contar(env: Env, sql: string, valores: unknown[]): Promise<number> {
  const fila = await env.DB.prepare(sql)
    .bind(...valores)
    .first<{ n: number }>()
  return fila?.n ?? 0
}

/** Escapa `%`, `_` y la propia barra invertida para un `LIKE ... ESCAPE '\'`. */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`)
}
