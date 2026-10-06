/**
 * Constantes del Worker.
 *
 * ============================================================================
 *  QUE ES EL WORKER Y POR QUE NO ESTA EN EL SITIO
 * ============================================================================
 * Pages sirve HTML estatico. Este Worker sirve la API. La separacion no es
 * estetica: todo lo que necesita una credencial vive aca, y el sitio publico no
 * las tiene.
 *
 * Consecuencia directa de seguridad: `secreto_firma` NO existe en el bundle de
 * Pages. Si estuviera en el frontend, cualquiera que abriera el codigo de la
 * pagina tendria la clave con la que se firman los enlaces de descarga, y
 * podria fabricar enlaces validos para archivos que no compro.
 *
 * ============================================================================
 *  LA REGLA DE ORO, DECIDIDA UNA VEZ
 * ============================================================================
 * El 5% solo puede retenerse si el dinero pasa por la plataforma. Por eso:
 *
 *   Regla A (digital externo)  -> el pago OBLIGATORIAMENTE pasa por QvaPay o
 *                                TropiPay. La plataforma retiene 5% y entrega 95%
 *                                al autor. NO se permite pagar directo al autor.
 *   Regla B (digital propio)   -> 0%. El autor cobra como quiera, incluso directo.
 *   Regla C (fisico)           -> 0%. El vendedor cobra como quiera.
 *
 * QUE PASABA ANTES Y POR QUE ESTA SEPARACION
 * La instruccion original era "cada vendedor pone sus propios metodos de cobro" Y
 * "el 5% llega solo a mi cuenta". Son incompatibles: si el comprador paga por
 * Zelle a un vendedor, ese dinero nunca pasa por la plataforma y no hay 5% que
 * retener ni forma de confirmarlo automaticamente.
 *
 * Por eso `metodosCobroDelAutor` NO se ofrece en la Regla A. En B y C si, y ahi
 * no hay problema porque la comision es cero: la plataforma no tiene nada que
 * retener de un pago que nunca le llega.
 */

/* ===========================================================================
 * Rutas
 * ======================================================================== */

export const RUTAS = {
  // Catalogo (solo lectura)
  productos: '/api/productos',
  productoPorSlug: (slug: string) => `/api/productos/${encodeURIComponent(slug)}`,
  categorias: '/api/categorias',

  // Vendedores (solo lectura)
  vendedores: '/api/vendedores',
  vendedorPorSlug: (slug: string) => `/api/vendedores/${encodeURIComponent(slug)}`,

  // Paquetes de espacios
  paquetes: '/api/paquetes',
  misEspacios: '/api/espacios/mios',

  // Carrito y pago
  carrito: '/api/carrito',
  pagos: '/api/pagos',

  // Descarga. El token es opaco y caduca; ver `entrega.ts`.
  descarga: (token: string) => `/api/descargas/${token}`,

  // Webhooks. Rutas SEPARADAS por pasarela porque los formatos de firma son
  // incompatibles: la de QvaPay hashea el cuerpo crudo, la de TropiPay hashea
  // monto y codigo de orden. Un unico endpointtendria que ramificar y seria mas
  // facil equivocarse que con dos rutas separadas.
  webhookQvaPay: '/webhook/qva-pay',
  webhookTropiPay: '/webhook/tropi-pay',

  // Datos editables de la plataforma (lectura publica, escritura solo owner)
  redes: '/api/plataforma/redes',
  contacto: '/api/plataforma/contacto',
  faq: '/api/plataforma/faq',

  // Formas de pago. El nombre no lleva '/plataforma' porque esta ruta la lee el
  // producto, no el pie de pagina: es informacion de COMPRA, y por eso devuelve
  // el numero de cuenta y no solo el nombre y el color.
  mediosPago: '/api/medios-pago',

  // Autenticacion
  registro: '/api/registro',
  sesion: '/api/sesion',
  cuenta: '/api/cuenta',

  // Formas de cobro PROPIAS de cada cuenta. Va detras de la sesion y no del
  // catalogo: quien contesta es el dueño de la cookie, y sin ella no hay nada
  // que listar.
  //
  // No se anade a `mediosPago`, que es la de plataforma y es de lectura
  // publica. Meter las dos en la misma ruta obligaria a decidir por el metodo
  // si algo es publico o privado, y esa es exactamente la clase de decision que
  // no deberia depender de que alguien acierte con el HTTP.
  mediosPagoPropios: '/api/panel/medios-pago',
} as const

/* ===========================================================================
 * Reglas de negocio
 * ======================================================================== */

/** Dias de vigencia de un paquete de espacios. */
export const VIGENCIA_PACQUETE_DIAS = 60

/** Segundos que un enlace de descarga permanece valido. */
export const EXPIRACION_ENLACE_SEG = 300

/** Segundos de tolerancia del timestamp de los webhooks. */
export const VENTANA_TIMESTAMP_SEG = 300

/** Porcentaje que retiene la plataforma en un producto de Regla A. */
export const COMISION_DIGITAL_EXTERNO = 5

/**
 * Si un producto tiene que cobrarse SI O SI por la plataforma.
 *
 * Esta es la funcion que hace cumplible el 5%. Un producto que devuelve `true`
 * NO puede venderse por metodos directos del autor, porque ese dinero no pasaria
 * por la pasarela y la plataforma no podria retener nada ni confirmar el pago.
 */
export function requierePasarelaPlataforma(regla: 'A' | 'B' | 'C'): boolean {
  return regla === 'A'
}

/**
 * Si el autor puede cobrar directo, sin pasar por la plataforma.
 *
 * Es lo contrario de `requierePasarelaPlataforma`, y por eso son dos funciones y
 * no un parametro: una regla que adivine mal deja al comprador pagando a un
 * tercero sin que QBASwing pueda confirmar la compra, o peor, reteniendo el 5% de
 * una venta que el autor cobro por su cuenta.
 */
export function autorCobraDirecto(regla: 'A' | 'B' | 'C'): boolean {
  return regla !== 'A'
}

/* ===========================================================================
 * Errores
 * ======================================================================== */

/**
 * Error con codigo HTTP. Todo lo que el Worker responde con error sale de aca.
 *
 * `codigo` es un identificador estable para que el frontend pueda reaccionar por
 * codigo sin parsear el texto. El texto puede cambiar; el codigo no.
 */
export class ErrorApi extends Error {
  readonly codigo: string
  readonly status: number

  /**
   * Metodos que la ruta si acepta, para el 405.
   *
   * Va en el error y no en el mensaje porque es un dato estructurado: lo que
   * hace falta es ponerlo en la cabecera `Allow`, no imprimirlo.
   */
  metodosPermitidos?: string[]

  constructor(codigo: string, mensaje: string, status: number) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.status = status
  }

  static noEncontrado(que: string): ErrorApi {
    return new ErrorApi('no_encontrado', `${que} no existe.`, 404)
  }

  /**
   * 405, con la cabecera `Allow`.
   *
   * Un 404 en un metodo equivocado hace creer que la ruta no existe, y no es
   * cierto: `/api/sesion` existe y solo admite POST, GET y DELETE. Quien
   * siga esa ruta necesita ver la diferencia.
   *
   * El 405 lleva `Allow` porque es lo que pide el protocolo para esa respuesta;
   * un 405 sin esa cabecera esta incompleto y hay navegadores que avisan por
   * consola.
   */
  static metodoNoPermitido(mensaje: string, permitidos: string[] = []): ErrorApi {
    const error = new ErrorApi('metodo_no_permitido', mensaje, 405)
    if (permitidos.length > 0) error.metodosPermitidos = permitidos
    return error
  }

  static sinPermiso(mensaje = 'No tenes permiso para esto.'): ErrorApi {
    return new ErrorApi('sin_permiso', mensaje, 403)
  }

  static noAutenticado(): ErrorApi {
    return new ErrorApi('no_autenticado', 'Necesitas iniciar sesion.', 401)
  }

  static invalido(campo: string, motivo: string): ErrorApi {
    return new ErrorApi('dato_invalido', `${campo}: ${motivo}`, 400)
  }
}

/** Se tira dentro de una transaccion de D1 para forzar el rollback. */
export function conflicto(mensaje: string): never {
  throw new ErrorApi('conflicto', mensaje, 409)
}