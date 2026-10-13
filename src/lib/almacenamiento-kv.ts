/**
 * Implementacion de `Almacenamiento` sobre Workers KV.
 *
 * ============================================================================
 *  QUE ES
 * ============================================================================
 * Es la primera implementacion concreta de la interfaz `Almacenamiento`
 * (`src/lib/almacenamiento.ts`). Guarda el archivo entero en el binding KV
 * `ARCHIVOS`, respetando el tope de 25 MiB por valor. El fraccionamiento y los
 * proveedores externos (Drive, Pixeldrain, GoFile) no pasan por aqui: el
 * fraccionamiento esta pendiente y los externos los maneja el panel contra la
 * API de cada proveedor.
 *
 * ============================================================================
 *  POR QUE NO TOCA `Almacenamiento` MAS DE LO NECESARIO
 * ============================================================================
 * El contrato vive en `almacenamiento.ts`. Aqui solo se implementa. Si mañana
 * se activa R2, se escribe `r2.ts` con la misma forma y quien llama no cambia
 * ni una linea.
 *
 * ============================================================================
 *  POR QUE SE DECLARA UN KV MINIMO Y NO SE USA `KVNamespace` DIRECTO
 * ============================================================================
 * `src/lib` lo compila tambien el tsconfig del sitio (Astro), que no conoce los
 * tipos globales de Cloudflare. Declarar aqui el trozo de KV que se usa evita
 * arrastrar `@cloudflare/workers-types` a todo el frontend. El binding real
 * (`KVNamespace`) cumple esta forma sin conversion.
 */

import {
  claveDeArchivo,
  contentTypeDe,
  formatoPermitido,
  hashSha256,
  MAX_BYTES_KV,
  type Almacenamiento,
  type ArchivoSubido,
  type OpcionesSubida,
} from './almacenamiento'

/**
 * El trozo de Workers KV que se usa. Deliberadamente minimo.
 *
 * `get` con `'arrayBuffer'` devuelve `null` si la clave no existe; nunca lanza
 * por ausencia. `list` existe para poder borrar por prefijo (por ejemplo, todas
 * las imagenes de un producto) sin consultar la base.
 */
export interface AlmacenKV {
  get(clave: string, tipo: 'arrayBuffer'): Promise<ArrayBuffer | null>
  get(clave: string, tipo: 'text'): Promise<string | null>
  put(
    clave: string,
    valor: ArrayBuffer | ArrayBufferView | string,
    opciones?: { metadata?: unknown; expirationTtl?: number },
  ): Promise<void>
  delete(clave: string): Promise<void>
  list(opciones?: {
    prefix?: string
    limit?: number
    cursor?: string
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
}

/** Codigos de fallo propios del almacenamiento, para traducirlos en el router. */
export type CodigoAlmacenamiento = 'formato-no-permitido' | 'demasiado-grande' | 'sin-url-temporal'

export class ErrorAlmacenamiento extends Error {
  readonly codigo: CodigoAlmacenamiento

  constructor(codigo: CodigoAlmacenamiento, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorAlmacenamiento'
    this.codigo = codigo
  }
}

/**
 * Crea el almacenamiento KV a partir del binding.
 *
 * Es una funcion y no una clase con estado por la misma razon que la interfaz:
 * el binding entra por parametro y el objeto no guarda nada mas.
 */
export function crearAlmacenamientoKV(kv: AlmacenKV): Almacenamiento {
  return {
    /**
     * Sube un archivo entero a KV.
     *
     * Valida formato y tamano ANTES de leer los bytes: leer un archivo de 300 MB
     * para despues rechazarlo seria gastar memoria del Worker (128 MiB de tope)
     * para nada.
     */
    async subir(opciones: OpcionesSubida): Promise<ArchivoSubido> {
      const { vendedorId, productoId, archivo } = opciones

      if (!formatoPermitido(archivo.name)) {
        throw new ErrorAlmacenamiento(
          'formato-no-permitido',
          'Solo se aceptan .zip, .rar, .7z, .pdf y .tar.gz.',
        )
      }

      if (archivo.size > MAX_BYTES_KV) {
        const mb = Math.ceil(archivo.size / (1024 * 1024))
        throw new ErrorAlmacenamiento(
          'demasiado-grande',
          `El archivo pesa ${mb} MB y KV admite ${Math.floor(MAX_BYTES_KV / (1024 * 1024))} MB como maximo. Para archivos mayores usa Drive, Pixeldrain o GoFile.`,
        )
      }

      const contenido = await archivo.arrayBuffer()
      const hash = await hashSha256(contenido)
      const contentType =
        archivo.type || contentTypeDe(archivo.name) || 'application/octet-stream'
      const clave = claveDeArchivo(vendedorId, productoId, archivo.name)

      // Los metadatos no son decorativos: permiten servir el archivo sin volver
      // a leer la fila de la base si algun dia hiciera falta.
      await kv.put(clave, contenido, {
        metadata: { nombre: archivo.name, contentType, bytes: archivo.size, hash },
      })

      return {
        clave,
        hash,
        bytes: archivo.size,
        contentType,
        nombreMostrado: archivo.name,
        modo: 'kv',
      }
    },

    /** Borra el valor. Idempotente: borrar algo que no existe no es un error. */
    async borrar(clave: string): Promise<void> {
      if (clave) await kv.delete(clave)
    },

    /**
     * KV no emite URLs firmadas.
     *
     * La descarga autorizada se sirve por streaming desde el propio Worker
     * (`servirDesdeMaestro`), asi que una URL temporal no tendria donde
     * apuntar. Se falla explicitamente en vez de devolver una URL falsa que
     * alguien pudiera guardar en la base.
     */
    async urlDescargaTemporal(): Promise<string> {
      throw new ErrorAlmacenamiento(
        'sin-url-temporal',
        'KV no emite URLs temporales: la descarga se sirve por streaming autorizado.',
      )
    },
  }
}
