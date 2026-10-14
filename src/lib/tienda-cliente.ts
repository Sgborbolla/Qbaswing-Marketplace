import { pedir, type Respuesta } from './identidad-cliente'

/**
 * Cliente de `/api/panel/tienda`.
 *
 * ============================================================================
 *  QUE MANEJA
 * ============================================================================
 * Lo que identifica a la tienda de cara al publico: nombre, descripcion,
 * ubicacion, avatar; el contacto directo (telefono, WhatsApp, correo, direccion,
 * sitio) y las redes sociales. Los precios y el catalogo NO van aqui: eso es
 * `/api/panel/productos`.
 *
 * El `PUT` manda los tres bloques a la vez porque las redes se reemplazan
 * enteras: una red que no venga en la lista, se borra. Por eso `guardarTienda`
 * recibe siempre la lista completa.
 */

const RUTA = '/api/panel/tienda'

/** Los datos de la propia tienda. */
export interface TiendaInfo {
  id: number
  slug: string
  nombre: string
  nombre_comercial: string
  descripcion: string
  avatar_url: string | null
  ubicacion: string
  /** `1` si el Owner ya la verifico. */
  verificado: number
}

export interface ContactoTienda {
  telefono: string
  whatsapp: string
  correo: string
  direccion: string
  sitio_web: string
}

export interface RedTienda {
  id?: number
  red: string
  url: string
  orden: number
}

export interface CuerpoTienda {
  nombre_comercial: string
  descripcion: string
  ubicacion: string
  avatar_url: string | null
  contacto: {
    telefono: string
    whatsapp: string
    correo: string
    direccion: string
    sitio_web: string
  }
  redes: { red: string; url: string; orden: number }[]
}

export interface TiendaCompleta {
  ok: true
  tienda: TiendaInfo
  contacto: {
    telefono: string
    whatsapp: string
    correo: string
    direccion: string
    sitio_web: string
  }
  redes: { id: number; red: string; url: string; orden: number }[]
}

/** Lee la tienda con su contacto y sus redes. */
export function miTienda(): Promise<Respuesta<TiendaCompleta>> {
  return pedir<TiendaCompleta>(RUTA)
}

/** Guarda tienda, contacto y redes de una vez. */
export function guardarTienda(cuerpo: CuerpoTienda): Promise<Respuesta<TiendaCompleta>> {
  return pedir<TiendaCompleta>(RUTA, { method: 'PUT', body: JSON.stringify(cuerpo) })
}

/** Las redes que el servidor admite. Se repite aqui para pintar el desplegable. */
export const REDES_TIENDA: { valor: string; nombre: string }[] = [
  { valor: 'facebook', nombre: 'Facebook' },
  { valor: 'instagram', nombre: 'Instagram' },
  { valor: 'tiktok', nombre: 'TikTok' },
  { valor: 'x', nombre: 'X' },
  { valor: 'youtube', nombre: 'YouTube' },
  { valor: 'telegram', nombre: 'Telegram' },
  { valor: 'whatsapp', nombre: 'WhatsApp' },
  { valor: 'linkedin', nombre: 'LinkedIn' },
  { valor: 'github', nombre: 'GitHub' },
  { valor: 'web', nombre: 'Sitio web' },
]
