/**
 * Idiomas del marketplace.
 *
 * ============================================================================
 *  POR QUE ESTA ESTRUCTURA
 * ============================================================================
 *
 * Astro genera las 20+ rutas solo (ver i18n.fallback en astro.config.mjs).
 * Este modulo define COMO se resuelve el texto dentro de cada pagina.
 *
 * El原则: nunca se escribe el texto de la interfaz directo en el .astro.
 * Se escribe `t('nav.catalogo')`. Cuando falte una traduccion, `t()` devuelve
 * el texto en espanol y la pagina sigue funcionando. Cuando se traduzca,
 * cambia una linea y todas las paginas la toman.
 *
 * Que NO se traduce (y por que):
 *
 * - Slugs de URL (`/productos/nova-saas-engine`): son identificadores. Traducirlos
 *   rompe los enlaces guardados y el SEO. El titulo visible si se traduce.
 * - Codigos de moneda (CUP, USD, EUR) y de pais.
 * - Nombres propios: QBASwing, Stripe, Cloudflare, TropiPay.
 * - Datos que vienen de la API: los titulos y descripciones de producto los
 *   traduce quien los publica, no esta tabla.
 *
 * ============================================================================
 *  ESTADO DE TRADUCCION
 * ============================================================================
 *
 * `traducidas` marca los idiomas con cobertura. Se usa para mostrar en el
 * selector cuantos idiomas estan completos, y para saber cuando una pagina
 * esta mostrando español bajo una bandera que promete otra cosa.
 */

export interface InfoIdioma {
  /** Codigo BCP-47. Debe coincidir con `i18n.locales` de astro.config.mjs. */
  codigo: string
  /** Nombre del idioma en su propio idioma. Nunca se traduce. */
  nombre: string
  /** Bandera en codigo regional, para el <img> de spritesheet. */
  bandera: string
  /** Direccion de escritura. RTL necesita estilos espejo. */
  direccion: 'ltr' | 'rtl'
}

export const IDIOMAS: InfoIdioma[] = [
  { codigo: 'es', nombre: 'Español', bandera: 'es', direccion: 'ltr' },
  { codigo: 'en', nombre: 'English', bandera: 'gb', direccion: 'ltr' },
  { codigo: 'pt', nombre: 'Português', bandera: 'pt', direccion: 'ltr' },
  { codigo: 'pt-BR', nombre: 'Português (Brasil)', bandera: 'br', direccion: 'ltr' },
  { codigo: 'fr', nombre: 'Français', bandera: 'fr', direccion: 'ltr' },
  { codigo: 'fr-CA', nombre: 'Français (Canada)', bandera: 'ca', direccion: 'ltr' },
  { codigo: 'de', nombre: 'Deutsch', bandera: 'de', direccion: 'ltr' },
  { codigo: 'it', nombre: 'Italiano', bandera: 'it', direccion: 'ltr' },
  { codigo: 'ca', nombre: 'Català', bandera: 'es', direccion: 'ltr' },
  { codigo: 'gl', nombre: 'Galego', bandera: 'es', direccion: 'ltr' },
  { codigo: 'eu', nombre: 'Euskara', bandera: 'es', direccion: 'ltr' },
  { codigo: 'en-GB', nombre: 'English (UK)', bandera: 'gb', direccion: 'ltr' },
  { codigo: 'en-US', nombre: 'English (US)', bandera: 'us', direccion: 'ltr' },
  { codigo: 'es-MX', nombre: 'Español (México)', bandera: 'mx', direccion: 'ltr' },
  { codigo: 'es-AR', nombre: 'Español (Argentina)', bandera: 'ar', direccion: 'ltr' },
  { codigo: 'es-CO', nombre: 'Español (Colombia)', bandera: 'co', direccion: 'ltr' },
  { codigo: 'zh-CN', nombre: '简体中文', bandera: 'cn', direccion: 'ltr' },
  { codigo: 'zh-TW', nombre: '繁體中文', bandera: 'tw', direccion: 'ltr' },
  { codigo: 'ja', nombre: '日本語', bandera: 'jp', direccion: 'ltr' },
  { codigo: 'ko', nombre: '한국어', bandera: 'kr', direccion: 'ltr' },
  { codigo: 'ru', nombre: 'Русский', bandera: 'ru', direccion: 'ltr' },
  { codigo: 'ar', nombre: 'العربية', bandera: 'sa', direccion: 'rtl' },
]

export const IDIOMA_POR_DEFECTO = 'es'

/** Idiomas con traduccion completa. Al principio solo el espanol. */
export const IDIOMAS_TRADUCIDOS = new Set(['es'])

export function infoIdioma(codigo: string): InfoIdioma {
  return (
    IDIOMAS.find((i) => i.codigo === codigo) ??
    IDIOMAS.find((i) => i.codigo === IDIOMA_POR_DEFECTO)!
  )
}

/** `true` si el idioma pedido tiene traduccion propia. */
export function estaTraducido(codigo: string): boolean {
  return IDIOMAS_TRADUCIDOS.has(codigo)
}
