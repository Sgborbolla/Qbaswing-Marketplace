/**
 * Idiomas declarados del marketplace.
 *
 * ============================================================================
 *  POR QUE ESTE ARCHIVO EXISTE Y NO ESTA EN astro.config.mjs
 * ============================================================================
 * `astro.config.mjs` es JavaScript, no TypeScript: Astro lo carga antes de
 * compilar y no pasa por transpilador, asi que `as const` y `export type` lo
 * rompen con "Type assertion expressions can only be used in TypeScript
 * files". Por eso la lista vive aca, en un modulo de verdad, y el config solo
 * la importa.
 *
 * ============================================================================
 *  ESTE ARCHIVO ES EL UNICO LUGAR DONDE SE ESCRIBEN LOS CODIGOS
 * ============================================================================
 * El selector de idioma y el layout necesitan ademas el nombre de cada idioma
 * en su propio idioma y su direccion de escritura, que no tienen nada que ver
 * con la configuracion de Astro. Esos datos viven en
 * `i18n/idiomas.ts`, NO como una segunda lista sino como un mapa por clave
 * (`Record<Idioma, ...>`) del que cuelga `IDIOMAS`: si aqui se anade un codigo
 * sin metadato, o en alli sobra uno, TypeScript no compila. Las dos mitades
 * solo pueden cambiar juntas.
 *
 * ============================================================================
 *  `es` NO LLEVA PREFIJO
 * ============================================================================
 * El espanol es el idioma por defecto y el mercado principal es Cuba. Con
 * `prefixDefaultLocale: false`, la portada vive en `/` y no en `/es`, que es
 * como la indexa Google. El resto de idiomas si lleva prefijo: `/pt-BR/...`.
 */

/**
 * Los 22 idiomas.
 *
 * Se incluyen los pares que comparten idioma pero no region (pt-BR, fr-CA,
 * zh-TW) porque el Documento Maestro apunta a mercados distintos: Brasil compra
 * en reales, Canada en dolares canadienses. Son entradas distintas en el
 * selector porque un cliente de Brasil no quiere leer una pagina que le ofrece
 * precios en dolares canadienses.
 *
 * El orden de esta lista es el orden en que aparecen en el selector.
 */
export const IDIOMAS = [
  'es', // Espanol        por defecto
  'en', // Ingles
  'pt', // Portugues
  'pt-BR', // Portugues Brasil
  'fr', // Frances
  'fr-CA', // Frances Canada
  'de', // Aleman
  'it', // Italiano
  'ca', // Catalan
  'gl', // Gallego
  'eu', // Vasco
  'en-GB', // Ingles Reino Unido
  'en-US', // Ingles Estados Unidos
  'es-MX', // Espanol Mexico
  'es-AR', // Espanol Argentina
  'es-CO', // Espanol Colombia
  'zh-CN', // Chino simplificado
  'zh-TW', // Chino tradicional
  'ja', // Japones
  'ko', // Coreano
  'ru', // Ruso
  'ar', // Arabe
] as const

export type Idioma = (typeof IDIOMAS)[number]

export const IDIOMA_POR_DEFECTO: Idioma = 'es'

/**
 * Idiomas que caen al espanol mientras no tengan traduccion.
 *
 * `rewrite` y no `redirect` (ver astro.config.mjs): el visitante ve la pagina
 * en espanol en SU URL (`/pt-BR/paquetes`) en vez de ser expulsado a
 * `/paquetes`. Un redirect lo saca de su idioma elegido y obliga a buscar de
 * nuevo, que es la razon por la que mucha gente abandona un sitio.
 */
export const FALLBACK: Record<string, Idioma> = Object.fromEntries(
  IDIOMAS.filter((i) => i !== IDIOMA_POR_DEFECTO).map((i) => [i, IDIOMA_POR_DEFECTO]),
)
