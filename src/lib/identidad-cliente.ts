/**
 * Identidad desde el navegador.
 *
 * ============================================================================
 *  POR QUE EL SITIO NO PUEDE VALIDAR NADA
 * ============================================================================
 * El sitio es HTML ESTATICO en Cloudflare Pages. `Pages` sirve el archivo a quien
 * lo pida, sin mirar quien es. Si la pagina decidiera por si misma si el usuario
 * esta dentro, bastaria con descargar el HTML y editarselo para hacer que
 * cualquier pagina parezca su panel.
 *
 * Asi que estas funciones hacen UNA cosa: hablar con el Worker, que es el unico
 * sitio donde hay secretos y base de datos, y devolver lo que el Worker decida.
 * Nunca deciden nada por su cuenta.
 *
 * ============================================================================
 *  `import.meta.env` Y POR QUE SIRVE EN EL NAVEGADOR
 * ============================================================================
 * Vite sustituye `import.meta.env.PUBLIC_*` por texto al compilar, en codigo
 * de servidor y de cliente por igual. Solo lo que empieza por `PUBLIC_` se
 * sustituye; el resto no se expone al bundle. Por eso `PUBLIC_API_BASE` es la
 * unica variable que se necesita aqui y no hay ningun secreto en el cliente.
 *
 * ============================================================================
 *  POR QUE SE USA `credentials: 'include'`
 * ============================================================================
 * La cookie de sesion es `HttpOnly`: el JavaScript no puede leerla. Solo puede
 * mandarla. Con `credentials: 'include'` el navegador la manda; sin eso, la
 * peticion sale sin sesion y el Worker responde "no estas dentro" aunque el
 * usuario tenga la cookie puesta.
 *
 * Ojo: `include` tambien hace que el navegador mande la cookie a OTRO origen
 * distinto del suyo. Como el Worker solo acepta peticiones de los origenes de
 * `ALLOWED_ORIGIN`, y ademas valida la cookie por si misma, enviar la ahi no da
 * acceso a nada. Es el mismo criterio que en un `<form>` normal.
 */

/*
 * El token del carrito se importa de su propio modulo y no de `carrito-cliente`.
 * Aqui solo se necesita para MANDARLO al registrarse o al entrar, nunca para
 * gestionarlo.
 */
import { cabeceraCarrito } from './token-carrito'

/** Base del Worker. Vacia cuando no hay backend configurado. */
export const API_BASE = import.meta.env.PUBLIC_API_BASE ?? ''

/** `true` cuando hay backend configurado. Sin esto, los formularios avisan. */
export const backendConfigurado = API_BASE.length > 0

/** Lo que el Worker devuelve de una identidad. */
export interface UsuarioCliente {
  id: number
  email: string
  nombre: string
  rol: 'owner' | 'administrador' | 'vendedor' | 'comprador'
  verificado: boolean
  esVendedor: boolean
  puedeAdministrar: boolean
}

/**
 * Resultado de una llamada de identidad.
 *
 * `ok: false` con `codigo` en vez de lanzar excepciones, porque quien llama es un
 * formulario en el navegador y necesita PINTAR el mensaje, no capturar un error.
 */
export type Respuesta<T> =
  | { ok: true; datos: T }
  | { ok: false; codigo: string; mensaje: string }

/**
 * Peticion al Worker.
 *
 * Exportada para que `medios-cliente.ts` la reutilice sin reimplementarla. Es
 * el mismo motivo que en `api.ts`: dos copias del manejo de errores divergirian,
 * y existiria una sola cuando la respuesta no sea JSON o la red se caiga.
 *
 * El tiempo de espera no es decorativo: sin el, si la red se cae a medias, el
 * boton se queda pulsado para siempre y el usuario no sabe si se registro o no.
 * Se informa con un mensaje honesto en vez de dejar el formulario colgando.
 */
export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<Respuesta<T>> {
  if (!backendConfigurado) {
    return {
      ok: false,
      codigo: 'sin_backend',
      mensaje: 'Este sitio todavia no tiene servidor configurado. Intentalo mas tarde.',
    }
  }

  const control = new AbortController()
  // 20 s. Es lento para un movil con mala senal y eterno para alguien esperando.
  const reloj = setTimeout(() => control.abort(), 20_000)

  try {
    const r = await fetch(API_BASE + ruta, {
      ...opciones,
      credentials: 'include',
      signal: control.signal,
      headers: { 'Content-Type': 'application/json', ...(opciones.headers ?? {}) },
    })

    let cuerpo: unknown = null
    try {
      cuerpo = await r.json()
    } catch {
      cuerpo = null
    }

    if (cuerpo && typeof cuerpo === 'object' && 'ok' in cuerpo) {
      const datos = cuerpo as { ok: boolean; mensaje?: string; codigo?: string }
      if (datos.ok === false) {
        return {
          ok: false,
          codigo: datos.codigo ?? 'error',
          // El mensaje del Worker esta escrito para leerse. Se usa tal cual y no
          // se sustituye por uno generico: el Worker dice "la contrasena no
          // puede contener tu correo", que es justo lo que la persona intento.
          mensaje: datos.mensaje ?? 'No se pudo completar la operacion.',
        }
      }
      return { ok: true, datos: cuerpo as T }
    }

    // Sin JSON: hay un proxy o el Worker caido en medio. No es un error de
    // formulario, asi que se dice otra cosa.
    return {
      ok: false,
      codigo: 'respuesta_ilegible',
      mensaje: 'El servidor no respondio como se espera.',
    }
  } catch (error) {
    const abortado = error instanceof DOMException && error.name === 'AbortError'
    return {
      ok: false,
      codigo: abortado ? 'tiempo_agotado' : 'sin_conexion',
      mensaje: abortado
        ? 'La conexion tardo demasiado. Intentalo de nuevo.'
        : 'No se pudo conectar con el servidor. Revisa tu conexion.',
    }
  } finally {
    clearTimeout(reloj)
  }
}

/**
 * Crea la cuenta. Responde 201 con la sesion ya abierta.
 *
 * ============================================================================
 *  POR QUE MANDA LA CABECERA DEL CARRITO
 * ============================================================================
 * El carrito sirve para quien NO esta dentro, y casi todas las visitas empiezan
 * asi: se anaden productos primero y la cuenta se crea despues, cuando ya se
 * ha decidido comprar. Al registrarse, el servidor pasa esas lineas a la cuenta
 * nueva, pero SOLO si le dicen cual era el carrito.
 *
 * Sin esta cabecera el servidor hace el volcado correctamente y no pasa nada:
 * quien se registra se encuentra con el carrito vacio, sin aviso, justo despues
 * de confirmar la compra. Por eso la cabecera no es un extra: es la diferencia
 * entre que la persona se vaya con lo que eligio o tenga que empezar de cero.
 */
export function registrar(cuerpo: {
  email: string
  nombre: string
  contrasena: string
}): Promise<Respuesta<{ usuario: UsuarioCliente }>> {
  return pedir<{ usuario: UsuarioCliente }>('/api/registro', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
    headers: cabeceraCarrito(),
  })
}

/**
 * Entra. Responde 200 con la sesion ya abierta.
 *
 * Manda la cabecera del carrito por el mismo motivo que `registrar`. El caso
 * tipico es el otro: alguien que limpio el navegador, o que entra desde el
 * movil, y entonces el carrito que habia elegido a mano se le pasa a la cuenta.
 */
export function iniciarSesion(cuerpo: {
  email: string
  contrasena: string
}): Promise<Respuesta<{ usuario: UsuarioCliente }>> {
  return pedir<{ usuario: UsuarioCliente }>('/api/sesion', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
    headers: cabeceraCarrito(),
  })
}

/**
 * Quien esta dentro ahora mismo.
 *
 * `ok: true` con `usuario: null` es la respuesta NORMAL de alguien que no esta
 * dentro, no un error. Por eso el tipo no distingue: quien pregunta solo quiere
 * saber si hay alguien.
 */
export function sesionActual(): Promise<Respuesta<{ usuario: UsuarioCliente | null }>> {
  return pedir<{ usuario: UsuarioCliente | null }>('/api/sesion', { method: 'GET' })
}

/**
 * Datos de la cuenta propia: exencion, tienda, compras y sesiones abiertas.
 *
 * Devuelve `ok: false` con codigo `no_dentro` si la sesion no vale. No es un
 * error de red, asi que la pagina puede distinguirlo y mandar a entrar en vez
 * de decir "el servidor no responde".
 */
export interface DatosCuentaCliente {
  usuario: UsuarioCliente
  /** `null` si esta cuenta no tiene exencion. */
  exencion: { exentoComision: boolean; slotsIlimitados: boolean; motivo: string } | null
  /** `null` si la cuenta no es de vendedor. */
  tienda: { slug: string; nombre: string; verificada: boolean } | null
  compras: number
  sesionesAbiertas: number
}

export function miCuenta(): Promise<Respuesta<DatosCuentaCliente>> {
  return pedir<DatosCuentaCliente>('/api/cuenta', { method: 'GET' })
}

/**
 * Salir.
 *
 * Es una funcion aparte y no una bandera de `iniciarSesion` porque el metodo es
 * distinto (`DELETE`), y porque el cierre tiene que ejecutarse SIEMPRE, incluso
 * si la sesion ya no existe: si el Worker no responde, la cookie se borra igual
 * en el navegador y el usuario queda fuera igual. Dejar la cookie puesta porque
 * "la peticion fallo" seria volver dentro sin querer.
 */
export async function cerrarSesion(): Promise<void> {
  try {
    await pedir('/api/sesion', { method: 'DELETE' })
  } catch {
    // Se ignora el fallo a proposito. El `Set-Cookie` con `Max-Age=0` y el
    // `Clear-Site-Data` los manda el Worker; si no llegaron, el usuario no va a
    // poder entrar desde esta pestana, que es lo que se le va a decir.
  }
}