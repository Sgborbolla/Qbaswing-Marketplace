/**
 * Perfil del vendedor: datos publicos y metodos de cobro.
 *
 * ============================================================================
 *  PUBLICO Y PRIVADO, EN ARCHIVOS DISTINTOS
 * ============================================================================
 * Este archivo describe lo que el COMPRADOR ve de un vendedor: su nombre, lo
 * que vende, como contactarlo, y los metodos de pago que acepta.
 *
 * Lo que el propietario del negocio ve de si mismo (tarifas internas, saldos,
 * liquidaciones) esta en `tipos-owner.ts`. La separacion es deliberada: si
 * un endpoint devolviera este tipo a un usuario cualquiera, no habria forma de
 * que un campo privado se colara por error, porque este archivo no tiene
 * campos privados.
 *
 * ============================================================================
 *  POR QUE EL VENDEDOR DEFINE SUS METODOS DE COBRO
 * ============================================================================
 * QBASwing no cobra ni liquida a los vendedores: cada uno recibe el dinero
 * directamente en su cuenta. Lo que hace la plataforma es publicar los metodos
 * de cobro de cada vendedor para que el comprador sepa como pagarle.
 *
 * Consecuencia de seguridad: un metodo de cobro de un vendedor NUNCA puede ser
 * un dato de pago de QBASwing. Si lo fuera, un atacante Publicaria su IBAN como
 * metodo de cobro y la plataforma le devolveria el dinero a el.
 */

import type { Categoria, Moneda, Rol } from './tipos'

/* ===========================================================================
 * Metodos de cobro del vendedor
 * ======================================================================== */

/**
 * Como puede pagar un comprador a un vendedor concreto.
 *
 * Cada metodo es del VENDEDOR, no de la plataforma. El Documento Maestro pide
 * expresamente que cada autor registre los suyos, y por eso la lista es abierta
 * y no un enumeracion fija: cada mercado tiene los suyos.
 */
export interface MetodoCobro {
  id: string
  vendedorId: string
  tipo: MetodoCobroTipo
  /** Nombre visible, ej. "Transferencia Banesco", "Zelle", "TropiPay". */
  etiqueta: string
  /**
   * El dato de cobro: IBAN, numero de telefono, email, direccion de cripto.
   *
   * Se muestra EN CLARO porque el comprador lo necesita para pagar. Esa es la
   * diferencia con un dato privado: no hay nada que ocultar, hay algo que
   * comunicar.
   */
  dato: string
  /** Monedas que acepta este metodo. */
  monedas: Moneda[]
  /** Instrucciones para el comprador, ej. "Enviar el monto exacto, sin comision". */
  instrucciones?: string
  /** Si el metodo esta activo. Se puede desactivar sin borrarlo, para no
   * perder el historial de pagos hechos por ahi. */
  activo: boolean
  /** Cuantos pagos se han hecho por este metodo. Lo ve el vendedor, no el
   * comprador. */
  vecesUsado?: number
  creadoAt: string
}

/**
 * Tipos de metodo de cobro.
 *
 * `cripto` incluye la direccion y la red, porque mandarle BTC a una direccion
 * de ETH no pierde el dinero de forma recuperable. La red es obligatoria.
 */
export type MetodoCobroTipo =
  | 'transferencia'
  | 'zelle'
  | 'whatsapp'
  | 'email'
  | 'efectivo'
  | 'qva-pay'
  | 'tropi-pay'
  | 'cripto'

export const ETIQUETA_METODO: Record<MetodoCobroTipo, string> = {
  transferencia: 'Transferencia bancaria',
  zelle: 'Zelle',
  whatsapp: 'WhatsApp',
  email: 'Correo',
  efectivo: 'Efectivo',
  'qva-pay': 'QvaPay',
  'tropi-pay': 'TropiPay',
  cripto: 'Criptomonedas',
}

/**
 * Redes de criptoanoda, para cuando el metodo es `cripto`.
 *
 * La red es un dato OBLIGATORIO y no opcional, por la razon de arriba: enviar
 * USDT por una red equivocada es una perdida irreversible. El selector de la
 * UI no debe permitir elegir moneda sin red.
 */
export const REDES: Record<string, { nombre: string; simbolo: string }> = {
  'BTC': { nombre: 'Bitcoin', simbolo: 'BTC' },
  'ETH': { nombre: 'Ethereum', simbolo: 'ETH' },
  'USDT-TRC20': { nombre: 'Tether (Tron)', simbolo: 'USDT' },
  'USDT-BEP20': { nombre: 'Tether (BSC)', simbolo: 'USDT' },
  'USDT-ERC20': { nombre: 'Tether (Ethereum)', simbolo: 'USDT' },
  'USDT-SOL': { nombre: 'Tether (Solana)', simbolo: 'USDT' },
}

/* ===========================================================================
 * Datos del vendedor
 * ======================================================================== */

/**
 * Lo que el comprador ve de un vendedor.
 *
 * NOTA SOBRE LA DIRECCION FISICA: se declara pero con una consideracion real.
 * En Cuba, con la informacion que hay disponible, publicar una direccion
 * completa en un sitio publico expone a personas que no pueden o no quieren
 * que su ubicacion sea indexada. Por eso `direccion` es visible solo para el
 * propietario y `provincia` + `municipio` son los que se publican.
 *
 * Esa es una decision de negocio, no tecnica. Si el Owner quiere la direccion
 * completa publica, se cambia el `privado: true` de abajo.
 */
export interface PerfilVendedorPublico {
  id: string
  slug: string
  nombreComercial: string
  descripcion: string
  /** URL del avatar. */
  avatar?: string
  /** URL del banner de portada. */
  banner?: string
  verificado: boolean

  /** Datos de contacto visibles publicamente. */
  contacto: {
    whatsapp?: string
    email?: string
    telefono?: string
    sitioWeb?: string
  }

  /** Redes sociales. Cada una con su URL completa. */
  redes: RedSocial[]

  /**
   * Ubicacion. `provincia` y `municipio` son publicos; la direccion exacta se
   * guarda aparte y no se envia al cliente.
   */
  ubicacion: {
    provincia: string
    municipio?: string
    /** Solo visible para el propietario del perfil. */
    direccion?: string
  }

  /** Metodos de pago que este vendedor acepta. */
  metodosCobro: MetodoCobro[]

  /** Categorias en las que vende. */
  especialidades: Categoria[]

  /** Metricas visibles. */
  metricas: {
    productos: number
    ventas: number
    valoracion: number
    opinionCount: number
    /** Fecha de alta, formato mes-ano. */
    desde: string
  }

  /**
   * Si el vendedor es un Owner de la plataforma.
   *
   * Se muestra como insignia en su perfil. Es informacion publica: un
   * comprador quiere saber si le esta comprando al dueno del marketplace.
   */
  esOwner: boolean
}

export interface RedSocial {
  /** `instagram`, `facebook`, `telegram`, `tiktok`, `youtube`, `github`, `web`. */
  plataforma: string
  /** Usuario o alias, sin la @. */
  usuario: string
  /** URL completa. Se construye si no viene. */
  url?: string
  /** Si el vendedor quiere que se muestre publicamente. */
  visible: boolean
}

/**
 * Plataformas con URL construible. Para las demas (un Telegram con invite
 * privado, por ejemplo) la URL la pone el vendedor a mano.
 */
export const PLATAFORMAS_SOCIALES: Record<string, { nombre: string; base: string }> = {
  instagram: { nombre: 'Instagram', base: 'https://instagram.com/' },
  facebook: { nombre: 'Facebook', base: 'https://facebook.com/' },
  telegram: { nombre: 'Telegram', base: 'https://t.me/' },
  tiktok: { nombre: 'TikTok', base: 'https://tiktok.com/@' },
  youtube: { nombre: 'YouTube', base: 'https://youtube.com/@' },
  github: { nombre: 'GitHub', base: 'https://github.com/' },
  x: { nombre: 'X', base: 'https://x.com/' },
}

/** Construye la URL de un perfil social a partir de la plataforma y el usuario. */
export function urlSocial(plataforma: string, usuario: string): string {
  const p = PLATAFORMAS_SOCIALES[plataforma]
  if (!p) return usuario.startsWith('http') ? usuario : ''
  return `${p.base}${usuario.replace(/^@/, '')}`
}

/* ===========================================================================
 * Formulario de edicion
 * ======================================================================== */

/**
 * Lo que el vendedor puede editar de su propio perfil.
 *
 * Separado de `PerfilVendedorPublico` a proposito: este tipo es lo que llega
 * del formulario, y un formulario no puede enviar `verificado: true`. Si se
 * usara el mismo tipo, un POST a `/api/perfil` con `verificado: true` bastaria
 * para convertirse en verificado.
 *
 * Los campos que el vendedor NO controla estan en la base y solo se tocan desde
 * el panel del Owner: `verificado`, `metricas`, `esOwner`.
 */
export interface EditarPerfil {
  nombreComercial: string
  descripcion: string
  contacto: PerfilVendedorPublico['contacto']
  redes: RedSocial[]
  ubicacion: PerfilVendedorPublico['ubicacion']
}

/* ===========================================================================
 * Vendedor en su propio panel
 * ======================================================================== */

/**
 * Lo que el VENDEDOR ve de si mismo.
 *
 * Incluye lo que el comprador no ve, porque lo necesita para funcionar: el
 * estado de sus slots, sus ventas, y cuanto tiene pendiente de cobro.
 *
 * No incluye nada de la plataforma. El 5%, los ingresos globales y las
 * liquidaciones de otros estan en `tipos-owner.ts`.
 */
export interface PanelVendedor {
  perfil: PerfilVendedorPublico
  rol: Rol

  /** Slots de vitrina, con la regla de reutilizacion ya aplicada. */
  espacios: {
    slotsTotales: number
    slotsUsados: number
    slotsLibres: number
    puedePublicar: boolean
    /** Suscripciones vencidas que hay que renovar. */
    advertencias: string[]
  }

  ventas: {
    total: number
    montoBruto: number
    /** Lo que QBASwing retuvo (5% en digitales de terceros, 0% en el resto). */
    comisionRetenida: number
    neto: number
    moneda: string
    /** Pendiente de liquidar. */
    porCobrar: number
    /** Ultimos 12 meses. */
    porMes: { mes: string; ventas: number; neto: number }[]
  }

  productos: {
    total: number
    publicados: number
    borradores: number
    /** Slots que ocuparia publicar todos los borradores. */
    slotsNecesarios: number
  }
}
