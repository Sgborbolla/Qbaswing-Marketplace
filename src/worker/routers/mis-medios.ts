/**
 * Router de las formas de pago de CADA USUARIO: `/api/panel/medios-pago`.
 *
 * ============================================================================
 *  LAS CUATRO OPERACIONES
 * ============================================================================
 *   GET    /api/panel/medios-pago   lista los tuyos
 *   POST   /api/panel/medios-pago   anade uno
 *   PATCH  /api/panel/medios-pago   cambia uno (el `id` va en el cuerpo)
 *   DELETE /api/panel/medios-pago   borra uno (el `id` va en el cuerpo)
 *
 * ============================================================================
 *  POR QUE EL ID VA EN EL CUERPO Y NO EN LA URL
 * ============================================================================
 * Porque asi la propiedad se comprueba UNA sola vez y en la SQL:
 *
 *     UPDATE medios_pago_usuario SET ... WHERE id = ? AND usuario_id = ?
 *
 * Con un `/api/panel/medios-pago/123` habria que sacar el id de la URL y el
 * dueno de la sesion de la cookie, y serian DOS fuentes que tendrian que
 * coincidir. Si alguna vez se relajara una (por ejemplo, comprobar el dueno en
 * JavaScript y no en la consulta), el atacante elegiria el id de la URL y
 * modificaria la cuenta de otro. Con `AND usuario_id = ?` la base no deja la
 * fila salir aunque el codigo se equivoque: la propiedad es una condicion del
 * `WHERE`, no una comprobacion que alguien pueda olvidar.
 *
 * ============================================================================
 *  LA VALIDACION SE REPITE, Y A PROPOSITO
 * ============================================================================
 * Cada campo se valida aqui aunque la tabla ya lo tiene en un `CHECK`. No es
 * redundancia defensiva: un `CHECK` devuelve `CHECK constraint failed` en
 * ingles, sin decir cual de los tres campos ha fallado, y el vendedor se queda
 * con "algo va mal" justo donde esta metiendo el numero de su cuenta. Aqui el
 * error dice "el numero de cuenta solo puede llevar digitos".
 *
 * Ademas el `CHECK` solo se puede mirar al guardar: si el fallo salta por la
 * base, la fila ya estaba a medias en la respuesta de error.
 *
 * ============================================================================
 *  QUE NO SE TOCA: EL OWNER Y EL VENDEDOR SON DOS COSAS DISTINTAS
 * ============================================================================
 * `medios_pago_plataforma` la edita el Owner y es la del pie de pagina y de los
 * productos de Regla B. Esta tabla es la de cada cuenta, y solo se puede
 * escribir con la sesion propia. No hay ninguna ruta aqui que acepte el id de
 * otra persona, porque no se compara contra una lista de permisos: se compara
 * contra el `usuario_id` de quien mando la cookie.
 *
 * En la 0016 se quito la columna `verificado`. El Owner no revisa los numeros
 * de los demas: en un producto de Regla A el comprador le paga al vendedor por
 * una cuenta del vendedor, y el que confirma el pago es el vendedor. Mirar la
 * cuenta no le daria informacion sobre si llego, porque no tiene acceso a ella.
 */

import { ErrorApi, RUTAS } from '../constantes'
import type { Env } from '../entorno'
import { json } from '../http'
import { usuarioDePeticion } from './registro'

/**
 * Los cinco tipos que la tabla admite en su `CHECK`.
 *
 * No es un tipo abierto: si aqui se anade uno nuevo sin tocar la migracion, el
 * `INSERT` falla en la base y el error llega al vendedor en ingles. Se declara
 * como union para que `tsc` lo note antes de desplegar.
 */
const TIPOS = ['tarjeta', 'app', 'cripto', 'efectivo', 'otro'] as const
type TipoMedio = (typeof TIPOS)[number]

/** Longitud maxima de cada texto. La base no las pone, pero un campo sin tope se rellena a mano. */
const TOPE_NOMBRE = 80
const TOPE_INSTRUCCIONES = 600
const TOPE_RED = 40
const TOPE_DIRECCION = 120
const TOPE_ENLACE = 300

/* ===========================================================================
 * Router
 * ======================================================================== */

export async function responderMisMedios(
  peticion: Request,
  env: Env,
): Promise<Response> {
  const { usuario } = await usuarioDePeticion(
    env.DB,
    peticion,
    env.QBASWING_SECRETO_FIRMA,
  )

  // Sin sesion no se llega a leer nada. Va ANTES de mirar el metodo: sin esto,
  // un DELETE sin cookie devolveria "metodo no permitido" en vez de "no estas
  // dentro", que es la respuesta que importa y la unica que dice la verdad.
  if (!usuario) throw ErrorApi.noAutenticado()

  const metodo = peticion.method

  if (metodo === 'GET') return listar(peticion, env, usuario.id)
  if (metodo === 'POST') return anadir(peticion, env, usuario.id)
  if (metodo === 'PATCH') return cambiar(peticion, env, usuario.id)
  if (metodo === 'DELETE') return borrar(peticion, env, usuario.id)

  throw ErrorApi.metodoNoPermitido('Ese metodo no existe en tus formas de cobro.', [
    'GET',
    'POST',
    'PATCH',
    'DELETE',
  ])
}

/* ===========================================================================
 * Operaciones
 * ======================================================================== */

/**
 * GET. Lo que el propio vendedor gestiona, no lo que ve el comprador.
 *
 * Devuelve TODO, incluidas las que estan apagadas (`activo = 0`): son las que el
 * vendedor esta editando, y esconderle las suyas propias seria no poder
 * encenderlas.
 */
async function listar(peticion: Request, env: Env, usuarioId: number): Promise<Response> {
  // No hace falta: el id sale de la sesion. Se ignora cualquier parametro.
  void peticion

  const { results } = await env.DB.prepare(
    `SELECT id, clave, nombre, tipo, color_marca,
            numero_cuenta, titular, direccion, red,
            enlace, instrucciones, activo, orden
       FROM medios_pago_usuario
      WHERE usuario_id = ?
      ORDER BY activo DESC, orden, id`,
  )
    .bind(usuarioId)
    .all<Record<string, unknown>>()

  return json({ ok: true, medios: results })
}

/**
 * POST.
 *
 * `clave` no la manda nadie: se deriva de `nombre`. Es un campo interno que usa
 * el codigo (la tabla la tiene como UNIQUE por usuario) y exponerla obligaria a
 * que el vendedor elija un slug, que es una decision que no le aporta nada y
 * que puede rechazarle el guardado por una colision que no va a entender.
 */
async function anadir(peticion: Request, env: Env, usuarioId: number): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const campos = leerCampos(cuerpo)

  const clave = await claveLibre(env, usuarioId, campos.nombre)

  // Dos limites conviven aqui y por eso el INSERT va envuelto.
  //
  // El primero es `claveLibre`, que ya eligio una clave sin chocar. Pero entre
  // esa comprobacion y este INSERT pueden llegar dos peticiones a la vez, y lo
  // unico que corta la carrera es el indice de la base.
  //
  // El segundo son los dos indices parciales de la 0018 (misma cuenta activa,
  // misma direccion activa). Sin este bloque, SQLite lanza `UNIQUE constraint
  // failed`, eso se escapa al manejador general y el vendedor ve un 500 con
  // "Algo fallo de nuestro lado" justamente al meter su propio numero de
  // cuenta, sin saber que ya lo tenia activo.
  let insertado
  try {
    insertado = await env.DB.prepare(
      `INSERT INTO medios_pago_usuario
         (usuario_id, clave, nombre, tipo, color_marca,
          numero_cuenta, titular, direccion, red, enlace,
          instrucciones, activo, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        usuarioId,
        clave,
        campos.nombre,
        campos.tipo,
        campos.colorMarca,
        campos.numeroCuenta,
        campos.titular,
        campos.direccion,
        campos.red,
        campos.enlace,
        campos.instrucciones,
        campos.activo,
        campos.orden,
      )
      .run()
  } catch (error) {
    const traducido = errorDeRestriccion(error)
    if (traducido) throw traducido
    // No es un choque de indice: se propaga tal cual y `responderError` lo
    // convierte en un 500 SIN detalle. El texto de SQLite no sale al exterior.
    throw error
  }

  if (insertado.meta?.changes !== 1) {
    throw ErrorApi.invalido('medio', 'No se pudo guardar. Intentalo de nuevo.')
  }

  const fila = await env.DB.prepare(
    `SELECT id, clave, nombre, tipo, color_marca,
            numero_cuenta, titular, direccion, red,
            enlace, instrucciones, activo, orden
       FROM medios_pago_usuario WHERE id = ? AND usuario_id = ?`,
  )
    .bind(insertado.meta.last_row_id, usuarioId)
    .first<Record<string, unknown>>()

  return json({ ok: true, medio: fila }, 201)
}

/**
 * PATCH. Solo campos enviados; no enviar un campo lo deja como estaba.
 *
 * `activo` y `orden` se tratan aparte del resto porque los otros campos definen
 * QUE ES el medio y `activo` solo si esta encendido. Cambiar `nombre` de una
 * tarjeta activa no debe requerir volver a activarla.
 */
async function cambiar(peticion: Request, env: Env, usuarioId: number): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  const id = entero(cuerpo.id)
  if (!id) throw ErrorApi.invalido('id', 'Falta el medio que quieres cambiar.')

  const existente = await env.DB.prepare(
    `SELECT * FROM medios_pago_usuario WHERE id = ? AND usuario_id = ?`,
  )
    .bind(id, usuarioId)
    .first<Record<string, unknown>>()

  // La misma respuesta exista o no exista, y no diga "no encontrado" solo para
  // el id ajeno: eso permitiria averiguar que ids existen probando. Que no
  // encuentre nada es suficiente y no informa de nada.
  if (!existente) throw ErrorApi.noEncontrado('Ese medio de cobro')

  // Se parte de lo que ya esta y se superpone lo que llega. Asi `PATCH` con un
  // solo campo no borra los demas, que es justo lo que distingue a `PATCH` de
  // `PUT`.
  const campos = leerCampos(cuerpo, existente)

  try {
    await env.DB.prepare(
      `UPDATE medios_pago_usuario
          SET nombre = ?, tipo = ?, color_marca = ?,
              numero_cuenta = ?, titular = ?, direccion = ?, red = ?,
              enlace = ?, instrucciones = ?, activo = ?, orden = ?,
              actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND usuario_id = ?`,
    )
      .bind(
        campos.nombre,
        campos.tipo,
        campos.colorMarca,
        campos.numeroCuenta,
        campos.titular,
        campos.direccion,
        campos.red,
        campos.enlace,
        campos.instrucciones,
        campos.activo,
        campos.orden,
        id,
        usuarioId,
      )
      .run()
  } catch (error) {
    // Mismo motivo que en el INSERT: poner activa una cuenta que otra fila ya
    // tiene activa choca con el indice de la 0018, y sin traducirlo el vendedor
    // ve un 500 al mover un interruptor.
    const traducido = errorDeRestriccion(error)
    if (traducido) throw traducido
    throw error
  }

  const fila = await env.DB.prepare(
    `SELECT id, clave, nombre, tipo, color_marca,
            numero_cuenta, titular, direccion, red,
            enlace, instrucciones, activo, orden
       FROM medios_pago_usuario WHERE id = ? AND usuario_id = ?`,
  )
    .bind(id, usuarioId)
    .first<Record<string, unknown>>()

  return json({ ok: true, medio: fila })
}

/**
 * DELETE.
 *
 * Se borra y no se "desactiva": un numero que ya no se quiere usar no deberia
 * seguir en la base esperando a que alguien decida. Los pagos antiguos guardan
 * el numero en la transaccion, no apuntan aqui, asi que no se rompe nada.
 */
async function borrar(peticion: Request, env: Env, usuarioId: number): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const id = entero(cuerpo.id)
  if (!id) throw ErrorApi.invalido('id', 'Falta el medio que quieres borrar.')

  const borrado = await env.DB.prepare(
    `DELETE FROM medios_pago_usuario WHERE id = ? AND usuario_id = ?`,
  )
    .bind(id, usuarioId)
    .run()

  if (borrado.meta?.changes !== 1) throw ErrorApi.noEncontrado('Ese medio de cobro')

  return json({ ok: true })
}

/* ===========================================================================
 * Validacion
 * ======================================================================== */

/**
 * Campos normalizados ya validados.
 *
 * Los `null` son de verdad `null` y no `''`: un `color_marca` vacio no es un
 * color, y guardarlo como cadena vacia haria que el `CHECK` de la tabla, que
 * exige `#RRGGBB` o `NULL`, rechazara un guardado que desde aqui parecia bien.
 */
interface Campos {
  nombre: string
  tipo: TipoMedio
  colorMarca: string | null
  numeroCuenta: string | null
  titular: string | null
  direccion: string | null
  red: string | null
  enlace: string | null
  instrucciones: string
  activo: 0 | 1
  orden: number
}

/**
 * Valida el cuerpo ya leido.
 *
 * ============================================================================
 *  POR QUE RECIBE EL CUERPO Y NO LA PETICION
 * ============================================================================
 * `Request.json()` consume el flujo. Se puede llamar UNA sola vez: la segunda
 * vez revienta con "body already used", y esa excepcion no es un problema de
 * JSON sino del hecho de pedirlo dos veces.
 *
 * Aqui se pedia dos veces en `cambiar`: una para sacar el `id` y otra dentro de
 * esta funcion. El resultado era que PATCH devolviera 400 "el mensaje recibido
 * no es un JSON valido" con un cuerpo que era JSON perfectamente valido, y
 * aparte no se podia editar ningun medio — que es la unica razon de ser de la
 * ruta. `DELETE` funcionaba porque solo leia una vez, y eso es lo que hacia el
 * fallo tan dificil de ver leyendo el codigo: la mitad de las operaciones
 * trabajaban.
 *
 * Leer el cuerpo en cada operacion una sola vez y pasarlo como argumento no es
 * una optimizacion: es la restriccion del objeto. Pasar `peticion` hacia abajo
 * deja la trampa puesta para la proxima funcion que quiera leer algo mas.
 *
 * `previo` es la fila que ya existe, para `PATCH`: lo que no llega en el cuerpo
 * se queda en su valor actual. Sin el, un `PATCH { activo: 1 }` borraria el
 * nombre, el numero y todo lo demas, porque el `UPDATE` los escribiria con
 * `undefined`, que en SQL es `NULL` y en la base es `NOT NULL`.
 */
function leerCampos(cuerpo: Record<string, unknown>, previo?: Record<string, unknown>): Campos {
  const nombre = texto(cuerpo.nombre, previo?.nombre)
  if (!nombre) throw ErrorApi.invalido('nombre', 'Pon un nombre para identificar este medio.')
  if (nombre.length > TOPE_NOMBRE) {
    throw ErrorApi.invalido('nombre', `El nombre no puede pasar de ${TOPE_NOMBRE} caracteres.`)
  }

  const tipo = texto(cuerpo.tipo, previo?.tipo)
  if (!TIPOS.includes(tipo as TipoMedio)) {
    throw ErrorApi.invalido('tipo', 'Ese tipo de medio no existe.')
  }
  const tipoFinal = tipo as TipoMedio

  const color = texto(cuerpo.colorMarca, previo?.color_marca)
  const colorMarca = color ? color : null
  if (colorMarca && !/^#[0-9A-Fa-f]{6}$/.test(colorMarca)) {
    throw ErrorApi.invalido(
      'colorMarca',
      'El color tiene que ser hexadecimal con almohadilla, por ejemplo #1B6AC9.',
    )
  }

  const instrucciones = texto(cuerpo.instrucciones, previo?.instrucciones) ?? ''
  if (instrucciones.length > TOPE_INSTRUCCIONES) {
    throw ErrorApi.invalido(
      'instrucciones',
      `Las instrucciones no pueden pasar de ${TOPE_INSTRUCCIONES} caracteres.`,
    )
  }

  /*
   * El enlace de pago publico del vendedor.
   *
   * ============================================================================
   *  POR QUE SOLO `http://` Y `https://`
   * ============================================================================
   * Este campo se pinta como `href` en la ficha del producto, es decir, el
   * comprador lo pulsa. Cualquier cosa que empiece por otro esquema se ejecuta
   * en su sesion: `javascript:` corre codigo, `data:` carga una pagina dentro de
   * la nuestra, `file:` ni hablemos.
   *
   * Es decir, la validacion no es por higiene ni para que quede bonito: si se
   * dejara pasar cualquier texto, cualquier vendedor podria ejecutar algo con la
   * sesion de quien le compra. Y la sesion del comprador lleva sus compras.
   *
   * `new URL()` es preferido a un regex porque no se inventa esquemas: valida la
   * URL de verdad y devuelve `protocol`, que es donde esta la informacion. Un
   * regex que no contemplara `javascript:` o que fuera demasiado laxo daria por
   * bueno algo que `new URL()` rechaza.
   *
   * La base no lo comprueba a proposito: un CHECK no admite `NULL` de forma
   * condicional sin rehacer la tabla entera, y la mayoria de los medios no tiene
   * enlace.
   */
  const crudoEnlace = texto(cuerpo.enlace, previo?.enlace)
  let enlace: string | null = null
  if (crudoEnlace) {
    if (crudoEnlace.length > TOPE_ENLACE) {
      throw ErrorApi.invalido('enlace', `El enlace no puede pasar de ${TOPE_ENLACE} caracteres.`)
    }
    let protocolo: string
    try {
      protocolo = new URL(crudoEnlace).protocol
    } catch {
      // No es una URL en absoluto: `new URL` no la puede analizar.
      throw ErrorApi.invalido('enlace', 'El enlace no es una direccion valida. Tiene que empezar por https://')
    }
    if (protocolo !== 'http:' && protocolo !== 'https:') {
      // Si es una URL, pero de un esquema peligroso. Se dice cual es, porque el
      // vendedor probablemente no sepa que `javascript:` existe siquiera: sin
      // verlo, lo reintentaria igual y con el mismo error.
      throw ErrorApi.invalido(
        'enlace',
        `Solo se admiten enlaces http:// o https://, y el que has puesto es ${protocolo} en vez de una direccion. Si el comprador te tiene que pagar de otra forma, escribe las instrucciones en su campo.`,
      )
    }
    enlace = crudoEnlace
  }

  const titular = texto(cuerpo.titular, previo?.titular) || null

  /* -- Los dos campos que el CHECK de la tabla exige segun el tipo ---------- */

  let numeroCuenta = texto(cuerpo.numeroCuenta, previo?.numero_cuenta) || null
  let direccion = texto(cuerpo.direccion, previo?.direccion) || null
  let red = texto(cuerpo.red, previo?.red) || null

  if (tipoFinal === 'cripto') {
    if (!direccion || direccion.length < 8) {
      throw ErrorApi.invalido(
        'direccion',
        'Pon la direccion de la cartera. Tiene que tener al menos 8 caracteres.',
      )
    }
    if (direccion.length > TOPE_DIRECCION) {
      throw ErrorApi.invalido('direccion', `La direccion no puede pasar de ${TOPE_DIRECCION} caracteres.`)
    }
    if (!red) {
      throw ErrorApi.invalido('red', 'Pon la red: USDT de TRON y USDT de Ethereum no son lo mismo.')
    }
    if (red.length > TOPE_RED) {
      throw ErrorApi.invalido('red', `El nombre de la red no puede pasar de ${TOPE_RED} caracteres.`)
    }
    // Una direccion de cripto no puede quedar junto a un numero de tarjeta del
    // medio anterior. Se limpia en vez de dejarla: si `tipo` cambia de
    // 'tarjeta' a 'cripto' y el numero se queda, la fila guarda dos identidades
    // a la vez y el comprador veria un banco con una direccion debajo.
    numeroCuenta = null
  } else if (tipoFinal === 'tarjeta' || tipoFinal === 'app') {
    if (!numeroCuenta) {
      throw ErrorApi.invalido('numeroCuenta', 'Pon el numero de la cuenta.')
    }
    // Solo digitos. Es lo que exige el `CHECK` de la tabla, y se comprueba aqui
    // para que el error diga que es un numero y no "CHECK constraint failed".
    // Los espacios que suelen traer los numeros copiados del banco se quitan
    // solos: el vendedor pega "9224 0699 9205 9523" y eso es un numero valido.
    numeroCuenta = numeroCuenta.replace(/\s+/g, '')
    if (!/^[0-9]+$/.test(numeroCuenta)) {
      throw ErrorApi.invalido(
        'numeroCuenta',
        'El numero de cuenta solo puede llevar digitos, sin letras ni guiones.',
      )
    }
    direccion = null
    red = null
  } else {
    // 'efectivo' y 'otro' no necesitan identificador, pero tampoco deben
    // heredar uno de un tipo anterior.
    numeroCuenta = null
    direccion = null
    red = null
  }

  // `activo` se lee CRUDO y no con `texto()`. No es solo el error de tipos: si
  // llegara `false` como booleano, `texto()` lo convertiria en la cadena
  // "false", y "false" es una cadena no vacia, que para un `CHECK` de la base
  // es verdadera. El medio se activaria al intentar apagarlo, y encima al reves.
  const brutoActivo = cuerpo.activo === undefined ? previo?.activo : cuerpo.activo
  const activoFinal: 0 | 1 =
    brutoActivo === true || brutoActivo === 1 || brutoActivo === '1' || brutoActivo === 'true'
      ? 1
      : 0

  const orden = entero(cuerpo.orden) ?? (previo?.orden as number) ?? 0

  return {
    nombre,
    tipo: tipoFinal,
    colorMarca,
    numeroCuenta,
    titular,
    direccion,
    red,
    enlace,
    instrucciones,
    activo: activoFinal,
    orden,
  }
}

/**
 * Una `clave` libre para este usuario, derivada del nombre.
 *
 * Va en minusculas y solo con letras, digitos y guion, porque la tabla lo
 * exige en su `CHECK` (`GLOB '*[^a-z0-9-]*'`). Si ya existe, se le anade un
 * numero: la colision es interna, el vendedor no la elige ni la ve, y
 * devolverle un error por ella seria castigarle por algo que no ha hecho.
 */
async function claveLibre(env: Env, usuarioId: number, nombre: string): Promise<string> {
  const base =
    nombre
      .toLowerCase()
      .normalize('NFD')
      // Los acentos se quitan antes de quitar lo que no sea letra: sin esto,
      // "café" se queda en "caf" y no en "cafe".
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'medio'

  const yaExiste = async (clave: string) =>
    (await env.DB.prepare(
      `SELECT 1 FROM medios_pago_usuario WHERE usuario_id = ? AND clave = ?`,
    )
      .bind(usuarioId, clave)
      .first()) !== null

  if (!(await yaExiste(base))) return base

  for (let n = 2; n < 50; n += 1) {
    const candidata = `${base}-${n}`
    if (!(await yaExiste(candidata))) return candidata
  }

  // 50 colisiones con el mismo nombre es un caso que no deberia darse, y
  // sacrificarlo por un numero aleatorio es mejor que quedarse sin clave.
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Convierte un choque de indice unico en un error que se pueda leer.
 *
 * Devuelve `null` cuando el fallo NO es ese, para no tragarnos un error de otra
 * naturaleza disfrazado de "ya lo tienes": si la base falla por otra razon, lo
 * correcto es que salga como 500 sin detalle.
 *
 * El texto de SQLite SIEMPRE nombra la columna, nunca la tabla, y por eso se
 * compara contra `numero_cuenta`, `direccion` y `clave`. Ese mensaje no se
 * enseña: se usa para saber CUAL de los tres choques ha sido y escribir otro
 * distinto. Si se devolviera el original, el vendedor veria
 * `UNIQUE constraint failed: medios_pago_usuario.numero_cuenta`, que es ingles
 * y ademas es el nombre de una columna que nunca ha visto.
 */
function errorDeRestriccion(error: unknown): ErrorApi | null {
  const mensaje = error instanceof Error ? error.message : String(error)
  if (!/UNIQUE constraint failed/i.test(mensaje)) return null

  if (mensaje.includes('numero_cuenta')) {
    return ErrorApi.invalido(
      'numeroCuenta',
      'Ya tienes esa cuenta activa. Apaga la otra o usa un numero distinto.',
    )
  }
  if (mensaje.includes('direccion')) {
    return ErrorApi.invalido(
      'direccion',
      'Ya tienes esa direccion activa. Apaga la otra primero.',
    )
  }
  if (mensaje.includes('clave')) {
    return ErrorApi.invalido('nombre', 'Ya usaste ese nombre para otro medio de cobro.')
  }

  return ErrorApi.invalido('medio', 'Ya guardaste eso antes.')
}

/* ===========================================================================
 * Utilidades
 * ======================================================================== */

/**
 * Lee el cuerpo como JSON.
 *
 * Un cuerpo que no es JSON no es un error del servidor sino del que llama, y se
 * contesta como invalido. Si se dejara caer, el `catch` general lo traduciria
 * como "no se pudo conectar", que es mentira: si hubo respuesta, hubo conexion.
 */
async function cuerpoJson(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json()
  } catch {
    throw ErrorApi.invalido('cuerpo', 'El mensaje recibido no es un JSON valido.')
  }
}

/** Cadena de texto recortada. `undefined` usa el valor anterior, `null` lo limpia. */
function texto(actual: unknown, previo?: unknown): string {
  if (actual === undefined) return typeof previo === 'string' ? previo : ''
  if (actual === null) return ''
  if (typeof actual !== 'string') return String(actual)
  return actual.trim()
}

/** Entero positivo, o `undefined` si no lo es. */
function entero(valor: unknown): number | undefined {
  const n = typeof valor === 'number' ? valor : Number.parseInt(String(valor ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
