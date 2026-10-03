/**
 * El token del carrito de quien no esta dentro.
 *
 * ============================================================================
 *  POR QUE ESTO VIVE SOLO
 * ============================================================================
 * Porque son DOS dominios los que lo necesitan, y no son el mismo:
 *
 *   - El carrito lo LEE y lo ESCRIBE en cada peticion de `/api/carrito`.
 *   - El registro y el acceso tienen que MANDARLO, para que las lineas que la
 *     persona eligio antes de crear la cuenta se le pasen a la cuenta nueva.
 *
 * Antes de que este archivo existiera, el token vivia dentro de
 * `carrito-cliente.ts`, y `identidad-cliente.ts` no mandaba la cabecera al
 * registrarse. El Worker hacia el volcado correctamente... y no pasaba nunca,
 * porque nadie le decia cual era el carrito. El fallo era invisible: las pruebas
 * del Worker pasaban porque mandaban la cabecera a mano, y el navegador no la
 * mandaba. Esa es exactamente la clase de fallo que no aparece en ningun
 * `tsc`.
 *
 * Lo contrario tampoco vale: que `identidad-cliente.ts` importara de
 * `carrito-cliente.ts` seria atar el modulo de identidad a uno que arrastra el
 * formateo de precios y el tipo `Moneda`. Lo que se comparte es un dato, no el
 * modulo entero.
 *
 * ============================================================================
 *  POR QUE VA EN UNA CABECERA Y NO EN UNA COOKIE
 * ============================================================================
 * Porque la cookie de sesion es `HttpOnly` a proposito, para que el JavaScript
 * no pueda leerla. Meter ahi el carrito seria mezclar dos cosas que tienen que
 * fallar por separado: perder el carrito molesta, perder la sesion deberia
 * dejar de estar dentro.
 *
 * Y este token NO es una credencial. No da acceso a la cuenta ni a datos de
 * nadie: solo dice "esta es la lista de cosas que elegiste". Por eso puede ir
 * en `localStorage` sin cifrar, y sin que eso sea un problema de seguridad.
 */

/** Cabecera donde viaja el token del carrito anonimo. */
export const CABECERA_TOKEN_CARRITO = 'X-QBASWing-Carrito'

/** Donde se guarda el token en el navegador. */
const CLAVE_TOKEN = 'qb:carrito'

/**
 * El token guardado, o cadena vacia.
 *
 * Se captura el fallo de `localStorage` en vez de dejar que suba. Sin
 * almacenamiento (modo privado antiguo, cuota llena, cookies de terceros
 * bloqueadas) el carrito sigue funcionando DENTRO de la pestana: se pierde al
 * recargar, y eso no es motivo para quitarle el boton de "añadir" a nadie. Que
 * el carrito se degrade es mucho mejor que que la pagina deje de funcionar.
 */
export function tokenGuardado(): string {
  try {
    return window.localStorage.getItem(CLAVE_TOKEN) ?? ''
  } catch {
    return ''
  }
}

/** Guarda el token. Si no se puede, se sigue adelante igual. */
export function guardarToken(token: string): void {
  if (!token) return
  try {
    window.localStorage.setItem(CLAVE_TOKEN, token)
  } catch {
    // Ver la nota de `tokenGuardado`.
  }
}

/**
 * La cabecera del carrito, o un objeto vacio si no hay token.
 *
 * Se devuelve como objeto porque va a mezclarse en las cabeceras de varias
 * peticiones, y ahi comprobar "si hay token" en cada llamada seria repetir la
 * comprobacion cinco veces.
 */
export function cabeceraCarrito(): Record<string, string> {
  const token = tokenGuardado()
  return token ? { [CABECERA_TOKEN_CARRITO]: token } : {}
}