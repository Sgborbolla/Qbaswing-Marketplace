/**
 * Router de datos de la plataforma: redes sociales, contacto y FAQ.
 *
 * ============================================================================
 *  POR QUE ESTO NO ESTA EN `plataforma.ts` COMO CONSTANTE
 * ============================================================================
 * Las redes, el correo y las FAQ cambian cuando el Owner decide, no cuando se
 * despliega. Si estuvieran escritas en el `.astro` del footer, cambiar el
 * WhatsApp exigiria un commit y un redespliegue, y como eso es una barrera, la
 * gente termina no actualizandolo. Un footer con el Instagram equivocado se ve
 * peor que uno sin Instagram.
 *
 * Asi que el componente PIDE estos datos. Si la API esta caida, el footer dibuja
 * los iconos deshabilitados en vez de romper la pagina: es el mismo diseno que
 * daria un footer sin redes configuradas, y por eso no parece un error.
 *
 * ============================================================================
 *  LO QUE NUNCA SE INVENTA
 * ============================================================================
 * `0002_datos_plataforma.sql` inserta las ocho redes con `valor = ''` y un
 * contacto vacio. Este router devuelve ese estado tal cual, con `valor: ''`, en
 * vez de rellenarlo con cuentas de ejemplo.
 *
 * Un placeholder del tipo `@qbaswing_oficial` en un sitio recien lanzado es una
 * mentira que el visitante da por cierta, y si el Owner nunca lo cambia queda
 * para siempre. Es preferible un icono deshabilitado.
 */

import { json } from '../http'
import { RUTAS, ErrorApi } from '../constantes'
import type { Env } from '../entorno'

export async function responderPlataforma(
  ruta: string,
  env: Env,
  soloLectura: boolean,
): Promise<Response> {
  if (!soloLectura) {
    // Escribir estas tablas es trabajo del Owner y va por el panel, que aun no
    // existe. Decir "no" ahora evita prometer algo que despues se cambie.
    throw new ErrorApi(
      'no_implementado',
      'La edicion desde el panel todavia no esta disponible.',
      501,
    )
  }

  switch (ruta) {
    case RUTAS.redes:
      return json({ ok: true, redes: await redes(env) })
    case RUTAS.contacto:
      return json({ ok: true, contacto: await contacto(env) })
    case RUTAS.faq:
      return json({ ok: true, faq: await faq(env) })
    default:
      throw ErrorApi.noEncontrado('Esa ruta')
  }
}

/**
 * Redes ordenadas como las ordeno el Owner.
 *
 * `ORDER BY orden, id` y no solo `orden`: si dos redes tienen el mismo orden,
 * SQLite puede devolverlas en cualquier orden y el footer cambiaria de aspecto
 * entre una carga y otra. `id` es estable.
 */
async function redes(env: Env): Promise<Record<string, unknown>[]> {
  const { results } = await env.DB.prepare(
    `SELECT etiqueta, icono, tipo, base, valor, activo, orden
       FROM redes_sociales
      WHERE activo = 1
      ORDER BY orden, id`,
  ).all()

  return (results as Record<string, unknown>[]).map((r) => ({
    etiqueta: r.etiqueta,
    icono: r.icono,
    tipo: r.tipo,
    base: r.base,
    valor: r.valor,
    orden: r.orden,
  }))
}

/**
 * Contacto de la plataforma.
 *
 * Devuelve `null` cuando la fila esta vacia, no un objeto con campos en blanco.
 * La diferencia importa: `null` le dice al footer "no hay contacto configurado"
 * y lo deja oculto; un objeto con cadenas vacias lo hace pintar etiquetas sin
 * nada al lado, que es lo que hace que un sitio recien creado parezca roto.
 */
async function contacto(env: Env): Promise<Record<string, unknown> | null> {
  const fila = await env.DB.prepare(
    `SELECT telefono, email, whatsapp, direccion, horario
       FROM contacto_plataforma
      ORDER BY id
      LIMIT 1`,
  ).first<Record<string, unknown>>()

  if (!fila) return null

  const campos = ['telefono', 'email', 'whatsapp', 'direccion', 'horario'] as const
  const alguno = campos.some((c) => String(fila[c] ?? '').trim() !== '')
  if (!alguno) return null

  return Object.fromEntries(campos.map((c) => [c, fila[c]]))
}

/**
 * FAQ activa, en el orden que fijo el Owner.
 *
 * `activa` se devuelve aunque la consulta ya la haya filtrado. No es redundancia
 * por descuido: el frontend compara `f.activa` para decidir si pinta la
 * pregunta, y sin la columna descartaba las veinte. Un filtro que el servidor ya
 * aplico vuelve a ser responsabilidad de quien consume, y las dos reglas se
 * contradicen en silencio cuando eso pasa.
 *
 * Lo que si es redundante y no se devuelve: el texto de la tabla de quien la
 * edito. No lo necesita ningun visitante.
 */
async function faq(env: Env): Promise<Record<string, unknown>[]> {
  const { results } = await env.DB.prepare(
    `SELECT pregunta, respuesta, orden, activa
       FROM faq
      WHERE activa = 1
      ORDER BY orden, id`,
  ).all()

  return results as Record<string, unknown>[]
}
