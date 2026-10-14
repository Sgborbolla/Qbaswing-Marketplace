import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { usuarioDePeticion, type UsuarioSesion } from './registro'

const ESTADOS = ['pendiente', 'aprobado', 'rechazado', 'borrador'] as const
type Estado = (typeof ESTADOS)[number]

function esAdministrador(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'owner' || usuario.rol === 'administrador'
}

export async function responderOwnerProductos(
  peticion: Request,
  env: Env,
): Promise<Response> {
  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)
  if (!usuario) throw ErrorApi.noAutenticado()
  if (!esAdministrador(usuario)) throw ErrorApi.sinPermiso()

  const ruta = new URL(peticion.url).pathname.replace(/\/+$/, '')

  if (ruta === '/api/owner/productos') {
    if (peticion.method !== 'GET') {
      throw ErrorApi.metodoNoPermitido('Aqui solo se listan productos.', ['GET'])
    }
    return listar(peticion, env)
  }

  const coincidencia = ruta.match(/^\/api\/owner\/productos\/(\d+)\/(aprobar|rechazar)$/)
  if (!coincidencia) throw ErrorApi.noEncontrado('Esa ruta')

  if (peticion.method !== 'POST') {
    throw ErrorApi.metodoNoPermitido('Esa accion se manda por POST.', ['POST'])
  }

  const id = Number(coincidencia[1])
  return coincidencia[2] === 'aprobar'
    ? aprobar(env, usuario, id)
    : rechazar(peticion, env, id)
}

async function listar(peticion: Request, env: Env): Promise<Response> {
  const url = new URL(peticion.url)
  const estado = url.searchParams.get('estado') ?? 'pendiente'
  if (!(ESTADOS as readonly string[]).includes(estado)) {
    throw ErrorApi.invalido('estado', 'Ese estado no existe.')
  }

  const { results } = await env.DB.prepare(
    `SELECT p.id, p.slug, p.titulo, p.descripcion, p.tipo, p.origen, p.regla,
            p.categoria, p.precio, COALESCE(p.moneda_codigo, p.moneda) AS moneda,
            p.estado_publicacion, p.motivo_rechazo,
            p.creado_at, p.actualizado_at,
            v.slug AS vendedor_slug, v.nombre_comercial AS vendedor_nombre,
            (SELECT i.url FROM producto_imagenes i
              WHERE i.producto_id = p.id ORDER BY i.orden, i.id LIMIT 1) AS imagen
       FROM productos p
       JOIN vendedores v ON v.id = p.vendedor_id
      WHERE p.estado_publicacion = ?
      ORDER BY p.actualizado_at ASC, p.id ASC
      LIMIT 100`,
  )
    .bind(estado)
    .all()

  return json({ ok: true, estado, productos: results ?? [] })
}

async function aprobar(env: Env, usuario: UsuarioSesion, id: number): Promise<Response> {
  const producto = await env.DB.prepare(
    'SELECT estado_publicacion FROM productos WHERE id = ?',
  )
    .bind(id)
    .first<{ estado_publicacion: string }>()

  if (!producto) throw ErrorApi.noEncontrado('Ese producto')
  if (producto.estado_publicacion !== 'pendiente') {
    throw ErrorApi.invalido('estado', 'Solo se aprueban productos pendientes.')
  }

  await env.DB.prepare(
    `UPDATE productos
        SET estado_publicacion = 'aprobado',
            aprobado_por = ?,
            aprobado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            publicado = 1,
            motivo_rechazo = NULL
      WHERE id = ?`,
  )
    .bind(usuario.id, id)
    .run()

  return json({ ok: true })
}

async function rechazar(peticion: Request, env: Env, id: number): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const motivo = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : ''
  if (motivo.length < 3) {
    throw ErrorApi.invalido('motivo', 'Escribe el motivo del rechazo.')
  }
  if (motivo.length > 300) {
    throw ErrorApi.invalido('motivo', 'El motivo no puede pasar de 300 caracteres.')
  }

  const producto = await env.DB.prepare(
    'SELECT estado_publicacion FROM productos WHERE id = ?',
  )
    .bind(id)
    .first<{ estado_publicacion: string }>()

  if (!producto) throw ErrorApi.noEncontrado('Ese producto')
  if (producto.estado_publicacion !== 'pendiente') {
    throw ErrorApi.invalido('estado', 'Solo se rechazan productos pendientes.')
  }

  await env.DB.prepare(
    `UPDATE productos
        SET estado_publicacion = 'rechazado',
            motivo_rechazo = ?,
            publicado = 0,
            aprobado_por = NULL,
            aprobado_at = NULL
      WHERE id = ?`,
  )
    .bind(motivo, id)
    .run()

  return json({ ok: true })
}
