/**
 * La cola de aprobacion, desde el navegador del Owner.
 *
 * ============================================================================
 *  QUE HACEN ESTAS TRES RUTAS
 * ============================================================================
 * `/api/owner/productos` lista los productos del marketplace por su estado de
 * publicacion, por defecto los `pendiente`. `aprobar` y `rechazar` solo actuan
 * sobre productos pendientes: el resto el Worker lo niega, porque un producto
 * aprobado ya esta en la tienda y un rechazado ya tiene su motivo escrito.
 *
 * Aprobar pasa el producto a `aprobado` y lo publica. Rechazar lo manda a
 * `rechazado`, lo saca de la tienda y guarda el motivo, que el vendedor vera
 * en su panel.
 *
 * ============================================================================
 *  POR QUE NO SE VALIDA NADA AQUI
 * ============================================================================
 * Mismo motivo que en `productos-panel.ts` y `tarifas-owner.ts`: el
 * JavaScript del navegador se puede editar desde la consola. La validacion
 * vive en el Worker, una sola vez, y aqui lo unico que se hace es devolver el
 * mensaje que el Worker escribio.
 */

import { pedir, type Respuesta } from './identidad-cliente'

/** Ruta del Worker. Copiada a mano y no importada desde `worker/constantes.ts`. */
const RUTA = '/api/owner/productos'

/**
 * Un producto esperando decision, con todo lo que hace falta para decidir.
 *
 * Los campos salen de la lista del Worker: lo que se muestra aqui es el titulo
 * del producto tal cual lo escribio su autor, y el motivo solo existe cuando el
 * producto ya fue rechazado alguna vez (en la cola de pendientes sera `null`).
 */
export interface ProductoEnRevision {
  id: number
  slug: string
  titulo: string
  descripcion: string
  tipo: string
  origen: string
  regla: string
  categoria: string
  precio: number
  moneda: string
  estado_publicacion: string
  motivo_rechazo: string | null
  creado_at: string
  actualizado_at: string
  vendedor_slug: string
  vendedor_nombre: string
  imagen: string | null
}

/** Lista los productos pendientes de aprobacion. Requiere sesion de Owner. */
export function productosEnRevision(): Promise<
  Respuesta<{ estado: string; productos: ProductoEnRevision[] }>
> {
  return pedir(`${RUTA}?estado=pendiente`)
}

/** Aprueba un producto pendiente: pasa a `aprobado` y se publica. */
export function aprobarProducto(id: number): Promise<Respuesta<{ ok: true }>> {
  return pedir(`${RUTA}/${id}/aprobar`, { method: 'POST' })
}

/**
 * Rechaza un producto pendiente.
 *
 * El motivo va en el cuerpo y el Worker lo exige: sin el, el vendedor veria
 * "rechazado" en su panel sin saber que cambiar. El limite de 300 caracteres
 * lo pone el Worker; aqui no se comprueba nada.
 */
export function rechazarProducto(
  id: number,
  motivo: string,
): Promise<Respuesta<{ ok: true }>> {
  return pedir(`${RUTA}/${id}/rechazar`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  })
}
