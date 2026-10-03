/**
 * Carrito desde el navegador.
 *
 * ============================================================================
 *  POR QUE HACE FALTA UNA CABECERA `X-QBASWing-Carrito`
 * ============================================================================
 * El carrito sirve para quien NO esta dentro, que es casi todo el mundo: nadie
 * se registra antes de ver si un producto le sirve. Para eso hay que poder
 * reconocer a un visitante anonimo entre peticiones, y una cookie es lo
 * habitual... pero aqui la cookie de sesion es `HttpOnly` a proposito, y meter el
 * carrito en ella seria mezclar dos cosas que deben fallar por separado.
 *
 * Asi que el token del carrito anonimo viaja en su propia cabecera y el
 * navegador lo guarda en `localStorage`. Se separa del token de sesion a proposito:
 * perder uno esmolesto y perder el otro deberia dejar de estar dentro.
 *
 * ============================================================================
 *  POR QUE `localStorage` Y NO UNA COOKIE
 * ============================================================================
 * El token del carrito NO es una credencial: no da acceso a la cuenta ni a datos
 * de nadie, solo identifica una lista de cosas que el visitante eligio. Con
 * `localStorage` no hace faltacriptarlo ni worry de CSRF por esta parte, y se
 * puede borrar desde el propio JavaScript cuando el visitante vacia el carrito.
 *
 * ============================================================================
 *  EL PRECIO CONGELADO
 * ============================================================================
 * El Worker guarda el precio del producto en el momento de anadir y lo devuelve
 * tal cual. Esta pagina NO recalcula ni vuelve a pedir el precio: si lo hiciera,
 * estaria decidiendo en el navegador cuanto va a pagar alguien, y eso lo decide
 * el servidor. Aqui solo se pinta lo que el servidor dijo.
 */

/** Base del Worker. Vacia cuando no hay backend configurado. */
export const API_BASE = import.meta.env.PUBLIC_API_BASE ?? ''

/** `true` cuando hay backend configurado. */
export const backendConfigurado = API_BASE.length > 0

/**
 * El token del carrito NO vive aqui.
 *
 * Antes vivia en este archivo y `identidad-cliente.ts` no lo conocia, asi que al
 * registrarse el navegador no mandaba la cabecera y las lineas del carrito se
 * perdian. El Worker hacia el volcado bien, pero nadie se lo pedia.
 *
 * Ahora esta en `token-carrito.ts`, que es donde lo leen los dos: el carrito
 * para usarlo y el registro y el acceso para pasarlo a la cuenta.
 */
import { CABECERA_TOKEN_CARRITO, guardarToken, tokenGuardado } from './token-carrito'

/**
 * Las tres monedas que la base admite.
 *
 * No es un tipo abierto: la tabla `carritos`/`productos` lo pone en un
 * `CHECK (moneda IN ('CUP','USD','EUR'))`, asi que no puede llegar otra cosa.
 * Tiparlo aqui como union y no como `string` es lo que hace que el formateador
 * de precios pueda aceptar el valor sin una conversion en cada llamada.
 */
export type Moneda = 'CUP' | 'USD' | 'EUR'

/**
 * Como pasa a moneda el valor que llega del servidor.
 *
 * Se estrecha en tiempo de ejecucion y no solo en el tipo: un Worker
 * desplegado con un `CHECK` distinto, o alguien que edite la base a mano,
 * podrian mandar otra cosa. Sin esta comprobacion, `Intl.NumberFormat` recibiria
 * una moneda que no conoce y devolveria `NaN` en pantalla.
 */
function moneda(valor: string): Moneda {
  return valor === 'CUP' || valor === 'USD' || valor === 'EUR' ? valor : 'CUP'
}

/** Una linea del carrito, tal como la devuelve el Worker. */
export interface LineaCarrito {
  id: number
  cantidad: number
  precioUnitario: number
  moneda: Moneda
  subtotal: number
  producto: {
    id: number
    slug: string
    titulo: string
    variante: string | null
    vendedorSlug: string | null
    disponible: boolean
    precioCambiado: boolean
    precioActual: number
  }
}

export interface ContenidoCarrito {
  lineas: LineaCarrito[]
  totales: Array<{ moneda: Moneda; unidades: number; subtotal: number }>
  vacio: boolean
  hayAvisos: boolean
}

export interface Respuesta<T> {
  ok: boolean
  datos: T
  codigo: string
  mensaje: string
}

/**
 * `tokenGuardado` y `guardarToken` ya no estan aqui.
 *
 * Se importan de `token-carrito.ts` y se reexportan, para que las paginas que
 * solo necesitan el token no tengan que saber de donde sale. Tener la MISMA
 * funcion en dos sitios habria sido el peor de los tres fallos posibles: dos
 * claves de almacenamiento distintas significarian dos carritos distintos, y
 * solo uno se moveria al iniciar sesion.
 */
export { CABECERA_TOKEN_CARRITO, guardarToken, tokenGuardado }

/**
 * Pintar el dinero.
 *
 * NO se reimplementa aqui: se reexporta el de `formato.ts`. Los precios en la
 * base son enteros de la unidad menor (250 CUP son 250, $10.00 son 1000), y hay
 * un solo sitio en el proyecto que sabe convertir eso a texto legible. Una
 * segunda copia divergiria en el redondeo y un dia el carrito y el catalogo
 * mostrarian el mismo producto a precios distintos.
 */
export { formatearPrecio as dinero } from './formato'

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<Respuesta<T>> {
  if (!backendConfigurado) {
    return {
      ok: false,
      datos: null as T,
      codigo: 'sin_backend',
      mensaje: 'Este sitio todavia no tiene servidor configurado.',
    }
  }

  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), 20_000)

  try {
    const token = tokenGuardado()
    const r = await fetch(API_BASE + ruta, {
      ...opciones,
      credentials: 'include',
      signal: control.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-QBASWing-Carrito': token } : {}),
        ...(opciones.headers ?? {}),
      },
    })

    const cuerpo: unknown = await r.json().catch(() => null)

    // El Worker devuelve el token del carrito en una cabecera, y con
    // `credentials: 'include'` esa cabecera SI es legible desde el JavaScript.
    // Sin leerla, el carrito anonimo se perderia en la segunda peticion.
    const tokenNuevo = r.headers.get('X-QBASWing-Carrito')
    if (tokenNuevo) guardarToken(tokenNuevo)

    if (cuerpo && typeof cuerpo === 'object' && 'ok' in cuerpo) {
      const datos = cuerpo as { ok: boolean; mensaje?: string; codigo?: string }
      if (datos.ok === false) {
        return {
          ok: false,
          datos: null as T,
          codigo: datos.codigo ?? 'error',
          mensaje: datos.mensaje ?? 'No se pudo completar la operacion.',
        }
      }
      return { ok: true, datos: cuerpo as T, codigo: '', mensaje: '' }
    }

    return {
      ok: false,
      datos: null as T,
      codigo: 'respuesta_ilegible',
      mensaje: 'El servidor no respondio como se espera.',
    }
  } catch (error) {
    const abortado = error instanceof DOMException && error.name === 'AbortError'
    return {
      ok: false,
      datos: null as T,
      codigo: abortado ? 'tiempo_agotado' : 'sin_conexion',
      mensaje: abortado
        ? 'La conexion tardo demasiado. Intentalo de nuevo.'
        : 'No se pudo conectar con el servidor. Revisa tu conexion.',
    }
  } finally {
    clearTimeout(reloj)
  }
}

/** Un carrito tal como lo manda el Worker, con las monedas ya estrechadas. */
function contenidoDe(cuerpo: unknown): ContenidoCarrito {
  const crudo = (cuerpo ?? {}) as { carrito?: ContenidoCarrito }

  // Se reconstruye en vez de hacer `as`. `as` no comprueba nada: si el Worker
  // mandara `moneda: "BTC"`, el tipo lo declararia `Moneda` y el fallo saldria
  // tres pantallas despues, en un `Intl.NumberFormat`. Aqui falla ya y en el
  // sitio que toca.
  const lineas = Array.isArray(crudo.carrito?.lineas) ? crudo.carrito.lineas : []

  return {
    lineas: lineas.map((l) => ({
      ...l,
      moneda: moneda(l.moneda),
    })),
    totales: Array.isArray(crudo.carrito?.totales)
      ? crudo.carrito.totales.map((t) => ({ ...t, moneda: moneda(t.moneda) }))
      : [],
    vacio: lineas.length === 0,
    hayAvisos: crudo.carrito?.hayAvisos === true,
  }
}

/** El carrito de quien esta en esta pestana. */
export function leerCarrito(): Promise<Respuesta<{ carrito: ContenidoCarrito }>> {
  return pedir<{ carrito: ContenidoCarrito }>('/api/carrito', { method: 'GET' }).then((r) =>
    r.ok ? { ...r, datos: { carrito: contenidoDe(r.datos) } } : r,
  )
}

/** Anade un producto. El Worker decide el precio; aqui solo se pide anadir. */
export function anadir(
  productoId: number,
  cantidad = 1,
  varianteId: number | null = null,
): Promise<Respuesta<{ carrito: ContenidoCarrito }>> {
  return pedir<{ carrito: ContenidoCarrito }>('/api/carrito', {
    method: 'POST',
    body: JSON.stringify({ producto_id: productoId, cantidad, variante_id: varianteId }),
  }).then((r) => (r.ok ? { ...r, datos: { carrito: contenidoDe(r.datos) } } : r))
}

/**
 * Quita una linea.
 *
 * Sin `id` vacia el carrito entero. Es el mismo contrato que el del Worker: el
 * boton de vaciar no necesita saber que linea quita, y obligarle a elegir una
 * seria pedirle a la pagina una decision que no es suya.
 */
export function quitar(id: number | null = null): Promise<Respuesta<{ carrito: ContenidoCarrito }>> {
  return pedir<{ carrito: ContenidoCarrito }>('/api/carrito', {
    method: 'DELETE',
    body: JSON.stringify(id === null ? {} : { id }),
  }).then((r) => (r.ok ? { ...r, datos: { carrito: contenidoDe(r.datos) } } : r))
}