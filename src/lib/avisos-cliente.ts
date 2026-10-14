/**
 * Avisos de la tienda, desde el navegador: `/api/panel/avisos`.
 *
 * ============================================================================
 *  QUE ES ESTO
 * ============================================================================
 * El dueño de la tienda ve quien eligio o compro sus productos. Son los avisos
 * que genera el Worker al anadir al carrito (y, mas adelante, al comprar).
 *
 * Como en `medios-cliente.ts`, aqui NO se valida nada: el sitio es HTML estatico
 * y se puede editar desde la consola. La validacion y la propiedad viven en el
 * Worker, que es el unico que puede leer la cookie de sesion.
 */

import { pedir, type Respuesta } from './identidad-cliente'

/** Ruta del Worker. Copiada a mano, igual que en el resto de modulos `*-cliente`. */
const RUTA = '/api/panel/avisos'

/** Una fila de `avisos` tal cual sale de la base: `snake_case` y sin transformar. */
export interface Aviso {
  id: number
  tipo: 'carrito' | 'compra'
  producto_id: number | null
  producto_titulo: string
  cantidad: number
  comprador_nombre: string
  comprador_email: string
  comprador_telefono: string
  /** 1 leido, 0 sin leer. Nunca booleano: viene de SQLite. */
  leido: 0 | 1
  creado_at: string
}

/** Los mios, los no leidos primero. */
export function misAvisos(): Promise<Respuesta<{ avisos: Aviso[]; no_leidos: number }>> {
  return pedir(RUTA)
}

/**
 * Marca como leido. `{ id }` marca uno; `{ todos: true }` el buzon entero.
 *
 * Leer NO marca nada: si abrir la pagina marcara todo, el aviso que todavia no
 * se atendio se perderia de vista. Marcar es una accion aparte.
 */
export function marcarAviso(
  payload: { id?: number; todos?: boolean },
): Promise<Respuesta<{ actualizados: number }>> {
  return pedir(RUTA, { method: 'PATCH', body: JSON.stringify(payload) })
}
