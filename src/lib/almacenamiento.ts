/**
 * Almacenamiento de archivos.
 *
 * ============================================================================
 *  POR QUE EXISTE ESTA CAPA
 * ============================================================================
 * El proyecto se despliega en Cloudflare y se.versiona en GitHub. Eso deja un
 * solo proveedor de almacenamiento posible hoy, y tiene un techo:
 *
 *   Workers KV   1 GB en total, 25 MiB por valor   (gratis, SIN tarjeta)
 *   R2           10 GB, sin limite por archivo    (gratis, PERO pide tarjeta)
 *
 * Como R2 no se puede activar todavia, un producto de 80 MB no tiene donde
 * vivir en KV. En vez de inventar una limitacion silenciosa, el sistema declara
 * el limite y ofrece tres rutas, en este orden de preferencia:
 *
 *   1. KV        el archivo entra completo        (<= 25 MiB)
 *   2. FRACCIONADO  el archivo se parte en trozos y el navegador recompone
 *   3. EXTERNO   el vendedor aloja el archivo (MEGA, Drive) y la plataforma
 *                registra el enlace con su hash
 *
 * La ruta 2 existe para no perder ventas por un tope arbitrario, pero no es
 * igual de buena que la 1: el comprador ve "Parte 1 de 4" y tiene que esperar
 * a que bajen todas. Por eso es la segunda opcion, no la primera.
 *
 * ============================================================================
 *  POR QUE D1 NO APARECE COMO OPCION
 * ============================================================================
 * D1 tiene un tope de 2 MB por fila que es ABSOLUTO: no se sube con plan
 * pagado. Ademas el plan gratis tops en 500 MB por base. Un catalogo de
 * productos cabe de sobra en 500 MB; los archivos, jamas.
 *
 * ============================================================================
 *  EL CONTRATO NO DEPENDE DEL PROVEEDOR
 * ============================================================================
 * Este archivo define QUE se puede hacer, no COMO. D1 guarda la clave, el hash
 * y los bytes; nunca una URL. Cuando R2 se active, se implementa `subir()` con
 * el binding de R2 y no se toca ni el esquema ni las paginas.
 */

/* ===========================================================================
 * Limites
 * ======================================================================== */

/** Tope de un valor en Workers KV. Es del servicio, no configurable. */
export const MAX_BYTES_KV = 25 * 1024 * 1024 // 25 MiB

/**
 * Partes en que se divide un archivo que no entra en KV.
 *
 * 4 partes de 25 MiB = 100 MiB. Es el maximo que cubre la ruta 2 con margen.
 * Para archivos mayores, la ruta 3 (externo) es la unica salida.
 */
export const MAX_PARTES = 4

/** Capacidad total de la ruta fractionada: 4 x 25 MiB. */
export const MAX_BYTES_FRACCIONADO = MAX_BYTES_KV * MAX_PARTES

/**
 * Formatos que se aceptan como descarga.
 *
 * NOTA DE SEGURIDAD: `.exe`, `.dll`, `.scr` y `.bat` NO estan en la lista, a
 * proposito. Un marketplace que aloja ejecutables descargados por desconocidos es
 * el vector clasico de malware, y un navegador puede marcar el sitio entero
 * como peligroso. Si el negocio necesita distribuir software, la decision es
 * del Owner y se documenta aparte; no se habilita por defecto.
 */
export const FORMATOS_PERMITIDOS: Record<string, string> = {
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  pdf: 'application/pdf',
  'tar.gz': 'application/gzip',
}

/* ===========================================================================
 * Resultado de subir
 * ======================================================================== */

export type ModoAlmacenamiento = 'kv' | 'fraccionado' | 'externo'

export interface ArchivoSubido {
  /** Clave en el almacen. `null` en la ruta externa: no hay archivo nuestro. */
  clave: string | null
  /** Hash SHA-256 en hexadecimal, 64 caracteres. Siempre presente. */
  hash: string
  bytes: number
  contentType: string
  nombreMostrado: string
  modo: ModoAlmacenamiento
  /**
   * Solo en la ruta 'fraccionado': las claves de cada parte, en orden.
   * El navegador las descarga en paralelo y las concatena.
   */
  partes?: string[]
  /** Solo en la ruta 'externo': el enlace que aporto el vendedor. */
  urlExterna?: string
}

export interface OpcionesSubida {
  productoId: string
  vendedorId: string
  archivo: File
  /** Tipo del archivo, igual que la columna `tipo` de `db/schema.sql`. */
  tipo: 'descarga' | 'muestra' | 'checksum' | 'documentacion'
}

/* ===========================================================================
 * Interfaz
 * ======================================================================== */

/**
 * Lo que un proveedor de almacenamiento debe cumplir. Hoy hay una sola
 * implementacion (`kv.ts`). Cuando haya R2, se agrega `r2.ts` y se elige con
 * una variable de entorno, sin tocar a quien llama.
 */
export interface Almacenamiento {
  /**
   * Sube un archivo. Decide solo que ruta usar segun el tamano.
   * Lanza si el formato no esta permitido o si el archivo excede
   * `MAX_BYTES_FRACCIONADO`.
   */
  subir(opciones: OpcionesSubida): Promise<ArchivoSubido>

  /** Borra un archivo y todas sus partes. Idempotente. */
  borrar(clave: string, partes?: string[]): Promise<void>

  /**
   * URL de descarga temporal, con expiracion.
   *
   * Nunca se guarda la URL en la base: se genera en el momento de servir.
   * Asi el enlace caduca solo y no queda en un log ni en un historial.
   */
  urlDescargaTemporal(clave: string, expiraEnSegundos: number): Promise<string>
}

/* ===========================================================================
 * Utilidades
 * ======================================================================== */

/**
 * Clave en el almacen.
 *
 * El prefijo por vendedor permite borrar todo lo de un vendedor con una
 * operacion de prefijo cuando se va de la plataforma, sin consultar la base.
 * El UUID evita colisiones entre dos vendedores con el mismo nombre de archivo
 * y evita que el nombre original (que controla el usuario) termine en la URL.
 */
export function claveDeArchivo(
  vendedorId: string,
  productoId: string,
  nombre: string,
  indice = 0,
): string {
  const uuid = crypto.randomUUID()
  const sufijo = indice > 0 ? `.p${indice}` : ''
  return `productos/${vendedorId}/${productoId}/${uuid}-${nombre}${sufijo}`
}

/** `true` si la extension del nombre esta en FORMATOS_PERMITIDOS. */
export function formatoPermitido(nombre: string): boolean {
  const minuscula = nombre.toLowerCase()
  return Object.keys(FORMATOS_PERMITIDOS).some((ext) => minuscula.endsWith(`.${ext}`))
}

/** Detecta el formato por extension y devuelve su MIME, o `null` si no aplica. */
export function contentTypeDe(nombre: string): string | null {
  const minuscula = nombre.toLowerCase()
  const ext = Object.keys(FORMATOS_PERMITIDOS).find((e) => minuscula.endsWith(`.${e}`))
  return ext ? FORMATOS_PERMITIDOS[ext] : null
}

/**
 * SHA-256 en hexadecimal, para integridad.
 *
 * El Documento Maestro lo exige. Sirve para dos cosas: que el comprador
 * detecte un archivo corrupto, y para que el vendedor suba el mismo archivo en
 * dos productos sin duplicar el consumo de espacio.
 */
export async function hashSha256(archivo: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', archivo)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Que ruta de almacenamiento corresponde a un archivo de cierto tamano.
 *
 * Es una funcion pura y sin efectos, para que la UI pueda explicar la
 * consecuencia ANTES de que el vendedor pulse "subir", y no despues con un
 * error.
 */
export function rutaParaTamano(bytes: number): ModoAlmacenamiento {
  if (bytes <= MAX_BYTES_KV) return 'kv'
  if (bytes <= MAX_BYTES_FRACCIONADO) return 'fraccionado'
  // Por encima ya no hay ruta propia posible: hay que usar enlace externo.
  return 'externo'
}
