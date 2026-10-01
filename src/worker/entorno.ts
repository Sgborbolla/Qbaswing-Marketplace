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
 * `wrangler.api.toml`: se carga con `wrangler secret put`. Si estuviera en
 * `[vars]`, quedaria escrito en un archivo del repositorio y cualquiera con
 * lectura del repo tendria la clave con la que se firman los enlaces de
 * descarga.
 */

export interface Env {
  /** Binding de D1. El nombre lo declara `wrangler.api.toml`. */
  DB: D1Database

  /**
   * Binding de Workers KV, donde viven los archivos.
   *
   * Se llama ARCHIVOS y no KV a proposito: cuando haya tarjeta y se migre a R2,
   * se cambia la linea de `wrangler.api.toml` y este codigo no se toca, porque
   * todo el acceso pasa por `src/lib/almacenamiento.ts`.
   */
  ARCHIVOS: KVNamespace

  /* --- Variables publicas (van en [vars]) --- */

  /** Origen del sitio. Sin esto, cualquiera podria llamar la API desde su pagina. */
  ALLOWED_ORIGIN: string

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
}

/** Conversion a numero con respaldo. Un string vacio en `[vars]` da NaN. */
export function numero(valor: string, respaldo: number): number {
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 ? n : respaldo
}