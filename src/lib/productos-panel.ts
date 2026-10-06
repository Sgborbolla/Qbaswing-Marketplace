/**
 * Los precios de los PROPIOS productos, desde el navegador.
 *
 * ============================================================================
 *  QUE ES ESTA RUTA Y QUE NO ES
 * ============================================================================
 * `/api/panel/productos` solo deja dos cosas: ver lo que uno vende y cambiarle
 * el precio con su moneda. No crea productos ni los publica. Todo lo demas que
 * un producto necesita (slug, descripcion, imagenes, categoria, aprobacion) se
 * sigue yendo por el catalogo, que es de solo lectura.
 *
 * ============================================================================
 *  POR QUE NO SE VALIDA NADA AQUI
 * ============================================================================
 * Mismo motivo que en `medios-cliente.ts` y `identidad-cliente.ts`: el sitio es
 * HTML estatico y su JavaScript se puede editar desde la consola de cualquier
 * navegador. Si esta funcion decidiera que un precio esta bien escrito, bastaria
 * con cambiar una linea y mandar lo que sea. La validacion vive en el Worker,
 * una sola vez, y aqui lo unico que se hace es devolver el mensaje que el
 * Worker escribio, que ya esta en castellano y ya dice cual de los campos ha
 * fallado.
 *
 * ============================================================================
 *  LAS UNIDADES, QUE ES DONDE ESTA EL PELIGRO
 * ============================================================================
 * El precio que se manda y el que se recibe estan en la MISMA unidad en que lo
 * guarda la base: enteros de la unidad menor. `250` CUP, `1000` USD. Convertir
 * a texto ("10,00 USD") es cosa de `formatearPrecio`, que ya sabe que USD van
 * divididos entre 100.
 *
 * Esto se escribe aqui porque es lo contrario de lo que cualquier formulario de
 * precio hace por costumbre: un campo de precio normal manda `"10.00"` y
 * espera que el servidor lo multiplique. Si se hiciera asi en esta ruta sin
 * tocar la base, un producto de 10 dolares se guardaria como `10` y apareceria
 * en el catalogo costando diez CENTAVOS. La asimetria entre lo que se teclea y
 * lo que se guarda esta resuelta en el formulario, no aqui.
 */

import { pedir, type Respuesta } from './identidad-cliente'

/** Ruta del Worker. Copiada a mano y no importada desde `worker/constantes.ts`. */
const RUTA = '/api/panel/productos'

/**
 * Las tres monedas que el `CHECK` de la tabla admite.
 *
 * Se declara igual que en el Worker y no se comparte entre los dos porque
 * `src/worker` tiene su propio `tsconfig` con los tipos de Cloudflare. Lo que
 * los mantiene alineados es la migracion: si un dia entra una moneda nueva, hay
 * que tocar el `CHECK` y los dos literales en el mismo despliegue.
 */
export type MonedaProducto = 'CUP' | 'USD' | 'EUR'

/** Estados que `productos.estado_publicacion` puede tener. */
export type EstadoPublicacion = 'borrador' | 'pendiente' | 'aprobado' | 'rechazado'

/**
 * Un producto propio, tal cual sale del `GET`.
 *
 * `moneda` se declara como una de las tres en vez de `string` porque el `CHECK`
 * de la tabla solo admite esas y el Worker las valida al escribir: cualquier
 * fila que llegue por aqui ya es una de ellas. Escribirla como `string` seria
 * obligar a cada pagina que la reciba a comprobar lo que la base ya garantiza.
 *
 * `precio` y `precio_anterior` van en enteros de la unidad menor, igual que se
 * guardan. No se convierte aqui: ver el bloque de arriba.
 */
export interface ProductoPropio {
  id: number
  slug: string
  titulo: string
  precio: number
  precio_anterior: number | null
  moneda: MonedaProducto
  publicado: boolean
  estado_publicacion: EstadoPublicacion
  categoria: string
  regla: string
  actualizado_at: string
}

/**
 * Lo que se manda en `PATCH`.
 *
 * Los dos campos van siempre, aunque el servidor conservaria los que no
 * lleguen: mandar el formulario entero hace que la respuesta describa lo que
 * quedo guardado, y no solo la mitad que se acaba de tocar.
 */
export interface PrecioEnvio {
  id: number
  precio: number | string
  moneda: MonedaProducto
}

/** Resultado del cambio, para poder pintar lo que quedo sin volver a pedir todo. */
export interface PrecioGuardado {
  id: number
  precio: number
  moneda: MonedaProducto
  precio_anterior: number | null
  /**
   * `true` si habia un precio anterior y el servidor lo borro porque deja de
   * ser cierto: el precio subio por encima, o cambio la moneda.
   *
   * Se devuelve para poder decirlo. Si desapareciera en silencio, la persona
   * creeria que el precio de antes seguia ahi y no volveria a mirar la ficha.
   */
  precioAnteriorBorrado: boolean
}

/** Lista lo tuyo, publicado y sin publicar. */
export function misProductos(): Promise<
  Respuesta<{ productos: ProductoPropio[]; total: number }>
> {
  return pedir(RUTA)
}

/**
 * Cambia el precio y la moneda de un producto propio.
 *
 * El `id` va dentro del cuerpo y no en la URL, por lo mismo que en
 * `cambiarMedio`: asi el servidor comprueba la propiedad UNA vez y en el mismo
 * `WHERE` (`... AND vendedor_id = ?`), sin dos sitios que puedan no coincidir.
 */
export function cambiarPrecio(
  cambios: PrecioEnvio,
): Promise<Respuesta<{ producto: PrecioGuardado }>> {
  return pedir(RUTA, { method: 'PATCH', body: JSON.stringify(cambios) })
}
