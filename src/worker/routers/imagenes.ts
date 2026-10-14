import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'
import { decodificar } from '../http'
import { contentTypeDeImagen, esClaveDeImagen } from '../../lib/imagenes'

const PREFIJO_RUTA = '/api/imagenes/'

export async function responderImagen(
  peticion: Request,
  env: Env,
  ruta: string,
): Promise<Response> {
  if (peticion.method !== 'GET' && peticion.method !== 'HEAD') {
    throw ErrorApi.metodoNoPermitido('Las imagenes solo se leen.', ['GET', 'HEAD'])
  }

  const clave = decodificar(ruta.slice(PREFIJO_RUTA.length))
  if (!clave || !esClaveDeImagen(clave)) throw ErrorApi.noEncontrado('Esa imagen')

  const cache = (caches as unknown as { default: Cache }).default
  const llaveCache = new Request(new URL(peticion.url).toString(), { method: 'GET' })
  const enCache = await cache.match(llaveCache)
  if (enCache) return enCache

  const bytes = await env.ARCHIVOS.get(clave, 'arrayBuffer')
  if (!bytes) throw ErrorApi.noEncontrado('Esa imagen')

  const respuesta = new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentTypeDeImagen(clave) ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })

  await cache.put(llaveCache, respuesta.clone())
  return respuesta
}
