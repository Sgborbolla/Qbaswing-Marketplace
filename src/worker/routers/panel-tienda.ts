/**
 * Router de la tienda de CADA CUENTA: `/api/panel/tienda`.
 *
 * ============================================================================
 *  LAS DOS OPERACIONES
 * ============================================================================
 *   GET  /api/panel/tienda   la ficha de tu tienda, tu contacto y tus redes
 *   PUT  /api/panel/tienda   guarda las tres cosas a la vez
 *
 * ============================================================================
 *  QUE ES "LA TIENDA" Y QUE NO
 * ============================================================================
 * Aqui vive lo que identifica al vendedor de cara al publico: su nombre
 * comercial, su descripcion, su ubicacion y su avatar; su contacto directo
 * (telefono, WhatsApp, correo, direccion, sitio web) y sus redes sociales.
 *
 * NO viven aqui ni los precios, ni el catalogo (van en `/api/panel/productos`)
 * ni las formas de cobro (van en `/api/panel/medios-pago`). Son tres paneles
 * porque son tres decisiones distintas, y mezclarlas en un solo
 * `PATCH` gigante haria que guardar el telefono pudiera tumbar el catalogo por
 * un fallo de validacion ajeno.
 *
 * El contacto y las redes van en tablas propias (`contacto_vendedor`,
 * `redes_vendedor`) porque cada tienda puede tener las que quiera, incluida
 * ninguna. Lo que si es uno a uno (nombre, descripcion...) vive en la fila del
 * propio vendedor.
 *
 * ============================================================================
 *  POR QUE `PUT` Y NO `PATCH`
 * ============================================================================
 * Porque las redes se envian como una lista COMPLETA y se reemplazan enteras:
 * una red que no venga, se borra. Eso es una sustitucion, no una fusion, y
 * `PUT` es su verbo. El cuerpo trae los cinco bloques a la vez y se aplica todo
 * en un solo `batch` para que no pueda quedar el nombre cambiado y las redes a
 * medias si algo falla por el camino.
 */

import { ErrorApi } from '../constantes'
import type { Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { usuarioDePeticion } from './registro'

/** Topes de cada campo. La base no los pone, y sin tope todo acaba con 10.000 caracteres. */
const TOPE_NOMBRE = 120
const TOPE_DESCRIPCION = 2000
const TOPE_UBICACION = 120
const TOPE_AVATAR = 500
const TOPE_TELEFONO = 40
const TOPE_CORREO = 200
const TOPE_DIRECCION_CONTACTO = 300
const TOPE_SITIO = 500
const TOPE_RED = 40
const TOPE_RED_URL = 500

/**
 * Las redes que se admiten en la tienda.
 *
 * Es una lista corta a proposito. El `red` de `redes_vendedor` no lleva `CHECK`
 * en la base porque las redes cambian mas seguido que el esquema, pero dejarlo
 * abierto significaria que la ficha pinta un icono que no conoce. Aqui se
 * acepta lo mismo que la plataforma ya sabe pintar.
 */
const REDES = [
  'facebook',
  'instagram',
  'tiktok',
  'x',
  'youtube',
  'telegram',
  'whatsapp',
  'linkedin',
  'github',
  'web',
] as const
type Red = (typeof REDES)[number]

export async function responderTienda(peticion: Request, env: Env): Promise<Response> {
  const { usuario } = await usuarioDePeticion(
    env.DB,
    peticion,
    env.QBASWING_SECRETO_FIRMA,
  )

  if (!usuario) throw ErrorApi.noAutenticado()

  const vendedorId = usuario.vendedor_id
  if (vendedorId === null) {
    throw ErrorApi.invalido('tienda', 'Tu cuenta todavia no tiene tienda.')
  }

  if (peticion.method === 'GET') return ver(env, vendedorId)
  if (peticion.method === 'PUT') return guardar(peticion, env, vendedorId)

  throw ErrorApi.metodoNoPermitido('Ese metodo no existe en tu tienda.', ['GET', 'PUT'])
}

async function ver(env: Env, vendedorId: number): Promise<Response> {
  const tienda = await env.DB.prepare(
    `SELECT id, slug, nombre, nombre_comercial, descripcion, avatar_url,
            ubicacion, verificado
       FROM vendedores
      WHERE id = ?`,
  )
    .bind(vendedorId)
    .first<Record<string, unknown>>()

  if (!tienda) throw ErrorApi.noEncontrado('Tu tienda')

  const contacto = await contactoDe(env, vendedorId)
  const redes = await redesDe(env, vendedorId)

  return json({ ok: true, tienda, contacto, redes })
}

async function contactoDe(
  env: Env,
  vendedorId: number,
): Promise<Record<string, unknown>> {
  const fila = await env.DB.prepare(
    `SELECT telefono, whatsapp, correo, direccion, sitio_web
       FROM contacto_vendedor
      WHERE vendedor_id = ?`,
  )
    .bind(vendedorId)
    .first<Record<string, unknown>>()

  return (
    fila ?? {
      telefono: '',
      whatsapp: '',
      correo: '',
      direccion: '',
      sitio_web: '',
    }
  )
}

async function redesDe(env: Env, vendedorId: number): Promise<Record<string, unknown>[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, red, url, orden
       FROM redes_vendedor
      WHERE vendedor_id = ?
      ORDER BY orden, id`,
  )
    .bind(vendedorId)
    .all()

  return results ?? []
}

async function guardar(
  peticion: Request,
  env: Env,
  vendedorId: number,
): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  const campos = leerTienda(cuerpo)
  const contacto = leerContacto(cuerpo.contacto)
  const redes = leerRedes(cuerpo.redes)

  const sentencias = [
    env.DB.prepare(
      `UPDATE vendedores
          SET nombre_comercial = ?,
              descripcion = ?,
              ubicacion = ?,
              avatar_url = ?
        WHERE id = ?`,
    ).bind(
      campos.nombreComercial,
      campos.descripcion,
      campos.ubicacion,
      campos.avatarUrl,
      vendedorId,
    ),
    env.DB.prepare(
      `INSERT INTO contacto_vendedor
         (vendedor_id, telefono, whatsapp, correo, direccion, sitio_web, actualizado_at)
       VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT (vendedor_id) DO UPDATE SET
         telefono = excluded.telefono,
         whatsapp = excluded.whatsapp,
         correo = excluded.correo,
         direccion = excluded.direccion,
         sitio_web = excluded.sitio_web,
         actualizado_at = excluded.actualizado_at`,
    ).bind(
      vendedorId,
      contacto.telefono,
      contacto.whatsapp,
      contacto.correo,
      contacto.direccion,
      contacto.sitioWeb,
    ),
    env.DB.prepare(`DELETE FROM redes_vendedor WHERE vendedor_id = ?`).bind(vendedorId),
    ...redes.map((r) =>
      env.DB.prepare(
        `INSERT INTO redes_vendedor (vendedor_id, red, url, orden) VALUES (?, ?, ?, ?)`,
      ).bind(vendedorId, r.red, r.url, r.orden),
    ),
  ]

  await env.DB.batch(sentencias)

  return json({
    ok: true,
    tienda: {
      ...campos,
      id: vendedorId,
    },
    contacto,
    redes,
  })
}

/* ===========================================================================
 * Validacion
 * ======================================================================== */

interface Tienda {
  nombreComercial: string
  descripcion: string
  ubicacion: string
  avatarUrl: string | null
}

interface Contacto {
  telefono: string
  whatsapp: string
  correo: string
  direccion: string
  sitioWeb: string
}

interface RedFila {
  red: Red
  url: string
  orden: number
}

function leerTienda(cuerpo: Record<string, unknown>): Tienda {
  const nombreComercial = texto(cuerpo.nombre_comercial)
  if (!nombreComercial) {
    throw ErrorApi.invalido('nombre_comercial', 'Pon el nombre con el que quieres aparecer.')
  }
  if (nombreComercial.length > TOPE_NOMBRE) {
    throw ErrorApi.invalido(
      'nombre_comercial',
      `El nombre comercial no puede pasar de ${TOPE_NOMBRE} caracteres.`,
    )
  }

  const descripcion = texto(cuerpo.descripcion)
  if (descripcion.length > TOPE_DESCRIPCION) {
    throw ErrorApi.invalido(
      'descripcion',
      `La descripcion no puede pasar de ${TOPE_DESCRIPCION} caracteres.`,
    )
  }

  const ubicacion = texto(cuerpo.ubicacion)
  if (ubicacion.length > TOPE_UBICACION) {
    throw ErrorApi.invalido(
      'ubicacion',
      `La ubicacion no puede pasar de ${TOPE_UBICACION} caracteres.`,
    )
  }

  const avatarUrl = urlSegura(cuerpo.avatar_url, 'avatar_url', TOPE_AVATAR)

  return { nombreComercial, descripcion, ubicacion, avatarUrl }
}

function leerContacto(crudo: unknown): Contacto {
  const c = (crudo ?? {}) as Record<string, unknown>

  const telefono = texto(c.telefono)
  if (telefono.length > TOPE_TELEFONO) {
    throw ErrorApi.invalido('telefono', `El telefono no puede pasar de ${TOPE_TELEFONO} caracteres.`)
  }
  const whatsapp = texto(c.whatsapp)
  if (whatsapp.length > TOPE_TELEFONO) {
    throw ErrorApi.invalido('whatsapp', `El WhatsApp no puede pasar de ${TOPE_TELEFONO} caracteres.`)
  }

  const correo = texto(c.correo)
  if (correo.length > TOPE_CORREO) {
    throw ErrorApi.invalido('correo', `El correo no puede pasar de ${TOPE_CORREO} caracteres.`)
  }
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw ErrorApi.invalido('correo', 'Ese correo no parece una direccion valida.')
  }

  const direccion = texto(c.direccion)
  if (direccion.length > TOPE_DIRECCION_CONTACTO) {
    throw ErrorApi.invalido(
      'direccion',
      `La direccion no puede pasar de ${TOPE_DIRECCION_CONTACTO} caracteres.`,
    )
  }

  const sitioWeb = urlSegura(c.sitio_web, 'sitio_web', TOPE_SITIO) ?? ''

  return { telefono, whatsapp, correo, direccion, sitioWeb }
}

function leerRedes(crudo: unknown): RedFila[] {
  if (crudo === undefined) return []
  if (!Array.isArray(crudo)) {
    throw ErrorApi.invalido('redes', 'Las redes tienen que ser una lista.')
  }

  const vistas = new Set<string>()
  const filas: RedFila[] = []

  crudo.forEach((item, indice) => {
    const r = (item ?? {}) as Record<string, unknown>

    const red = texto(r.red).toLowerCase()
    if (!(REDES as readonly string[]).includes(red)) {
      throw ErrorApi.invalido(
        `redes[${indice}].red`,
        `Esa red no existe. Puede ser: ${REDES.join(', ')}.`,
      )
    }
    if (vistas.has(red)) {
      throw ErrorApi.invalido(`redes[${indice}].red`, `Repetiste ${red}.`)
    }
    vistas.add(red)

    const url = urlSegura(r.url, `redes[${indice}].url`, TOPE_RED_URL)
    if (!url) {
      throw ErrorApi.invalido(`redes[${indice}].url`, 'Pon la direccion de tu perfil en esa red.')
    }

    const orden = entero(r.orden) ?? indice
    filas.push({ red: red as Red, url, orden })
  })

  return filas
}

/**
 * URL que se va a pintar como `href` en la ficha publica, asi que solo `http` y
 * `https`. Un `javascript:` ahi correria con la sesion de quien lo pulsa.
 * Devuelve `null` cuando no viene nada; los campos con tope propio lo manejan.
 */
function urlSegura(valor: unknown, campo: string, tope: number): string | null {
  const s = texto(valor)
  if (!s) return null
  if (s.length > tope) {
    throw ErrorApi.invalido(campo, `Ese enlace no puede pasar de ${tope} caracteres.`)
  }
  let protocolo: string
  try {
    protocolo = new URL(s).protocol
  } catch {
    throw ErrorApi.invalido(campo, 'Ese enlace no es una direccion valida.')
  }
  if (protocolo !== 'http:' && protocolo !== 'https:') {
    throw ErrorApi.invalido(campo, `Solo se admiten enlaces http:// o https://.`)
  }
  return s
}

function texto(valor: unknown): string {
  if (valor === undefined || valor === null) return ''
  return typeof valor === 'string' ? valor.trim() : String(valor).trim()
}

function entero(valor: unknown): number | undefined {
  const n = typeof valor === 'number' ? valor : Number.parseInt(String(valor ?? ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
