// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

// Este archivo es JavaScript puro a proposito: Astro lo carga antes de
// compilar y no lo transpila, asi que aqui no puede haber `as const` ni
// `export type`. La lista de idiomas y sus tipos viven en el modulo de verdad
// (src/i18n/config.ts) y se importan desde ahi.
import { FALLBACK, IDIOMA_POR_DEFECTO, IDIOMAS } from './src/i18n/config.ts'

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://qbaswing-marketplace.pages.dev',
  // Cloudflare Pages redirige `/productos` -> `/productos/` (308) porque la
  // salida es `productos/index.html`. Con 'never' la canonical y el sitemap
  // declaraban la URL SIN barra y el navegador acababa en la CON barra: dos
  // URLs distintas para la misma pagina. 'always' alinea la declaracion con
  // lo que el hosting ya sirve.
  trailingSlash: 'always',

  integrations: [
    sitemap({
      // Fuera del sitemap las paginas de flujo (carrito, caja, panel, cuenta):
      // Google no debe gastar rastreo en URLs que nadie busca y que ademas
      // requieren sesion o son paso intermedio de una compra.
      filter: (pagina) => {
        const { pathname } = new URL(pagina)
        const conLocale = IDIOMAS.find((i) => pathname === `/${i}` || pathname.startsWith(`/${i}/`))
        const ruta = conLocale ? pathname.slice(pathname.indexOf('/', 1) || pathname.length) : pathname
        return !/^\/(404|carrito|pagar|success|cancel|cuenta|owner|vender|panel|iniciar-sesion)(\/|$)/.test(ruta)
      },
    }),
  ],

  i18n: {
    locales: [...IDIOMAS],
    defaultLocale: IDIOMA_POR_DEFECTO,
    routing: {
      // El espanol (idioma por defecto) NO lleva prefijo: `/paquetes`.
      // Los otros 21 si: `/pt-BR/paquetes`.
      //
      // La razon es el SEO: el mercado principal es Cuba y el espanol, y un
      // prefijo en la pagina principal separa al sitio de la competencia en
      // busquedas en espanol.
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
