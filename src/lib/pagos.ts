/**
 * Pasarelas de pago.
 *
 * ============================================================================
 *  POR QUE ESTE ARCHIVO EXISTE
 * ============================================================================
 * Los metodos de cobro de QBASwing no son cinco gateways equivalentes. Son
 * tres clases tecnicas distintas, y confundirlas es el error de diseño mas
 * comun en un marketplace: asumir que todos mandan webhook y que todos se
 * confirman solos.
 *
 *   CLASE 1 — GATEWAY CON WEBHOOK
 *     QvaPay, TropiPay
 *     El proveedor notifica. El sistema recibe, valida la firma, marca la
 *     compra como pagada. El comprador no hace nada.
 *
 *   CLASE 2 — VERIFICACION ACTIVA
 *     Tarjetas cubanas, Criptomonedas
 *     No hay webhook entrante util, o no es de fiar. El sistema CONSULTA al
 *     proveedor o a la blockchain cada cierto tiempo. El pago se confirma por
 *     sondeo, no por notificacion.
 *
 *   CLASE 3 — CONFIRMACION MANUAL
 *     WhatsApp
 *     Una persona recibe el mensaje, comprueba el pago, y marca la compra.
 *     No hay automatizacion posible. Es lo que hacen miles de negocios.
 *
 * La consecuencia practica: la clase 3 necesita un panel para el Owner y una
 * tabla de auditoria que deje claro quien confirmo cada pago y cuando. Sin eso,
 * un marketplace con pagos manuales es imposible de auditar y facil de
 * fraudulentar.
 *
 * ============================================================================
 *  LA REGLA QUE NO SE ROMPE
 * ============================================================================
 * Ningun camino marca una compra como pagada sin una evidencia:
 *
 *   clase 1 -> webhook con firma verificada
 *   clase 2 -> sondeo con hash o referencia confirmada por el proveedor
 *   clase 3 -> accion humana, con nombre de quien la hizo
 *
 * Nunca "el comprador dijo que pago". Ese es el camino que convierte un
 * marketplace en una pagina de descargas gratis.
 */

/* ===========================================================================
 * Tipos
 * ======================================================================== */

export type Pasarela =
  | 'qva-pay'
  | 'tropi-pay'
  | 'crypto'
  | 'tarjeta-cubana'
  | 'whatsapp'

/** De que clase tecnica es cada pasarela. */
export type ClasePasarela = 'webhook' | 'sondeo' | 'manual'

export interface DefinicionPasarela {
  id: Pasarela
  nombre: string
  clase: ClasePasarela
  /** Si admite mas de una moneda. */
  monedas: ('CUP' | 'USD' | 'EUR')[]
  /** Si el pago necesita confirmacion humana. */
  requiereRevision?: boolean
  /**
   * Cuanto tarda en estar disponible el dinero. El comprador ve esto, y el
   * vendedor tambien: cambia si le conviene vender por ahi.
   */
  liquidacion: 'inmediata' | 'dias' | 'manual'
}

/**
 * Las cinco pasarelas, segun lo definido por el Owner.
 *
 * `qva-pay` es el identificador en la base (ver el CHECK de `db/schema.sql`).
 * El nombre visible al comprador es "QvaPay". Se conservan distintos a
 * proposito: el identificador puede cambiar si el proveedor renombra su API,
 * sin romper los pagos ya registrados.
 */
export const PASARELAS: Record<Pasarela, DefinicionPasarela> = {
  'qva-pay': {
    id: 'qva-pay',
    nombre: 'QvaPay',
    clase: 'webhook',
    monedas: ['CUP', 'USD'],
    liquidacion: 'inmediata',
  },
  'tropi-pay': {
    id: 'tropi-pay',
    nombre: 'TropiPay',
    clase: 'webhook',
    monedas: ['CUP', 'USD'],
    liquidacion: 'inmediata',
  },
  crypto: {
    id: 'crypto',
    nombre: 'Criptomonedas',
    clase: 'sondeo',
    monedas: ['USD', 'EUR'],
    liquidacion: 'dias',
  },
  'tarjeta-cubana': {
    id: 'tarjeta-cubana',
    nombre: 'Tarjeta bancaria cubana',
    clase: 'sondeo',
    monedas: ['CUP'],
    liquidacion: 'dias',
  },
  whatsapp: {
    id: 'whatsapp',
    nombre: 'WhatsApp',
    clase: 'manual',
    monedas: ['CUP', 'USD'],
    requiereRevision: true,
    liquidacion: 'manual',
  },
}

/** Pasarelas que se pueden offered en el checkout segun la moneda. */
export function pasarelasPara(moneda: 'CUP' | 'USD' | 'EUR'): DefinicionPasarela[] {
  return Object.values(PASARELAS).filter((p) => p.monedas.includes(moneda))
}

/* ===========================================================================
 * Estados de una transaccion
 * ======================================================================== */

export type EstadoPago =
  | 'pendiente'   // iniciada, sin evidencia de pago
  | 'verificado'  // PAGADA. Es el unico estado que da acceso al archivo.
  | 'rechazado'   // el proveedor la rechazo
  | 'reembolsado' // se devolvio el dinero

/**
 * Transicion valida de estados.
 *
 * Se declara en un mapa y no con `if`s sueltos para que sea imposible pasar de
 * `verificado` a `pendiente`, que es lo que permitiria "reabrir" un pago ya
 * cobrado y volver a cobrarlo.
 *
 * La excepcion es `verificado -> reembolsado`, que es la unica salida valida
 * de un pago cobrado.
 */
export const TRANSICIONES: Record<EstadoPago, EstadoPago[]> = {
  pendiente: ['verificado', 'rechazado'],
  verificado: ['reembolsado'],
  rechazado: [],
  reembolsado: [],
}

export function puedeTransicionar(desde: EstadoPago, hacia: EstadoPago): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

/* ===========================================================================
 * Evidencias
 * ======================================================================== */

/**
 * La prueba que autoriza cada transicion.
 *
 * Sin `evidencia`, una transicion no se registra. Esto convierte "el Owner
 * pulso verificado" en "el Owner pulso verificado y dejo constancia de por
 * que", que es justo lo que un marketplace con pagos manuales necesita para ser
 * auditable.
 */
export interface EvidenciaPago {
  clase: ClasePasarela
  /** Texto crudo de la prueba, tal como llego. */
  crudo: string
  /** Verificacion criptografica, si la clase la tiene. */
  hash?: string
  /** Quien confirmo, para la clase manual. */
  confirmadoPor?: string
  /** Cuando se confirmo. */
  confirmadoAt: string
  /** Monto que se verifico, para detectar discrepancias. */
  montoVerificado?: number
  moneda?: 'CUP' | 'USD' | 'EUR'
}

/* ===========================================================================
 * Recepcion de pagos
 * ======================================================================== */

/**
 * Resultado de intentar confirmar un pago.
 *
 * `requiere_revision` es distinto de `rechazado`: es "no se puede saber solo,
 * que lo mire una persona". Es el estado normal de un pago por WhatsApp, y
 * tratarlo como rechazo perderia ventas reales.
 */
export type ResultadoConfirmacion =
  | { estado: 'verificado'; evidencia: EvidenciaPago }
  | { estado: 'rechazado'; motivo: string }
  | { estado: 'pendiente'; motivo: string }
  | { estado: 'requiere_revision'; motivo: string }

/**
 * Decide el resultado a partir de la respuesta del proveedor.
 *
 * `respuesta` es lo que devuelve la consulta: un webhook ya validado (clase 1),
 * el estado de una transaccion consultada (clase 2), o un mensaje humano
 * (clase 3).
 *
 * Se separo de la llamada de red a proposito: la regla de negocio se puede
 * probar sin red, y lo que se tiene que depurar cuando un pago no se marca es
 * la regla, no el fetch.
 */
export function evaluarPago(
  pasarela: Pasarela,
  respuesta: {
    /** Estado que reporta el proveedor. */
    estado: string
    /** Hash de la operacion, si existe. */
    hash?: string
    /** Monto que el proveedor dice que recibio. */
    monto?: number
    /** Persona que confirma, en la clase manual. */
    porQuien?: string
  },
  ahora = new Date(),
): ResultadoConfirmacion {
  const definicion = PASARELAS[pasarela]
  const evidenciaBase = { clase: definicion.clase, ahora: ahora.toISOString() }

  // Clase 3: nunca se automatiza. Siempre a revision humana.
  if (definicion.clase === 'manual') {
    if (!respuesta.porQuien) {
      return {
        estado: 'requiere_revision',
        motivo: 'El pago por WhatsApp lo tiene que confirmar una persona. Falta quien lo autorice.',
      }
    }
    return {
      estado: 'verificado',
      evidencia: {
        ...evidenciaBase,
        crudo: `confirmado por ${respuesta.porQuien}`,
        confirmadoPor: respuesta.porQuien,
        confirmadoAt: ahora.toISOString(),
        montoVerificado: respuesta.monto,
      },
    }
  }

  // Clases 1 y 2: el estado lo dice el proveedor.
  switch (respuesta.estado) {
    case 'aprobado':
    case 'completado':
    case 'confirmado':
      return {
        estado: 'verificado',
        evidencia: {
          ...evidenciaBase,
          crudo: respuesta.estado,
          hash: respuesta.hash,
          confirmadoAt: ahora.toISOString(),
          montoVerificado: respuesta.monto,
        },
      }

    case 'rechazado':
    case 'fallido':
      return { estado: 'rechazado', motivo: `El proveedor respondio "${respuesta.estado}".` }

    // Aqui cae lo que no se puede resolver solo: la verificacion activa
    // todavia no ve el pago. NO es un rechazo: el dinero puede estar de camino.
    default:
      return {
        estado: 'pendiente',
        motivo: `La pasarela ${definicion.nombre} aun no confirma "${respuesta.estado}".`,
      }
  }
}

/* ===========================================================================
 * Criptomonedas
 * ======================================================================== */

/**
 * Redes de criptomoneda con su dificultad de confirmacion.
 *
 * El numero de confirmaciones NO es arbitrario: es el que hace falta para que
 * un intercambio no pueda reescribir la transaccion. Con menos de esto, un
 * comprador podia gastar dos veces la misma moneda.
 */
export const REDES_CRYPTO: Record<string, { confirmaciones: number; simbolo: string }> = {
  'BTC': { confirmaciones: 6, simbolo: 'BTC' },
  'ETH': { confirmaciones: 12, simbolo: 'ETH' },
  'USDT-TRC20': { confirmaciones: 20, simbolo: 'USDT' },
  'USDT-BEP20': { confirmaciones: 20, simbolo: 'USDT' },
  'USDT-ERC20': { confirmaciones: 20, simbolo: 'USDT' },
}

/** Tope de tiempo para pagar un pedido cripto antes de que expire la direccion. */
export const EXPIRACION_PAGO_CRYPTO_SEG = 30 * 60 // 30 minutos
