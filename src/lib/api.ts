/**
 * Capa de acceso a datos.
 *
 * ============================================================================
 *  ESTA ES LA FRONTERA DEL PROYECTO — LEER ANTES DE TOCAR NADA
 * ============================================================================
 *
 * Ninguna pagina importa datos directamente. Todas pasan por este modulo.
 *
 * NO HAY DATOS FICTICIOS EN ESTE ARCHIVO. No hay un producto de ejemplo "para
 * que se vea algo", ni un vendedor inventado, ni un precio de relleno. Si una
 * funcion no puede devolver la verdad, lanza `PendienteDeImplementar` y la
 * pagina dibuja un estado vacio que DICE que esta vacio. La diferencia importa:
 * un estado vacio honesto se ve como un sitio recien lanzado; uno relleno se ve
 * como un sitio lleno de fraud, y ese dano no se deshace.
 *
 * ============================================================================
 *  LA API HABLA snake_case, EL DOMINIO HABLA camelCase
 * ============================================================================
 * D1 devuelve filas como salen de la tabla: `vendedor_nombre`, `precio_cup`.
 * El dominio usa `vendedorNombre`, `precios.CUP`. La conversion ocurre AQUI, en
 * un solo archivo, y no en cada componente. Si se hiciera en el `.astro` cada
 * tarjeta repetiria el `?? null` y un dia uno se olvidaria, y ese forgot solo se
 * ve en produccion con el dato real.
 *
 * ============================================================================
 *  POR QUE `listaDe` LANZA CUANDO FALTA LA CLAVE
 * ============================================================================
 * La API envuelve todo en `{ ok: true, <la lista> }`. Si el nombre de la clave
 * cambia y esta funcion devolviera `[]` por defecto, la pagina mostraria "no hay
 * productos" y nadie sabria que en realidad la API cambio de contrato. Un estado
 * vacio y un error de contrato se ven IGUALES en pantalla. Por eso la funcion
 * distingue los dos casos y lanza en el segundo.
 *
 * Variables de entorno (ver .env.example):
 *   PUBLIC_API_BASE       -> base del Worker, ver `wrangler.api.toml`
 *   PUBLIC_CF_WORKER_URL  -> URL del Worker, si aplica
 *
 * `PUBLIC_` es intencional: Astro las expone al cliente. Si alguna vez el
 * secreto NO debe salir al navegador, quitale el prefijo `PUBLIC_` y queda
 * accesible solo en el servidor mediante `import.meta.env`.
 * ============================================================================
 */

import type { Categoria, Moneda, SuscripcionEspacios, Transaccion, Usuario } from './tipos'
import { COMISIONES, repartir, reglaDeOro } from './tipos'

/* -------------------------------------------------------------------------
 * Configuracion
 * ---------------------------------------------------------------------- */

export const API_BASE = import.meta.env.PUBLIC_API_BASE ?? ''
export const CF_WORKER_URL = import.meta.env.PUBLIC_CF_WORKER_URL ?? ''

/** `true` cuando no hay backend configurado. Las vistas lo usan para
 *  mostrar el estado vacio en vez de un error. */
export const backendConfigurado = API_BASE.length > 0

/**
 * Error unico de la capa de datos.
 *
 * `endpoint` va acompanado a proposito: cuando falle en produccion, el
 * mensaje dice exactamente que URL hay que arreglar en vez de un
 * "no se pudieron cargar los productos".
 */
export class ApiError extends Error {
  readonly endpoint: string
  readonly status?: number

  constructor(mensaje: string, endpoint: string, status?: number) {
    super(mensaje)
    this.name = 'ApiError'
    this.endpoint = endpoint
    this.status = status
  }
}

/**
 * Error de "falta implementar". Distinto de ApiError a proposito: un
 * `PendienteDeImplementar` es esperado y la vista lo maneja con un estado
 * vacio; un `ApiError` es un fallo real y merece una pantalla de error.
 */
export class PendienteDeImplementar extends Error {
  readonly endpoint: string

  constructor(operacion: string, endpointSugerido: string) {
    super(
      `\`${operacion}\` todavia no tiene endpoint. Implementalo en src/worker/routers/ como ${endpointSugerido}.`,
    )
    this.name = 'PendienteDeImplementar'
    this.endpoint = endpointSugerido
  }
}

/* -------------------------------------------------------------------------
 * Transporte
 * ---------------------------------------------------------------------- */

export interface OpcionesRequest {
  signal?: AbortSignal
  headers?: Record<string, string>
}

/** Una fila de D1 tal cual sale: claves en snake_case y valores sin transformar. */
export type Registro = Record<string, unknown>

/**
 * GET contra el backend.
 *
 * Devuelve el CUERPO COMPLETO, sin desenvolver el sobre `{ ok: true, ... }`.
 * Quien llame decide que campo leer, porque cada endpoint mete la lista en una
 * clave distinta (`productos`, `vendedores`, `paquetes`, `categorias`, `faq`) y
 * una funcion que adivinara el nombre seria adivinar.
 *
 * Lanza `PendienteDeImplementar` si no hay API configurada, de modo que la vista
 * pueda distinguir "vacio" de "roto".
 *
 * Exportada para que `api-plataforma.ts` la reuse. Reimplementarla ahi seria
 * duplicar el manejo de errores, y las dos copias divergirian: una existiria
 * cuando la API devuelve 500 y la otra no. Con una sola version, el footer y el
 * catalogo fallan exactamente igual.
 */
export async function pedir(ruta: string, opciones: OpcionesRequest = {}): Promise<Registro> {
  if (!backendConfigurado) {
    throw new PendienteDeImplementar(`GET ${ruta}`, `${API_BASE || '<PUBLIC_API_BASE>'}${ruta}`)
  }

  const url = `${API_BASE}${ruta}`

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      signal: opciones.signal,
      headers: {
        Accept: 'application/json',
        ...opciones.headers,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(`No se pudo conectar con ${url}. Verificá la red o CORS.`, url)
  }

  if (!respuesta.ok) {
    throw new ApiError(
      `${ruta} respondio ${respuesta.status} ${respuesta.statusText}.`,
      url,
      respuesta.status,
    )
  }

  const cuerpo = await respuesta.json()

  // Hoy el Worker responde `ok: false` siempre con 4xx o 5xx, asi que el `!ok`
  // de arriba ya cubria el caso. Se comprueba igual porque es una linea y
  // porque un endpoint futuro podria querer devolver 200 con un aviso, y que
  // 200 significara "todo bien" seria una suposicion fragil.
  if (cuerpo && typeof cuerpo === 'object' && (cuerpo as Registro).ok === false) {
    const c = cuerpo as Registro
    throw new ApiError(String(c.mensaje ?? 'La API respondio con un error.'), url, respuesta.status)
  }

  return cuerpo as Registro
}

/**
 * Lee una lista del cuerpo de la respuesta.
 *
 * Lanza si la clave no viene. Es lo que separa "todavia no hay productos" de
 * "la API cambio y el sitio ya no coincide con ella". La primera se ve bien; la
 * segunda no, y sin este error se veria igual.
 */
function listaDe(cuerpo: Registro, clave: string, ruta: string): Registro[] {
  const valor = cuerpo[clave]
  if (Array.isArray(valor)) return valor as Registro[]
  throw new ApiError(
    `${ruta} no devolvio la lista "${clave}". La API cambio y el sitio ya no coincide con ella.`,
    `${API_BASE}${ruta}`,
  )
}

/** Lee un objeto del cuerpo. Lanza si no esta, por el mismo motivo que `listaDe`. */
function objetoDe(cuerpo: Registro, clave: string, ruta: string): Registro {
  const valor = cuerpo[clave]
  if (valor && typeof valor === 'object') return valor as Registro
  throw new ApiError(
    `${ruta} no devolvio el objeto "${clave}". La API cambio y el sitio ya no coincide con ella.`,
    `${API_BASE}${ruta}`,
  )
}

/* -------------------------------------------------------------------------
 * Producto
 * ---------------------------------------------------------------------- */

export interface FiltrosCatalogo {
  categoria?: string
  tipo?: 'digital' | 'fisico' | 'servicio'
  busqueda?: string
  orden?: 'destacados' | 'nuevo' | 'precio_asc' | 'precio_desc'
  soloDestacados?: boolean
  pagina?: number
  porPagina?: number
}

export interface ResultadoPaginado<T> {
  items: T[]
  total: number
  pagina: number
  porPagina: number
  /** 0 cuando no hay resultados, para que `paginas > 1` no se compare con NaN. */
  paginas: number
}

/**
 * Convierte los filtros del dominio a los nombres que la API lee.
 *
 * La conversion va a mano y no con `Object.entries`, porque los NOMBRES NO
 * COINCIDEN: el dominio dice `busqueda`, la API lee `q`; el dominio dice
 * `soloDestacados: true`, la API lee `destacado=1`. Mandar el nombre del dominio
 * tal cual NO da error: la API ignora el parametro que no conoce y devuelve el
 * catalogo entero. Una pagina cuyos filtros no filtran se ve exactamente igual
 * que una que si, y el unico sintoma es que el filtro "no hace nada".
 */
function serializarFiltros(f: FiltrosCatalogo): string {
  const params = new URLSearchParams()
  if (f.categoria) params.set('categoria', f.categoria)
  if (f.tipo) params.set('tipo', f.tipo)
  if (f.busqueda) params.set('q', f.busqueda)
  if (f.orden) params.set('ordenar', f.orden)
  if (f.soloDestacados) params.set('destacado', '1')
  if (f.pagina) params.set('pagina', String(f.pagina))
  if (f.porPagina) params.set('por_pagina', String(f.porPagina))
  const s = params.toString()
  return s ? `?${s}` : ''
}

/**
 * Lo que una tarjeta de producto necesita, y nada mas.
 *
 * Es un tipo aparte del `Producto` del detalle a proposito. El listado NO
 * devuelve `descripcion_larga`, no existe una tabla de `etiquetas`, y del
 * vendedor solo trae el slug. Declarar aqui el `Producto` completo y prometer
 * campos que la API no envia es como se empieza a pintar `undefined` en pantalla.
 */
export interface ProductoResumen {
  id: number
  slug: string
  titulo: string
  descripcion: string
  tipo: 'digital' | 'fisico' | 'servicio'
  origen: 'qbaswing' | 'externo'
  regla: 'A' | 'B' | 'C'
  categoria: string
  precio: number
  precioAnterior: number | null
  moneda: 'CUP' | 'USD' | 'EUR'
  destacado: boolean
  vitalicia: boolean | null
  fechaPublicacion: string
  vendedorSlug: string
  vendedorNombre: string
  /** Primera imagen del producto, o `null` si no tiene ninguna. */
  imagen: string | null
}

function mapearResumen(f: Registro): ProductoResumen {
  return {
    id: f.id as number,
    slug: String(f.slug),
    titulo: String(f.titulo),
    descripcion: String(f.descripcion ?? ''),
    tipo: f.tipo as ProductoResumen['tipo'],
    origen: f.origen as ProductoResumen['origen'],
    regla: f.regla as ProductoResumen['regla'],
    categoria: String(f.categoria),
    precio: f.precio as number,
    precioAnterior: (f.precio_anterior as number | null) ?? null,
    moneda: f.moneda as ProductoResumen['moneda'],
    destacado: f.destacado === 1,
    vitalicia: (f.vitalicia as boolean | null) ?? null,
    fechaPublicacion: String(f.creado_at),
    vendedorSlug: String(f.vendedor_slug ?? ''),
    vendedorNombre: String(f.vendedor_nombre ?? ''),
    imagen: (f.imagen as string | null) ?? null,
  }
}

export async function listarProductos(
  filtros: FiltrosCatalogo = {},
  opciones?: OpcionesRequest,
): Promise<ResultadoPaginado<ProductoResumen>> {
  const ruta = `/api/productos${serializarFiltros(filtros)}`
  const cuerpo = await pedir(ruta, opciones)
  return {
    items: listaDe(cuerpo, 'productos', ruta).map(mapearResumen),
    total: (cuerpo.total as number) ?? 0,
    pagina: (cuerpo.pagina as number) ?? 1,
    porPagina: (cuerpo.por_pagina as number) ?? 24,
    paginas: (cuerpo.paginas as number) ?? 0,
  }
}

/** Productos destacados para la portada. Mismo endpoint, distinto filtro. */
export function listarDestacados(
  limite = 8,
  opciones?: OpcionesRequest,
): Promise<ResultadoPaginado<ProductoResumen>> {
  return listarProductos({ soloDestacados: true, porPagina: limite }, opciones)
}

export interface Producto extends ProductoResumen {
  descripcionLarga: string
  fechaActualizacion: string
  /** Los detalles llegan aplanados: campos de `detalles_digitales`, `detalles_fisicos` y `detalles_servicio`. */
  detallesDigitales: {
    stack: string | null
    licencia: string | null
    version: string | null
    ultimaActualizacion: string | null
    demoUrl: string | null
    formatoEntrega: string | null
  } | null
  detallesFisicos: { stock: number | null; envio: string | null; processingTime: string | null } | null
  detallesServicio: { modalidad: string | null; duracionEstimada: string | null } | null
  imagenes: { url: string; alt: string | null }[]
  /**
   * `true` cuando el pago tiene que pasar por la plataforma.
   *
   * La API lo manda explicito porque es lo que hace cumplible el 5%: en la
   * Regla A el comprador NO puede pagarle directo al autor. Si el frontend lo
   * calculara por su cuenta, bastaria una peticion manipulada para saltarselo.
   */
  requierePasarelaPlataforma: boolean
}

export async function obtenerProducto(
  slug: string,
  opciones?: OpcionesRequest,
): Promise<Producto> {
  const ruta = `/api/productos/${encodeURIComponent(slug)}`
  const cuerpo = await pedir(ruta, opciones)
  const f = objetoDe(cuerpo, 'producto', ruta)
  return {
    ...mapearResumen(f),
    descripcionLarga: String(f.descripcion_larga ?? ''),
    fechaActualizacion: String(f.actualizado_at ?? ''),
    detallesDigitales:
      f.stack || f.licencia
        ? {
            stack: (f.stack as string | null) ?? null,
            licencia: (f.licencia as string | null) ?? null,
            version: (f.version as string | null) ?? null,
            ultimaActualizacion: (f.ultima_actualizacion as string | null) ?? null,
            demoUrl: (f.demo_url as string | null) ?? null,
            formatoEntrega: (f.formato_entrega as string | null) ?? null,
          }
        : null,
    detallesFisicos:
      f.stock !== null || f.envio
        ? {
            stock: (f.stock as number | null) ?? null,
            envio: (f.envio as string | null) ?? null,
            processingTime: (f.processing_time as string | null) ?? null,
          }
        : null,
    detallesServicio: f.modalidad
      ? {
          modalidad: (f.modalidad as string | null) ?? null,
          duracionEstimada: (f.duracion_estimada as string | null) ?? null,
        }
      : null,
    imagenes: (cuerpo.imagenes as { url: string; alt: string | null }[] | undefined) ?? [],
    requierePasarelaPlataforma: f.requiere_pasarela_plataforma === true,
  }
}

/** Categoria con el conteo real de productos visibles. */
export interface CategoriaConConteo {
  nombre: string
  productos: number
  precioMinimo: number
  precioMaximo: number
}

export async function listarCategorias(
  opciones?: OpcionesRequest,
): Promise<CategoriaConConteo[]> {
  const ruta = '/api/categorias'
  const cuerpo = await pedir(ruta, opciones)
  return listaDe(cuerpo, 'categorias', ruta).map((f) => ({
    nombre: String(f.nombre),
    productos: f.productos as number,
    precioMinimo: f.precio_minimo as number,
    precioMaximo: f.precio_maximo as number,
  }))
}

/* -------------------------------------------------------------------------
 * Vendedor
 * ---------------------------------------------------------------------- */

export interface VendedorResumen {
  slug: string
  nombre: string
  nombreComercial: string
  descripcion: string
  avatarUrl: string | null
  ubicacion: string | null
  verificado: boolean
  productosPublicados: number
}

export async function listarVendedores(
  opciones?: OpcionesRequest,
): Promise<ResultadoPaginado<VendedorResumen>> {
  const ruta = '/api/vendedores'
  const cuerpo = await pedir(ruta, opciones)
  return {
    items: listaDe(cuerpo, 'vendedores', ruta).map((f) => ({
      slug: String(f.slug),
      nombre: String(f.nombre),
      nombreComercial: String(f.nombre_comercial),
      descripcion: String(f.descripcion ?? ''),
      avatarUrl: (f.avatar_url as string | null) ?? null,
      ubicacion: (f.ubicacion as string | null) ?? null,
      verificado: f.verificado === 1,
      productosPublicados: f.productos_publicados as number,
    })),
    total: (cuerpo.total as number) ?? 0,
    pagina: (cuerpo.pagina as number) ?? 1,
    porPagina: (cuerpo.por_pagina as number) ?? 24,
    paginas: 0,
  }
}

export interface Vendedor extends VendedorResumen {
  creadoAt: string
  productos: ProductoResumen[]
}

export async function obtenerVendedor(
  slug: string,
  opciones?: OpcionesRequest,
): Promise<Vendedor> {
  const ruta = `/api/vendedores/${encodeURIComponent(slug)}`
  const cuerpo = await pedir(ruta, opciones)
  const f = objetoDe(cuerpo, 'vendedor', ruta)
  const productos = (cuerpo.productos as Registro[] | undefined) ?? []
  return {
    slug: String(f.slug),
    nombre: String(f.nombre),
    nombreComercial: String(f.nombre_comercial),
    descripcion: String(f.descripcion ?? ''),
    avatarUrl: (f.avatar_url as string | null) ?? null,
    ubicacion: (f.ubicacion as string | null) ?? null,
    verificado: f.verificado === 1,
    productosPublicados: productos.length,
    creadoAt: String(f.creado_at ?? ''),
    productos: productos.map(mapearResumen),
  }
}

/* -------------------------------------------------------------------------
 * Paquetes de espacios fisicos
 * ---------------------------------------------------------------------- */

/**
 * Un paquete, con los precios ya separados por moneda.
 *
 * La API los manda como tres columnas (`precio_cup`, `precio_usd`,
 * `precio_eur`) porque asi estan en la base. El dominio los quiere en un objeto
 * `precios` para que un componente haga `precios[monedaElegida]` sin conocer la
 * base. La conversion va al entrar, no al pintar: en el `.astro` cada tarjeta
 * repetiria el fallback, y un forgot ahi solo se ve en produccion.
 *
 * `id` NO esta, y no es un olvido: la API no lo devuelve porque las tarjetas de
 * paquete no lo necesitan y el nombre de la categoria ya lo identifica. Cuando
 * haga falta el id, se agrega a la consulta del router, no se inventa aqui.
 */
export interface PaqueteEspacios {
  nombre: string
  categoria: string
  slots: number
  vigenciaDias: number
  precios: Record<'CUP' | 'USD' | 'EUR', number>
  precioConfigurable: boolean
  caracteristicas: string[]
}

export async function listarPaquetes(opciones?: OpcionesRequest): Promise<PaqueteEspacios[]> {
  const ruta = '/api/paquetes'
  const cuerpo = await pedir(ruta, opciones)
  return listaDe(cuerpo, 'paquetes', ruta).map((f) => ({
    nombre: String(f.nombre),
    categoria: String(f.categoria),
    slots: f.slots as number,
    vigenciaDias: f.vigencia_dias as number,
    precios: {
      CUP: (f.precio_cup as number) ?? 0,
      USD: (f.precio_usd as number) ?? 0,
      EUR: (f.precio_eur as number) ?? 0,
    },
    precioConfigurable: f.precio_configurable === 1,
    // La columna `caracteristicas` es TEXT con un JSON adentro, porque SQLite no
    // tiene tipo array. Si alguien inserta texto plano, el `JSON.parse` revienta
    // y el paquete entero no se dibuja, asi que se degrada a lista vacia en vez
    // de romper la pagina entera.
    caracteristicas: leerCaracteristicas(f.caracteristicas),
  }))
}

function leerCaracteristicas(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String)
  if (typeof valor !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(valor)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/* -------------------------------------------------------------------------
 * Lo que la API todavia NO tiene
 *
 * Estas funciones NO hacen un fetch. Lanzan `PendienteDeImplementar` con el
 * endpoint que les falta, y las vistas muestran un estado vacio o un aviso.
 *
 * La razon de escribirlas igual: el error dice exactamente que endpoint crear y
 * en que archivo. Un "no implementado" a secas obliga a adivinar.
 *
 * IMPORTANTE: no devuelven una lista vacia. Devolver `[]` seria mostrar "no
 * tienes productos" cuando la verdad es "la API no soporta esto todavia", y son
 * dos cosas que el usuario no puede distinguir. Aqui la honestidad cuesta mas
 * que la comodidad, y es la eleccion correcta.
 * ---------------------------------------------------------------------- */

export function listarProductosDeVendedor(
  slug: string,
  _opciones?: OpcionesRequest,
): Promise<ProductoResumen[]> {
  return Promise.reject(
    new PendienteDeImplementar('listarProductosDeVendedor', `/api/vendedores/${slug}/productos`),
  )
}

export function listarRelacionados(_slug: string, _limite = 4): Promise<ProductoResumen[]> {
  return Promise.reject(
    new PendienteDeImplementar('listarRelacionados', '/api/productos/{slug}/relacionados'),
  )
}

export function listarSuscripciones(
  vendedorId: string,
  _opciones?: OpcionesRequest,
): Promise<SuscripcionEspacios[]> {
  return Promise.reject(
    new PendienteDeImplementar('listarSuscripciones', `/api/vendedores/${vendedorId}/suscripciones`),
  )
}

export function obtenerDisponibilidadSlots(
  vendedorId: string,
  _opciones?: OpcionesRequest,
): Promise<{
  slotsTotales: number
  slotsUsados: number
  slotsLibres: number
  puedePublicar: boolean
  advertencias: string[]
}> {
  return Promise.reject(
    new PendienteDeImplementar('obtenerDisponibilidadSlots', `/api/vendedores/${vendedorId}/slots`),
  )
}

export function listarTransacciones(
  _filtros: { estado?: Transaccion['estado']; pagina?: number; porPagina?: number } = {},
  _opciones?: OpcionesRequest,
): Promise<ResultadoPaginado<Transaccion>> {
  return Promise.reject(new PendienteDeImplementar('listarTransacciones', '/api/transacciones'))
}

export function obtenerTransaccion(
  referencia: string,
  _opciones?: OpcionesRequest,
): Promise<Transaccion> {
  return Promise.reject(
    new PendienteDeImplementar('obtenerTransaccion', `/api/transacciones/${referencia}`),
  )
}

export function obtenerSesionActual(_opciones?: OpcionesRequest): Promise<Usuario | null> {
  return Promise.reject(new PendienteDeImplementar('obtenerSesionActual', '/api/sesion'))
}

export function listarUsuarios(_opciones?: OpcionesRequest): Promise<Usuario[]> {
  return Promise.reject(new PendienteDeImplementar('listarUsuarios', '/api/usuarios'))
}

/* -------------------------------------------------------------------------
 * Constantes de dominio
 *
 * Estas NO vienen del backend a proposito. Son las 3 Reglas de Oro del
 * Documento Maestro: son la identidad comercial del marketplace y no pueden
 * cambiar por una llamada remota sin que el sitio quede incoherente. El Owner si
 * puede alterarlas, pero eso se hace en el panel, persistido.
 * ---------------------------------------------------------------------- */

export { COMISIONES, repartir, reglaDeOro }
export type { SuscripcionEspacios, Transaccion, Usuario, Categoria, Moneda }
