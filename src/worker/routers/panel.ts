/**
 * Precios de los PROPIOS productos.
 *
 * ============================================================================
 *  QUE HACE Y QUE NO
 * ============================================================================
 * Solo dos operaciones: listar lo que el que llama vende, y cambiarle el precio
 * con su moneda. No crea productos, no los borra, no los publica y no toca la
 * aprobacion. Crear un producto es todo lo demas: slug, descripcion, imagenes,
 * categoria, regla y el circuito de aprobacion de 0003. Meterlo aqui habria
 * dado una ruta que inserta en `productos` sin pasar por ninguno de esos
 * controles, y el dia que fallara seria imposible saber que falto.
 *
 * ============================================================================
 *  POR QUE LA PROPIEDAD SE COMPRUEBA EN SQL Y NO EN JAVASCRIPT
 * ============================================================================
 * Se podria leer el producto, mirar en JS si `vendedor_id` coincide con el de
 * la sesion, y despues actualizar. Funciona, y es la forma de escribir el bug:
 * dos consultas donde cabia una, y si en algun momento se cambiara el `UPDATE`
 * olvidando la condicion, JavaScript ya habria dicho que si.
 *
 * Aqui el `WHERE` lleva las dos cosas a la vez:
 *
 *   UPDATE productos SET ... WHERE id = ? AND vendedor_id = ?
 *
 * `vendedor_id` sale SIEMPRE de la sesion, nunca del cuerpo de la peticion. Un
 * `vendedor_id` aceptado desde fuera convertiria esta ruta en una para editar
 * precios ajenos, que es exactamente lo contrario de lo que hace falta en un
 * marketplace.
 *
 * Si el id no es suyo, la consulta no cambia ninguna fila y se contesta 404.
 * No se devuelve "eso no es tuyo" porque eso confirmaria que el producto existe
 * en esa tienda, que es informacion que quien no lo tiene no necesita.
 *
 * ============================================================================
 *  LAS DOS COLUMNAS QUE HAY QUE MIRAR AL CAMBIAR EL PRECIO
 * ============================================================================
 * `productos` lleva un `CHECK (precio_anterior IS NULL OR precio_anterior >=
 * precio)`. Si un vendedor sube el precio por encima de su precio anterior, el
 * `UPDATE` revienta en ingles con un error de restriccion. Y aunque no
 * revientara, enseñar "antes 2000, ahora 3000" es un descuento al reves, que
 * es una mentira sobre el precio.
 *
 * Por eso `precio_anterior` se limpia en el mismo `UPDATE` cuando deja de ser
 * cierto. Esta columna no se expone en el formulario: quien cambia su precio
 * no esta pensando en el precio de antes, y pedirle que lo rellene seria
 * pedirle que decida un descuento que nadie le ha pedido.
 *
 * El otro caso es el cambio de moneda: un `precio_anterior` de 300 CUP no
 * significa nada al lado de un precio nuevo en USD. Se limpia tambien, y es lo
 * honesto, porque volver a pintarlo seria inventar un tipo de cambio.
 *
 * ============================================================================
 *  ESTADOS VACIOS REALES
 * ============================================================================
 * La base de produccion tiene 0 productos. La respuesta es `{ productos: [],
 * total: 0 }`, que es la verdad. No hay ningun producto de ejemplo.
 *
 * Una cuenta sin tienda (rol `comprador`) tambien recibe la lista vacia, no un
 * error: el formulario se muestra a todo el mundo que se registra, y lo que no
 * tiene productos dice que no tiene productos.
 */

import { ErrorApi, TOPE_PRECIO } from '../constantes'
import type { Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { usuarioDePeticion } from './registro'

/**
 * Las tres monedas del `CHECK` de la tabla.
 *
 * Se repite aqui y no se importa de `src/lib` porque el Worker tiene su propio
 * `tsconfig` con los tipos de Cloudflare y los del navegador conviviendo seria
 * mezclar dos mundos en un fichero que corre en el servidor. La misma razon por
 * la que `mis-medios` declara `TIPOS` en vez de traerlos de parte alguna: es un
 * conjunto que tiene que coincidir con la base, y si un dia se anade una
 * moneda nueva, `tsc` obliga a tocar el `CHECK` de la migracion y este array a
 * la vez, en el mismo compilado.
 */
const MONEDAS = ['CUP', 'USD', 'EUR'] as const
type Moneda = (typeof MONEDAS)[number]

/* ===========================================================================
 * Router
 * ======================================================================== */

export async function responderPanelProductos(peticion: Request, env: Env): Promise<Response> {
  const { usuario } = await usuarioDePeticion(
    env.DB,
    peticion,
    env.QBASWING_SECRETO_FIRMA,
  )

  // Sin sesion no hay lista que dar: lo unico que se podria listar es lo de
  // otra persona, y para eso ya existe el catalogo publico.
  if (!usuario) throw ErrorApi.noAutenticado()

  const metodo = peticion.method

  if (metodo === 'GET') return listar(env, usuario.vendedor_id)
  if (metodo === 'PATCH') return cambiar(peticion, env, usuario.vendedor_id)

  throw ErrorApi.metodoNoPermitido('Ese metodo no existe en tus productos.', ['GET', 'PATCH'])
}

/* ===========================================================================
 * Operaciones
 * ======================================================================== */

/**
 * GET. Todo lo que el que llama vende, incluidos los que no estan publicados.
 *
 * Se devuelven tambien los borradores y los rechazados porque son los que el
 * vendedor esta editando. Filtrar aqui por `publicado = 1` dejaria sin poder
 * poner precio justo a los que aun no salieron, que es donde mas hace falta.
 *
 * Se ordena por `actualizado_at` descendente: lo ultimo tocado arriba, que es
 * lo que se busca cuando se abre el panel a corregir un precio.
 *
 * No hay paginacion. El listado esta limitado por lo que posee una sola cuenta
 * y nadie mas lo puede alargar: alguien podria anadir paginacion el dia que
 * haya tiendas con miles de productos, pero anadirla hoy seria una consulta mas
 * que nadie ha pedido y que nadie puede probar con la base vacia.
 */
async function listar(env: Env, vendedorId: number | null): Promise<Response> {
  // Sin tienda no hay filas propias. Se devuelve la lista vacia en vez de un
  // error porque no es una falta: es el estado normal de una cuenta que todavia
  // no vende, y el formulario se muestra a todo el mundo.
  if (vendedorId === null) return json({ productos: [], total: 0 })

  const filas = await env.DB.prepare(
    `SELECT id, slug, titulo, precio, precio_anterior, moneda,
            publicado, estado_publicacion, categoria, regla, actualizado_at
       FROM productos
      WHERE vendedor_id = ?
      ORDER BY actualizado_at DESC, id DESC`,
  )
    .bind(vendedorId)
    .all<{
      id: number
      slug: string
      titulo: string
      precio: number
      precio_anterior: number | null
      moneda: string
      publicado: number
      estado_publicacion: string
      categoria: string
      regla: string
      actualizado_at: string
    }>()

  const productos = (filas.results ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    titulo: f.titulo,
    precio: f.precio,
    precio_anterior: f.precio_anterior,
    moneda: f.moneda,
    publicado: f.publicado === 1,
    estado_publicacion: f.estado_publicacion,
    categoria: f.categoria,
    regla: f.regla,
    actualizado_at: f.actualizado_at,
  }))

  return json({ productos, total: productos.length })
}

/**
 * PATCH. Cambia el precio y la moneda de UN producto propio.
 *
 * El cuerpo manda los dos campos siempre, aunque aqui sobreviviria uno solo:
 * `undefined` conserva el valor anterior. Se lee el cuerpo UNA sola vez y se
 * pasa abajo, por la razon que esta escrita en `cuerpoJson`.
 */
async function cambiar(
  peticion: Request,
  env: Env,
  vendedorId: number | null,
): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  // El id de la fila a tocar. De aqui sale, no del body de otra forma: el
  // `WHERE` de abajo es quien decide si es suyo.
  const id = Number(cuerpo.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw ErrorApi.invalido('id', 'Falta el producto que quieres cambiar.')
  }

  const existente = await env.DB.prepare(
    `SELECT precio, precio_anterior, moneda
       FROM productos
      WHERE id = ? AND vendedor_id = ?`,
  )
    .bind(id, vendedorId)
    .first<{ precio: number; precio_anterior: number | null; moneda: string }>()

  if (!existente) throw ErrorApi.noEncontrado('Ese producto')

  const precio = leerPrecio(cuerpo.precio, existente.precio)
  const moneda = leerMoneda(cuerpo.moneda, existente.moneda)

  /*
   * Las dos razones por las que el precio de antes deja de poder quedarse.
   *
   * 1. El precio nuevo pasa por encima del anterior: el `CHECK` de la tabla lo
   *    prohibiria y el error saldria en ingles desde SQLite.
   * 2. Cambio la moneda: un 300 de la moneda vieja al lado de un precio nuevo
   *    en otra es inventar un tipo de cambio que nadie ha fijado.
   *
   * Los dos casos se resuelven en la misma columna porque el resultado es el
   * mismo: no hay precio anterior que enseñar con verdad.
   */
  const subioPorEncima =
    existente.precio_anterior !== null && precio > existente.precio_anterior
  const cambioDeMoneda = moneda !== existente.moneda
  const precioAnterior = subioPorEncima || cambioDeMoneda ? null : existente.precio_anterior

  const actualizado = await env.DB.prepare(
    `UPDATE productos
        SET precio = ?,
            moneda = ?,
            precio_anterior = ?,
            actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND vendedor_id = ?`,
  )
    .bind(precio, moneda, precioAnterior, id, vendedorId)
    .run()

  // Dos consultas con el mismo `WHERE`, pero la primera podia encontrar la fila
  // y esta no haber cambiado nada si entre medias alguien la borro. Si no
  // coincide una fila, lo que se dice es que no existe, que ya es lo que
  // contestaria la consulta de arriba.
  if (actualizado.meta?.changes !== 1) throw ErrorApi.noEncontrado('Ese producto')

  return json({
    ok: true,
    producto: {
      id,
      precio,
      moneda,
      precio_anterior: precioAnterior,
      precioAnteriorBorrado: precioAnterior === null && existente.precio_anterior !== null,
    },
  })
}

/* ===========================================================================
 * Validacion
 * ======================================================================== */

/**
 * El precio, ya validado.
 *
 * `undefined` conserva el que tenia, que es el contrato de un `PATCH` en este
 * proyecto: el cliente manda siempre todos los campos y el servidor decide con
 * lo que llega.
 *
 * `null` o `''` no conservan y no limpian tampoco: `precio` es `NOT NULL` en la
 * base, y no poner precio no es lo mismo que poner precio cero. Un precio en
 * cero es "todavia no se cuanto vale", y se escribe asi. Dejarlo vacio no
 * significaria nada, asi que se contesta.
 */
function leerPrecio(actual: unknown, previo: number): number {
  if (actual === undefined) return previo

  if (actual === null || actual === '') {
    throw ErrorApi.invalido(
      'precio',
      'Pon el precio. Si todavia no lo sabes, deja 0: el producto se muestra como "no disponible".',
    )
  }

  // Se acepta cadena porque los campos de texto del formulario mandan texto, y
  // rechazar `"250"` exigiria convertirlo en el navegador antes de mandarlo.
  // `Number('')` es 0 y `Number(' ')` tambien, pero esos ya salieron arriba.
  const numero = typeof actual === 'number' ? actual : Number(String(actual).trim())

  if (!Number.isFinite(numero)) {
    throw ErrorApi.invalido('precio', 'Ese precio no es un numero.')
  }

  // Sin esto, `250.5` se guardaria como REAL en una columna INTEGER: la tabla
  // no es STRICT, asi que SQLite lo admitiria y el error solo se veria despues,
  // cuando el catalogo pintara un precio con decimales que no puede cobrar.
  if (!Number.isInteger(numero)) {
    throw ErrorApi.invalido('precio', 'El precio es un numero entero, sin decimales.')
  }

  if (numero < 0) {
    throw ErrorApi.invalido('precio', 'El precio no puede ser negativo.')
  }

  if (numero > TOPE_PRECIO) {
    throw ErrorApi.invalido('precio', 'Ese precio es demasiado grande para poder calcularlo.')
  }

  return numero
}

/**
 * La moneda, ya validada contra el `CHECK` de la tabla.
 *
 * Se comprueba aqui y no en la base a proposito: si llegara una moneda que el
 * `CHECK` no admite, el error saldria de SQLite en ingles y llegaria al
 * navegador tal cual. Y hay que validarla aunque no venga: un `moneda`
 * ausente conserva la anterior, que siempre es una de las tres.
 */
function leerMoneda(actual: unknown, previo: string): Moneda {
  if (actual === undefined) return previo as Moneda

  const valor = typeof actual === 'string' ? actual.trim().toUpperCase() : ''
  if (!MONEDAS.includes(valor as Moneda)) {
    throw ErrorApi.invalido(
      'moneda',
      `La moneda tiene que ser ${MONEDAS.join(', ')}.`,
    )
  }

  return valor as Moneda
}
