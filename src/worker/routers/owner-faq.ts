/**
 * Router de la FAQ para el Owner: `/api/owner/faq`.
 *
 * ============================================================================
 *  POR QUE ESTA RUTA ES APARTE DE `plataforma.ts`
 * ============================================================================
 * `plataforma.ts` lee la FAQ para el pie de pagina y `/faq`: es lectura publica.
 * Aqui se escribe, y escribir es del Owner. Meter las dos cosas en el mismo
 * archivo obligaria a ramificar por metodo en cada funcion y a repetir la
 * comprobacion de rol. El prefijo `/api/owner` deja claro en la propia URL quien
 * puede tocar esto, igual que en productos y cuentas.
 *
 * ============================================================================
 *  LA FAQ ES POR IDIOMA
 * ============================================================================
 * Cada fila tiene `idioma`. El Owner edita la version de cada idioma por
 * separado; no hay traduccion automatica. La lectura publica pide un idioma y,
 * si aun no tiene filas, cae al espanol: medio sitio traducido es peor que el
 * sitio entero en espanol, y una FAQ vacia se ve como un fallo.
 */

import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { IDIOMAS } from '../../i18n/config'
import { usuarioDePeticion, type UsuarioSesion } from './registro'

const IDIOMAS_VALIDOS = new Set<string>(IDIOMAS)

function esAdministrador(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'owner' || usuario.rol === 'administrador'
}

const MAX_PREGUNTA = 300
const MAX_RESPUESTA = 4000

export async function responderOwnerFaq(
  peticion: Request,
  env: Env,
): Promise<Response> {
  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)
  if (!usuario) throw ErrorApi.noAutenticado()
  if (!esAdministrador(usuario)) throw ErrorApi.sinPermiso()

  const ruta = new URL(peticion.url).pathname.replace(/\/+$/, '')
  if (ruta !== '/api/owner/faq') throw ErrorApi.noEncontrado('Esa ruta')

  if (peticion.method === 'GET') return listar(peticion, env)
  if (peticion.method === 'POST') return crear(peticion, env, usuario)
  if (peticion.method === 'PATCH') return actualizar(peticion, env, usuario)
  if (peticion.method === 'DELETE') return borrar(peticion, env)

  throw ErrorApi.metodoNoPermitido('Ese metodo no existe aqui.', [
    'GET',
    'POST',
    'PATCH',
    'DELETE',
  ])
}

/** El idioma pedido, o espanol si no viene. */
function idiomaDe(peticion: Request): string {
  const pedido = new URL(peticion.url).searchParams.get('idioma') ?? 'es'
  return IDIOMAS_VALIDOS.has(pedido) ? pedido : 'es'
}

async function listar(peticion: Request, env: Env): Promise<Response> {
  const idioma = idiomaDe(peticion)
  const { results } = await env.DB.prepare(
    `SELECT id, idioma, pregunta, respuesta, orden, activa
       FROM faq
      WHERE idioma = ?
      ORDER BY orden, id`,
  )
    .bind(idioma)
    .all()

  return json({ ok: true, idioma, faq: results as Record<string, unknown>[] })
}

function texto(valor: unknown, campo: string, max: number, obligatorio: boolean): string | null {
  if (valor === undefined || valor === null) {
    if (obligatorio) throw ErrorApi.invalido(campo, 'Es obligatorio.')
    return null
  }
  if (typeof valor !== 'string') throw ErrorApi.invalido(campo, 'Tiene que ser texto.')
  const limpio = valor.trim()
  if (obligatorio && limpio === '') throw ErrorApi.invalido(campo, 'No puede estar vacio.')
  if (limpio.length > max) throw ErrorApi.invalido(campo, `Maximo ${max} caracteres.`)
  return limpio
}

function aIdioma(valor: unknown): string {
  if (valor === undefined || valor === null) return 'es'
  if (typeof valor !== 'string' || !IDIOMAS_VALIDOS.has(valor)) {
    throw ErrorApi.invalido('idioma', 'Ese idioma no existe.')
  }
  return valor
}

async function crear(
  peticion: Request,
  env: Env,
  usuario: UsuarioSesion,
): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const idioma = aIdioma(cuerpo.idioma)
  const pregunta = texto(cuerpo.pregunta, 'pregunta', MAX_PREGUNTA, true)
  const respuesta = texto(cuerpo.respuesta, 'respuesta', MAX_RESPUESTA, true)
  const orden = typeof cuerpo.orden === 'number' ? Math.trunc(cuerpo.orden) : 0
  const activa = cuerpo.activa === 0 || cuerpo.activa === false ? 0 : 1

  const resultado = await env.DB.prepare(
    `INSERT INTO faq (idioma, pregunta, respuesta, orden, activa, actualizado_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(idioma, pregunta, respuesta, orden, activa, usuario.id)
    .run()

  return json(
    {
      ok: true,
      id: Number(resultado.meta?.last_row_id),
      idioma,
      pregunta,
      respuesta,
      orden,
      activa,
    },
    201,
  )
}

async function actualizar(
  peticion: Request,
  env: Env,
  usuario: UsuarioSesion,
): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const id = typeof cuerpo.id === 'number' ? Math.trunc(cuerpo.id) : NaN
  if (!Number.isFinite(id)) throw ErrorApi.invalido('id', 'Falta el id.')

  const campos: string[] = []
  const valores: unknown[] = []

  const pregunta = texto(cuerpo.pregunta, 'pregunta', MAX_PREGUNTA, false)
  if (pregunta !== null) {
    campos.push('pregunta = ?')
    valores.push(pregunta)
  }
  const respuesta = texto(cuerpo.respuesta, 'respuesta', MAX_RESPUESTA, false)
  if (respuesta !== null) {
    campos.push('respuesta = ?')
    valores.push(respuesta)
  }
  if (typeof cuerpo.orden === 'number') {
    campos.push('orden = ?')
    valores.push(Math.trunc(cuerpo.orden))
  }
  if (cuerpo.activa !== undefined) {
    campos.push('activa = ?')
    valores.push(cuerpo.activa === 0 || cuerpo.activa === false ? 0 : 1)
  }
  if (cuerpo.idioma !== undefined) {
    campos.push('idioma = ?')
    valores.push(aIdioma(cuerpo.idioma))
  }

  if (campos.length === 0) throw ErrorApi.invalido('campos', 'No hay nada que cambiar.')

  campos.push("actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
  campos.push('actualizado_por = ?')
  valores.push(usuario.id)
  valores.push(id)

  await env.DB.prepare(`UPDATE faq SET ${campos.join(', ')} WHERE id = ?`)
    .bind(...valores)
    .run()

  return json({ ok: true, id })
}

async function borrar(peticion: Request, env: Env): Promise<Response> {
  const url = new URL(peticion.url)
  let id = Number(url.searchParams.get('id'))
  if (!Number.isFinite(id) || id <= 0) {
    const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
    id = typeof cuerpo.id === 'number' ? Math.trunc(cuerpo.id) : NaN
  }
  if (!Number.isFinite(id) || id <= 0) throw ErrorApi.invalido('id', 'Falta el id.')

  await env.DB.prepare('DELETE FROM faq WHERE id = ?').bind(id).run()
  return json({ ok: true })
}
