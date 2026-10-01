/**
 * Capa de acceso a datos.
 *
 * ============================================================================
 *  ESTA ES LA FRONTERA DEL PROYECTO — LEER ANTES DE TOCAR NADA
 * ============================================================================
 *
 * Ninguna pagina importa datos directamente. Todas pasan por este modulo.
 * Eso permite cambiar de proveedor (Cloudflare D1, REST, GraphQL) sin tocar
 * ni una sola vista.
 *
 * HOY: este archivo lanza errores. No hay datos ficticios en ninguna parte
 * del proyecto, por decision propia. Si invento productos y luego conecto la
 * API real, vas a ver pantallas que "funcionan" con informacion falsa y no
 * vas a saber cuales datos son reales y cuales fabrique yo.
 *
 * CUANDO TENGAS EL BACKEND: implementa las funciones de `ApiError` hacia
 * abajo y las paginas empezaran a mostrar contenido sin tocarlas.
 *
 * Variables de entorno esperadas (ver .env.example):
 *   PUBLIC_API_BASE       -> base del backend, ej: https://api.qbaswing.com
 *   PUBLIC_CF_WORKER_URL  -> URL del Worker de Cloudflare, si aplica
 *
 * `PUBLIC_` es intencional: Astro las expone al cliente. Si alguna vez el
 * secreto NO debe salir al navegador, quitale el prefijo `PUBLIC_` y queda
 * accesible solo en el servidor mediante `import.meta.env`.
 * ============================================================================
 */

import type {
  Categoria,
  Moneda,
  PaqueteEspacios,
  Producto,
  SuscripcionEspacios,
  Transaccion,
  Usuario,
  Vendedor,
} from './tipos'
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
      `\`${operacion}\` no tiene backend. Implementala en src/lib/api.ts ` +
        `llamando a ${endpointSugerido}.`,
    )
    this.name = 'PendienteDeImplementar'
    this.endpoint = endpointSugerido
  }
}

/* -------------------------------------------------------------------------
 * Transporte
 * ---------------------------------------------------------------------- */

interface OpcionesRequest {
  signal?: AbortSignal
  headers?: Record<string, string>
}

/**
 * GET contra el backend. Lanza `PendienteDeImplementar` si no hay API
 * configurada, de modo que la vista pueda distinguir "vacio" de "roto".
 */
async function pedir<T>(ruta: string, opciones: OpcionesRequest = {}): Promise<T> {
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

  return (await respuesta.json()) as T
}

/* -------------------------------------------------------------------------
 * Producto
 * ---------------------------------------------------------------------- */

export interface FiltrosCatalogo {
  categoria?: Categoria
  tipo?: Producto['tipo']
  /** Regla de Oro: 'A' (digital externo), 'B' (digital propio), 'C' (fisico). */
  regla?: Producto['regla']
  vendedorId?: string
  /** Precio minimo en la moneda indicada. */
  precioMin?: number
  precioMax?: number
  moneda?: Moneda
  busqueda?: string
  soloDestacados?: boolean
  pagina?: number
  porPagina?: number
}

export interface ResultadoPaginado<T> {
  items: T[]
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
}

function serializarFiltros(f: FiltrosCatalogo): string {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(f)) {
    if (valor === undefined || valor === '') continue
    params.set(clave, String(valor))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

export function listarProductos(
  filtros: FiltrosCatalogo = {},
  opciones?: OpcionesRequest,
): Promise<Producto[]> {
  return pedir<Producto[]>(`/api/productos${serializarFiltros(filtros)}`, opciones)
}

export function obtenerProducto(
  slug: string,
  opciones?: OpcionesRequest,
): Promise<Producto> {
  return pedir<Producto>(`/api/productos/${encodeURIComponent(slug)}`, opciones)
}

export function listarCategorias(opciones?: OpcionesRequest): Promise<Categoria[]> {
  return pedir<Categoria[]>('/api/categorias', opciones)
}

export function listarDestacados(
  limite = 8,
  opciones?: OpcionesRequest,
): Promise<Producto[]> {
  return pedir<Producto[]>(`/api/productos?destacados=true&limite=${limite}`, opciones)
}

/** Productos del mismo vendedor y tipo, para la seccion "relacionados". */
export function listarRelacionados(
  productoId: string,
  limite = 4,
  opciones?: OpcionesRequest,
): Promise<Producto[]> {
  return pedir<Producto[]>(
    `/api/productos/${encodeURIComponent(productoId)}/relacionados?limite=${limite}`,
    opciones,
  )
}

/* -------------------------------------------------------------------------
 * Vendedor
 * ---------------------------------------------------------------------- */

export function listarVendedores(
  opciones?: OpcionesRequest,
): Promise<Vendedor[]> {
  return pedir<Vendedor[]>('/api/vendedores', opciones)
}

export function obtenerVendedor(
  slug: string,
  opciones?: OpcionesRequest,
): Promise<Vendedor> {
  return pedir<Vendedor>(`/api/vendedores/${encodeURIComponent(slug)}`, opciones)
}

/** Productos publicados por un vendedor. */
export function listarProductosDeVendedor(
  slug: string,
  opciones?: OpcionesRequest,
): Promise<Producto[]> {
  return pedir<Producto[]>(`/api/vendedores/${encodeURIComponent(slug)}/productos`, opciones)
}

/* -------------------------------------------------------------------------
 * Paquetes de espacios fisicos
 * ---------------------------------------------------------------------- */

export function listarPaquetes(opciones?: OpcionesRequest): Promise<PaqueteEspacios[]> {
  return pedir<PaqueteEspacios[]>('/api/paquetes', opciones)
}

export function listarSuscripciones(
  vendedorId: string,
  opciones?: OpcionesRequest,
): Promise<SuscripcionEspacios[]> {
  return pedir<SuscripcionEspacios[]>(
    `/api/vendedores/${encodeURIComponent(vendedorId)}/suscripciones`,
    opciones,
  )
}

/**
 * Slots disponibles de un vendedor.
 *
 * `slotsUsados` cuenta publicaciones ACTIVAS, no ventas: al vender o
 * retirar un producto, su slot se libera automaticamente (Documento Maestro,
 * seccion 2). Esta funcion no calcula nada — la regla vive en el backend
 * porque en D1 debe ser una transaccion atomica.
 */
export function obtenerDisponibilidadSlots(
  vendedorId: string,
  opciones?: OpcionesRequest,
): Promise<{
  slotsTotales: number
  slotsUsados: number
  slotsLibres: number
  puedePublicar: boolean
  advertencias: string[]
}> {
  return pedir(
    `/api/vendedores/${encodeURIComponent(vendedorId)}/slots`,
    opciones,
  )
}

/* -------------------------------------------------------------------------
 * Transacciones
 * ---------------------------------------------------------------------- */

export function listarTransacciones(
  filtros: { estado?: Transaccion['estado']; pagina?: number; porPagina?: number } = {},
  opciones?: OpcionesRequest,
): Promise<ResultadoPaginado<Transaccion>> {
  return pedir(`/api/transacciones${serializarFiltros(filtros)}`, opciones)
}

export function obtenerTransaccion(
  referencia: string,
  opciones?: OpcionesRequest,
): Promise<Transaccion> {
  return pedir<Transaccion>(
    `/api/transacciones/${encodeURIComponent(referencia)}`,
    opciones,
  )
}

/* -------------------------------------------------------------------------
 * Usuario / sesion
 * ---------------------------------------------------------------------- */

export function obtenerSesionActual(
  opciones?: OpcionesRequest,
): Promise<Usuario | null> {
  return pedir<Usuario | null>('/api/sesion', opciones)
}

export function listarUsuarios(opciones?: OpcionesRequest): Promise<Usuario[]> {
  return pedir<Usuario[]>('/api/usuarios', opciones)
}

/* -------------------------------------------------------------------------
 * Constantes de dominio
 *
 * Estas NO vienen del backend a proposito. Son las 3 Reglas de Oro del
 * Documento Maestro: son la identidad comercial del marketplace y no
 * pueden cambiar por una llamada remota sin que el sitio quede incoherente.
 * El Owner si puede alterarlas, pero eso se hace en el panel, persistido.
 * ---------------------------------------------------------------------- */

export { COMISIONES, repartir, reglaDeOro }
export type { Producto, Vendedor, PaqueteEspacios, SuscripcionEspacios, Transaccion, Usuario, Categoria, Moneda }
