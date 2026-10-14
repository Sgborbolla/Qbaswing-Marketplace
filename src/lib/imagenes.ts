/**
 * Imagenes de producto: formato, tamano y claves.
 *
 * ============================================================================
 *  POR QUE ESTE ARCHIVO ES COMPARTIDO Y NO VIVE EN EL ROUTER
 * ============================================================================
 * Lo usan DOS routers: el del panel (subir y borrar) y el publico que sirve la
 * imagen. Si cada uno tuviera su copia de "que extensiones valen" y de "como se
 * saca la clave de una URL", el dia que se anada `avif` habria que acordarse de
 * los dos sitios, y el que se olvide no da error: sube una imagen que despues no
 * se puede servir, o deja de borrarla y paga el espacio para siempre.
 *
 * ============================================================================
 *  POR QUE EL FORMATO SE DECIDE POR EXTENSION Y NO POR `File.type`
 * ============================================================================
 * `File.type` lo pone el navegador y puede venir vacio, o mentir: renombrar un
 * `.exe` a `.jpg` no cambia lo que manda el cliente, pero cambiar la extension
 * tampoco es una defensa seria. Lo que SI hace falta es no guardar en KV un
 * objeto con una clave sin extension, porque entonces el navegador no sabe con
 * que `Content-Type` pintarlo y lo descarga como binario.
 *
 * Por eso la extension manda: es la que queda en la clave, y de la clave sale el
 * `Content-Type` al servir. El tope de tamano (ver `MAX_BYTES_IMAGEN`) es lo que
 * evita que esto sea un vertedero de archivos grandes.
 *
 * ============================================================================
 *  LAS IMAGENES NO SON EL ARCHIVO MAESTRO
 * ============================================================================
 * El archivo maestro (el entregable digital) se sube con `almacenamiento-kv.ts`
 * y solo acepta zip/rar/7z/pdf/tar.gz. Las imagenes van aparte, con sus propios
 * formatos y su propio tope, y con una clave que empieza por `img/`. Mezclar los
 * dos mundos haria que una imagen subida por el panel de productos pasara por la
 * validacion del maestro y se rechazara por no ser un .zip.
 */

/** Extensiones admitidas y su `Content-Type`. La clave es la extension en minusculas. */
export const FORMATOS_IMAGEN: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

/**
 * Tope de una imagen: 2 MiB.
 *
 * No es el limite de KV (25 MiB). Es lo que se comprime en el navegador antes de
 * subir: una foto de movil de 2 MiB ya se ve bien en una ficha, y dejar subir 25
 * MiB por imagen convertiria la galeria de un producto en decenas de megas que
 * cada visita del catalogo tiene que descargar. El que quiera el original lo pone
 * en el archivo maestro, no en la galeria.
 */
export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024

/** Prefijo de toda clave de imagen. Lo que NO empieza por esto no se sirve. */
export const PREFIJO_IMAGEN = 'img/'

/**
 * La extension valida de un nombre de archivo, o `null`.
 *
 * Se queda con el ULTIMO punto (`foto.algo.jpg` es `jpg`) y en minusculas, para
 * que `FOTO.JPG` y `foto.jpg` acaben en la misma clave.
 */
export function extensionDeImagen(nombre: string): string | null {
  const punto = nombre.lastIndexOf('.')
  if (punto < 0) return null
  const ext = nombre.slice(punto + 1).toLowerCase()
  return FORMATOS_IMAGEN[ext] ? ext : null
}

/**
 * El `Content-Type` de una clave, por su extension. `null` si no es una imagen
 * conocida.
 *
 * Se deriva de la CLAVE y no de los metadatos del objeto de KV a proposito: al
 * servir una imagen el camino mas rapido es leer el valor y devolverlo con su
 * tipo. Si el tipo viviera solo en `metadata`, servirla obligaria a leer tambien
 * los metadatos, que es otra operacion.
 */
export function contentTypeDeImagen(clave: string): string | null {
  const ext = extensionDeImagen(clave)
  return ext ? FORMATOS_IMAGEN[ext] : null
}

/**
 * Arma la clave de una imagen nueva.
 *
 * Forma: `img/<vendedorId>/<productoId>/<uuid>.<ext>`.
 *
 * El `uuid` y no el nombre original: dos personas subiendo `foto.jpg` al mismo
 * producto chocarian, y en KV `put` con la misma clave PISA el valor anterior
 * sin avisar. Con un nombre aleatorio cada subida es un objeto nuevo, y borrar
 * una imagen no puede llevarse por delante otra que comparte nombre.
 *
 * El prefijo lleva el vendedor y el producto para poder borrar por prefijo
 * (`list({ prefix })`) si algun dia hace falta barrer las imagenes de un
 * producto sin consultar la base.
 */
export function claveDeImagen(vendedorId: number, productoId: number, nombre: string): string {
  const ext = extensionDeImagen(nombre) ?? 'jpg'
  return `${PREFIJO_IMAGEN}${vendedorId}/${productoId}/${crypto.randomUUID()}.${ext}`
}

/** `true` si la clave es de una imagen y por tanto se puede servir en publico. */
export function esClaveDeImagen(clave: string): boolean {
  return clave.startsWith(PREFIJO_IMAGEN) && contentTypeDeImagen(clave) !== null
}

/**
 * La clave que hay escondida en una URL guardada en `producto_imagenes.url`.
 *
 * La columna guarda la URL ABSOLUTA (`https://api.../api/imagenes/img/...`) para
 * que el `<img src>` funcione desde el sitio estatico, que vive en otro origen.
 * Para borrar la imagen hay que recuperar la clave, y el unico sitio del que
 * sale es la parte que va despues de `/api/imagenes/`.
 *
 * Se comprueba que empiece por `img/`: una URL que no sea una imagen nuestra no
 * se toca. Sin esa comprobacion, borrar un producto podria intentar borrar una
 * clave de otra cosa.
 */
export function claveDesdeUrlImagen(url: string): string | null {
  const marca = '/api/imagenes/'
  const pos = url.indexOf(marca)
  if (pos < 0) return null
  const clave = url.slice(pos + marca.length)
  return esClaveDeImagen(clave) ? clave : null
}

/** La URL publica absoluta de una clave, a partir de la base de la API. */
export function urlPublicaDeImagen(base: string, clave: string): string {
  return `${base.replace(/\/+$/, '')}/api/imagenes/${clave}`
}
