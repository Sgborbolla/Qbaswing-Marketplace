/**
 * Entrega de archivos: solo quien compro.
 *
 * ============================================================================
 *  EL MODELO
 * ============================================================================
 * Es lo que hacen Whop, Shopify y Gumroad, y la razon por la que un marketplace
 * de software puede cobrar: **el archivo nunca es publico**. No hay una URL que
 * exista antes de la compra. La secuencia es:
 *
 *   1. El comprador paga. La pasarela confirma (webhook).
 *   2. La fila aparece en `biblioteca`, con su `transaccion_id`.
 *   3. El comprador pulsa "Descargar".
 *   4. El servidor comprueba que ESA compra existe y esta pagada.
 *   5. Solo entonces genera un enlace que caduca.
 *
 * El enlace expira (por defecto 5 minutos). No es capricho: un enlace de
 * descarga permanente es un enlace que se filtra por email, chat o captura de
 * pantalla, y a las dos semanas cualquiera que lo tenga tiene el producto.
 * Caducando, la ventana de comparticion es corta y la compra sigue siendo la
 * unica forma de obtener un enlace nuevo.
 *
 * ============================================================================
 *  QUE SE PERSISTE Y QUE NO
 * ============================================================================
 * Se guarda: la clave del archivo, su hash, sus bytes. Nunca la URL.
 *
 * La URL se arma en el instante de servir. Consecuencia practica: no hay URLs
 * guardadas que se filtren en un backup, en un log, o en la base. Un snapshot
 * de la base no entrega productos.
 *
 * ============================================================================
 *  LOS TRES MODOS
 * ============================================================================
 *   kv          el archivo esta entero. Se sirve directo.
 *   fraccionado el archivo esta partido en trozos. El Worker los concatena al
 *               servir. El comprador no ve los trozos.
 *   externo     el archivo lo aloja el vendedor. Se sirve un redirect al
 *               enlace, y se avisa de que la entrega depende de un tercero.
 *
 * La idea de que el comprador NUNCA ve un "Parte 1 de 4" es deliberada: el
 * fraccionamiento es un detalle de transporte, no del producto. El Worker
 * recombine y entrega un unico archivo con el nombre correcto.
 */

/* ===========================================================================
 * Configuracion
 * ======================================================================== */

/**
 * Vida del enlace de descarga, en segundos.
 *
 * 300 s (5 min) es el punto medio: alcanza para empezar a descargar un archivo
 * grande sin que la sesion expire a mitad, y es corto para que un enlace
 * pegado en un grupo de WhatsApp no sirva dentro de un mes.
 */
export const EXPIRACION_ENLACE_SEG = 300

/** Nombre del header que lleva la firma del enlace. */
const HEADER_FIRMA = 'X-QBASWing-Firma'
/** Nombre de la cookie de sesion, si en el futuro se usa. Hoy no. */
const HEADER_TOKEN = 'X-QBASWing-Token'

/* ===========================================================================
 * Resultado
 * ======================================================================== */

export interface EntregaArchivo {
  /**
   * Donde esta el archivo. El Worker responde con redirect a esta URL si
   * `modo === 'externo'`, o sirve los bytes si es KV.
   */
  url: string
  modo: 'kv' | 'fraccionado' | 'externo'
  /** Segundos que le quedan al enlace. */
  expiraEn: number
  /** Hash que el comprador puede verificar tras descargar. */
  hash: string
  bytes: number
  /** Content-Type a enviar en la respuesta. */
  contentType: string
  /** Nombre con el que se descarga (`Content-Disposition`). */
  nombre: string
}

export class ErrorEntrega extends Error {
  readonly codigo:
    | 'no-autenticado'
    | 'sin-compra'
    | 'compra-pendiente'
    | 'expirado'
    | 'revocado'
    | 'archivo-no-disponible'

  constructor(codigo: ErrorEntrega['codigo'], mensaje: string) {
    super(mensaje)
    this.name = 'ErrorEntrega'
    this.codigo = codigo
  }
}

/* ===========================================================================
 * Consulta de compra — LA UNICA QUE AUTORIZA
 * ======================================================================== */

/**
 * Verifica que `usuarioId`Extent compro de verdad el producto `productoId`.
 *
 * Esta consulta es el corazon del negocio. Todo lo demas (KV, R2, enlaces) es
 * transporte; esto es lo que hace que cobrar tenga sentido.
 *
 * Se consulta `biblioteca` y se une con `transacciones` para exigir que el
 * pago este en estado 'verificado'. Un pago pendiente o rechazado NO da acceso,
 * aunque la fila exista en la biblioteca: es la diferencia entre "pago
 * iniciado" y "pago cobrado".
 *
 * `vitalicia` decide si la descarga caduca. El Documento Maestro ofrece
 * descarga perpetua para digitales, asi que un producto vitalicio con
 * `expira_at` en el pasado sigue dando acceso; uno no vitalicio, no.
 */
export interface CompraVerificada {
  ok: boolean
  motivo?: 'sin-compra' | 'compra-pendiente' | 'expirado'
  /** `true` si la compra da acceso perpetuo. */
  vitalicia: boolean
  /** Referencia visible de la transaccion, para soporte. */
  referencia?: string
}

/**
 * SQL de verificacion de compra.
 *
 * Se deja como constante y no como funcion para que sea visible y auditable:
 * la politica de acceso de un marketplace se lee mejor en un SELECT que
 * dispersa en condicionales de TypeScript.
 */
export const SQL_VERIFICAR_COMPRA = `
  SELECT b.vitalicia,
         b.expira_at,
         t.referencia,
         t.estado        AS estado_pago,
         t.comprobante_url,
         b.transaccion_id
    FROM biblioteca b
    JOIN transacciones t ON t.id = b.transaccion_id
   WHERE b.usuario_id = ?
     AND b.producto_id = ?
   ORDER BY b.creado_at DESC
   LIMIT 1
`

/**
 * Evalua una fila de la consulta anterior.
 *
 * Separada del SQL para que la regla se pueda probar sin base de datos, y
 * sobre todo para que quede explicita: cada motivo de rechazo es una decision,
 * no un accidente.
 */
export function evaluarCompra(fila: {
  vitalicia: number
  expira_at: string | null
  referencia: string
  estado_pago: string
} | null): CompraVerificada {
  // Sin fila: nunca compro este producto.
  if (!fila) {
    return { ok: false, motivo: 'sin-compra', vitalicia: false }
  }

  // El pago tiene que estar verificado. 'pendiente' significa que la pasarela
  // todavia noconfirmedo, y 'rechazado' que no va a pasar.
  if (fila.estado_pago !== 'verificado') {
    return { ok: false, motivo: 'compra-pendiente', vitalicia: false }
  }

  const vitalicia = fila.vitalicia === 1

  // Un producto no vitalicio caduca. Uno vitalicio, nunca: por eso
  // `expira_at` es NULL cuando `vitalicia = 1` (lo garantiza el trigger
  // `trg_biblioteca_vitalicia`).
  if (!vitalicia && fila.expira_at && new Date(fila.expira_at) < new Date()) {
    return { ok: false, motivo: 'expirado', vitalicia: false, referencia: fila.referencia }
  }

  return { ok: true, vitalicia, referencia: fila.referencia }
}

/* ===========================================================================
 * Firma del enlace
 * ======================================================================== */

/**
 * Firma el enlace de descarga.
 *
 * Por que una firma y no solo un token en la base: la base esta en D1, y cada
 * peticion de descarga que vaya a la base consume filas leidas del plan gratis
 * (5 millones/dia). Con la firma, el Worker valida en memoria, sin tocar D1.
 *
 * La firma cubre usuario + archivo + expiry. Eso hace que el enlace no se
 * pueda extender, no se pueda cambiar el archivo, y no se pueda reutilizar
 * para otro comprador. Firmar solo el expiry seria insuficiente.
 */
export async function firmarEnlace(
  usuarioId: string,
  claveArchivo: string,
  expiraEn: number,
  secreto: string,
): Promise<string> {
  const mensaje = `${usuarioId}.${claveArchivo}.${expiraEn}`
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(mensaje))
  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verifica una firma. Comparacion en tiempo constante.
 *
 * El tiempo constante no es paranoia: comparar firmas con `===` filtra informacion
 * por tiempo de respuesta, y un atacante que sabe cuantos caracteres coinciden
 * puede reconstruir la firma byte a byte. `timingSafeEqual` de WebCrypto
 * compara todos los bytes siempre.
 */
export async function verificarEnlace(
  usuarioId: string,
  claveArchivo: string,
  expiraEn: number,
  firmaRecibida: string,
  secreto: string,
): Promise<boolean> {
  const esperada = await firmarEnlace(usuarioId, claveArchivo, expiraEn, secreto)

  const a = new TextEncoder().encode(esperada)
  const b = new TextEncoder().encode(firmaRecibida)

  // Distinto largo: no hay nada que comparar en tiempo constante.
  if (a.length !== b.length) return false

  let diferencia = 0
  for (let i = 0; i < a.length; i++) {
    diferencia |= a[i] ^ b[i]
  }
  return diferencia === 0
}

/* ===========================================================================
 * Rota de descarga (contrato del Worker)
 * ======================================================================== */

/**
 * Como responde el Worker a `GET /descargar/:idArchivo`.
 *
 * No es una funcion: es la especificacion del endpoint, escrita para que el
 * Worker se implemente contra ella sin tener que releer el Documento Maestro.
 * Se deja aqui, junto al dominio, y no en el codigo del Worker, porque es una
 * regla de negocio y las reglas de negocio no se esconden en infraestructura.
 */
export interface ContratoDescarga {
  /** 200 con los bytes (modo kv) o redirect 302 (modo externo). */
  exito: 'ok' | 'redirect'
  /** 401 sin sesion. 403 sin compra pagada. 410 si el archivo ya no existe. */
  error: 401 | 403 | 410 | 500
  /** Que verifica el Worker antes de servir. */
  pasos: [
    'sesion del usuario',
    'existencia del archivo en la tabla `archivos`',
    'compra verificada via SQL_VERIFICAR_COMPRA',
    'firma HMAC valida y no expirada',
    'servir bytes o redirigir',
  ]
}

/**
 * Headers de la respuesta de descarga.
 *
 * `Content-Disposition: attachment` es lo que hace que el navegador guarde el
 * archivo en vez de abrirlo. Sin esto, un PDF se abre en una pestaña y el
 * comprador pierde el archivo.
 *
 * `X-Content-Type-Options: nosniff` evita que el navegador interprete el
 * contenido como un tipo distinto al declarado. Con archivos de usuario
 * descargados, es una proteccion real: sin ella, un archivo que se disfraza de
 * `.png` podria ejecutarse como JavaScript en algunos contextos.
 */
export function headersDeDescarga(entrega: EntregaArchivo): Headers {
  return new Headers({
    'Content-Type': entrega.contentType,
    'Content-Disposition': `attachment; filename="${entrega.nombre}"`,
    'Content-Length': String(entrega.bytes),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    [HEADER_FIRMA]: entrega.hash,
  })
}
