/**
 * Router de avatares: foto de la CUENTA, foto de la TIENDA y sus reportes.
 *
 * ============================================================================
 *  RUTAS
 * ============================================================================
 *   POST   /api/panel/avatar                 sube (o cambia) tu foto de cuenta
 *   DELETE /api/panel/avatar                 quita tu foto de cuenta
 *   POST   /api/panel/tienda/avatar          sube (o cambia) la foto de la tienda
 *   DELETE /api/panel/tienda/avatar          quita la foto de la tienda
 *   POST   /api/reportes/avatar              PUBLICO: avisar de una foto
 *   GET    /api/owner/reportes-avatar        el Owner ve los avisos pendientes
 *   POST   /api/owner/reportes-avatar/:id/atender  el Owner borra la foto y cierra el aviso
 *
 * ============================================================================
 *  POR QUE LAS SUBIDAS NO VAN EN EL `PUT` DE LA TIENDA QUE YA EXISTE
 * ============================================================================
 * `PUT /api/panel/tienda` guarda textos y una URL. Subir una foto es otra cosa:
 * llega un archivo binario, hay que validarlo por sus primeros bytes, escribir en
 * KV y BORRAR la foto anterior para no pagar espacio de fotos que ya nadie ve.
 * Meterlo en el mismo `PUT` obligaria a que cada guardado de la descripcion
 * reenviara la foto entera, y a que un error al escribir el nombre dejara el
 * archivo subido sin dueño.
 *
 * ============================================================================
 *  POR QUE SE VALIDAN LOS BYTES Y NO LA EXTENSION NI EL `Content-Type`
 * ============================================================================
 * El navegador elige el `Content-Type`, y el nombre del archivo lo elige quien
 * sube. Renombrar un ejecutable a `.jpg` es trivial. Aqui lo que manda es la
 * FIRMA del archivo (los primeros bytes), y de la firma sale la extension que
 * queda en la clave de KV, no de lo que diga el nombre. Un archivo cuyo nombre
 * dice `.png` y cuyos bytes dicen JPEG se guarda como JPEG: lo que se ve es lo
 * que los bytes dicen, siempre.
 *
 * El navegador ademas normaliza la foto a 512x512 antes de subirla (ver
 * `src/lib/avatar-cliente.ts`), asi que en KV no acaba una foto de 12 MP. Este
 * router no confia en ese paso igualmente: si la peticion no viene del
 * navegador, la validacion sigue aqui.
 */

import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'
import { baseDeApi, cuerpoJson, json } from '../http'
import {
  MAX_BYTES_IMAGEN,
  claveDeAvatar,
  claveDesdeUrlImagen,
  contentTypeDeImagen,
  urlPublicaDeImagen,
} from '../../lib/imagenes'
import { hashSha256 } from '../../lib/almacenamiento'
import { usuarioDePeticion, type UsuarioSesion } from './registro'

/** Las dos fotos que se pueden reportar. La de cuenta es de la persona. */
const TIPOS = ['cuenta', 'tienda'] as const
type TipoFoto = (typeof TIPOS)[number]

/** Minimo y maximo de un motivo. Por debajo no dice nada util. */
const MOTIVO_MIN = 10
const MOTIVO_MAX = 500

export async function responderAvatar(peticion: Request, env: Env): Promise<Response> {
  const ruta = new URL(peticion.url).pathname.replace(/\/+$/, '')

  // El aviso de una foto lo puede mandar CUALQUIERA: es justo el caso de quien
  // no esta dentro y ve algo que no deberia estar. Va antes de leer la cookie,
  // porque exigir sesion para reportar dejaria fuera a quien mas lo necesita.
  if (ruta === '/api/reportes/avatar') {
    if (peticion.method !== 'POST') {
      throw ErrorApi.metodoNoPermitido('Un aviso se manda por POST.', ['POST'])
    }
    return reportar(peticion, env)
  }

  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)
  if (!usuario) throw ErrorApi.noAutenticado()

  // Revision de fotos por parte del Owner. Mismo criterio que
  // `/api/owner/productos`: en la propia URL se ve que no es una ruta de panel.
  if (ruta === '/api/owner/reportes-avatar') {
    if (!esAdministrador(usuario)) throw ErrorApi.sinPermiso()
    if (peticion.method !== 'GET') {
      throw ErrorApi.metodoNoPermitido('Aqui solo se listan avisos.', ['GET'])
    }
    return listarReportes(env)
  }

  const atender = ruta.match(/^\/api\/owner\/reportes-avatar\/(\d+)\/atender$/)
  if (atender) {
    if (!esAdministrador(usuario)) throw ErrorApi.sinPermiso()
    if (peticion.method !== 'POST') {
      throw ErrorApi.metodoNoPermitido('Esa decision se manda por POST.', ['POST'])
    }
    return atenderReporte(env, Number(atender[1]))
  }

  if (ruta === '/api/panel/avatar') {
    if (peticion.method === 'POST') return subirCuenta(peticion, env, usuario)
    if (peticion.method === 'DELETE') return borrarCuenta(env, usuario)
    throw ErrorApi.metodoNoPermitido('La foto de la cuenta se sube por POST y se quita por DELETE.', ['POST', 'DELETE'])
  }

  if (ruta === '/api/panel/tienda/avatar') {
    if (peticion.method === 'POST') return subirTienda(peticion, env, usuario)
    if (peticion.method === 'DELETE') return borrarTienda(env, usuario)
    throw ErrorApi.metodoNoPermitido('La foto de la tienda se sube por POST y se quita por DELETE.', ['POST', 'DELETE'])
  }

  throw ErrorApi.noEncontrado('Esa ruta')
}

function esAdministrador(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'owner' || usuario.rol === 'administrador'
}

/* ===========================================================================
 * Subir y quitar
 * ======================================================================== */

/**
 * La lectura y validacion que comparten las dos subidas.
 *
 * Se devuelve la extension DERIVADA DE LA FIRMA junto a los bytes. Las dos
 * subidas hacen exactamente las mismas comprobaciones y en el mismo orden, y
 * tenerlas en dos sitios seria la forma segura de que una se quede sin una.
 */
async function leerImagen(peticion: Request): Promise<{ bytes: ArrayBuffer; ext: string }> {
  const forma = await peticion.formData()
  const crudo = forma.get('imagen')
  if (!(crudo instanceof File)) throw ErrorApi.invalido('imagen', 'Adjunta una imagen.')
  if (crudo.size === 0) throw ErrorApi.invalido('imagen', 'La imagen esta vacia.')
  if (crudo.size > MAX_BYTES_IMAGEN) {
    throw ErrorApi.invalido('imagen', 'La imagen no puede pasar de 2 MB.')
  }

  const bytes = await crudo.arrayBuffer()
  const ext = extensionReal(new Uint8Array(bytes))
  if (!ext) {
    throw ErrorApi.invalido(
      'imagen',
      'Ese archivo no es una imagen. Se aceptan JPG, PNG, WEBP, GIF o AVIF.',
    )
  }
  return { bytes, ext }
}

/** Escribe los bytes en KV y devuelve la URL publica absoluta. */
async function guardarEnArchivos(
  peticion: Request,
  env: Env,
  usuarioId: number,
  bytes: ArrayBuffer,
  ext: string,
): Promise<string> {
  const clave = claveDeAvatar(usuarioId, `foto.${ext}`)
  const hash = await hashSha256(bytes)
  await env.ARCHIVOS.put(clave, bytes, {
    metadata: {
      contentType: contentTypeDeImagen(clave),
      bytes: bytes.byteLength,
      hash,
    },
  })
  return urlPublicaDeImagen(baseDeApi(env, peticion), clave)
}

/**
 * Borra de KV el objeto que hay detras de una URL guardada.
 *
 * Si la URL no es una de nuestras (una foto que alguien pego a mano antes de que
 * existiera la subida), `claveDesdeUrlImagen` devuelve `null` y no se toca nada:
 * borrar a ciegas podria llevarse un objeto que no es de esta cuenta.
 */
async function borrarObjeto(env: Env, url: string | null): Promise<void> {
  if (!url) return
  const clave = claveDesdeUrlImagen(url)
  if (clave) await env.ARCHIVOS.delete(clave)
}

async function subirCuenta(
  peticion: Request,
  env: Env,
  usuario: UsuarioSesion,
): Promise<Response> {
  const anterior = await env.DB.prepare('SELECT avatar FROM usuarios WHERE id = ?')
    .bind(usuario.id)
    .first<{ avatar: string | null }>()

  const { bytes, ext } = await leerImagen(peticion)
  const url = await guardarEnArchivos(peticion, env, usuario.id, bytes, ext)

  await env.DB.prepare('UPDATE usuarios SET avatar = ? WHERE id = ?').bind(url, usuario.id).run()

  // La anterior se borra DESPUES de que la nueva quede guardada. Al reves, un
  // fallo al escribir dejaria la cuenta sin foto y sin la vieja.
  await borrarObjeto(env, anterior?.avatar ?? null)

  return json({ ok: true, avatar: url }, 201)
}

async function borrarCuenta(env: Env, usuario: UsuarioSesion): Promise<Response> {
  const fila = await env.DB.prepare('SELECT avatar FROM usuarios WHERE id = ?')
    .bind(usuario.id)
    .first<{ avatar: string | null }>()

  await env.DB.prepare('UPDATE usuarios SET avatar = NULL WHERE id = ?').bind(usuario.id).run()
  await borrarObjeto(env, fila?.avatar ?? null)

  return json({ ok: true, avatar: null })
}

async function subirTienda(
  peticion: Request,
  env: Env,
  usuario: UsuarioSesion,
): Promise<Response> {
  const vendedorId = usuario.vendedor_id
  if (vendedorId === null) {
    throw ErrorApi.invalido('tienda', 'Tu cuenta todavia no tiene tienda.')
  }

  const anterior = await env.DB.prepare('SELECT avatar_url FROM vendedores WHERE id = ?')
    .bind(vendedorId)
    .first<{ avatar_url: string | null }>()

  const { bytes, ext } = await leerImagen(peticion)
  const url = await guardarEnArchivos(peticion, env, usuario.id, bytes, ext)

  await env.DB.prepare('UPDATE vendedores SET avatar_url = ? WHERE id = ?')
    .bind(url, vendedorId)
    .run()

  await borrarObjeto(env, anterior?.avatar_url ?? null)

  return json({ ok: true, avatar: url }, 201)
}

async function borrarTienda(env: Env, usuario: UsuarioSesion): Promise<Response> {
  const vendedorId = usuario.vendedor_id
  if (vendedorId === null) {
    throw ErrorApi.invalido('tienda', 'Tu cuenta todavia no tiene tienda.')
  }

  const fila = await env.DB.prepare('SELECT avatar_url FROM vendedores WHERE id = ?')
    .bind(vendedorId)
    .first<{ avatar_url: string | null }>()

  await env.DB.prepare('UPDATE vendedores SET avatar_url = NULL WHERE id = ?')
    .bind(vendedorId)
    .run()
  await borrarObjeto(env, fila?.avatar_url ?? null)

  return json({ ok: true, avatar: null })
}

/* ===========================================================================
 * Reportes
 * ======================================================================== */

/**
 * `POST /api/reportes/avatar` — el aviso de un visitante.
 *
 * Cuerpo: `{ vendedor_slug, tipo, motivo }`.
 *
 * Se identifica por SLUG y no por id porque es lo unico que la pagina publica
 * conoce: un id interno en el `<form>` es un numero que se puede cambiar a mano
 * para reportar a cualquiera, mientras que el slug es lo que la persona esta
 * viendo.
 *
 * Un segundo aviso sobre la misma foto pendiente no crea fila nueva: el Owner
 * no gana nada con ver el mismo caso cinco veces, y quien insiste no consigue
 * nada que no consiguiera una vez. El aviso que vale es el primero.
 */
async function reportar(peticion: Request, env: Env): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  const slug = typeof cuerpo.vendedor_slug === 'string' ? cuerpo.vendedor_slug.trim() : ''
  if (!slug) throw ErrorApi.invalido('vendedor_slug', 'Falta el vendedor de la foto.')

  const tipo = cuerpo.tipo
  if (!(TIPOS as readonly unknown[]).includes(tipo)) {
    throw ErrorApi.invalido('tipo', 'Esa foto no existe.')
  }

  const motivo = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : ''
  if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX) {
    throw ErrorApi.invalido(
      'motivo',
      `Cuentanos un poco mas (de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres).`,
    )
  }

  const vendedor = await env.DB.prepare('SELECT id, avatar_url FROM vendedores WHERE slug = ?')
    .bind(slug)
    .first<{ id: number; avatar_url: string | null }>()
  if (!vendedor) throw ErrorApi.noEncontrado('Ese vendedor')

  const url = await urlDeLaFoto(env, vendedor.id, tipo as TipoFoto)
  if (!url) throw ErrorApi.invalido('foto', 'Esa foto ya no esta publicada.')

  const yaHay = await env.DB.prepare(
    `SELECT 1 AS hay FROM reportes_avatar
      WHERE vendedor_id = ? AND tipo = ? AND atendido_at IS NULL
      LIMIT 1`,
  )
    .bind(vendedor.id, tipo)
    .first<{ hay: number }>()

  if (!yaHay) {
    await env.DB.prepare(
      'INSERT INTO reportes_avatar (vendedor_id, tipo, url, motivo) VALUES (?, ?, ?, ?)',
    )
      .bind(vendedor.id, tipo, url, motivo)
      .run()
  }

  return json({ ok: true }, 201)
}

/** La URL de la foto de un vendedor segun cual sea: la de la cuenta o la de la tienda. */
async function urlDeLaFoto(
  env: Env,
  vendedorId: number,
  tipo: TipoFoto,
): Promise<string | null> {
  if (tipo === 'tienda') {
    const fila = await env.DB.prepare('SELECT avatar_url FROM vendedores WHERE id = ?')
      .bind(vendedorId)
      .first<{ avatar_url: string | null }>()
    return fila?.avatar_url ?? null
  }
  const fila = await env.DB.prepare('SELECT avatar FROM usuarios WHERE vendedor_id = ?')
    .bind(vendedorId)
    .first<{ avatar: string | null }>()
  return fila?.avatar ?? null
}

/** `GET /api/owner/reportes-avatar` — la cola del Owner, pendientes primero. */
async function listarReportes(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.tipo, r.url, r.motivo, r.creado_at, r.atendido_at,
            v.slug AS vendedor_slug, v.nombre_comercial AS vendedor_nombre,
            u.email AS vendedor_email
       FROM reportes_avatar r
       JOIN vendedores v ON v.id = r.vendedor_id
       LEFT JOIN usuarios u ON u.vendedor_id = v.id
      ORDER BY (r.atendido_at IS NULL) DESC, r.creado_at DESC
      LIMIT 100`,
  ).all<Record<string, unknown>>()

  return json({
    ok: true,
    reportes: (results ?? []).map((f) => ({
      id: f.id,
      tipo: f.tipo,
      url: f.url,
      motivo: f.motivo,
      vendedorSlug: f.vendedor_slug,
      vendedorNombre: f.vendedor_nombre,
      vendedorEmail: f.vendedor_email,
      creadoAt: f.creado_at,
      atendido: f.atendido_at !== null,
    })),
  })
}

/**
 * `POST /api/owner/reportes-avatar/:id/atender` — borra la foto y cierra el aviso.
 *
 * Se borra la foto REPORTADA, no todas: si alguien reporto la de la tienda y la
 * persona tiene ademas la de la cuenta, esa se queda. Quitar las dos seria una
 * sancion mas amplia que la revision que el Owner acaba de hacer.
 *
 * Volver a atender un aviso ya atendido responde 200 y no hace nada: un doble
 * clic no es un error, y fallar ahi solo confundiria.
 */
async function atenderReporte(env: Env, id: number): Promise<Response> {
  const reporte = await env.DB.prepare(
    'SELECT id, vendedor_id, tipo, atendido_at FROM reportes_avatar WHERE id = ?',
  )
    .bind(id)
    .first<{ id: number; vendedor_id: number; tipo: TipoFoto; atendido_at: string | null }>()
  if (!reporte) throw ErrorApi.noEncontrado('Ese aviso')
  if (reporte.atendido_at !== null) return json({ ok: true })

  const url = await urlDeLaFoto(env, reporte.vendedor_id, reporte.tipo)

  if (reporte.tipo === 'tienda') {
    await env.DB.prepare('UPDATE vendedores SET avatar_url = NULL WHERE id = ?')
      .bind(reporte.vendedor_id)
      .run()
  } else {
    await env.DB.prepare('UPDATE usuarios SET avatar = NULL WHERE vendedor_id = ?')
      .bind(reporte.vendedor_id)
      .run()
  }

  await borrarObjeto(env, url)
  await env.DB.prepare(
    `UPDATE reportes_avatar
        SET atendido_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?`,
  )
    .bind(id)
    .run()

  return json({ ok: true })
}

/* ===========================================================================
 * Firma de archivo
 * ======================================================================== */

/**
 * La extension real segun los primeros bytes, o `null` si no es una imagen.
 *
 * Se comparan los bytes y no el nombre a proposito: el nombre lo elige quien
 * sube y no prueba nada. Lo que se comprueba aqui es lo que despues se va a
 * guardar, porque la extension de la clave es la que decide el `Content-Type`
 * con el que se servira.
 */
function extensionReal(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null

  const ascii = (desde: number, largo: number): string =>
    String.fromCharCode(...bytes.slice(desde, desde + largo))

  // JPEG: FF D8 FF. GIF: GIF87a / GIF89a.
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif'

  // PNG: los ocho bytes fijos de la cabecera.
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }

  // WEBP: contenedor RIFF con marca WEBP.
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp'

  // AVIF: caja ISO-BMFF con marca avif/avis.
  if (ascii(4, 4) === 'ftyp' && (ascii(8, 4) === 'avif' || ascii(8, 4) === 'avis')) {
    return 'avif'
  }

  return null
}
