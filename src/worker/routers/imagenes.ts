import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'
import { decodificar } from '../http'
import { contentTypeDeImagen, esClaveDeImagen } from '../../lib/imagenes'

const PREFIJO_RUTA = '/api/imagenes/'

/**
 * Los bytes de una imagen, con las cabeceras con las que se sirve.
 *
 * Se devuelve una `Response` NUEVA en los dos caminos (cache y KV) y no se
 * reenvia la de la Cache API tal cual. Eso ultimo fue un fallo real: una
 * `Response` que sale de `cache.match()` tiene las cabeceras CONGELADAS, y el
 * despacho del Worker hace `headers.set` para anadir CORS. `set` sobre unas
 * cabeceras congeladas lanza `TypeError`, asi que la imagen se servia bien la
 * PRIMERA vez (viene del KV, cabeceras normales) y daba 500 a partir de la
 * segunda (viene de la cache). El sintoma engañaba: parecia un problema del
 * archivo y era de quien lo servia.
 *
 * `Content-Type` se recalcula desde la clave y no se copia del objeto guardado
 * para que un objeto viejo con la cabecera mal puesta se siga sirviendo bien.
 */
function respuestaDeImagen(bytes: ArrayBuffer, clave: string): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentTypeDeImagen(clave) ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

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

  // Un `HEAD` no deja cuerpo que cachear y ademas `cache.put` exige un cuerpo:
  // se resuelve antes de tocar la cache.
  const esCabeza = peticion.method === 'HEAD'

  if (!esCabeza) {
    const llaveCache = new Request(new URL(peticion.url).toString(), { method: 'GET' })
    const enCache = await cache.match(llaveCache)
    if (enCache) {
      const bytes = await enCache.arrayBuffer()
      return respuestaDeImagen(bytes, clave)
    }
  }

  const bytes = await env.ARCHIVOS.get(clave, 'arrayBuffer')
  if (!bytes) throw ErrorApi.noEncontrado('Esa imagen')

  const respuesta = respuestaDeImagen(bytes, clave)

  if (!esCabeza) {
    const llaveCache = new Request(new URL(peticion.url).toString(), { method: 'GET' })
    await cache.put(llaveCache, respuesta.clone())
  }

  return respuesta
}
