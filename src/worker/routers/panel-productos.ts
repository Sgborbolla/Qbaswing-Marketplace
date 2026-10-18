import { ErrorApi, TOPE_PRECIO } from '../constantes'
import type { Env } from '../entorno'
import { cuerpoJson, json } from '../http'
import { esCategoriaValida } from '../../lib/categorias-producto'
import { obtenerArchivoMaestro } from '../../lib/entrega'
import {
  MONEDAS as MONEDAS_MUNDO,
  bucketDe,
  esMonedaValida,
} from '../../lib/monedas'
import {
  MAX_BYTES_IMAGEN,
  claveDeImagen,
  claveDesdeUrlImagen,
  contentTypeDeImagen,
  extensionDeImagen,
  urlPublicaDeImagen,
} from '../../lib/imagenes'
import { hashSha256 } from '../../lib/almacenamiento'
import {
  MONEDAS_PRINCIPALES,
  type PreciosProducto,
  esMonedaPrincipal,
  monedaBaseDe,
  precioBaseDe,
  preciosDeFila,
} from '../../lib/precios-producto'
import { slugUnico } from '../slug'
import { usuarioDePeticion, type UsuarioSesion } from './registro'
import { traducirYGuardar } from '../traduccion'

type Moneda = string

const TIPOS = ['digital', 'fisico', 'servicio'] as const
type Tipo = (typeof TIPOS)[number]

const ORIGENES = ['qbaswing', 'externo'] as const
type Origen = (typeof ORIGENES)[number]

const FORMATOS_ENTREGA = ['descarga', 'clave', 'licencia', 'repositorio'] as const
const MODALIDADES = ['presencial', 'remoto', 'hibrido'] as const

interface DetalleDigital {
  stack: string
  licencia: string
  version: string
  ultimaActualizacion: string | null
  demoUrl: string | null
  formatoEntrega: string
}

interface DetalleFisico {
  stock: number
  envio: string
  processingTime: string
  pesoKg: number | null
  altoCm: number | null
  anchoCm: number | null
  largoCm: number | null
}

interface DetalleServicio {
  modalidad: string
  duracionEstimada: string
  incluye: string
}

type Detalles = DetalleDigital | DetalleFisico | DetalleServicio

interface ProductoPanel {
  id: number
  slug: string
  vendedor_id: number
  titulo: string
  descripcion: string
  descripcion_larga: string
  tipo: string
  origen: string
  regla: string
  categoria: string
  precio: number
  precio_anterior: number | null
  moneda: string
  precio_cup: number | null
  precio_usd: number | null
  precio_eur: number | null
  destacado: number
  publicado: number
  vitalicia: number | null
  estado_publicacion: string
  aprobado_por: number | null
  aprobado_at: string | null
  motivo_rechazo: string | null
}

/* ===========================================================================
 * Sesion y propiedad
 * ======================================================================== */

async function sesion(peticion: Request, env: Env): Promise<UsuarioSesion> {
  const { usuario } = await usuarioDePeticion(
    env.DB,
    peticion,
    env.QBASWING_SECRETO_FIRMA,
  )
  if (!usuario) throw ErrorApi.noAutenticado()
  return usuario
}

function esAdmin(usuario: UsuarioSesion): boolean {
  return usuario.rol === 'owner' || usuario.rol === 'administrador'
}

async function productoDe(
  env: Env,
  usuario: UsuarioSesion,
  id: number,
): Promise<ProductoPanel> {
  const fila = await env.DB.prepare(
    `SELECT id, slug, vendedor_id, titulo, descripcion, descripcion_larga, tipo,
            origen, regla, categoria, precio, precio_anterior,
            COALESCE(moneda_codigo, moneda) AS moneda, destacado,
            precio_cup, precio_usd, precio_eur,
            publicado, vitalicia, estado_publicacion, aprobado_por, aprobado_at,
            motivo_rechazo
       FROM productos
      WHERE id = ?`,
  )
    .bind(id)
    .first<ProductoPanel>()

  if (!fila) throw ErrorApi.noEncontrado('Ese producto')

  const suyo = usuario.vendedor_id !== null && usuario.vendedor_id === fila.vendedor_id
  if (!suyo && !esAdmin(usuario)) throw ErrorApi.noEncontrado('Ese producto')

  return fila
}

function baseDeApi(env: Env, peticion: Request): string {
  return (env.PUBLIC_API_BASE ?? new URL(peticion.url).origin).replace(/\/+$/, '')
}

/* ===========================================================================
 * Crear
 * ======================================================================== */

export async function crearProducto(
  peticion: Request,
  env: Env,
  ctx?: ExecutionContext,
): Promise<Response> {
  const usuario = await sesion(peticion, env)
  const vendedorId = usuario.vendedor_id
  if (vendedorId === null) {
    throw ErrorApi.invalido('tienda', 'Tu cuenta todavia no tiene tienda.')
  }

  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  const tipo = leerTipo(cuerpo.tipo)
  const origen: Origen = tipo === 'fisico' ? 'qbaswing' : leerOrigen(cuerpo.origen)
  const regla = reglaDe(tipo, origen)
  const titulo = texto(cuerpo.titulo, 'titulo', 3, 120)
  const descripcion = texto(cuerpo.descripcion, 'descripcion', 10, 500)
  const descripcionLarga = textoOpcional(cuerpo.descripcion_larga, 'descripcion_larga', 5000)
  const categoria = leerCategoria(cuerpo.categoria)
  const precios = leerPrecios(cuerpo, { CUP: null, USD: null, EUR: null })
  // El precio base se DERIVA de los tres: no se acepta desde fuera, para que no
  // pueda contradecirlos. Ordena el catalogo y es lo que se cobra por defecto.
  const moneda = monedaBaseDe(precios)
  const precio = precioBaseDe(precios)
  const vitalicia = tipo === 'digital' ? leerBooleano(cuerpo.vitalicia, null) : null
  const detalles = leerDetalles(tipo, cuerpo, null)

  const slug = await slugUnico(env.DB, 'productos', titulo, 'producto')

  const sentencias = [
    env.DB.prepare(
      `INSERT INTO productos
         (slug, vendedor_id, titulo, descripcion, descripcion_larga, tipo, origen,
          regla, categoria, precio, moneda, moneda_codigo, vitalicia, publicado,
          estado_publicacion, precio_cup, precio_usd, precio_eur)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'borrador', ?, ?, ?)`,
    ).bind(
      slug,
      vendedorId,
      titulo,
      descripcion,
      descripcionLarga,
      tipo,
      origen,
      regla,
      categoria,
      precio,
      bucketDe(moneda),
      moneda,
      vitalicia,
      precios.CUP,
      precios.USD,
      precios.EUR,
    ),
    env.DB.prepare(
      sqlDetalle(tipo, '(SELECT id FROM productos WHERE slug = ?)'),
    ).bind(slug, ...valoresDetalle(tipo, detalles)),
  ]

  await env.DB.batch(sentencias)

  const creado = await env.DB.prepare('SELECT id FROM productos WHERE slug = ?')
    .bind(slug)
    .first<{ id: number }>()
  if (!creado) {
    throw new ErrorApi('no_creado', 'No se pudo crear el producto.', 500)
  }

  // Traduccion en segundo plano: la persona que guarda recibe la respuesta ya,
  // y el Worker sigue traduciendo a los 13 idiomas base despues de responder.
  // Sin `ctx` (por ejemplo en una prueba) simplemente no se traduce.
  ctx?.waitUntil(traducirYGuardar(env, creado.id, { titulo, descripcion, descripcionLarga }))

  return json({ ok: true, producto: await detalleProducto(env, creado.id) }, 201)
}

/* ===========================================================================
 * Router de un producto
 * ======================================================================== */

export async function responderPanelProducto(
  peticion: Request,
  env: Env,
  ctx?: ExecutionContext,
): Promise<Response> {
  const usuario = await sesion(peticion, env)

  const ruta = new URL(peticion.url).pathname.replace(/\/+$/, '')
  const coincidencia = ruta.match(
    /^\/api\/panel\/productos\/(\d+)(?:\/([a-z-]+))?(?:\/(\d+))?$/,
  )
  if (!coincidencia) throw ErrorApi.noEncontrado('Esa ruta')

  const id = Number(coincidencia[1])
  const accion = coincidencia[2]
  const sub = coincidencia[3] ? Number(coincidencia[3]) : null
  const metodo = peticion.method

  if (!accion) {
    if (metodo === 'GET') {
      await productoDe(env, usuario, id)
      return json({ ok: true, producto: await detalleProducto(env, id) })
    }
    if (metodo === 'PUT') return editar(peticion, env, usuario, id, ctx)
    if (metodo === 'DELETE') return borrar(env, usuario, id)
    throw ErrorApi.metodoNoPermitido('Ese metodo no existe aqui.', ['GET', 'PUT', 'DELETE'])
  }

  if (accion === 'publicar' && metodo === 'POST') return publicar(env, usuario, id, ctx)
  if (accion === 'despublicar' && metodo === 'POST') return despublicar(env, usuario, id)
  // Vuelve a traducir el producto. Sirve para rellenar los que se publicaron
  // antes de tener Workers AI, o para rehacerlo tras editar el original.
  if (accion === 'traducir' && metodo === 'POST') return traducirProducto(env, usuario, id)

  if (accion === 'imagenes') {
    if (metodo === 'POST') return subirImagen(peticion, env, usuario, id)
    if (metodo === 'DELETE' && sub !== null) return borrarImagen(env, usuario, id, sub)
  }

  if (accion === 'variantes') {
    if (metodo === 'POST') return crearVariante(peticion, env, usuario, id)
    if (metodo === 'DELETE' && sub !== null) return borrarVariante(env, usuario, id, sub)
  }

  throw ErrorApi.metodoNoPermitido('Esa accion no existe.', ['GET', 'POST', 'PUT', 'DELETE'])
}

/* ===========================================================================
 * Detalle
 * ======================================================================== */

async function detalleProducto(env: Env, id: number): Promise<Record<string, unknown>> {
  const producto = await env.DB.prepare(
    `SELECT id, slug, vendedor_id, titulo, descripcion, descripcion_larga, tipo,
            origen, regla, categoria, precio, precio_anterior,
            COALESCE(moneda_codigo, moneda) AS moneda, destacado,
            precio_cup, precio_usd, precio_eur,
            publicado, vitalicia, estado_publicacion, aprobado_por, aprobado_at,
            motivo_rechazo, creado_at, actualizado_at
       FROM productos
      WHERE id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!producto) throw ErrorApi.noEncontrado('Ese producto')

  const imagenes = await env.DB.prepare(
    `SELECT id, url, alt, orden, hash_sha256, bytes
       FROM producto_imagenes
      WHERE producto_id = ?
      ORDER BY orden, id`,
  )
    .bind(id)
    .all()

  const variantes = await env.DB.prepare(
    `SELECT id, nombre, valor, stock
       FROM producto_variantes
      WHERE producto_id = ?
      ORDER BY nombre, valor`,
  )
    .bind(id)
    .all()

  const detalles = await detalleDe(env, id, producto.tipo as string)

  return {
    ...producto,
    precios: preciosDeFila(producto),
    detalles,
    imagenes: imagenes.results ?? [],
    variantes: variantes.results ?? [],
  }
}

async function detalleDe(
  env: Env,
  id: number,
  tipo: string,
): Promise<Record<string, unknown> | null> {
  const tabla =
    tipo === 'digital'
      ? 'detalles_digitales'
      : tipo === 'fisico'
        ? 'detalles_fisicos'
        : 'detalles_servicio'
  const fila = await env.DB.prepare(`SELECT * FROM ${tabla} WHERE producto_id = ?`)
    .bind(id)
    .first<Record<string, unknown>>()
  return fila ?? null
}

/* ===========================================================================
 * Editar
 * ======================================================================== */

async function editar(
  peticion: Request,
  env: Env,
  usuario: UsuarioSesion,
  id: number,
  ctx?: ExecutionContext,
): Promise<Response> {
  const existente = await productoDe(env, usuario, id)
  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>

  const previoDetalle = await detalleDe(env, id, existente.tipo)
  const detalles = leerDetalles(existente.tipo, cuerpo, previoDetalle)

  const titulo = texto(cuerpo.titulo, 'titulo', 3, 120, existente.titulo)
  const descripcion = texto(cuerpo.descripcion, 'descripcion', 10, 500, existente.descripcion)
  const descripcionLarga = textoOpcional(
    cuerpo.descripcion_larga,
    'descripcion_larga',
    5000,
    existente.descripcion_larga,
  )
  const categoria = leerCategoria(cuerpo.categoria, existente.categoria)
  const precios = leerPrecios(cuerpo, preciosDeFila(existente))
  const moneda = monedaBaseDe(precios)
  const precio = precioBaseDe(precios)
  const vitalicia =
    existente.tipo === 'digital'
      ? leerBooleano(cuerpo.vitalicia, existente.vitalicia)
      : existente.vitalicia

  const subioPorEncima =
    existente.precio_anterior !== null && precio > existente.precio_anterior
  const cambioMoneda = moneda !== existente.moneda
  const precioAnterior =
    subioPorEncima || cambioMoneda ? null : existente.precio_anterior

  let estado = existente.estado_publicacion
  let publicado = existente.publicado
  let motivo: string | null = existente.motivo_rechazo

  if (existente.regla === 'A' && estado === 'aprobado') {
    estado = 'pendiente'
    publicado = 0
    motivo = null
  }
  if (existente.tipo === 'fisico' && 'stock' in detalles && detalles.stock === 0) {
    publicado = 0
  }

  await env.DB.prepare(
    `UPDATE productos
        SET titulo = ?, descripcion = ?, descripcion_larga = ?, categoria = ?,
            precio = ?, moneda = ?, moneda_codigo = ?,
            precio_cup = ?, precio_usd = ?, precio_eur = ?,
            precio_anterior = ?,
            vitalicia = ?, publicado = ?, estado_publicacion = ?, motivo_rechazo = ?
      WHERE id = ?`,
  )
    .bind(
      titulo,
      descripcion,
      descripcionLarga,
      categoria,
      precio,
      bucketDe(moneda),
      moneda,
      precios.CUP,
      precios.USD,
      precios.EUR,
      precioAnterior,
      vitalicia,
      publicado,
      estado,
      motivo,
      id,
    )
    .run()

  const tipoEditar = existente.tipo as Tipo
  await env.DB.prepare(sqlDetalle(tipoEditar, '?'))
    .bind(id, ...valoresDetalle(tipoEditar, detalles))
    .run()

  // El original cambio: se retraduce en segundo plano para que los idiomas no
  // se queden mostrando el texto viejo.
  ctx?.waitUntil(traducirYGuardar(env, id, { titulo, descripcion, descripcionLarga }))

  return json({ ok: true, producto: await detalleProducto(env, id) })
}

/* ===========================================================================
 * Borrar
 * ======================================================================== */

async function borrar(env: Env, usuario: UsuarioSesion, id: number): Promise<Response> {
  await productoDe(env, usuario, id)

  const imagenes = await env.DB.prepare(
    'SELECT url FROM producto_imagenes WHERE producto_id = ?',
  )
    .bind(id)
    .all<{ url: string }>()

  const claves: string[] = (imagenes.results ?? [])
    .map((f) => claveDesdeUrlImagen(f.url))
    .filter((c): c is string => c !== null)

  const archivo = await env.DB.prepare(
    'SELECT almacen, clave FROM archivos_producto WHERE producto_id = ?',
  )
    .bind(id)
    .first<{ almacen: string; clave: string }>()
  if (archivo && archivo.almacen === 'kv') claves.push(archivo.clave)

  try {
    await env.DB.prepare('DELETE FROM productos WHERE id = ?').bind(id).run()
  } catch {
    throw new ErrorApi(
      'producto_con_ventas',
      'Este producto ya tiene ventas: no se puede borrar, solo retirarlo de la vitrina.',
      409,
    )
  }

  await Promise.all(claves.map((clave) => env.ARCHIVOS.delete(clave)))
  return json({ ok: true })
}

/* ===========================================================================
 * Publicar / retirar
 * ======================================================================== */

async function publicar(
  env: Env,
  usuario: UsuarioSesion,
  id: number,
  ctx?: ExecutionContext,
): Promise<Response> {
  const producto = await productoDe(env, usuario, id)

  // Un digital sin Archivo Maestro es una venta que no se puede entregar: el
  // comprador pagaria y la pagina de descargas no tendria nada que servirle.
  // Se exige aqui, en el unico punto donde el producto pasa de borrador a
  // visible, y no al crearlo, porque el archivo se sube despues desde la
  // edicion del producto.
  if (producto.tipo === 'digital') {
    const maestro = await obtenerArchivoMaestro(id, env.DB)
    if (!maestro) {
      throw new ErrorApi(
        'sin_archivo_maestro',
        'Este producto es digital y todavia no tiene Archivo Maestro. Sube el archivo desde la edicion del producto: sin archivo no hay descarga que entregar.',
        409,
      )
    }
  }

  if (producto.tipo === 'fisico') {
    const detalle = await detalleDe(env, id, 'fisico')
    const stock = Number(detalle?.stock ?? 0)
    if (stock <= 0) {
      throw new ErrorApi(
        'sin_existencias',
        'No podes publicar un producto agotado. Anadele existencias primero.',
        409,
      )
    }
  }

  if (producto.regla === 'A') {
    if (producto.estado_publicacion === 'aprobado') {
      await env.DB.prepare('UPDATE productos SET publicado = 1 WHERE id = ?')
        .bind(id)
        .run()
    } else {
      await env.DB.prepare(
        `UPDATE productos
            SET estado_publicacion = 'pendiente', publicado = 0, motivo_rechazo = NULL
          WHERE id = ?`,
      )
        .bind(id)
        .run()
    }
  } else {
    try {
      await env.DB.prepare(
        `UPDATE productos
            SET estado_publicacion = 'aprobado', publicado = 1, motivo_rechazo = NULL
          WHERE id = ?`,
      )
        .bind(id)
        .run()
    } catch (error) {
      throw traducirError(error)
    }
  }

  // Al publicar se asegura la traduccion: cubre los productos creados antes de
  // que existiera la traduccion automatica, que si no se quedarian en espanol.
  ctx?.waitUntil(
    traducirYGuardar(env, id, {
      titulo: producto.titulo,
      descripcion: producto.descripcion,
      descripcionLarga: producto.descripcion_larga,
    }),
  )

  return json({ ok: true, producto: await detalleProducto(env, id) })
}

async function despublicar(env: Env, usuario: UsuarioSesion, id: number): Promise<Response> {
  await productoDe(env, usuario, id)
  await env.DB.prepare('UPDATE productos SET publicado = 0 WHERE id = ?').bind(id).run()
  return json({ ok: true, producto: await detalleProducto(env, id) })
}

/**
 * Vuelve a traducir un producto propio, esperando el resultado.
 *
 * A diferencia del guardado (que traduce en segundo plano), aqui se espera
 * porque quien llama quiere saber si quedo traducido: es el boton de "rehacer la
 * traduccion", y responder antes de terminar diria que si cuando todavia no.
 * Si no hay IA, responde `traducido: false` en vez de fallar: no tener Workers
 * AI no es un error del producto.
 */
async function traducirProducto(
  env: Env,
  usuario: UsuarioSesion,
  id: number,
): Promise<Response> {
  const producto = await productoDe(env, usuario, id)
  const hayIa = Boolean(env.AI)
  if (hayIa) {
    await traducirYGuardar(env, id, {
      titulo: producto.titulo,
      descripcion: producto.descripcion,
      descripcionLarga: producto.descripcion_larga,
    })
  }
  return json({ ok: true, traducido: hayIa })
}

function traducirError(error: unknown): Error {
  const mensaje = error instanceof Error ? error.message : String(error)
  if (/espacio libre/i.test(mensaje)) {
    return new ErrorApi(
      'sin_espacio',
      'No tenes un espacio libre. Compra un paquete o retira otro producto fisico.',
      409,
    )
  }
  return error instanceof Error ? error : new Error(mensaje)
}

/* ===========================================================================
 * Imagenes
 * ======================================================================== */

async function subirImagen(
  peticion: Request,
  env: Env,
  usuario: UsuarioSesion,
  id: number,
): Promise<Response> {
  const producto = await productoDe(env, usuario, id)

  const forma = await peticion.formData()
  const crudo = forma.get('imagen')
  if (!(crudo instanceof File)) {
    throw ErrorApi.invalido('imagen', 'Adjunta una imagen.')
  }
  if (!extensionDeImagen(crudo.name)) {
    throw ErrorApi.invalido('imagen', 'Solo se aceptan JPG, PNG, WEBP, GIF o AVIF.')
  }
  if (crudo.size === 0) throw ErrorApi.invalido('imagen', 'La imagen esta vacia.')
  if (crudo.size > MAX_BYTES_IMAGEN) {
    throw ErrorApi.invalido('imagen', 'La imagen no puede pasar de 2 MB.')
  }

  const clave = claveDeImagen(producto.vendedor_id, id, crudo.name)
  const bytes = await crudo.arrayBuffer()
  const hash = await hashSha256(bytes)

  await env.ARCHIVOS.put(clave, bytes, {
    metadata: { contentType: contentTypeDeImagen(clave), bytes: crudo.size, hash },
  })

  const url = urlPublicaDeImagen(baseDeApi(env, peticion), clave)
  const alt =
    textoOpcional(forma.get('alt'), 'alt', 200, producto.titulo) || producto.titulo

  const maxOrden = await env.DB.prepare(
    'SELECT COALESCE(MAX(orden), -1) AS n FROM producto_imagenes WHERE producto_id = ?',
  )
    .bind(id)
    .first<{ n: number }>()
  const orden = (maxOrden?.n ?? -1) + 1

  const resultado = await env.DB.prepare(
    `INSERT INTO producto_imagenes (producto_id, url, alt, orden, hash_sha256, bytes)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, url, alt, orden, hash, crudo.size)
    .run()

  return json(
    {
      ok: true,
      imagen: {
        id: Number(resultado.meta?.last_row_id ?? 0),
        url,
        alt,
        orden,
      },
    },
    201,
  )
}

async function borrarImagen(
  env: Env,
  usuario: UsuarioSesion,
  id: number,
  imagenId: number,
): Promise<Response> {
  await productoDe(env, usuario, id)

  const fila = await env.DB.prepare(
    'SELECT url FROM producto_imagenes WHERE id = ? AND producto_id = ?',
  )
    .bind(imagenId, id)
    .first<{ url: string }>()
  if (!fila) throw ErrorApi.noEncontrado('Esa imagen')

  await env.DB.prepare('DELETE FROM producto_imagenes WHERE id = ?').bind(imagenId).run()

  const clave = claveDesdeUrlImagen(fila.url)
  if (clave) await env.ARCHIVOS.delete(clave)

  return json({ ok: true })
}

/* ===========================================================================
 * Variantes
 * ======================================================================== */

async function crearVariante(
  peticion: Request,
  env: Env,
  usuario: UsuarioSesion,
  id: number,
): Promise<Response> {
  await productoDe(env, usuario, id)

  const cuerpo = (await cuerpoJson(peticion)) as Record<string, unknown>
  const nombre = texto(cuerpo.nombre, 'nombre', 1, 40)
  const valor = texto(cuerpo.valor, 'valor', 1, 60)
  const stock = leerEntero(cuerpo.stock, 'stock', 0, 1_000_000, 0)

  await env.DB.prepare(
    `INSERT INTO producto_variantes (producto_id, nombre, valor, stock)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (producto_id, nombre, valor)
     DO UPDATE SET stock = excluded.stock`,
  )
    .bind(id, nombre, valor, stock)
    .run()

  return json({ ok: true }, 201)
}

async function borrarVariante(
  env: Env,
  usuario: UsuarioSesion,
  id: number,
  varianteId: number,
): Promise<Response> {
  await productoDe(env, usuario, id)
  const resultado = await env.DB.prepare(
    'DELETE FROM producto_variantes WHERE id = ? AND producto_id = ?',
  )
    .bind(varianteId, id)
    .run()
  if ((resultado.meta?.changes ?? 0) !== 1) throw ErrorApi.noEncontrado('Esa variante')
  return json({ ok: true })
}

/* ===========================================================================
 * SQL de detalles
 * ======================================================================== */

function sqlDetalle(tipo: Tipo, ref: string): string {
  if (tipo === 'digital') {
    return `INSERT INTO detalles_digitales
        (producto_id, stack, licencia, version, ultima_actualizacion, demo_url, formato_entrega)
      VALUES (${ref}, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (producto_id) DO UPDATE SET
        stack = excluded.stack,
        licencia = excluded.licencia,
        version = excluded.version,
        ultima_actualizacion = excluded.ultima_actualizacion,
        demo_url = excluded.demo_url,
        formato_entrega = excluded.formato_entrega`
  }
  if (tipo === 'fisico') {
    return `INSERT INTO detalles_fisicos
        (producto_id, stock, envio, processing_time, peso_kg, alto_cm, ancho_cm, largo_cm)
      VALUES (${ref}, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (producto_id) DO UPDATE SET
        stock = excluded.stock,
        envio = excluded.envio,
        processing_time = excluded.processing_time,
        peso_kg = excluded.peso_kg,
        alto_cm = excluded.alto_cm,
        ancho_cm = excluded.ancho_cm,
        largo_cm = excluded.largo_cm`
  }
  return `INSERT INTO detalles_servicio
      (producto_id, modalidad, duracion_estimada, incluye)
    VALUES (${ref}, ?, ?, ?)
    ON CONFLICT (producto_id) DO UPDATE SET
      modalidad = excluded.modalidad,
      duracion_estimada = excluded.duracion_estimada,
      incluye = excluded.incluye`
}

function valoresDetalle(tipo: Tipo, d: Detalles): unknown[] {
  if (tipo === 'digital') {
    const x = d as DetalleDigital
    return [x.stack, x.licencia, x.version, x.ultimaActualizacion, x.demoUrl, x.formatoEntrega]
  }
  if (tipo === 'fisico') {
    const x = d as DetalleFisico
    return [x.stock, x.envio, x.processingTime, x.pesoKg, x.altoCm, x.anchoCm, x.largoCm]
  }
  const x = d as DetalleServicio
  return [x.modalidad, x.duracionEstimada, x.incluye]
}

function leerDetalles(
  tipo: string,
  cuerpo: Record<string, unknown>,
  previo: Record<string, unknown> | null,
): Detalles {
  if (tipo === 'digital') {
    return {
      stack: leerLista(cuerpo.stack, (previo?.stack as string) ?? '[]'),
      licencia: textoOpcional(cuerpo.licencia, 'licencia', 120, (previo?.licencia as string) ?? ''),
      version: textoOpcional(cuerpo.version, 'version', 60, (previo?.version as string) ?? ''),
      ultimaActualizacion: textoOpcionalON(
        cuerpo.ultima_actualizacion,
        'ultima_actualizacion',
        40,
        (previo?.ultima_actualizacion as string | null) ?? null,
      ),
      demoUrl: leerUrl(cuerpo.demo_url, 'demo_url', (previo?.demo_url as string | null) ?? null),
      formatoEntrega: leerOpcion(
        cuerpo.formato_entrega,
        FORMATOS_ENTREGA,
        'formato_entrega',
        (previo?.formato_entrega as string) ?? 'descarga',
      ),
    }
  }
  if (tipo === 'fisico') {
    return {
      stock: leerEntero(cuerpo.stock, 'stock', 0, 1_000_000, (previo?.stock as number) ?? 0),
      envio: textoOpcional(cuerpo.envio, 'envio', 200, (previo?.envio as string) ?? ''),
      processingTime: textoOpcional(
        cuerpo.processing_time,
        'processing_time',
        120,
        (previo?.processing_time as string) ?? '',
      ),
      pesoKg: leerDecimal(cuerpo.peso_kg, 'peso_kg', 0, 1_000_000, (previo?.peso_kg as number) ?? null),
      altoCm: leerDecimal(cuerpo.alto_cm, 'alto_cm', 0, 100000, (previo?.alto_cm as number) ?? null),
      anchoCm: leerDecimal(cuerpo.ancho_cm, 'ancho_cm', 0, 100000, (previo?.ancho_cm as number) ?? null),
      largoCm: leerDecimal(cuerpo.largo_cm, 'largo_cm', 0, 100000, (previo?.largo_cm as number) ?? null),
    }
  }
  return {
    modalidad: leerOpcion(
      cuerpo.modalidad,
      MODALIDADES,
      'modalidad',
      (previo?.modalidad as string) ?? 'remoto',
    ),
    duracionEstimada: textoOpcional(
      cuerpo.duracion_estimada,
      'duracion_estimada',
      80,
      (previo?.duracion_estimada as string) ?? '',
    ),
    incluye: leerLista(cuerpo.incluye, (previo?.incluye as string) ?? '[]'),
  }
}

/* ===========================================================================
 * Validacion
 * ======================================================================== */

function texto(
  valor: unknown,
  campo: string,
  min: number,
  max: number,
  previo?: string,
): string {
  if (valor === undefined) {
    if (previo !== undefined) return previo
    throw ErrorApi.invalido(campo, 'Es obligatorio.')
  }
  if (typeof valor !== 'string') throw ErrorApi.invalido(campo, 'Tiene que ser texto.')
  const t = valor.trim()
  if (t.length < min) throw ErrorApi.invalido(campo, `Escribe al menos ${min} caracteres.`)
  if (t.length > max) throw ErrorApi.invalido(campo, `No puede pasar de ${max} caracteres.`)
  return t
}

function textoOpcional(valor: unknown, campo: string, max: number, previo = ''): string {
  if (valor === undefined) return previo
  if (valor === null) return ''
  if (typeof valor !== 'string') throw ErrorApi.invalido(campo, 'Tiene que ser texto.')
  const t = valor.trim()
  if (t.length > max) throw ErrorApi.invalido(campo, `No puede pasar de ${max} caracteres.`)
  return t
}

function textoOpcionalON(
  valor: unknown,
  campo: string,
  max: number,
  previo: string | null,
): string | null {
  if (valor === undefined) return previo
  if (valor === null) return null
  if (typeof valor !== 'string') throw ErrorApi.invalido(campo, 'Tiene que ser texto.')
  const t = valor.trim()
  if (t === '') return null
  if (t.length > max) throw ErrorApi.invalido(campo, `No puede pasar de ${max} caracteres.`)
  return t
}

function leerEntero(
  valor: unknown,
  campo: string,
  min: number,
  max: number,
  previo: number,
): number {
  if (valor === undefined) return previo
  if (valor === null || valor === '') throw ErrorApi.invalido(campo, 'Escribe un numero.')
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw ErrorApi.invalido(campo, 'Tiene que ser un numero entero.')
  }
  if (n < min || n > max) throw ErrorApi.invalido(campo, `Tiene que estar entre ${min} y ${max}.`)
  return n
}

function leerDecimal(
  valor: unknown,
  campo: string,
  min: number,
  max: number,
  previo: number | null,
): number | null {
  if (valor === undefined) return previo
  if (valor === null || valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim())
  if (!Number.isFinite(n)) throw ErrorApi.invalido(campo, 'Tiene que ser un numero.')
  if (n < min || n > max) throw ErrorApi.invalido(campo, `Tiene que estar entre ${min} y ${max}.`)
  return n
}

function leerLista(valor: unknown, previo: string): string {
  if (valor === undefined) return previo
  let elementos: string[]
  if (Array.isArray(valor)) {
    elementos = valor.map((x) => String(x).trim()).filter(Boolean)
  } else if (typeof valor === 'string') {
    const t = valor.trim()
    if (!t) return '[]'
    try {
      const json2 = JSON.parse(t)
      elementos = Array.isArray(json2)
        ? json2.map((x) => String(x).trim()).filter(Boolean)
        : t.split(',').map((s) => s.trim()).filter(Boolean)
    } catch {
      elementos = t.split(',').map((s) => s.trim()).filter(Boolean)
    }
  } else {
    throw ErrorApi.invalido('lista', 'Tiene que ser una lista.')
  }
  return JSON.stringify(elementos.slice(0, 50))
}

function leerUrl(valor: unknown, campo: string, previo: string | null): string | null {
  if (valor === undefined) return previo
  if (valor === null) return null
  if (typeof valor !== 'string') throw ErrorApi.invalido(campo, 'Tiene que ser una direccion web.')
  const t = valor.trim()
  if (!t) return null
  if (!/^https?:\/\//i.test(t)) {
    throw ErrorApi.invalido(campo, 'Tiene que empezar por http:// o https://.')
  }
  if (t.length > 400) throw ErrorApi.invalido(campo, 'La direccion es demasiado larga.')
  return t
}

function leerBooleano(valor: unknown, previo: number | null): number | null {
  if (valor === undefined) return previo
  if (valor === null) return null
  if (typeof valor === 'boolean') return valor ? 1 : 0
  if (typeof valor === 'number') return valor ? 1 : 0
  if (typeof valor === 'string') return /^(1|true|si|sí|yes)$/i.test(valor.trim()) ? 1 : 0
  throw ErrorApi.invalido('vitalicia', 'Tiene que ser si o no.')
}

function leerCategoria(valor: unknown, previo?: string): string {
  if (valor === undefined) {
    if (previo !== undefined) return previo
    throw ErrorApi.invalido('categoria', 'Elige una categoria.')
  }
  if (typeof valor !== 'string' || !esCategoriaValida(valor.trim())) {
    throw ErrorApi.invalido('categoria', 'Esa categoria no existe.')
  }
  return valor.trim()
}

function leerTipo(valor: unknown): Tipo {
  const v = typeof valor === 'string' ? valor.trim().toLowerCase() : ''
  if (!(TIPOS as readonly string[]).includes(v)) {
    throw ErrorApi.invalido('tipo', `El tipo tiene que ser ${TIPOS.join(', ')}.`)
  }
  return v as Tipo
}

function leerOrigen(valor: unknown): Origen {
  const v = typeof valor === 'string' ? valor.trim().toLowerCase() : 'qbaswing'
  if (!(ORIGENES as readonly string[]).includes(v)) {
    throw ErrorApi.invalido('origen', `El origen tiene que ser ${ORIGENES.join(', ')}.`)
  }
  return v as Origen
}

function leerMoneda(valor: unknown, previo: string): Moneda {
  if (valor === undefined) return previo
  const v = typeof valor === 'string' ? valor.trim().toUpperCase() : ''
  // Cada vendedor cobra en la moneda de su pais (ver `src/lib/monedas.ts`). La
  // lista es cerrada a proposito: el precio se guarda en enteros de la unidad
  // menor y cada moneda sabe cuantos decimales tiene.
  if (!esMonedaValida(v)) throw ErrorApi.invalido('moneda', 'Esa moneda no esta en la lista.')
  return v
}

function leerPrecio(valor: unknown, previo: number): number {
  if (valor === undefined) return previo
  if (valor === null || valor === '') {
    throw ErrorApi.invalido('precio', 'Pon el precio. Si no lo sabes, deja 0.')
  }
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim())
  if (!Number.isFinite(n)) {
    throw ErrorApi.invalido('precio', 'El precio tiene que ser un numero valido.')
  }
  if (n < 0) throw ErrorApi.invalido('precio', 'El precio no puede ser negativo.')
  // Sin tope artificial. Lo que importa es que se pueda representar y calcular.
  return Math.trunc(n) === n ? n : n // se conserva como numero; redondeo por moneda
}

/**
 * Los tres precios de un producto, ya validados.
 *
 * Acepta dos formas por compatibilidad:
 *
 *   - `precios: { CUP, USD, EUR }` (la forma nueva). Cada clave que venga se
 *     valida; las que no vengan conservan su valor anterior.
 *   - `precio` + `moneda` (la forma vieja, de un solo precio). Se escribe en la
 *     columna de esa moneda y las otras quedan como estaban. Un `moneda` que no
 *     sea CUP/USD/EUR (por ejemplo MXN) no tiene columna propia: se guarda solo
 *     en el precio base, que es lo que habia antes de la migracion 0029.
 *
 * Un precio `null`, `''` o ausente dentro del objeto significa "quitar esa
 * moneda". `0` se guarda tal cual y el sitio lo pinta como "sin precio".
 */
function leerPrecios(cuerpo: Record<string, unknown>, previo: PreciosProducto): PreciosProducto {
  const crudo = cuerpo.precios

  if (crudo === undefined) {
    if (cuerpo.precio === undefined && cuerpo.moneda === undefined) return previo
    const moneda = leerMoneda(cuerpo.moneda, monedaBaseDe(previo))
    const precio = leerPrecio(cuerpo.precio, precioBaseDe(previo))
    if (!esMonedaPrincipal(moneda)) return previo
    return { ...previo, [moneda]: precio }
  }

  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    throw ErrorApi.invalido('precios', 'Los precios tienen que venir como un objeto con CUP, USD y EUR.')
  }

  const objeto = crudo as Record<string, unknown>
  const salida: PreciosProducto = { ...previo }
  let vioAlguno = false
  for (const m of MONEDAS_PRINCIPALES) {
    if (!(m in objeto)) continue
    vioAlguno = true
    salida[m] = leerPrecioOpcional(objeto[m], m)
  }
  if (!vioAlguno) {
    throw ErrorApi.invalido('precios', 'Los precios tienen que venir como un objeto con CUP, USD y EUR.')
  }
  return salida
}

/** Un precio de una moneda concreta: entero >= 0, o `null` si se quita. */
function leerPrecioOpcional(valor: unknown, campo: string): number | null {
  if (valor === undefined || valor === null) return null
  if (valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim())
  if (!Number.isFinite(n)) {
    throw ErrorApi.invalido(campo, 'Ese precio no es un numero valido.')
  }
  if (!Number.isInteger(n)) {
    throw ErrorApi.invalido(campo, 'El precio es un numero entero, sin decimales.')
  }
  if (n < 0) throw ErrorApi.invalido(campo, 'El precio no puede ser negativo.')
  if (n > TOPE_PRECIO) {
    throw ErrorApi.invalido(campo, 'Ese precio es demasiado grande para poder calcularlo.')
  }
  return n
}

function leerOpcion(
  valor: unknown,
  permitidos: readonly string[],
  campo: string,
  previo: string,
): string {
  if (valor === undefined) return previo
  const v = typeof valor === 'string' ? valor.trim().toLowerCase() : ''
  if (!permitidos.includes(v)) {
    throw ErrorApi.invalido(campo, `Tiene que ser uno de: ${permitidos.join(', ')}.`)
  }
  return v
}

function reglaDe(tipo: Tipo, origen: Origen): 'A' | 'B' | 'C' {
  if (tipo === 'fisico') return 'C'
  return origen === 'qbaswing' ? 'B' : 'A'
}


