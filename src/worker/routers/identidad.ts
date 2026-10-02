/**
 * Router de identidad: `/api/registro` y `/api/sesion`.
 *
 * ============================================================================
 *  LAS CUATRO OPERACIONES
 * ============================================================================
 *   POST   /api/registro    crea la cuenta y abre sesion
 *   POST   /api/sesion      entra con correo y contrasena
 *   GET    /api/sesion      quien esta dentro ahora mismo
 *   DELETE /api/sesion      salir
 *
 * ============================================================================
 *  POR QUE LA SESION ESTA EN EL WORKER Y NO EN UN ARCHIVETE HTML
 * ============================================================================
 * Porque el sitio es HTML ESTATICO: Pages sirve el archivo tal cual, a cualquiera
 * que lo pida, sin mirar quien es. Una pagina de panel guardada como
 * `panel.html` se puede abrir con curl sin estar dentro, y no hay nada en el
 * archivo que lo impida.
 *
 * Por eso el shell no lleva datos: la pagina se sirve vacia y pide sus datos a
 * la API, que es lo unico que puede validar la cookie. Si alguien copia la
 * pagina, se lleva un"Es que esta vacio".
 *
 * ============================================================================
 *  SALIR Y EL BOTON DE ATRAS
 * ============================================================================
 * El Owner pidio que salir solo se pueda hacer con el boton, y que el boton de
 * atras del navegador no devuelva la sesion. El boton de atras no se puede
 * deshabilitar desde una pagina: es un control del navegador, no del sitio. Lo
 * que si se puede es que la pagina restaurada no sirva de nada, y por eso el
 * cierre actua en cuatro frentes a la vez:
 *
 *   1. REVOCA en el servidor. `DELETE /api/sesion` marca la fila de
 *      `sesiones` como revocada. Aunque el navegador reponga la cookie, la API
 *      devuelve 401 porque la fila ya no vale. Sin esto, "salir" seria solo
 *      borrar una cadena del navegador.
 *
 *   2. `Clear-Site-Data: "cache"`. Le dice al navegador que tire lo que tenga
 *      guardado de este sitio, incluida la copia del HTML en su cache de
 *      retroceso. Es la cabecera que existe exactamente para esto, y es la que
 *      hace que el boton de atras no pueda resucitar la pagina.
 *
 *   3. La cookie se borra con los MISMOS atributos con los que se puso. Si el
 *      `Path` o el `SameSite` no coinciden, el navegador guarda dos cookies con
 *      el mismo nombre y sobrevive la que no toca.
 *
 *   4. En el sitio, `pageshow` con `event.persisted` fuerza recargar cuando la
 *      pagina vuelve del cache de retroceso (ver `Base.astro`). Es la ultima
 *      linea, porque los tres anteriores son de servidor y este es el unico que
 *      depende del navegador.
 *
 * Los cuatro hacen falta. Cualquiera de ellos solo deja un hueco por el que la
 * sesion vuelve.
 */

import { ErrorApi, RUTAS } from '../constantes'
import { type Env } from '../entorno'
import { json } from '../http'
import { cookieDeBorrado, cookieDeSesion } from '../../lib/auth'
import {
  cerrarSesion as revocarSesion,
  datosDeCuenta,
  iniciarSesion,
  registrar,
  usuarioDePeticion,
} from './registro'

/* ===========================================================================
 * Cabeceras de una sesion que acaba de abrir o cerrar
 * ======================================================================== */

/**
 * Cabeceras comunes de toda respuesta de identidad.
 *
 * `no-store` es lo que impide que el navegador guarde la respuesta. No es
 * prudencia: sin esto, `/api/sesion` queda en la cache del navegador y al
 * pulsar atras el sitio cree que sigue dentro sin volver a preguntar.
 */
function cabecerasDeSesion(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    ...extra,
  }
}

/**
 * La respuesta del cierre de sesion.
 *
 * `Clear-Site-Data` va SOLO aqui, no en todas. En una respuesta normal seria
 * absurdo: obliga al navegador a tirar la cache en cada respuesta, y con
 * `storage` ademas borraria el carrito sin avisar. Aqui tiene sentido porque el
 * evento ES "este sitio ya no me reconoce".
 *
 * El valor `"cache"` y no `"*"` a proposito: `"*"` incluiria `storage` y
 * `cookies`, y vaciar el almacenamiento local borraria el carrito de alguien que
 * solo queria cambiar de cuenta. Se borra la cookie con `Set-Cookie`, que es
 * lo preciso, y la cache, que es lo que resucita el boton de atras.
 */
function cabecerasDeCierre(): Record<string, string> {
  return {
    ...cabecerasDeSesion(),
    'Clear-Site-Data': '"cache"',
  }
}

/* ===========================================================================
 * Enrutado
 * ======================================================================== */

export async function responderIdentidad(
  ruta: string,
  metodo: string,
  peticion: Request,
  env: Env,
): Promise<Response> {
  if (ruta === RUTAS.registro) {
    if (metodo !== 'POST') {
      throw ErrorApi.metodoNoPermitido('El registro es POST.', ['POST'])
    }
    return crearCuenta(peticion, env)
  }

  if (ruta === RUTAS.sesion) {
    if (metodo === 'POST') return entrar(peticion, env)
    if (metodo === 'DELETE') return salir(peticion, env)
    if (metodo === 'GET') return quienSoy(peticion, env)
    throw ErrorApi.metodoNoPermitido('Esa operacion no existe en la sesion.', [
      'GET',
      'POST',
      'DELETE',
    ])
  }

  if (ruta === RUTAS.cuenta) {
    if (metodo !== 'GET') {
      throw ErrorApi.metodoNoPermitido('Los datos de la cuenta solo se leen.', ['GET'])
    }
    return miCuenta(peticion, env)
  }

  throw ErrorApi.noEncontrado('Esa ruta')
}

/* ===========================================================================
 * Operaciones
 * ======================================================================== */

/**
 * Sin secreto de firma no hay sesiones, y por eso no hay registro ni acceso.
 *
 * Se devuelve 503 y no 500: el Worker esta vivo, lo que falta es
 * configuracion. Es la misma razon por la que los webhooks responden 503
 * mientras falte su secreto.
 */
function exigirSecreto(env: Env): string {
  if (!env.QBASWING_SECRETO_FIRMA) {
    throw new ErrorApi(
      'sin_configurar',
      'El acceso todavia no esta configurado en el servidor.',
      503,
    )
  }
  return env.QBASWING_SECRETO_FIRMA
}

/** Lee el cuerpo JSON y devuelve un objeto. Un cuerpo que no es objeto, no. */
async function cuerpoJson(peticion: Request): Promise<Record<string, unknown>> {
  try {
    const crudo = await peticion.text()
    if (!crudo) return {}
    const valor: unknown = JSON.parse(crudo)
    // Un array o un `null` son JSON validos pero no son lo que este endpoint
    // espera. Aceptarlos haria que `cuerpo.email` fuera `undefined` sin avisar.
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return {}
    return valor as Record<string, unknown>
  } catch {
    throw new ErrorApi('json_invalido', 'Los datos enviados no se pudieron leer.', 400)
  }
}

/**
 * POST /api/registro
 *
 * Devuelve 201 con el token en la cabecera y el usuario en el cuerpo. El token
 * NO va en el cuerpo de la respuesta: si fuera JSON, un reenvio accidental a
 * un servicio de registro de errores lo dejaria escrito en un tercero.
 */
async function crearCuenta(peticion: Request, env: Env): Promise<Response> {
  const secreto = exigirSecreto(env)
  const cuerpo = await cuerpoJson(peticion)

  const resultado = await registrar(env.DB, cuerpo, peticion, secreto)

  if (!resultado.ok) {
    return json({ ok: false, codigo: resultado.codigo, mensaje: resultado.mensaje }, resultado.status)
  }


  return json(
    { ok: true, usuario: usuarioPublico(resultado.usuario) },
    201,
    cabecerasDeSesion({ 'Set-Cookie': cookieDeSesion(resultado.token) }),
  )
}

/** POST /api/sesion */
async function entrar(peticion: Request, env: Env): Promise<Response> {
  const secreto = exigirSecreto(env)
  const cuerpo = await cuerpoJson(peticion)

  const resultado = await iniciarSesion(env.DB, cuerpo, peticion, secreto)

  if (!resultado.ok) {
    return json({ ok: false, codigo: resultado.codigo, mensaje: resultado.mensaje }, resultado.status)
  }


  return json(
    { ok: true, usuario: usuarioPublico(resultado.usuario) },
    200,
    cabecerasDeSesion({ 'Set-Cookie': cookieDeSesion(resultado.token) }),
  )
}

/**
 * GET /api/sesion
 *
 * Responde 200 con `usuario: null` cuando no hay sesion, y no 401. La razon es
 * que esta ruta se consulta en cada carga de pagina para pintar el estado del
 * boton "salir": si devolviera 401, el navegador lo registraria como error en
 * la consola cada vez que alguien solo visita el catalogo. Un visitante que no
 * esta dentro no ha cometido ningun error.
 *
 * Cuando hay cookie pero la fila esta revocada, se manda ademas la cookie de
 * borrado: el token ya no vale y no tiene sentido que el navegador lo arrastre.
 */
async function quienSoy(peticion: Request, env: Env): Promise<Response> {
  const { usuario, token } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)

  const cabeceras = cabecerasDeSesion()
  if (!usuario && token) {
    cabeceras['Set-Cookie'] = cookieDeBorrado()
  }

  return json(
    { ok: true, usuario: usuario ? usuarioPublico(usuario) : null },
    200,
    cabeceras,
  )
}

/**
 * DELETE /api/sesion
 *
 * Siempre 200, haya sesion o no. Un 401 en el cierre seria un error de estado:
 * el objetivo es "ya estas fuera", y estar fuera cuando ya estabas fuera es el
 * resultado correcto, no un fallo.
 */
async function salir(peticion: Request, env: Env): Promise<Response> {

  if (env.QBASWING_SECRETO_FIRMA) {
    await revocarSesion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)
  }

  return json(
    { ok: true },
    200,
    { ...cabecerasDeCierre(), 'Set-Cookie': cookieDeBorrado() },
  )
}

/**
 * GET /api/cuenta
 *
 * A diferencia de `GET /api/sesion`, aqui SI se devuelve 401 sin sesion. Es un
 * fallo de verdad: quien pide esta ruta es la pagina de su cuenta, y sin cookie
 * no hay nada que mostrar. Un 200 con `null` obligaria a la pagina a decidir por
 * su cuenta si es un invitado o un fallo, y esa decision se tomaria en el
 * sitio, que es justo donde no se puede validar nada.
 */
async function miCuenta(peticion: Request, env: Env): Promise<Response> {
  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)

  if (!usuario) {
    throw new ErrorApi('no_dentro', 'Primero tienes que entrar.', 401)
  }

  const cuenta = await datosDeCuenta(env.DB, usuario)

  return json(
    {
      ok: true,
      usuario: usuarioPublico(usuario),
      exencion: cuenta.exencion,
      tienda: cuenta.tienda,
      compras: cuenta.compras,
      sesionesAbiertas: cuenta.sesionesAbiertas,
    },
    200,
    cabecerasDeSesion(),
  )
}

/* ===========================================================================
 * Lo que se devuelve al cliente
 * ======================================================================== */

/**
 * Vista del usuario sin datos de credencial.
 *
 * `sesion_id` se quita a proposito: es el identificador interno de la fila de
 * `sesiones`. No sirve para nada fuera del servidor y publicarlo solo da a
 * alguien un numero que probar.
 */
function usuarioPublico(usuario: {
  id: number
  email: string
  nombre: string
  rol: 'owner' | 'administrador' | 'vendedor' | 'comprador'
  verificado: number
  vendedor_id: number | null
  privilegios: string[]
}) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    verificado: usuario.verificado === 1,
    esVendedor: usuario.vendedor_id !== null,
    puedeAdministrar: usuario.rol === 'owner' || usuario.rol === 'administrador' || usuario.privilegios.includes('administracion'),
  }
}