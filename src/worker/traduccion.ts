/**
 * Traduccion de los productos con Workers AI.
 *
 * ============================================================================
 *  QUE HACE
 * ============================================================================
 * Toma el texto que escribio el vendedor (en espanol) y lo traduce a los idiomas
 * del sitio, guardando el resultado en `producto_traducciones`. Se llama al
 * guardar o publicar un producto, en segundo plano (`ctx.waitUntil`), para que
 * la persona que guarda no espere a que terminen 13 traducciones.
 *
 * Este modulo NO decide que idioma pide el visitante ni como se lee: eso lo hace
 * el catalogo, que une `producto_traducciones` con `productos` y cae al texto
 * original cuando una fila no esta.
 *
 * ============================================================================
 *  SI NO HAY IA, NO PASA NADA
 * ============================================================================
 * `env.AI` es opcional. Si falta (binding no declarado, cuenta sin Workers AI),
 * cada funcion sale sin traducir y el producto se sirve en espanol. Ningun error
 * sube: la traduccion es una mejora, no un requisito para vender.
 *
 * ============================================================================
 *  IDIOMAS BASE, NO VARIANTES
 * ============================================================================
 * El modelo no distingue `en-US` de `en-GB`: traducir dos veces el mismo texto
 * al ingles daria el mismo resultado y gastaria el doble de IA. Por eso todo se
 * reduce a un idioma base con `idiomaBaseDe` antes de leer o escribir.
 */
import { IDIOMAS } from '../i18n/config'
import type { Env } from './entorno'

/** El modelo multilingue de traduccion de Workers AI (100 idiomas). */
const MODELO = '@cf/meta/m2m100-1.2b'

/** El idioma en que se escriben los productos: el texto original. */
export const IDIOMA_ORIGEN = 'es'

/**
 * Los idiomas base que el modelo entiende y que el sitio ofrece.
 *
 * Es una lista explicita y no `IDIOMAS` porque `IDIOMAS` trae variantes
 * regionales (`pt-BR`, `zh-TW`) que el modelo no sabe distinguir: su codigo es
 * el base. Si aqui faltara uno, `idiomaBaseDe` lo mandaria al original y ese
 * idioma quedaria sin traducir sin que nadie se enterara.
 */
const CODIGOS_DEL_MODELO = new Set([
  'es',
  'en',
  'pt',
  'fr',
  'de',
  'it',
  'ca',
  'gl',
  'eu',
  'zh',
  'ja',
  'ko',
  'ru',
  'ar',
])

/**
 * De un idioma del sitio a su base para el modelo.
 *
 * `pt-BR` -> `pt`, `zh-TW` -> `zh`, `en-GB` -> `en`, `es-MX` -> `es`. Un idioma
 * desconocido cae al original, que es lo unico seguro: devolver algo raro haria
 * que el modelo tradujese a un idioma equivocado.
 */
export function idiomaBaseDe(idioma: string): string {
  const base = String(idioma || '')
    .trim()
    .toLowerCase()
    .split('-')[0]
  return CODIGOS_DEL_MODELO.has(base) ? base : IDIOMA_ORIGEN
}

/** Los idiomas base a los que se traduce, sin el original y sin repetidos. */
export const IDIOMAS_DESTINO: string[] = [...new Set(IDIOMAS.map(idiomaBaseDe))].filter(
  (idioma) => idioma !== IDIOMA_ORIGEN,
)

/** El texto de un producto que se traduce. */
export interface TextosProducto {
  titulo: string
  descripcion: string
  descripcionLarga: string | null
}

/**
 * Traduce un texto a un idioma, o devuelve `null` si no se pudo.
 *
 * Devuelve `null` (y no lanza) a proposito: dentro de `traducirYGuardar` hay una
 * traduccion por idioma, y que falle una no puede tumbar las otras doce. Un
 * `null` simplemente deja ese idioma sin guardar.
 */
async function traducir(env: Env, texto: string, destino: string): Promise<string | null> {
  if (!env.AI || !texto.trim()) return null
  try {
    const salida = await env.AI.run(MODELO, {
      text: texto,
      source_lang: IDIOMA_ORIGEN,
      target_lang: destino,
    })
    const traducido = (salida as { translated_text?: unknown } | null)?.translated_text
    return typeof traducido === 'string' && traducido.trim() ? traducido.trim() : null
  } catch {
    return null
  }
}

/**
 * Traduce un producto a todos los idiomas y guarda el resultado.
 *
 * Se guarda con `ON CONFLICT ... DO UPDATE` porque el mismo producto se vuelve a
 * traducir cada vez que se edita: la traduccion vieja se reemplaza por la nueva,
 * no se acumula. Los idiomas que fallen en esta pasada conservan la traduccion
 * anterior, que es mejor que borrarla.
 */
export async function traducirYGuardar(
  env: Env,
  productoId: number,
  textos: TextosProducto,
): Promise<void> {
  if (!env.AI) return

  const titulo = textos.titulo?.trim()
  const descripcion = textos.descripcion?.trim()
  const larga = textos.descripcionLarga?.trim() || null
  if (!titulo || !descripcion) return

  await Promise.all(
    IDIOMAS_DESTINO.map(async (idioma) => {
      const [t, d, l] = await Promise.all([
        traducir(env, titulo, idioma),
        traducir(env, descripcion, idioma),
        larga ? traducir(env, larga, idioma) : Promise.resolve(null),
      ])
      if (!t || !d) return
      await env.DB.prepare(
        `INSERT INTO producto_traducciones
           (producto_id, idioma, titulo, descripcion, descripcion_larga, actualizado_at)
         VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         ON CONFLICT(producto_id, idioma) DO UPDATE SET
           titulo = excluded.titulo,
           descripcion = excluded.descripcion,
           descripcion_larga = excluded.descripcion_larga,
           actualizado_at = excluded.actualizado_at`,
      )
        .bind(productoId, idioma, t, d, l)
        .run()
    }),
  )
}
