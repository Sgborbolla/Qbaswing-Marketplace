// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

/**
 * Los 20 idiomas del marketplace.
 *
 * `es` es el idioma por defecto y el unico con contenido completo al inicio.
 * El orden de esta lista es el orden que se muestra en el selector.
 *
 * Se incluyen los 4 pares que comparten idioma pero no|region (pt-BR, fr-CA,
 * zh-TW) porque los productos del Documento Maestro se dirigen a mercados
 * distintos: Brasil compra en reales, Canada en dolares canadienses.
 */
export const IDIOMAS = [
  'es',      // Espanol        por defecto
  'en',      // Ingles
  'pt',      // Portugues
  'pt-BR',   // Portugues Brasil
  'fr',      // Frances
  'fr-CA',   // Frances Canadá
  'de',      // Aleman
  'it',      // Italiano
  'ca',      // Catalan
  'gl',      // Gallego
  'eu',      // Vasco
  'en-GB',   // Ingles Reino Unido
  'en-US',   // Ingles Estados Unidos
  'es-MX',   // Espanol Mexico
  'es-AR',   // Espanol Argentina
  'es-CO',   // Espanol Colombia
  'zh-CN',   // Chino simplificado
  'zh-TW',   // Chino tradicional
  'ja',      // Japones
  'ko',      // Coreano
  'ru',      // Ruso
  'ar',      // Arabe
] as const

export type Idioma = (typeof IDIOMAS)[number]

export const IDIOMA_POR_DEFECTO: Idioma = 'es'

/**
 * Idiomas que caen al español mientras no tengan traduccion.
 *
 * `rewrite` y no `redirect`: el visitante ve la pagina en español en SU URL
 * (/pt-BR/paquetes) en vez de ser expulsado a /paquetes. Un redirect lo
 * manda fuera de su idioma elegido y hay que volver a buscar.
 */
const FALLBACK = Object.fromEntries(
  IDIOMAS.filter((i) => i !== IDIOMA_POR_DEFECTO).map((i) => [i, IDIOMA_POR_DEFECTO]),
)

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://qbaswing-marketplace.pages.dev',
  trailingSlash: 'never',

  i18n: {
    locales: [...IDIOMAS],
    defaultLocale: IDIOMA_POR_DEFECTO,
    routing: {
      // El espanol (idioma por defecto) NO lleva prefijo: `/paquetes`.
      // Los otros 19 si: `/pt-BR/paquetes`.
      //
      // La razon es el SEO: el mercado principal es Cuba y elispañol, y un
      // prefijo en la pagina principal separa al sitio de la competencia en
      // busquedas en español.
      prefixDefaultLocale: false,
      fallbackType: 'rewrite',
    },
    fallback: FALLBACK,
  },

  build: {
    // Astro inlima por defecto los CSS menores de 4 kB en cada pagina.
    // 'never' los deja siempre como archivo externo: el bundle del design
    // system es grande, duplicarlo en cada HTML infla cada respuesta.
    inlineStylesheets: 'never',
  },

  devToolbar: {
    enabled: false,
  },

  vite: {
    plugins: [tailwindcss()],
  },
})
