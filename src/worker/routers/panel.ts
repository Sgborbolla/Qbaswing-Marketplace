
function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s+/g,'')
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i=0;i<len;i++) bytes[i]=binary.charCodeAt(i)
  return bytes.buffer
}
async function obtenerTokenDrivePanel(env: Env): Promise<string> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON')
  let sa: any
  try { sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) } catch { throw new Error('JSON inválido') }
  const now = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive.file', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }
  const h64 = base64UrlEncode(enc.encode(JSON.stringify(header)).buffer)
  const p64 = base64UrlEncode(enc.encode(JSON.stringify(payload)).buffer)
  const toSign = enc.encode(h64+'.'+p64)
  const keyData = pemToArrayBuffer(sa.private_key)
  const ck = await crypto.subtle.importKey('pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', ck, toSign)
  const jwt = h64+'.'+p64+'.'+base64UrlEncode(sig)
  const tr = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:jwt})})
  if (!tr.ok) throw new Error('Token Drive falló')
  const tj = await tr.json() as any
  if (!tj.access_token) throw new Error('Sin access_token')
  return tj.access_token
}
async function sha256Archivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(hash)
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')
}
async function subirArchivoADrive(env: Env, archivo: File) {
  const token = await obtenerTokenDrivePanel(env)
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({name: archivo.name})], {type:'application/json'}))
  form.append('file', archivo)
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=false', {method:'POST', headers:{Authorization:'Bearer '+token}, body:form})
  if (!res.ok) throw new Error('Drive upload falló')
  const j = await res.json() as any
  if (!j.id) throw new Error('Drive sin fileId')
  return {fileId:j.id, bytes:archivo.size, contentType:archivo.type||'application/octet-stream', nombre:archivo.name}
}
async function subirArchivoAPixeldrain(env: Env, archivo: File) {
  const form = new FormData(); form.append('file', archivo)
  const headers: Record<string,string>={}; if (env.PIXELDRAIN_API_KEY) headers.Authorization = 'Basic '+btoa(env.PIXELDRAIN_API_KEY+':')
  const res = await fetch('https://pixeldrain.com/api/file', {method:'POST', headers, body:form})
  if (!res.ok) throw new Error('Pixeldrain upload falló')
  const j = await res.json() as any
  if (!j.id) throw new Error('Pixeldrain sin id')
  return {id:j.id, bytes:archivo.size, contentType:archivo.type||'application/octet-stream', nombre:archivo.name}
}
async function subirArchivoAGofile(env: Env, archivo: File) {
  const token = env.GOFILE_API_TOKEN; if (!token) throw new Error('Falta GOFILE_API_TOKEN')
  const s = await fetch('https://api.gofile.io/servers'); if (!s.ok) throw new Error('GoFile servers falló')
  const sj = await s.json() as any; const server = sj?.data?.servers?.[0]?.name; if (!server) throw new Error('Sin server GoFile')
  const form = new FormData(); form.append('file', archivo)
  const up = await fetch('https://'+server+'.gofile.io/uploadFile?token='+encodeURIComponent(token), {method:'POST', body:form})
  if (!up.ok) throw new Error('GoFile upload falló')
  const uj = await up.json() as any; const fileId = uj?.data?.fileId; if (!fileId) throw new Error('GoFile sin fileId')
  return {fileId, bytes:archivo.size, contentType:archivo.type||'application/octet-stream', nombre:archivo.name}
}
/**
 * Precios de los PROPIOS productos.
 *
 * ============================================================================
 *  QUE HACE Y QUE NO
 * ============================================================================
 * Solo dos operaciones: listar lo que el que llama vende, y cambiarle el precio
 * con su moneda. No crea productos, no los borra, no los publica y no toca la
 * aprobacion. Crear un producto es todo lo demas: slug, descripcion, imagenes,
 * categoria, regla y el circuito de aprobacion de 0003. Meterlo aqui habria
 * dado una ruta que inserta en `productos` sin pasar por ninguno de esos
 * controles, y el dia que fallara seria imposible saber que falto.
 *
 * ============================================================================
 *  POR QUE LA PROPIEDAD SE COMPRUEBA EN SQL Y NO EN JAVASCRIPT
 * ============================================================================
 * Se podria leer el producto, mirar en JS si `vendedor_id` coincide con el de
 * la sesion, y despues actualizar. Funciona, y es la forma de escribir el bug:
 * dos consultas donde cabia una, y si en algun momento se cambiara el `UPDATE`
 * olvidando la condicion, JavaScript ya habria dicho que si.
 *
 * Aqui el `WHERE` lleva las dos cosas a la vez:
 *
 *   UPDATE productos SET ... WHERE id = ? AND vendedor_id = ?
 *
 * `vendedor_id` sale SIEMPRE de la sesion, nunca del cuerpo de la peticion. Un
 * `vendedor_id` aceptado desde fuera convertiria esta ruta en una para editar
 * precios ajenos, que es exactamente lo contrario de lo que hace falta en un
 * marketplace.
 *
 * Si el id no es suyo, la consulta no cambia ninguna fila y se contesta 404.
 * No se devuelve "eso no es tuyo" porque eso confirmaria que el producto existe
 * en esa tienda, que es informacion que quien no lo tiene no necesita.
 *
 * ============================================================================
 *  LAS DOS COLUMNAS QUE HAY QUE MIRAR AL CAMBIAR EL PRECIO
 * ============================================================================
 * `productos` lleva un `CHECK (precio_anterior IS NULL OR precio_anterior >=
 * precio)`. Si un vendedor sube el precio por encima de su precio anterior, el
 * `UPDATE` revienta en ingles con un error de restriccion. Y aunque no
 * revientara, enseñar "antes 2000, ahora 3000" es un descuento al reves, que
 * es una mentira sobre el precio.
 *
 * Por eso `precio_anterior` se limpia en el mismo `UPDATE` cuando deja de ser
 * cierto. Esta columna no se expone en el formulario: quien cambia su precio
 * no esta pensando en el precio de antes, y pedirle que lo rellene seria
 * pedirle que decida un descuento que nadie le ha pedido.
 *
 * El otro caso es el cambio de moneda: un `precio_anterior` de 300 CUP no
 * significa nada al lado de un precio nuevo en USD. Se limpia tambien, y es lo
 * honesto, porque volver a pintarlo seria inventar un tipo de cambio.
 *
 * ============================================================================
 *  ESTADOS VACIOS REALES
 * ============================================================================
 * La base de produccion tiene 0 productos. La respuesta es `{ productos: [],
 * total: 0 }`, que es la verdad. No hay ningun producto de ejemplo.
 *
 * Una cuenta sin tienda (rol `comprador`) tambien recibe la lista vacia, no un
 * error: el formulario se muestra a todo el mundo que se registra, y lo que no
 * tiene productos dice que no tiene productos.
 */

import { ErrorApi, TOPE_PRECIO } from '../constantes'
import type { Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { crearAlmacenamientoKV, ErrorAlmacenamiento } from '../../lib/almacenamiento-kv'
import { usuarioDePeticion } from './registro'

/**
 * Las tres monedas del `CHECK` de la tabla.
 *
 * Se repite aqui y no se importa de `src/lib` porque el Worker tiene su propio
 * `tsconfig` con los tipos de Cloudflare y los del navegador conviviendo seria
 * mezclar dos mundos en un fichero que corre en el servidor. La misma razon por
 * la que `mis-medios` declara `TIPOS` en vez de traerlos de parte alguna: es un
 * conjunto que tiene que coincidir con la base, y si un dia se anade una
 * moneda nueva, `tsc` obliga a tocar el `CHECK` de la migracion y este array a
 * la vez, en el mismo compilado.
 */
const MONEDAS = ['CUP', 'USD', 'EUR'] as const
type Moneda = (typeof MONEDAS)[number]

/* ===========================================================================
 * Router
 * ======================================================================== */

export async function responderPanelProductos(peticion: Request, env: Env): Promise<Response> {
  const { usuario } = await usuarioDePeticion(
    env.DB,
    peticion,
    env.QBASWING_SECRETO_FIRMA,
  )

  // Sin sesion no hay lista que dar: lo unico que se podria listar es lo de
  // otra persona, y para eso ya existe el catalogo publico.
  if (!usuario) throw ErrorApi.noAutenticado()

  const metodo = peticion.method

  if (metodo === 'GET') return listar(env, usuario.vendedor_id)
  if (metodo === 'PATCH') return cambiar(peticion, env, usuario.vendedor_id)

  throw ErrorApi.metodoNoPermitido('Ese metodo no existe en tus productos.', ['GET', 'PATCH'])
}

/* ===========================================================================
 * Operaciones
 * ======================================================================== */

/**
 * GET. Todo lo que el que llama vende, incluidos los que no estan publicados.
 *
 * Se devuelven tambien los borradores y los rechazados porque son los que el
 * vendedor esta editando. Filtrar aqui por `publicado = 1` dejaria sin poder
 * poner precio justo a los que aun no salieron, que es donde mas hace falta.
 *
 * Se ordena por `actualizado_at` descendente: lo ultimo tocado arriba, que es
 * lo que se busca cuando se abre el panel a corregir un precio.
 *
 * No hay paginacion. El listado esta limitado por lo que posee una sola cuenta
 * y nadie mas lo puede alargar: alguien podria anadir paginacion el dia que
 * haya tiendas con miles de productos, pero anadirla hoy seria una consulta mas
 * que nadie ha pedido y que nadie puede probar con la base vacia.
 */
async function listar(env: Env, vendedorId: number | null): Promise<Response> {
  // Sin tienda no hay filas propias. Se devuelve la lista vacia en vez de un
  // error porque no es una falta: es el estado normal de una cuenta que todavia
  // no vende, y el formulario se muestra a todo el mundo.
  if (vendedorId === null) return json({ productos: [], total: 0 })

  const filas = await env.DB.prepare(
    `SELECT id, slug, titulo, precio, precio_anterior, moneda,
            publicado, estado_publicacion, categoria, regla, actualizado_at
       FROM productos
      WHERE vendedor_id = ?
      ORDER BY actualizado_at DESC, id DESC`,
  )
    .bind(vendedorId)
    .all<{
      id: number
      slug: string
      titulo: string
      precio: number
      precio_anterior: number | null
      moneda: string
      publicado: number
      estado_publicacion: string
      categoria: string
      regla: string
      actualizado_at: string
    }>()

  const productos = (filas.results ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    titulo: f.titulo,
    precio: f.precio,
    precio_anterior: f.precio_anterior,
    moneda: f.moneda,
    publicado: f.publicado === 1,
    estado_publicacion: f.estado_publicacion,
    categoria: f.categoria,
    regla: f.regla,
    actualizado_at: f.actualizado_at,
  }))

  return json({ productos, total: productos.length })
}

/**
 * PATCH. Cambia el precio y la moneda de UN producto propio.
 *
 * El cuerpo manda los dos campos siempre, aunque aqui sobreviviria uno solo:
 * `undefined` conserva el valor anterior. Se lee el cuerpo UNA sola vez y se
 * pasa abajo, por la razon que esta escrita en `cuerpoJson`.
 */
async function cambiar(
  peticion: Request,
  env: Env,
  vendedorId: number | null,
): Promise<Response> {
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  // El id de la fila a tocar. De aqui sale, no del body de otra forma: el
  // `WHERE` de abajo es quien decide si es suyo.
  const id = Number(cuerpo.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw ErrorApi.invalido('id', 'Falta el producto que quieres cambiar.')
  }

  const existente = await env.DB.prepare(
    `SELECT precio, precio_anterior, moneda
       FROM productos
      WHERE id = ? AND vendedor_id = ?`,
  )
    .bind(id, vendedorId)
    .first<{ precio: number; precio_anterior: number | null; moneda: string }>()

  if (!existente) throw ErrorApi.noEncontrado('Ese producto')

  const precio = leerPrecio(cuerpo.precio, existente.precio)
  const moneda = leerMoneda(cuerpo.moneda, existente.moneda)

  /*
   * Las dos razones por las que el precio de antes deja de poder quedarse.
   *
   * 1. El precio nuevo pasa por encima del anterior: el `CHECK` de la tabla lo
   *    prohibiria y el error saldria en ingles desde SQLite.
   * 2. Cambio la moneda: un 300 de la moneda vieja al lado de un precio nuevo
   *    en otra es inventar un tipo de cambio que nadie ha fijado.
   *
   * Los dos casos se resuelven en la misma columna porque el resultado es el
   * mismo: no hay precio anterior que enseñar con verdad.
   */
  const subioPorEncima =
    existente.precio_anterior !== null && precio > existente.precio_anterior
  const cambioDeMoneda = moneda !== existente.moneda
  const precioAnterior = subioPorEncima || cambioDeMoneda ? null : existente.precio_anterior

  const actualizado = await env.DB.prepare(
    `UPDATE productos
        SET precio = ?,
            moneda = ?,
            precio_anterior = ?,
            actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND vendedor_id = ?`,
  )
    .bind(precio, moneda, precioAnterior, id, vendedorId)
    .run()

  // Dos consultas con el mismo `WHERE`, pero la primera podia encontrar la fila
  // y esta no haber cambiado nada si entre medias alguien la borro. Si no
  // coincide una fila, lo que se dice es que no existe, que ya es lo que
  // contestaria la consulta de arriba.
  if (actualizado.meta?.changes !== 1) throw ErrorApi.noEncontrado('Ese producto')

  return json({
    ok: true,
    producto: {
      id,
      precio,
      moneda,
      precio_anterior: precioAnterior,
      precioAnteriorBorrado: precioAnterior === null && existente.precio_anterior !== null,
    },
  })
}

/* ===========================================================================
 * Validacion
 * ======================================================================== */

/**
 * El precio, ya validado.
 *
 * `undefined` conserva el que tenia, que es el contrato de un `PATCH` en este
 * proyecto: el cliente manda siempre todos los campos y el servidor decide con
 * lo que llega.
 *
 * `null` o `''` no conservan y no limpian tampoco: `precio` es `NOT NULL` en la
 * base, y no poner precio no es lo mismo que poner precio cero. Un precio en
 * cero es "todavia no se cuanto vale", y se escribe asi. Dejarlo vacio no
 * significaria nada, asi que se contesta.
 */
function leerPrecio(actual: unknown, previo: number): number {
  if (actual === undefined) return previo

  if (actual === null || actual === '') {
    throw ErrorApi.invalido(
      'precio',
      'Pon el precio. Si todavia no lo sabes, deja 0: el producto se muestra como "no disponible".',
    )
  }

  // Se acepta cadena porque los campos de texto del formulario mandan texto, y
  // rechazar `"250"` exigiria convertirlo en el navegador antes de mandarlo.
  // `Number('')` es 0 y `Number(' ')` tambien, pero esos ya salieron arriba.
  const numero = typeof actual === 'number' ? actual : Number(String(actual).trim())

  if (!Number.isFinite(numero)) {
    throw ErrorApi.invalido('precio', 'Ese precio no es un numero.')
  }

  // Sin esto, `250.5` se guardaria como REAL en una columna INTEGER: la tabla
  // no es STRICT, asi que SQLite lo admitiria y el error solo se veria despues,
  // cuando el catalogo pintara un precio con decimales que no puede cobrar.
  if (!Number.isInteger(numero)) {
    throw ErrorApi.invalido('precio', 'El precio es un numero entero, sin decimales.')
  }

  if (numero < 0) {
    throw ErrorApi.invalido('precio', 'El precio no puede ser negativo.')
  }

  if (numero > TOPE_PRECIO) {
    throw ErrorApi.invalido('precio', 'Ese precio es demasiado grande para poder calcularlo.')
  }

  return numero
}

/**
 * La moneda, ya validada contra el `CHECK` de la tabla.
 *
 * Se comprueba aqui y no en la base a proposito: si llegara una moneda que el
 * `CHECK` no admite, el error saldria de SQLite en ingles y llegaria al
 * navegador tal cual. Y hay que validarla aunque no venga: un `moneda`
 * ausente conserva la anterior, que siempre es una de las tres.
 */
function leerMoneda(actual: unknown, previo: string): Moneda {
  if (actual === undefined) return previo as Moneda

  const valor = typeof actual === 'string' ? actual.trim().toUpperCase() : ''
  if (!MONEDAS.includes(valor as Moneda)) {
    throw ErrorApi.invalido(
      'moneda',
      `La moneda tiene que ser ${MONEDAS.join(', ')}.`,
    )
  }

  return valor as Moneda
}

/* ===========================================================================
 * Archivo maestro
 * ======================================================================== */

/*
 * El archivo maestro es el entregable de un producto digital: se sube UNA vez y
 * cada compra descarga ese mismo original. No es lo mismo que las muestras ni
 * las imagenes del catalogo, y por eso tiene su propia tabla (`archivos_producto`)
 * y su propia ruta.
 *
 *   GET  /api/panel/productos/:id/maestro/ver        consulta lo que hay
 *   POST /api/panel/productos/:id/maestro/kv         sube a Workers KV (<= 25 MB)
 *   POST /api/panel/productos/:id/maestro/drive      sube a Google Drive
 *   POST /api/panel/productos/:id/maestro/pixeldrain sube a Pixeldrain
 *   POST /api/panel/productos/:id/maestro/gofile     sube a GoFile
 *   POST /api/panel/productos/:id/maestro/eliminar   borra el archivo
 *
 * El `fraccionado` (partir en trozos para pasar de 25 MB sin R2) todavia no
 * existe: no se finge. Un archivo que no quepa en KV se sube a un proveedor
 * externo, que ya esta soportado.
 */

/** Los almacenes con subida directa desde el panel. `fraccionado` no esta. */
const ALMACENES_SUBIDA = ['kv', 'drive', 'pixeldrain', 'gofile'] as const
type AlmacenSubida = (typeof ALMACENES_SUBIDA)[number]

/**
 * Router del archivo maestro. Se llama desde `index.ts` cuando la ruta empieza
 * por `/api/panel/productos/` y lleva `/maestro/`.
 *
 * La propiedad se comprueba leyendo el `vendedor_id` del producto, no el de la
 * sesion: lo que se decide es si el producto es de quien llama. Un Owner o un
 * administrador pueden gestionar el archivo de cualquier producto, que es lo
 * que necesita el circuito de aprobacion (0003).
 */
export async function responderArchivoMaestro(
  peticion: Request,
  env: Env,
): Promise<Response> {
  const { usuario } = await usuarioDePeticion(
    env.DB,
    peticion,
    env.QBASWING_SECRETO_FIRMA,
  )

  if (!usuario) throw ErrorApi.noAutenticado()

  const coincidencia = new URL(peticion.url).pathname.match(
    /^\/api\/panel\/productos\/(\d+)\/maestro\/([a-z-]+)$/,
  )
  if (!coincidencia) throw ErrorApi.noEncontrado('Esa ruta')

  const productoId = Number(coincidencia[1])
  const accion = coincidencia[2]

  const producto = await env.DB.prepare(
    'SELECT vendedor_id FROM productos WHERE id = ?',
  )
    .bind(productoId)
    .first<{ vendedor_id: number | null }>()

  if (!producto) throw ErrorApi.noEncontrado('Ese producto')

  const esDueno =
    usuario.vendedor_id !== null && usuario.vendedor_id === producto.vendedor_id
  const esAdmin = usuario.rol === 'owner' || usuario.rol === 'administrador'

  // Se contesta 404 y no 403 cuando el producto no es de quien llama y no es
  // admin: decir "no es tuyo" confirmaria que el producto existe en otra tienda.
  if (!esDueno && !esAdmin) throw ErrorApi.noEncontrado('Ese producto')

  if (peticion.method === 'GET') {
    if (accion !== 'ver') {
      throw ErrorApi.metodoNoPermitido('GET solo sirve para ver el archivo.', [
        'GET',
      ])
    }
    return consultarArchivoMaestro(env, productoId)
  }

  if (peticion.method === 'POST') {
    if (accion === 'eliminar') return eliminarArchivoMaestro(env, productoId)

    if ((ALMACENES_SUBIDA as readonly string[]).includes(accion)) {
      return subirArchivoMaestro(
        peticion,
        env,
        productoId,
        producto.vendedor_id,
        accion as AlmacenSubida,
        usuario.id,
      )
    }

    throw ErrorApi.noEncontrado('Esa accion sobre el archivo maestro')
  }

  throw ErrorApi.metodoNoPermitido('Ese metodo no existe aqui.', ['GET', 'POST'])
}

/** GET. Lo que hay guardado, o `null`. La clave privada se devuelve porque es
 *  del dueño; la descarga publica nunca la expone. */
async function consultarArchivoMaestro(
  env: Env,
  productoId: number,
): Promise<Response> {
  const archivo = await env.DB.prepare(
    `SELECT id, producto_id, almacen, clave, nombre_descarga, content_type,
            bytes, hash_sha256, subido_por, creado_at, actualizado_at
       FROM archivos_producto
      WHERE producto_id = ?`,
  )
    .bind(productoId)
    .first()

  return json({ ok: true, archivo: archivo ?? null })
}

/**
 * POST .../eliminar. Borra la referencia y, si el archivo vive en KV, tambien
 * el valor.
 *
 * Los externos (Drive, Pixeldrain, GoFile) solo se desvinculan: borrarlos pide
 * permisos que no tenemos o una llamada a cada API, y el espacio lo libera el
 * propio proveedor. Se borra la fila SIEMPRE, para que el producto deje de
 * ofrecer una descarga rota.
 */
async function eliminarArchivoMaestro(
  env: Env,
  productoId: number,
): Promise<Response> {
  const archivo = await env.DB.prepare(
    'SELECT almacen, clave FROM archivos_producto WHERE producto_id = ?',
  )
    .bind(productoId)
    .first<{ almacen: string; clave: string }>()

  if (!archivo) throw ErrorApi.noEncontrado('Ese archivo maestro')

  if (archivo.almacen === 'kv') {
    await crearAlmacenamientoKV(env.ARCHIVOS).borrar(archivo.clave)
  }

  await env.DB.prepare('DELETE FROM archivos_producto WHERE producto_id = ?')
    .bind(productoId)
    .run()

  return json({ ok: true })
}

interface DatosMaestro {
  almacen: string
  clave: string
  nombre: string
  contentType: string
  bytes: number
  hash: string
}

/**
 * POST .../{almacen}. Sube el archivo al almacen elegido y guarda la referencia.
 *
 * El archivo llega como `multipart/form-data` en el campo `archivo`. Se sube
 * primero al almacen y solo si eso funciona se escribe la fila: al reves, un
 * fallo de red dejaria en la base una clave que no apunta a ningun lado.
 */
async function subirArchivoMaestro(
  peticion: Request,
  env: Env,
  productoId: number,
  vendedorId: number | null,
  almacen: AlmacenSubida,
  subidoPor: number,
): Promise<Response> {
  const forma = await peticion.formData()
  const crudo = forma.get('archivo')

  // Se exige `File` y no se acepta un string: un campo de texto con el nombre
  // no es un archivo, y guardar su nombre como clave seria una fila que no
  // descarga nada.
  if (!(crudo instanceof File)) {
    throw ErrorApi.invalido('archivo', 'Adjunta el archivo maestro.')
  }

  let datos: DatosMaestro

  try {
    if (almacen === 'kv') {
      const subido = await crearAlmacenamientoKV(env.ARCHIVOS).subir({
        productoId: String(productoId),
        vendedorId: String(vendedorId ?? 0),
        archivo: crudo,
        tipo: 'descarga',
      })
      datos = {
        almacen: 'kv',
        clave: subido.clave ?? '',
        nombre: subido.nombreMostrado,
        contentType: subido.contentType,
        bytes: subido.bytes,
        hash: subido.hash,
      }
    } else if (almacen === 'drive') {
      const r = await subirArchivoADrive(env, crudo)
      datos = {
        almacen: 'drive',
        clave: r.fileId,
        nombre: r.nombre,
        contentType: r.contentType,
        bytes: r.bytes,
        hash: await sha256Archivo(crudo),
      }
    } else if (almacen === 'pixeldrain') {
      const r = await subirArchivoAPixeldrain(env, crudo)
      datos = {
        almacen: 'pixeldrain',
        clave: r.id,
        nombre: r.nombre,
        contentType: r.contentType,
        bytes: r.bytes,
        hash: await sha256Archivo(crudo),
      }
    } else {
      const r = await subirArchivoAGofile(env, crudo)
      datos = {
        almacen: 'gofile',
        clave: r.fileId,
        nombre: r.nombre,
        contentType: r.contentType,
        bytes: r.bytes,
        hash: await sha256Archivo(crudo),
      }
    }
  } catch (error) {
    // Un fallo de tamano o formato es culpa de quien sube: 400 con el motivo.
    // Un fallo del proveedor externo es 502: la peticion estaba bien y fallo el
    // otro extremo.
    if (error instanceof ErrorAlmacenamiento) {
      throw ErrorApi.invalido('archivo', error.message)
    }
    throw new ErrorApi(
      'archivo_maestro',
      error instanceof Error
        ? error.message
        : 'No se pudo subir el archivo maestro.',
      502,
    )
  }

  await guardarArchivoMaestro(env, productoId, datos, subidoPor)
  return json({ ok: true, archivo: { ...datos, producto_id: productoId } })
}

/**
 * Guarda o reemplaza la fila del archivo maestro.
 *
 * Antes de escribir se mira lo que habia: si era un archivo distinto en KV, se
 * borra el valor viejo para no dejar basura pagada por el vendedor. Reemplazar
 * en KV sin borrar el anterior perderia la clave vieja y dejaria el objeto
 * huerfano para siempre.
 */
async function guardarArchivoMaestro(
  env: Env,
  productoId: number,
  datos: DatosMaestro,
  subidoPor: number,
): Promise<void> {
  const previo = await env.DB.prepare(
    'SELECT almacen, clave FROM archivos_producto WHERE producto_id = ?',
  )
    .bind(productoId)
    .first<{ almacen: string; clave: string }>()

  if (previo && previo.almacen === 'kv' && previo.clave !== datos.clave) {
    await crearAlmacenamientoKV(env.ARCHIVOS).borrar(previo.clave)
  }

  await env.DB.prepare(
    `INSERT INTO archivos_producto
       (producto_id, almacen, clave, nombre_descarga, content_type, bytes, hash_sha256, subido_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(producto_id) DO UPDATE SET
       almacen         = excluded.almacen,
       clave           = excluded.clave,
       nombre_descarga = excluded.nombre_descarga,
       content_type    = excluded.content_type,
       bytes           = excluded.bytes,
       hash_sha256     = excluded.hash_sha256,
       subido_por      = excluded.subido_por`,
  )
    .bind(
      productoId,
      datos.almacen,
      datos.clave,
      datos.nombre,
      datos.contentType,
      datos.bytes,
      datos.hash,
      subidoPor,
    )
    .run()
}
