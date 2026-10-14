/**
 * Router de los avisos de la tienda: `/api/panel/avisos`.
 *
 * ============================================================================
 *  DE DONDE SALEN ESTOS AVISOS
 * ============================================================================
 * Los genera `avisos.ts` cuando alguien anade un producto al carrito o lo
 * compra. Aqui solo se LEEN y se marcan como leidos: el dueño de la tienda
 * entra a su panel y ve quien le eligio algo.
 *
 * ============================================================================
 *  POR QUE SOLO VE LOS SUYOS
 * ============================================================================
 * Igual que en `mis-medios.ts`, la propiedad es una condicion del `WHERE` y no
 * una comprobacion aparte: `WHERE vendedor_id = ?` con el id que sale de la
 * sesion. No hay ninguna ruta que acepte el id de otra tienda, porque no se
 * compara contra una lista de permisos: se compara contra quien mando la cookie.
 *
 * ============================================================================
 *  QUE SE MARCA Y QUE NO
 * ============================================================================
 *   GET    /api/panel/avisos   los mios, los no leidos primero
 *   PATCH  /api/panel/avisos   marcar leido (uno, o todos)
 *
 * Leer no marca nada. Si abrir el panel marcara todo como leido, el vendedor
 * que solo mira de reojo perderia el aviso que todavia no atendio. Marcar es
 * una accion explicita.
 */

import { ErrorApi, RUTAS } from '../constantes'
import { type Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { usuarioDePeticion } from './registro'

/** Cuantos avisos se devuelven de una vez. Mas viejos que esto ya no se atienden. */
const TOPE = 200

export async function responderAvisos(peticion: Request, env: Env): Promise<Response> {
  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)

  // Sin sesion no se llega a leer nada, y va ANTES de mirar el metodo: sin esto
  // un PATCH sin cookie diria "metodo no permitido" en vez de "no estas dentro".
  if (!usuario) throw ErrorApi.noAutenticado()

  // Quien no tiene tienda no tiene avisos. No es un error: es una lista vacia.
  if (usuario.vendedor_id === null) {
    return json({ ok: true, avisos: [], no_leidos: 0 })
  }

  if (peticion.method === 'GET') return listar(env, usuario.vendedor_id)
  if (peticion.method === 'PATCH') return marcarLeido(peticion, env, usuario.vendedor_id)

  throw ErrorApi.metodoNoPermitido('Los avisos no aceptan ese metodo.', ['GET', 'PATCH'])
}

async function listar(env: Env, vendedorId: number): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, tipo, producto_id, producto_titulo, cantidad,
            comprador_nombre, comprador_email, comprador_telefono,
            leido, creado_at
       FROM avisos
      WHERE vendedor_id = ?
      ORDER BY leido, id DESC
      LIMIT ?`,
  )
    .bind(vendedorId, TOPE)
    .all<Record<string, unknown>>()

  const conteo = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM avisos WHERE vendedor_id = ? AND leido = 0',
  )
    .bind(vendedorId)
    .first<{ n: number }>()

  // La ruta es privada y sin cache, pero se manda igual por costumbre del resto
  // de la API: todas las respuestas que dependen de una sesion van con no-store.
  return json({ ok: true, avisos: results, no_leidos: conteo?.n ?? 0 })
}

async function marcarLeido(peticion: Request, env: Env, vendedorId: number): Promise<Response> {
  const crudo = await cuerpoJson(peticion)
  const cuerpo = (typeof crudo === 'object' && crudo !== null ? crudo : {}) as Record<string, unknown>

  // `todos: true` marca el buzon entero; `id` marca uno. Son las dos cosas que
  // se hacen de verdad: "ya lo vi todo" y "atiendo este".
  if (cuerpo.todos === true) {
    const r = await env.DB.prepare(
      'UPDATE avisos SET leido = 1 WHERE vendedor_id = ? AND leido = 0',
    )
      .bind(vendedorId)
      .run()
    return json({ ok: true, actualizados: r.meta.changes ?? 0 })
  }

  const id = typeof cuerpo.id === 'number' ? cuerpo.id : Number(cuerpo.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw ErrorApi.invalido('id', 'Falta el aviso que queres marcar, o no es valido.')
  }

  const r = await env.DB.prepare(
    'UPDATE avisos SET leido = 1 WHERE id = ? AND vendedor_id = ?',
  )
    .bind(id, vendedorId)
    .run()

  return json({ ok: true, actualizados: r.meta.changes ?? 0 })
}
