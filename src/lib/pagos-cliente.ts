/**
 * Pagos desde el navegador: `/api/pagos`.
 *
 * ============================================================================
 *  QUE HACE
 * ============================================================================
 *   cobrar   -> POST   convierte el carrito en ordenes y lo vacia
 *   compras  -> GET    las compras de la sesion
 *
 * El POST exige sesion. Sin sesion el Worker responde 401 y la pagina manda a
 * entrar; aqui no se decide nada, solo se manda la peticion y se devuelve lo que
 * el Worker conteste. La validacion (pasarela conocida, moneda que la pasarela
 * cobra, Regla A por gateway, producto retirado) vive ENTERA en el Worker: esta
 * capa no la repite, porque un cliente no puede ser la autoridad de una regla
 * de dinero.
 *
 * ============================================================================
 *  POR QUE NO CALCULA EL TOTAL
 * ============================================================================
 * El navegador NO suma precios. El total de cada orden lo arma y lo congela el
 * Worker en el momento del cobro. Aqui solo se pinta lo que llega, porque un
 * total calculado en el navegador es un total que se puede editar con las
 * herramientas de desarrollo.
 */

import { pedir, type Respuesta } from './identidad-cliente'

/** Ruta del Worker. Copiada a mano, igual que en el resto de modulos `*-cliente`. */
const RUTA = '/api/pagos'

/** Una linea de una orden ya creada. */
export interface ProductoOrden {
  productoId: number
  titulo: string
  cantidad: number
  precioUnitario: number
}

/** Una orden tal como la devuelve el Worker. */
export interface Orden {
  id: number
  referencia: string
  pasarela: string
  /** Bucket de comision: `CUP` | `USD` | `EUR`. */
  moneda: string
  /** Moneda real del vendedor (puede ser `MXN`, `ARS`...). */
  monedaCodigo: string
  regla: string
  subtotal: number
  comision: number
  total: number
  estado: string
  vendedorId: number
  vendedorSlug: string | null
  productos: ProductoOrden[]
}

/**
 * Cobra el carrito con la pasarela elegida.
 *
 * Devuelve las ordenes creadas. Un error con codigo conocido (`carrito_vacio`,
 * `producto_no_disponible`, `moneda_no_soportada`, `regla_a_gateway`) llega con
 * el mensaje ya escrito por el Worker, que es el que se pinta.
 */
export function cobrar(
  pasarela: string,
): Promise<Respuesta<{ ordenes: Orden[] }>> {
  return pedir<{ ordenes: Orden[] }>(RUTA, {
    method: 'POST',
    body: JSON.stringify({ pasarela }),
  })
}

/** Las compras de la sesion, mas nuevas primero. */
export function compras(): Promise<Respuesta<{ ordenes: Orden[] }>> {
  return pedir<{ ordenes: Orden[] }>(RUTA, { method: 'GET' })
}

/**
 * El Owner confirma o rechaza a mano un pago que ninguna maquina puede
 * confirmar (transferencia cubana, WhatsApp).
 *
 * Va aqui aunque la use el panel del Owner: es el mismo endpoint y con tenerla
 * en dos sitios se acaba con dos contratos distintos para la misma peticion.
 */
export function confirmar(
  referencia: string,
  estado: 'verificado' | 'rechazado',
  nota = '',
): Promise<Respuesta<{ referencia: string; estado: string; entregados: number }>> {
  return pedir(RUTA, {
    method: 'PATCH',
    body: JSON.stringify({ referencia, estado, nota }),
  })
}
