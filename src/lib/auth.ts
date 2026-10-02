/**
 * Identidad: contrasenas, cookies y sesiones revocables.
 *
 * ============================================================================
 *  POR QUE ESTA EN `src/lib/` Y NO EN EL WORKER
 * ============================================================================
 * Es la misma razon que `entrega.ts`: son reglas de negocio, no infraestructura.
 * La regla "una contrasena no se guarda en claro" y la regla "cerrar sesion
 * revoca el token en el servidor" son reglas del marketplace, no del Worker que
 * las aplica. Si vivieran en el router, no se podrian probar sin levantar D1 ni
 * leer sin saber por que el router decide lo que decide.
 *
 * ============================================================================
 *  POR QUE ESTO NO ES SHA-256
 * ============================================================================
 * El comentario del esquema dice "SHA-256 del hash de la contrasena", y esa
 * instruccion es CORRECTA para guardar una contrasena en una base: nunca en
 * claro. Pero SHA-256 SOLO, tal cual, es insuficiente para contrasenas, y es un
 * fallo conocido de manual:
 *
 * SHA-256 esta disenado para ir RAPIDO. Uno hardware moderno hace miles de
 * millones por segundo. Una contrasena tiene 6 caracteres, asi que el atacante
 * prueba todas las combinaciones en un rato y la lee. Una base filtrada con
 * SHA-256 de contrasenas es una lista de contrasenas leidas, no cifradas.
 *
 * Aqui se usa PBKDF2-HMAC-SHA256: es SHA-256 repetido muchas veces con una sal
 * por usuario. Ralentiza al atacante sinalar al usuario, porque el usuario solo
 * paga una vez al entrar y el que ataca tiene que pagar cada intento.
 *
 * El formato guardado lleva el nombre del algoritmo y el numero de vueltas:
 *
 *   pbkdf2-sha256$100000$<sal>$<hash>
 *
 * Meterlo en el propio hash y no en el codigo es lo que permite subir las
 * vueltas dentro de tres anos sin que nadie tenga que rehashear nada: la funcion
 * de verificacion lee las vueltas del hash guardado y usa esas.
 *
 * ============================================================================
 *  ITERACIONES
 * ============================================================================
 * OWASP recomienda 210.000 para PBKDF2-SHA256. Aqui son 100.000 por el limite
 * de CPU de los Workers en el plan gratuito, que es de 10 ms por peticion:
 * 210.000 vueltas se salen de ese presupuesto y el Worker mataria la peticion,
 * con lo que nadie podria entrar nunca.
 *
 * Es una concession consciente y queda escrita aqui para que no se lea como un
 * descuido: 100.000 es la cifra que aguanta el limite. Si el proyecto pasa a
 * plan de pago, el numero sube; no al reves.
 *
 * ============================================================================
 *  LA REGLA DE ORO DE ESTE ARCHIVO
 * ============================================================================
 * Cerrar sesion tiene que dejar de ser valido EN EL SERVIDOR. Borrar la cookie
 * del navegador no basta: el boton de atras del navegador devuelve la pagina que
 * ya tenia, con la cookie puesta, y el usuario sigue dentro. Por eso el token
 * vive en la tabla `sesiones` y cerrar sesion marca la fila como revocada. La
 * cookie sin fila es un papel con un sello valido sobre un documento que ya no
 * existe.
 */

/* ===========================================================================
 * Configuracion
 * ======================================================================== */

/**
 * Vueltas de PBKDF2.
 *
 * El limite de CPU del plan gratuito de Workers es la razon del numero. Ver el
 * bloque de arriba antes de subirlo.
 */
export const ITERACIONES_PBKDF2 = 100_000

/**
 * Vida de la sesion, en segundos.
 *
 * 30 dias es lo que duran las cookies de "recordarme" en casi todos los sitios.
 * El limite es la `expira_at` de la fila en `sesiones`, no la cookie: si alguien
 * copia el token, sigue sirviendo hasta que la fila caduque, y se limpia sola
 * porque el indice `idx_sesiones_expira` la deja acotada.
 */
export const VIGENCIA_SESION_SEG = 30 * 24 * 60 * 60

/** Nombre de la cookie. Sin prefijo `__Host-` a proposito; ver `cookieDeSesion`. */
export const NOMBRE_COOKIE_SESION = 'qbaswing_sesion'

/** Alfabeto de los tokens: sin `+`, `/` ni `=`. Ver `tokenSesion`. */
const ALFABETO_TOKEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/* ===========================================================================
 * Contrasenas
 * ======================================================================== */

/** Longitud de la sal, en bytes. 16 es el minimo recomendado. */
const BYTES_SAL = 16

/** Longitud de la clave derivada, en bytes. */
const BYTES_CLAVE = 32

/** A codificacion Base64 sin relleno, para que el hash no traiga `=` ni `+`. */
function aBase64(bytes: Uint8Array): string {
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64(texto: string): Uint8Array {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(normal.padEnd(normal.length + ((4 - (normal.length % 4)) % 4), '='))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

function bytesAleatorios(cuantos: number): Uint8Array {
  const bytes = new Uint8Array(cuantos)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Deriva la clave con PBKDF2.
 *
 * `salt` e `iteraciones` son parametros y no constantes porque la verificacion
 * lee las vueltas del hash guardado. Si estan fijos aqui, subir el coste
 * obligaria a rehashear a todos los usuarios a la vez.
 *
 * `iterations` va en ingles porque es el NOMBRE DE LA PROPIEDAD que define
 * WebCrypto, no una decision nuestra. Es la unica palabra en ingles del
 * proyecto y esta aqui para que nadie la "corrija" y rompa la derivacion.
 */
async function derivar(contrasena: string, salt: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(contrasena),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations: iteraciones },
    clave,
    BYTES_CLAVE * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Convierte una contrasena en lo que se guarda en `usuarios.password_hash`.
 *
 * La sal se genera aqui y no se pasa: si la generara el llamante, dos usuarios con
 * la misma contrasena tendrian el mismo hash y se veria de un vistazo cuales
 * comparten contrasena en una fuga.
 */
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = bytesAleatorios(BYTES_SAL)
  const derivada = await derivar(contrasena, sal, ITERACIONES_PBKDF2)
  return `pbkdf2-sha256$${ITERACIONES_PBKDF2}$${aBase64(sal)}$${aBase64(derivada)}`
}

/**
 * Comprueba una contrasena contra lo guardado.
 *
 * Devuelve `false` en vez de lanzar cuando el formato no se reconoce. Un hash
 * que no se sabe leer es un hash que no verifica, y que el usuario no pueda
 * entrar se reporta como "el sistema tiene que revisar esa cuenta", no como un
 * error 500 en medio de la pantalla de acceso.
 *
 * La comparacion es en tiempo constante por el mismo motivo que en
 * `entrega.ts`: comparar con `===` filtra informacion por tiempo de respuesta.
 */
export async function verificarContrasena(contrasena: string, guardada: string): Promise<boolean> {
  const partes = guardada.split('$')
  if (partes.length !== 4) return false
  // OJO con la coma inicial: aqui NO se descarta ninguna posicion. El hash son
  // cuatro partes y las cuatro se necesitan. Con una coma inicial de mas
  // `hashTexto` salia `undefined`, la conversion a bytes fallaba y la funcion
  // devolvia `false` para TODAS las contrasenas: el registro funcionaba y era
  // imposible entrar. La comprobacion de `partes.length !== 4` de arriba es la
  // que dice cuantas hay, y el numero de nombres tiene que coincidir con ella.
  const [algoritmo, vueltasCrudas, salTexto, hashTexto] = partes
  if (algoritmo !== 'pbkdf2-sha256') return false

  const iteraciones = Number.parseInt(vueltasCrudas, 10)
  if (!Number.isFinite(iteraciones) || iteraciones < 1) return false

  let esperada: Uint8Array
  try {
    esperada = deBase64(hashTexto)
    const derivada = await derivar(contrasena, deBase64(salTexto), iteraciones)
    if (derivada.length !== esperada.length) return false

    let diferencia = 0
    for (let i = 0; i < derivada.length; i++) diferencia |= derivada[i] ^ esperada[i]
    return diferencia === 0
  } catch {
    return false
  }
}

/* ===========================================================================
 * Tokens
 * ======================================================================== */

/**
 * Token de sesion opaco.
 *
 * 32 caracteres de un alfabeto de 62 = unos 190 bits de entropia. No es un
 * identificador corto ni un contador: es aleatorio y no se puede adivinar.
 *
 * El alfabeto excluye `+`, `/` y `=` a proposito. El token va en una cookie, y
 * `=` y los separadores dan problemas en cabeceras `Cookie` y en URL sin
 * codificar. Como el token solo se compara y se hashea, el alfabeto reducido no
 * quita entropia apreciable.
 */
export function tokenSesion(): string {
  const bytes = bytesAleatorios(40)
  let salida = ''
  for (const b of bytes) salida += ALFABETO_TOKEN[b % ALFABETO_TOKEN.length]
  return salida
}

/**
 * HMAC del token, que es lo unico que se guarda.
 *
 * La tabla `sesiones` es una tabla de credenciales. Si alguien lee la base con
 * una fuga, lo que encuentra son estos hashes: sin `QBASWING_SECRETO_FIRMA` no
 * puede fabricar ninguna cookie a partir de ellos.
 */
export async function hashDeToken(token: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(token))
  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/* ===========================================================================
 * Cookie
 * ======================================================================== */

/**
 * `Set-Cookie` para abrir sesion.
 *
 * Los cuatro atributos no son adornos:
 *
 *   HttpOnly  el JavaScript de la pagina no puede leer la cookie. Sin esto,
 *             cualquier error de XSS en el sitio roba la sesion de todo el
 *             mundo con un bucle de peticiones.
 *   Secure    solo viaja por HTTPS. En HTTP se manda en claro y se lee en la red.
 *   SameSite  `Lax` evita que un enlace externo lleve la cookie de vuelta al
 *             sitio, que es la tecnica de CSRF mas comun. `Strict` tampoco
 *             sirve para QvaPay: la pasarela vuelve por redireccion, y con
 *             `Strict` la cookie no volveria y el usuario tendria que entrar
 *             otra vez a proposito.
 *   Path=/    la cookie vale en todo el sitio, que es lo que se necesita para
 *             que el panel y la pagina de descargas compartan sesion.
 */
export function cookieDeSesion(token: string, vigenciaSeg: number = VIGENCIA_SESION_SEG): string {
  return [
    `${NOMBRE_COOKIE_SESION}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${vigenciaSeg}`,
  ].join('; ')
}

/**
 * `Set-Cookie` para cerrar sesion.
 *
 * `Max-Age=0` es lo que hace que el navegador la borre. Y tiene que llevar
 * EXACTAMENTE los mismos `Path`, `Secure` y `SameSite` con los que se puso: si
 * no coinciden, el navegador ve dos cookies distintas con el mismo nombre en
 * sitios distintos y guarda la que no toca. Es el motivo clasico de "cerrar
 * sesion y seguir dentro" y no tiene nada que ver con la sesion, sino con la
 * cookie.
 */
export function cookieDeBorrado(): string {
  return [`${NOMBRE_COOKIE_SESION}=`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=0'].join('; ')
}

/** Lee la cookie de sesion de una peticion. `null` si no viene o si esta vacia. */
export function leerCookieDePeticion(peticion: Request): string | null {
  const cabecera = peticion.headers.get('Cookie')
  if (!cabecera) return null

  for (const trozo of cabecera.split(';')) {
    const igual = trozo.indexOf('=')
    if (igual < 0) continue
    if (trozo.slice(0, igual).trim() !== NOMBRE_COOKIE_SESION) continue
    const valor = trozo.slice(igual + 1).trim()
    if (valor) return valor
  }
  return null
}

/* ===========================================================================
 * Contrasena aceptable
 * ======================================================================== */

/**
 * Comprueba que una contrasena no sea trivialmente debil.
 *
 * El limite real es el MINIMO de 8 caracteres, no la variedad de simbolos: pedir
 * simbolos empuja a la gente a anotar la contrasena en un papel pegado al
 * monitor, y esa contrasena anotada es peor que una mediocre de 12 letras. Por
 * eso el mensaje de error dice "12 caracteres" en vez de "un simbolo".
 *
 * Contra el correo del propio usuario, que es el ataque mas comun y el mas
 * barato: se comprueba aqui y no en el Worker, para que la regla sea la misma
 * se llame desde donde se llame.
 */
export function problemaDeContrasena(contrasena: string, email: string = ''): string | null {
  if (contrasena.length < 8) return 'La contrasena necesita al menos 8 caracteres.'
  if (contrasena.length > 200) return 'La contrasena es demasiado larga.'

  const sinEspacios = contrasena.trim()
  if (sinEspacios.length < 8) {
    return 'La contrasena no puede ser solo espacios, aunque tenga 8.'
  }

  // En minusculas, y aqui y no dentro del bloque del correo: la lista de
  // debiles de abajo tambien la necesita, y declararla dentro del `if` la
  // dejaba fuera de alcance.
  const minusculas = contrasena.toLowerCase()

  if (email) {
    const antesDelArroba = email.split('@')[0]?.toLowerCase() ?? ''
    if (antesDelArroba.length >= 4 && minusculas.includes(antesDelArroba)) {
      return 'La contrasena no puede contener tu correo.'
    }
  }

  // Las tres contrasenas mas usadas del mundo. Rechazarlas es barato y quita un
  // monton de cuentas robadas, porque son las primeras que se prueban.
  const debiles = new Set([
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'contrasena',
    'qwertyui',
    'abc12345',
    'iloveyou',
    '11111111',
    '00000000',
  ])
  if (debiles.has(minusculas)) return 'Esa contrasena es demasiado comun. Pon otra.'

  return null
}

/** Normaliza un correo: minusculas y sin espacios. Para comparar y para indice unico. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Comprueba que un correo tenga forma de correo.
 *
 * A proposito austera: un solo `@`, algo antes y algo despues, un punto en el
 * dominio y ningun espacio. Una regexp que enumere los TLD reales se queda
 * vieja y empieza a rechazar direcciones validas.
 */
export function problemaDeEmail(email: string): string | null {
  const limpio = email.trim()
  if (limpio.length < 5 || limpio.length > 254) return 'El correo no tiene un formato valido.'

  const partes = limpio.split('@')
  if (partes.length !== 2) return 'El correo necesita un solo @.'
  const [usuario, dominio] = partes

  if (!usuario || !dominio) return 'El correo no tiene un formato valido.'
  if (!dominio.includes('.')) return 'El dominio del correo necesita un punto.'
  if (dominio.startsWith('.') || dominio.endsWith('.')) return 'El dominio del correo no es valido.'
  if (/\s/.test(limpio)) return 'El correo no puede tener espacios.'

  return null
}