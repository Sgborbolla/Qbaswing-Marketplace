import { json } from '../http'
import type { Env } from '../entorno'
import { obtenerSesion } from './identidad'
import { SQL_VERIFICAR_COMPRA, evaluarCompra, obtenerArchivoMaestro, servirDesdeMaestro, ErrorEntrega } from '../../lib/entrega'

function extraerIdDeRuta(ruta: string): number | null {
  const m = ruta.match(/\/api\/productos\/(\d+)\/descargar$/)
  if (m) return Number(m[1])
  return null
}

export async function responderDescarga(ruta: string, peticion: Request, env: Env): Promise<Response> {
  if (peticion.method !== 'GET' && peticion.method !== 'HEAD') {
    return json({ ok: false, codigo: 'metodo_no_permitido', mensaje: 'Este endpoint solo acepta GET/HEAD.' }, 405, { Allow: 'GET, HEAD' })
  }

  const id = extraerIdDeRuta(ruta)
  if (id == null || !Number.isFinite(id) || id < 1) {
    return json({ ok: false, codigo: 'id_invalido', mensaje: 'ID de producto inválido.' }, 400)
  }

  const sesion = await obtenerSesion(peticion, env)
  if (!sesion?.usuarioId) {
    return json({ ok: false, codigo: 'no_autenticado', mensaje: 'Necesitas iniciar sesión para descargar.' }, 401)
  }

  try {
    const fila = await env.DB.prepare(SQL_VERIFICAR_COMPRA).bind(sesion.usuarioId, id).first<any>()
    const compra = evaluarCompra(fila)
    if (!compra.ok) {
      const cod = compra.motivo ?? 'sin_acceso'
      const msg = cod === 'sin-compra' ? 'No has comprado este producto.' : cod === 'compra-pendiente' ? 'Tu compra aún no ha sido verificada.' : 'Tu compra no tiene acceso a este archivo.'
      return json({ ok: false, codigo: cod, mensaje: msg }, 403)
    }

    const maestro = await obtenerArchivoMaestro(id, env.DB)
    if (!maestro) {
      return json({ ok: false, codigo: 'sin_archivo', mensaje: 'Este producto aún no tiene archivo maestro.' }, 404)
    }

    const resp = await servirDesdeMaestro(maestro, env)
    if (peticion.method === 'HEAD') {
      return new Response(null, { status: resp.status, headers: resp.headers })
    }
    return resp
  } catch (err) {
    if (err instanceof ErrorEntrega) {
      const mapa: Record<string, number> = {
        'no-autenticado': 401,
        'sin-compra': 403,
        'compra-pendiente': 403,
        expirado: 403,
        revocado: 403,
        'archivo-no-disponible': 404,
      }
      const st = mapa[err.codigo] ?? 500
      return json({ ok: false, codigo: err.codigo, mensaje: err.message }, st)
    }
    return json({ ok: false, codigo: 'error_interno', mensaje: 'No se pudo entregar el archivo.' }, 500)
  }
}
