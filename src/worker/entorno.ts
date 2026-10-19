/**
 * Tipos del entorno del Worker.
 *
 * ============================================================================
 *  POR QUE ESTA DECLARADO Y NO SE USA `env` DIRECTO
 * ============================================================================
 * Los bindings de Cloudflare solo existen cuando el Worker corre. TypeScript
 * no los conoce, asi que sin esto `env.DB` seria un error de tipo en cada
 * archivo. Declararlos una vez aca hace que el error aparezca en un solo lugar.
 *
 * `interface Env` es el nombre que exige la documentacion de Cloudflare para el
 * autocomplete. El nombre no es arbitrario.
 *
 * ============================================================================
 *  SECRETOS Y VARIABLES: LA DIFERENCIA
 * ============================================================================
 *   [vars]      -> publicas. Van en el bundle y se ven en el panel.
 *   secrets     -> cifradas. NO van en ningun archivo.
 *
 * Por eso `QBASWING_SECRETO_FIRMA` es `string` pero no esta en
 * `wrangler.toml`: se carga con `wrangler secret put`. Si estuviera en
 * `[vars]`, quedaria escrito en un archivo del repositorio y cualquiera con
 * lectura del repo tendria la clave con la que se firman los enlaces de
 * descarga.
 */

export interface Env {
  /** Binding de D1. El nombre lo declara `wrangler.toml`. */
  DB: D1Database

  /**
   * Binding de Workers KV, donde viven los archivos.
   *
   * Se llama ARCHIVOS y no KV a proposito: cuando haya tarjeta y se migre a R2,
   * se cambia la linea de `wrangler.toml` y este codigo no se toca, porque
   * todo el acceso pasa por `src/lib/almacenamiento.ts`.
   */
  ARCHIVOS: KVNamespace

  /**
   * Binding de Workers AI, para traducir los productos.
   *
   * Opcional a proposito: si el binding no esta declarado (o la cuenta no tiene
   * Workers AI activado), `env.AI` llega `undefined` y la traduccion simplemente
   * no ocurre; el producto se sirve en su idioma original. Asi el marketplace no
   * se cae por no tener una funcion de conveniencia, que es la misma logica que
   * con los avisos: un canal sin secretos no tumba el resto.
   */
  AI?: Ai

  /* --- Variables publicas (van en [vars]) --- */

  /** Origen del sitio. Sin esto, cualquiera podria llamar la API desde su pagina. */
  ALLOWED_ORIGIN: string

  /**
   * Base publica de la API, para armar la URL absoluta de las imagenes.
   *
   * La columna `producto_imagenes.url` guarda la URL COMPLETA porque el sitio
   * vive en otro origen y el `<img src>` tiene que poder resolverla sin saber
   * donde esta la API. Si falta, se usa el origen de la peticion.
   */
  PUBLIC_API_BASE?: string


  /** Vida del enlace de descarga, en segundos. */
  EXPIRACION_ENLACE_SEG: string

  /** Tolerancia del timestamp de los webhooks, en segundos. */
  VENTANA_TIMESTAMP_SEG: string

  /* --- Secretos (van con `wrangler secret put`) --- */

  /**
   * Clave para firmar los enlaces de descarga con HMAC-SHA256.
   *
   * Sin esta clave, el enlace es solo un id: cualquiera que descubriera el
   * formato podria fabricar uno valido para un archivo que no compro. Con ella,
   * hay que conocerla para crear un enlace que el Worker acepte.
   *
   * El NOMBRE del binding tiene que ser exactamente el que se paso a
   * `wrangler secret put`. Por eso se llama `QBASWING_SECRETO_FIRMA` y no algo
   * como `secretoFirma`: Cloudflare crea un binding con el nombre que le des, y
   * un nombre distinto en el codigo y en el comando produce un `undefined`
   * silencioso en tiempo de ejecucion, que no es ningun error visible hasta que
   * alguien intenta descargar.
   *
   *   npx wrangler secret put QBASWING_SECRETO_FIRMA
   *
   * Es la unica clave del proyecto que genera el propio marketplace. No se
   * escribe en ningun archivo versionado.
   */
  QBASWING_SECRETO_FIRMA: string

  /**
   * `app-secret` de QvaPay.
   *
   * Se usa de dos formas distintas y por eso conviene no confundirlas:
   *   1. Para GENERAR la firma de las peticiones que QBASwing le hace a QvaPay.
   *   2. Para VERIFICAR la firma que QvaPay manda en `x-qvapay-signature`.
   */
  QVAPAY_APP_SECRET: string

  /**
   * Credenciales de TropiPay, separadas por ambiente.
   *
   * La documentacion de TropiPay recomienda credenciales distintas para sandbox
   * y produccion: un secret de sandbox filtrado no compromete produccion. Por eso
   * son dos variables y no una.
   */
  TROPIPAY_CLIENT_ID: string
  TROPIPAY_CLIENT_SECRET: string
  TROPIPAY_SANDBOX: string

  /* --- Almacenamiento maestro gratuito (secrets) --- */
  GOOGLE_SERVICE_ACCOUNT_JSON?: string
  GOOGLE_DRIVE_FOLDER_ID?: string
  PIXELDRAIN_API_KEY?: string
  GOFILE_API_TOKEN?: string

  /* --- Avisos a las tiendas (secrets, todos opcionales) --- */
  /*
   * Un canal sin sus secretos queda en 'sin_configurar' y el aviso sigue
   * existiendo en el panel. Por eso son opcionales: la plataforma no se cae por
   * no tener todavia proveedor de SMS, solo no manda ese canal.
   *
   *   npx wrangler secret put CORREO_API_KEY      (Resend)
   *   npx wrangler secret put WHATSAPP_TOKEN      (Meta WhatsApp Cloud API)
   *   npx wrangler secret put TWILIO_AUTH_TOKEN   (SMS)
   */
  CORREO_API_KEY?: string
  /** Remitente verificado del proveedor de correo, p.ej. `QBASwing <avisos@dominio>`. */
  CORREO_REMITENTE?: string
  WHATSAPP_TOKEN?: string
  /** Id del numero de WhatsApp Business que envia los mensajes. */
  WHATSAPP_PHONE_ID?: string
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  /** Numero emisor de los SMS, en E.164 (p.ej. `+12025550123`). */
  TWILIO_FROM?: string

  /*
   * Binding opcional de R2, todavia no activado (pide tarjeta).
   *
   * Es opcional porque hoy `wrangler.worker.toml` no lo declara: si un dia se
   * activa R2, basta con anadir el binding y `servirDesdeMaestro` empieza a
   * usarlo sin tocar nada mas. Mientras tanto, la rama de codigo que lo
   * consulta queda inerte y el modo 'r2' cae al error de abajo.
   */
  PRODUCTOS_R2?: R2Bucket
}

/** Conversion a numero con respaldo. Un string vacio en `[vars]` da NaN. */
export function numero(valor: string, respaldo: number): number {
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 ? n : respaldo
}