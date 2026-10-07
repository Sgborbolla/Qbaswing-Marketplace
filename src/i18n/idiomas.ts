/**
 * Idiomas del marketplace: como se presentan cada uno de ellos.
 *
 * ============================================================================
 *  QUIEN ES EL DUENO DE LA LISTA
 * ============================================================================
 *
 * Los 22 CODIGOS viven en `i18n/config.ts`, que es el unico modulo que importa
 * `astro.config.mjs` para montar `i18n.locales`. Aqui estan, claveados por
 * codigo, el nombre de cada idioma en su propio idioma y su direccion de
 * escritura.
 *
 * No se copian las 22 entradas en los dos lados. `METADATOS` esta tipado como
 * `Record<Idioma, ...>`, y eso obliga a que las dos partes avancen juntas:
 *
 *   - codigo nuevo en `config.ts` sin metadato  -> `Property 'xx' is missing`
 *   - metadato sobrante en este archivo         -> `Object literal may only
 *                                                  specify known properties`
 *
 * Ambos salen al compilar, no en produccion con una bandera al lado de
 * `undefined`. Antes las dos listas estaban escritas a mano una al lado de la
 * otra, que es exactamente como se desincronizan: se anade un idioma en un
 * sitio, el otro sigue mirando la lista vieja y nadie se entera.
 *
 * ============================================================================
 *  QUE NO SE TRADUCE (Y POR QUE)
 * ============================================================================
 *
 * - Slugs de URL (`/productos/nova-saas-engine`): son identificadores. Traducirlos
 *   rompe los enlaces guardados y el SEO. El titulo visible si se traduce.
 * - Codigos de moneda (CUP, USD, EUR) y de pais.
 * - Nombres propios: QBASwing, Stripe, Cloudflare, TropiPay.
 * - Datos que vienen de la API: los titulos y descripciones de producto los
 *   traduce quien los publica, no esta tabla.
 *
 * ============================================================================
 *  QUIEN DICE QUE UN IDIOMA ESTA TRADUCIDO
 * ============================================================================
 *
 * No este archivo. La fuente es `DICCIONARIOS`, en `i18n/diccionario.ts`: un
 * idioma esta completo cuando tiene TODAS las claves, y `idiomaCompleto()` lo
 * dice. El selector de idioma consulta esa funcion.
 *
 * Aqui existia una `IDIOMAS_TRADUCIDOS` escrita a mano con `es` dentro. Dos
 * formas de decir lo mismo, una de ellas sin nada que la actualizara: en cuanto
 * se anadio la segunda traduccion al diccionario, el selector dejaria de
 * marcarla como completa. Se borro; el conjunto que hay que mirar es uno solo.
 */

import { IDIOMAS as CODIGOS, IDIOMA_POR_DEFECTO, type Idioma } from './config'

export interface InfoIdioma {
  /** Codigo BCP-47. Debe coincidir con `i18n.locales` de astro.config.mjs. */
  codigo: string
  /** Nombre del idioma en su propio idioma. Nunca se traduce. */
  nombre: string
  /** Direccion de escritura. RTL necesita estilos espejo. */
  direccion: 'ltr' | 'rtl'
}

/**
 * Nombre y direccion de escritura de cada codigo de `config.ts`.
 *
 * El orden del menu es el de `config.ts`, no este: aca solo se busca por clave.
 *
 * AQUI ANTES HABIA TAMBIEN UN CODIGO DE BANDERA POR IDIOMA. No lo ponia nadie:
 * el selector muestra iniciales y no imagenes, y el unico comentario que lo
 * justificaba hablaba de un spritesheet que nunca existio. Datos que nadie lee
 * son datos que se quedan desactualizados en silencio.
 */
const METADATOS: Record<Idioma, Omit<InfoIdioma, 'codigo'>> = {
  es: { nombre: 'Español', direccion: 'ltr' },
  en: { nombre: 'English', direccion: 'ltr' },
  pt: { nombre: 'Português', direccion: 'ltr' },
  'pt-BR': { nombre: 'Português (Brasil)', direccion: 'ltr' },
  fr: { nombre: 'Français', direccion: 'ltr' },
  'fr-CA': { nombre: 'Français (Canada)', direccion: 'ltr' },
  de: { nombre: 'Deutsch', direccion: 'ltr' },
  it: { nombre: 'Italiano', direccion: 'ltr' },
  ca: { nombre: 'Català', direccion: 'ltr' },
  gl: { nombre: 'Galego', direccion: 'ltr' },
  eu: { nombre: 'Euskara', direccion: 'ltr' },
  'en-GB': { nombre: 'English (UK)', direccion: 'ltr' },
  'en-US': { nombre: 'English (US)', direccion: 'ltr' },
  'es-MX': { nombre: 'Español (México)', direccion: 'ltr' },
  'es-AR': { nombre: 'Español (Argentina)', direccion: 'ltr' },
  'es-CO': { nombre: 'Español (Colombia)', direccion: 'ltr' },
  'zh-CN': { nombre: '简体中文', direccion: 'ltr' },
  'zh-TW': { nombre: '繁體中文', direccion: 'ltr' },
  ja: { nombre: '日本語', direccion: 'ltr' },
  ko: { nombre: '한국어', direccion: 'ltr' },
  ru: { nombre: 'Русский', direccion: 'ltr' },
  ar: { nombre: 'العربية', direccion: 'rtl' },
}

/** Los 22 idiomas, en el orden en que aparecen en el selector. */
export const IDIOMAS: InfoIdioma[] = CODIGOS.map((codigo) => ({
  codigo,
  ...METADATOS[codigo],
}))

export function infoIdioma(codigo: string): InfoIdioma {
  return (
    IDIOMAS.find((i) => i.codigo === codigo) ??
    IDIOMAS.find((i) => i.codigo === IDIOMA_POR_DEFECTO)!
  )
}

/**
 * Codigo de idioma en el formato que pide la etiqueta `og:locale`.
 *
 * Open Graph no usa el BCP-47 del `<html lang>` sino el par `lenguaje_region`
 * de la norma ISO 639-1 + 3166-1: `es_ES`, `zh_CN`, `pt_BR`. Poner `zh-CN`
 * hace que algunos previsualizadores ignoren el campo y muestren el contenido
 * en el idioma del que comparte el enlace.
 *
 * Los codigos sin region (`es`, `en`, `pt`...) necesitan una region por
 * defecto: `es` se queda en `es_ES` porque el espanol del sitio es el de Cuba y
 * el espanol sin region no existe en la norma. Las tres inglesas y las dos
 * francesas ya vienen con su region y pasan tal cual.
 */
const REGION_POR_DEFECTO: Record<string, string> = {
  es: 'ES',
  en: 'US',
  pt: 'PT',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  ca: 'ES',
  gl: 'ES',
  eu: 'ES',
  ar: 'SA',
}

export function ogLocale(codigo: string): string {
  if (codigo.includes('-')) return codigo.replace('-', '_')
  const region = REGION_POR_DEFECTO[codigo]
  return region ? `${codigo}_${region}` : codigo
}
