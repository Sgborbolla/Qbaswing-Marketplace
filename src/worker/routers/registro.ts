/**
 * Registro e inicio de sesion.
 *
 * ============================================================================
 *  EL ROL NO SE INVENTA: SE DEDUCE DE LO QUE YA ESTA EN LA BASE
 * ============================================================================
 * Cuando alguien se registra no se elige el rol en un desplegable. Se lee:
 *
 *   1. ¿esta el correo en `owner_registro_preautorizado` con `activo = 1`?
 *      -> rol `owner`. Es el unico Owner y hay una sola fila a proposito.
 *
 *   2. ¿existe una fila en `vendedores` con ese correo?
 *      -> rol `vendedor`, y `vendedor_id` apunta a esa tienda. Asi es como el
 *         patrocinador entra como vendedor sin que nadie tenga que tocar el
 *         codigo.
 *
 *   3. en cualquier otro caso -> rol `comprador`.
 *
 * Los privilegios administrativos van aparte, en `privilegio_usuario`, y no
 * cambian el rol. Es lo que permite que Freeman sea las dos cosas: vende porque
 * `vendedores.email` es el suyo, y administra porque tiene una fila de
 * privilegio. Un rol unico no puede ser las dos cosas a la vez.
 *
 * Que el rol NO se mande en el cuerpo de la peticion es la parte importante de
 * seguridad: si el registro aceptase `{"rol": "owner"}`, cualquiera podria
 * crearse Owner a si mismo por un POST. Aqui el rol se decide SIEMPRE en el
 * servidor, y el cuerpo solo puede traer nombre, correo y contrasena.
 *
 * ============================================================================
 *  POR QUE EL CORREO NO SE CONFIRMA CON UN EMAIL
 * ============================================================================
 * No hay como enviar correo desde un Worker sin contratar un servicio, y sin
 * confirmar el correo el unico Owner se registraria con el correo de otra
 * persona. Lo que se hace en su lugar:
 *
 *   - El Owner no se registra: entra por el registro, que ya esta sembrado con
 *     su correo en `owner_registro_preautorizado`, y su sesion se marca
 *     `verificado = 1` de salida.
 *   - Los demas usuarios quedan `verificado = 0`. El Owner los verifica desde
 *     su panel.
 *
 * La columna `verificado` ya existe y es la que controla el sello en la
 * publicacion de productos. Que no haya correo automatico no significa que la
 * verificacion sea opcional: significa que la hace una persona.
 */

import {
  hashDeToken,
  hashearContrasena,
  leerCookieDePeticion,
  normalizarEmail,
  problemaDeContrasena,
  problemaDeEmail,
  tokenSesion,
  verificarContrasena,
} from '../../lib/auth'

/* ===========================================================================
 * SQL
 * ======================================================================== */

/**
 * Busca el usuario por correo.
 *
 * `password_hash` viene SIEMPRE en el SELECT del login. En el del registro no:
 * no hace falta, y no traer una credencial que no se va a comparar es una regla
 * buena que se cumple sola con la forma de la consulta.
 */
const SQL_USUARIO_POR_EMAIL = `
  SELECT id, email, nombre, rol, password_hash, verificado, vendedor_id
    FROM usuarios
   WHERE email = ?
   LIMIT 1
`

/**
 * Rol y tienda que le corresponden a este correo.
 *
 * `vendedores.email` se busco con `idx_vendedores_email`, asi que este `CASE` no
 * recorre la tabla: es una busqueda por indice.
 */
const SQL_ROL_Y_TIENDA = `
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM owner_registro_preautorizado
                    WHERE email = ? COLLATE NOCASE AND activo = 1)
        THEN 'owner'
      WHEN EXISTS (SELECT 1 FROM vendedores WHERE email = ? COLLATE NOCASE)
        THEN 'vendedor'
      ELSE 'comprador'
    END                                       AS rol,
    (SELECT id FROM vendedores WHERE email = ? COLLATE NOCASE LIMIT 1) AS vendedor_id
`

/**
 * Marca la cuenta como verificada si su correo estaba preautorizado como Owner.
 *
 * Se hace en el mismo INSERT con un `CASE`, en vez de un `UPDATE` despues, para
 * que no exista un instante en el que la cuenta exista sin estar verificada.
 * D1 no tiene transacciones en el modo en que se ejecuta desde un Worker y
 * dos escrituras dejan una ventana en la que un `SELECT` ve al Owner sin
 * verificar.
 */
const SQL_INSERTAR_USUARIO_VERIFICADO = `
  INSERT INTO usuarios (email, nombre, rol, password_hash, verificado, vendedor_id)
  VALUES (?, ?, ?, ?,
          CASE WHEN EXISTS (SELECT 1 FROM owner_registro_preautorizado
                             WHERE email = ? COLLATE NOCASE AND activo = 1)
               THEN 1 ELSE 0 END,
          ?)
`

/** Abre sesion: guarda el HMAC del token y la fecha en que caduca. */
const SQL_ABRIR_SESION = `
  INSERT INTO sesiones (token_hash, usuario_id, expira_at, user_agent, ip_hash)
  VALUES (?, ?, ?, ?, ?)
`

/**
 * Resuelve una cookie a un usuario.
 *
 * Las tres condiciones se comprueban en el MISMO `WHERE` y no en tres `if`: si
 * fueran separadas, una sesion revocada con fecha futura pasaria el primer
 * filtro y el segundo la tiraria, pero el orden de las consultas haria trabajo
 * de mas y es mas facil que se olvide una condicion por error. Ademas
 * `revocada = 0` en el `WHERE` deja la revocacion en manos del indice.
 *
 * `COALESCE(revocada, 0) = 0` y no `revocada = 0`: la columna tiene
 * `NOT NULL DEFAULT 0`, asi que el `COALESCE` es por si alguna fila viene de una
 * base vieja migrada antes de que existiera el `NOT NULL`.
 */
const SQL_USUARIO_DE_SESION = `
  SELECT u.id, u.email, u.nombre, u.rol, u.verificado, u.vendedor_id, s.id AS sesion_id
    FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
   WHERE s.token_hash = ?
     AND s.revocada = 0
     AND s.expira_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   LIMIT 1
`

/** Revoca la sesion que se esta cerrando. Solo esa: las demas siguen vivas. */
const SQL_REVOCAR_SESION = `
  UPDATE sesiones
     SET revocada = 1, revocada_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE token_hash = ? AND revocada = 0
`

/**
 * Privilegios administrativos de un usuario.
 *
 * Se consultan por `usuarios.id` y no por correo para no tener que volver a
 * normalizar el correo, que ya se normalizo al crear la sesion.
 */
const SQL_PRIVILEGIOS = `
  SELECT p.alcance
    FROM privilegio_usuario p
    JOIN usuarios u ON u.email = p.email COLLATE NOCASE
   WHERE u.id = ? AND p.activo = 1 AND p.revocado_at IS NULL
`

/**
 * Datos de la cuenta propia que la pagina `/cuenta` necesita.
 *
 * SE LEE DEL CORREO, NO DEL `usuario_id`, y a proposito: la exencion y el
 * privilegio son fila por CORREO en sus tablas (`exencion_usuario` y
 * `privilegio_usuario`). Es lo que permite concederlos a alguien antes de que se
 * registre. Si se consultaran por `usuario_id`, habria que copiar el dato de una
 * tabla a otra al registrarse, y entonces habria dos verdades.
 *
 * El `LEFT JOIN` a `vendedores` es por el mismo camino: la tienda se crea antes
 * que la cuenta.
 */
const SQL_DATOS_CUENTA = `
  SELECT
    (SELECT e.exento_comision FROM exencion_usuario e
      WHERE e.email = u.email COLLATE NOCASE AND e.activo = 1 AND e.revocado_at IS NULL) AS exento_comision,
    (SELECT e.slots_ilimitados FROM exencion_usuario e
      WHERE e.email = u.email COLLATE NOCASE AND e.activo = 1 AND e.revocado_at IS NULL) AS slots_ilimitados,
    (SELECT e.motivo FROM exencion_usuario e
      WHERE e.email = u.email COLLATE NOCASE AND e.activo = 1 AND e.revocado_at IS NULL) AS exencion_motivo,
    (SELECT v.slug FROM vendedores v WHERE v.email = u.email COLLATE NOCASE) AS tienda_slug,
    (SELECT v.nombre_comercial FROM vendedores v WHERE v.email = u.email COLLATE NOCASE) AS tienda_nombre,
    (SELECT v.verificado FROM vendedores v WHERE v.email = u.email COLLATE NOCASE) AS tienda_verificada,
    (SELECT COUNT(*) FROM biblioteca b WHERE b.usuario_id = u.id) AS compras,
    (SELECT COUNT(*) FROM sesiones s
      WHERE s.usuario_id = u.id AND s.revocada = 0
        AND s.expira_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) AS sesiones_abiertas
    FROM usuarios u
   WHERE u.id = ?
`

/* ===========================================================================
 * Resultado
 * ======================================================================== */

/** Lo que devuelve `GET /api/cuenta`. */
export interface DatosCuenta {
  usuario: UsuarioSesion
  /** `null` si no hay exencion. `exentoComision` es estar libre de porcentaje. */
  exencion: { exentoComision: boolean; slotsIlimitados: boolean; motivo: string } | null
  /** `null` si la cuenta no es de vendedor. */
  tienda: { slug: string; nombre: string; verificada: boolean } | null
  compras: number
  sesionesAbiertas: number
}

/**
 * Lee los datos de la cuenta de un usuario ya autenticado.
 *
 * No se vuelve a leer la cookie: quien llama ya la resolvio con
 * `usuarioDePeticion`, y volver a hacerlo seria una segunda lectura de D1 por
 * peticion sin ganar nada.
 */
export async function datosDeCuenta(db: D1Database, usuario: UsuarioSesion): Promise<DatosCuenta> {
  const fila = await db.prepare(SQL_DATOS_CUENTA).bind(usuario.id).first<{
    exento_comision: number | null
    slots_ilimitados: number | null
    exencion_motivo: string | null
    tienda_slug: string | null
    tienda_nombre: string | null
    tienda_verificada: number | null
    compras: number
    sesiones_abiertas: number
  }>()

  // Sin fila no es posible: la sesion resuelta viene de `usuarios`. Se comprueba
  // igual para que un cambio de esquema no devuelva `exencion` con forma de
  // objeto y todos los campos a `undefined`.
  if (!fila) {
    return { usuario, exencion: null, tienda: null, compras: 0, sesionesAbiertas: 0 }
  }

  return {
    usuario,
    exencion:
      fila.exencion_motivo === null
        ? null
        : {
            exentoComision: fila.exento_comision === 1,
            slotsIlimitados: fila.slots_ilimitados === 1,
            motivo: fila.exencion_motivo,
          },
    tienda: fila.tienda_slug
      ? {
          slug: fila.tienda_slug,
          nombre: fila.tienda_nombre ?? '',
          verificada: fila.tienda_verificada === 1,
        }
      : null,
    compras: fila.compras ?? 0,
    sesionesAbiertas: fila.sesiones_abiertas ?? 0,
  }
}

export interface UsuarioSesion {
  id: number
  email: string
  nombre: string
  rol: 'owner' | 'administrador' | 'vendedor' | 'comprador'
  verificado: number
  vendedor_id: number | null
  /** Session id. Se usa para revocar una sola sesion. */
  sesion_id: number
  /** Privilegios de `privilegio_usuario`, no del rol. */
  privilegios: string[]
}

/* ===========================================================================
 * Sesion actual
 * ======================================================================== */

/**
 * Lee la sesion de una peticion.
 *
 * Devuelve `null` cuando no hay cookie, cuando la cookie no corresponde a
 * ninguna fila, cuando la fila esta revocada o cuando caduco. Los cuatro casos
 * son el mismo para quien llama: "no estas dentro". Distinguirlos ayudaria a
 * alguien que esta probando, y en un endpoint publico tambien a alguien que
 * esta probando de verdad.
 *
 * Aparte, cuando hay cookie pero la sesion esta revocada, la fila queda
 * "muerta" pero la cookie sigue en el navegador. Se devuelve `null` igualmente
 * y el router manda el `Set-Cookie` de borrado, para que el navegador no siga
 * arrastrando una cookie que ya no sirve.
 */
export async function usuarioDePeticion(
  db: D1Database,
  peticion: Request,
  secreto: string,
): Promise<{ usuario: UsuarioSesion | null; token: string | null }> {
  const token = leerCookieDePeticion(peticion)
  if (!token) return { usuario: null, token: null }

  const hash = await hashDeToken(token, secreto)
  const fila = await db
    .prepare(SQL_USUARIO_DE_SESION)
    .bind(hash)
    .first<{
      id: number
      email: string
      nombre: string
      rol: UsuarioSesion['rol']
      verificado: number
      vendedor_id: number | null
      sesion_id: number
    }>()

  if (!fila) return { usuario: null, token }

  const privilegios = await db
    .prepare(SQL_PRIVILEGIOS)
    .bind(fila.id)
    .all<{ alcance: string }>()

  return {
    usuario: {
      id: fila.id,
      email: fila.email,
      nombre: fila.nombre,
      rol: fila.rol,
      verificado: fila.verificado,
      vendedor_id: fila.vendedor_id,
      sesion_id: fila.sesion_id,
      privilegios: (privilegios.results ?? []).map((p) => p.alcance),
    },
    token,
  }
}

/* ===========================================================================
 * Registro
 * ======================================================================== */

export type ResultadoRegistro =
  | { ok: true; token: string; usuario: UsuarioSesion }
  | { ok: false; codigo: string; mensaje: string; status: number }

/**
 * Registra una cuenta.
 *
 * El cuerpo de la peticion solo puede traer `email`, `nombre` y `contrasena`.
 * Cualquier otro campo se ignora, y en particular `rol`, `verificado` y
 * `vendedor_id` NO se leen de la peticion en ningun punto de esta funcion.
 */
export async function registrar(
  db: D1Database,
  cuerpo: { email?: unknown; nombre?: unknown; contrasena?: unknown },
  peticion: Request,
  secreto: string,
): Promise<ResultadoRegistro> {
  const emailCrudo = typeof cuerpo.email === 'string' ? cuerpo.email : ''
  const nombreCrudo = typeof cuerpo.nombre === 'string' ? cuerpo.nombre : ''
  const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : ''

  const email = normalizarEmail(emailCrudo)
  const nombre = nombreCrudo.trim()

  if (!email) return { ok: false, codigo: 'campos', mensaje: 'Escribe tu correo.', status: 400 }

  const falloEmail = problemaDeEmail(email)
  if (falloEmail) return { ok: false, codigo: 'email', mensaje: falloEmail, status: 400 }

  if (nombre.length < 2) {
    return { ok: false, codigo: 'nombre', mensaje: 'Escribe tu nombre.', status: 400 }
  }
  if (nombre.length > 80) {
    return { ok: false, codigo: 'nombre', mensaje: 'El nombre es demasiado largo.', status: 400 }
  }

  const falloContrasena = problemaDeContrasena(contrasena, email)
  if (falloContrasena) {
    return { ok: false, codigo: 'contrasena', mensaje: falloContrasena, status: 400 }
  }

  const existente = await db
    .prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1')
    .bind(email)
    .first<{ id: number }>()
  if (existente) {
    // Se dice "ya existe" y no "la contrasena no es esa" a proposito: el
    // formulario de registro no es un sitio donde probar correos ajenos.
    return {
      ok: false,
      codigo: 'email_en_uso',
      mensaje: 'Ya hay una cuenta con ese correo. Entra con tu contrasena.',
      status: 409,
    }
  }

  const rol = await db.prepare(SQL_ROL_Y_TIENDA).bind(email, email, email).first<{
    rol: UsuarioSesion['rol']
    vendedor_id: number | null
  }>()
  const rolElegido = rol?.rol ?? 'comprador'
  const vendedorId = rolElegido === 'vendedor' ? (rol?.vendedor_id ?? null) : null

  const hash = await hashearContrasena(contrasena)

  const insertado = await db
    .prepare(SQL_INSERTAR_USUARIO_VERIFICADO)
    .bind(email, nombre, rolElegido, hash, email, vendedorId)
    .run()

  if (!insertado.success) {
    return {
      ok: false,
      codigo: 'error_registro',
      mensaje: 'No se pudo crear la cuenta. Intentalo de nuevo.',
      status: 500,
    }
  }

  const id = Number(insertado.meta.last_row_id ?? 0)
  const sesion = await abrirSesion(db, id, peticion, secreto)
  if (!sesion) {
    // La cuenta ya existe: no se borra. Se dice la verdad y se manda a entrar.
    return {
      ok: false,
      codigo: 'sesion_no_abierta',
      mensaje: 'Tu cuenta se creo, pero no se pudo abrir la sesion. Entra con tu contrasena.',
      status: 500,
    }
  }

  const listaPrivilegios = await db.prepare(SQL_PRIVILEGIOS).bind(id).all<{ alcance: string }>()

  return {
    ok: true,
    token: sesion,
    usuario: {
      id,
      email,
      nombre,
      rol: rolElegido,
      verificado: rolElegido === 'owner' ? 1 : 0,
      vendedor_id: vendedorId,
      sesion_id: 0,
      privilegios: (listaPrivilegios.results ?? []).map((p) => p.alcance),
    },
  }
}

/* ===========================================================================
 * Inicio de sesion
 * ======================================================================== */

export type ResultadoLogin =
  | { ok: true; token: string; usuario: UsuarioSesion }
  | { ok: false; codigo: string; mensaje: string; status: number }

/**
 * Entra con correo y contrasena.
 *
 * ============================================================================
 *  POR QUE EL TIEMPO DE RESPUESTA NO REVELA SI EL CORREO EXISTE
 * ============================================================================
 * Si el correo no existe se devuelve 401 sin comparar nada, y si existe se
 * tardan unos 100 ms en las vueltas de PBKDF2. Esa diferencia se mide con un
 * cronometro y dice cuantos correos estan registrados. Se hace siempre el
 * hash: si no, el mismo reloj informa de lo mismo.
 */
export async function iniciarSesion(
  db: D1Database,
  cuerpo: { email?: unknown; contrasena?: unknown },
  peticion: Request,
  secreto: string,
): Promise<ResultadoLogin> {

  const email = normalizarEmail(typeof cuerpo.email === 'string' ? cuerpo.email : '')
  const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : ''

  const credencialesMal = {
    ok: false as const,
    codigo: 'credenciales',
    mensaje: 'Correo o contrasena incorrectos.',
    status: 401,
  }

  if (!email || !contrasena) return credencialesMal

  const fila = await db.prepare(SQL_USUARIO_POR_EMAIL).bind(email).first<{
    id: number
    email: string
    nombre: string
    rol: UsuarioSesion['rol']
    password_hash: string
    verificado: number
    vendedor_id: number | null
  }>()

  if (!fila) {
    // Hash de mentira con las vueltas por defecto. Cuesta lo mismo que uno
    // real, que es justo lo que se quiere: el atacante no puede distinguir los
    // dos casos midiendo.
    await hashearContrasena(contrasena)
    return credencialesMal
  }

  const correcta = await verificarContrasena(contrasena, fila.password_hash)
  if (!correcta) return credencialesMal

  const token = await abrirSesion(db, fila.id, peticion, secreto)
  if (!token) {
    return {
      ok: false,
      codigo: 'sesion_no_abierta',
      mensaje: 'No se pudo abrir la sesion. Intentalo de nuevo.',
      status: 500,
    }
  }

  const privilegios = await db.prepare(SQL_PRIVILEGIOS).bind(fila.id).all<{ alcance: string }>()

  return {
    ok: true,
    token,
    usuario: {
      id: fila.id,
      email: fila.email,
      nombre: fila.nombre,
      rol: fila.rol,
      verificado: fila.verificado,
      vendedor_id: fila.vendedor_id,
      sesion_id: 0,
      privilegios: (privilegios.results ?? []).map((p) => p.alcance),
    },
  }
}

/* ===========================================================================
 * Cierre de sesion
 * ======================================================================== */

/**
 * Cierra la sesion de esta cookie.
 *
 * Revoca LA fila de esta cookie y solo esa. Si alguien entro desde el movil y
 * desde el portatil, cerrar sesion en uno no tendria por que echar al otro, y es
 * lo que espera la gente: "salir de este dispositivo".
 *
 * Devuelve `true` si habia algo que revocar. `false` con la cookie puesta no es
 * un error: es exactamente el caso del boton de atras, y la respuesta es la
 * misma cookie borrada.
 */
export async function cerrarSesion(
  db: D1Database,
  peticion: Request,
  secreto: string,
): Promise<boolean> {

  const token = leerCookieDePeticion(peticion)
  if (!token) return false

  const hash = await hashDeToken(token, secreto)
  const resultado = await db.prepare(SQL_REVOCAR_SESION).bind(hash).run()
  return Boolean(resultado.success && (resultado.meta.changes ?? 0) > 0)
}

/* ===========================================================================
 * Abrir sesion
 * ======================================================================== */

/** Calcula cuando caduca la fila de `sesiones`. */
function expiracion(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Crea el token, lo hashea y guarda la fila.
 *
 * El `user_agent` se guarda para auditoria. El `ip_hash` se guarda HASHEADO con
 * el secreto de firma y no en claro: la IP es un dato personal y no hace falta
 * para nada tenerlo legible, solo para poder correlacionar "muchas sesiones con
 * la misma IP". El hash cumple y no expone el dato.
 */
async function abrirSesion(
  db: D1Database,
  usuarioId: number,
  peticion: Request,
  secreto: string,
): Promise<string | null> {

  const token = tokenSesion()
  const hash = await hashDeToken(token, secreto)
  const ip = peticion.headers.get('CF-Connecting-IP') ?? ''
  const ipHash = ip ? await hashDeToken(ip, secreto) : null
  const userAgent = (peticion.headers.get('User-Agent') ?? '').slice(0, 255)

  const resultado = await db
    .prepare(SQL_ABRIR_SESION)
    .bind(hash, usuarioId, expiracion(), userAgent, ipHash)
    .run()

  return resultado.success ? token : null
}