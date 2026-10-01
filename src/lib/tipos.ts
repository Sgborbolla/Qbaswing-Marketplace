/**
 * Tipos del dominio QBASwing Marketplace.
 *
 * Fuente: Documento Maestro 2026 (secciones 2, 3 y 6) + los 8 mockups de Stitch.
 *
 * Reglas de negocio que quedan fijadas aqui y que la UI debe respetar:
 *
 * 1. COMISIONES (seccion 2, "Las 3 Reglas de Oro")
 *    - digital-externo  -> 5%  QBASwing / 95% autor
 *    - digital-propio   -> 0%  (100% neto para QBASwing)
 *    - fisico           -> 0%  por venta
 *
 * 2. ESPACIOS FISICOS: un paquete no limita ventas, limita SLOTS SIMULTANEOS.
 *    Si el vendedor agota su saldo, los slots vuelven a estar disponibles
 *    (seccion 2, principio de reutilizacion). Implementado en `slotsUsados`
 *    como conteo de publicaciones activas, no de ventas.
 *
 * 3. VIGENCIA: los paquetes fisicos duran 60 dias naturales desde su
 *    activacion (seccion 3).
 */

/* --------------------------------------------------------------------------
 * Catalogo
 * ----------------------------------------------------------------------- */

/** Regla de Oro que aplica al producto. Determina la comision. */
export type ReglaOro = 'A' | 'B' | 'C'

export type TipoProducto = 'digital' | 'fisico' | 'servicio'

export type Categoria =
  | 'software'
  | 'plantillas'
  | 'ui-kits'
  | 'menus-digitales'
  | 'identidad-marca'
  | 'ropa'
  | 'calzado'
  | 'accesorios'
  | 'belleza'
  | 'hogar'
  | 'electronica'
  | 'informatica'
  | 'automotriz'
  | 'construccion'
  | 'consultoria'
  | 'desarrollo'

/** Producto creado por QBASwing Designer (0% comision) o por un tercero (5%). */
export type Origen = 'qbaswing' | 'externo'

export type Moneda = 'CUP' | 'USD' | 'EUR'

export interface Precio {
  monto: number
  moneda: Moneda
  /** Discount sobre el precio de lista, si aplica. */
  descuento?: number
}

export interface Vendedor {
  id: string
  slug: string
  nombre: string
  /** Nombre mostrable en la ficha publica. */
  nombreComercial: string
  descripcion: string
  avatar: string
  verificado: boolean
  /** Alias shown in the URL and reused in the OpenCode session title. */
  desde: string
  ubicacion: string
  metricas: {
    productos: number
    ventas: number
    valoracion: number
    opinionCount: number
  }
  specialties: Categoria[]
}

export interface Producto {
  id: string
  slug: string
  titulo: string
  descripcion: string
  descripcionLarga: string
  tipo: TipoProducto
  /** Regla de Oro: define la comision aplicada en el checkout. */
  regla: ReglaOro
  origen: Origen
  categoria: Categoria
  vendedorId: string
  precio: Precio
  /** Precio tachado cuando hay descuento. */
  precioAnterior?: Precio
  imagenes: string[]
  /** Para tipo digital: stack tecnologico, licencia, etc. */
  metadatosDigitales?: {
    stack: string[]
    licencia: string
    version: string
    ultimaActualizacion: string
    archivoZipHash: string
    demoUrl?: string
  }
  /** Para tipo fisico: stock, envio, variantes. */
  metadatosFisicos?: {
    stock: number
    envio: string
    processingTime: string
    variantes: { nombre: string; valores: string[] }[]
  }
  /** Para tipo servicio: agenda, modalidad, paquetes. */
  metadatosServicio?: {
    modalidad: 'presencial' | 'remoto' | 'hibrido'
    duracionEstimada: string
    incluye: string[]
  }
  etiquetas: string[]
  destacado: boolean
  publicado: boolean
  fechaPublicacion: string
  /** Solo para digitales: vida de la licencia en la biblioteca. */
  vitalicia?: boolean
}

/* --------------------------------------------------------------------------
 * Paquetes de espacios fisicos (seccion 3)
 * ----------------------------------------------------------------------- */

/**
 * Un paquete otorga slots de vitrina SIMULTANEOS, no ventas.
 * Los slots se liberan cuando el producto se retira o se vende.
 */
export interface PaqueteEspacios {
  id: string
  nombre: string
  /** Categoria fisica a la que aplica este paquete. */
  categoria: Categoria
  /** Numero de slots simultaneos que otorga. */
  slots: number
  /** Vigencia en dias. El documento fija 60 para todos los fisicos. */
  vigenciaDias: number
  precios: Record<Moneda, number>
  /** El documento marca estas categorias como "configurable" por el Owner. */
  precioConfigurable: boolean
  caracteristicas: string[]
}

export interface SuscripcionEspacios {
  id: string
  vendedorId: string
  paqueteId: string
  /** Fecha ISO de inicio de la vigencia. */
  activatedAt: string
  /** Slots totales que otorga el paquete. */
  slotsTotales: number
  /**
   * Slots ocupados por publicaciones ACTIVIVAS.
   * Se recalcula, no se incrementa por venta: vender un producto libera el slot.
   */
  slotsUsados: number
  estado: 'activo' | 'vencido' | 'suspendido'
}

/** Resultado de la regla de reutilizacion de espacios. */
export interface DisponibilidadSlots {
  slotsTotales: number
  slotsUsados: number
  slotsLibres: number
  /** `true` si el vendedor puede publicar otro producto ahora. */
  puedePublicar: boolean
  /** Suscripciones vencidas que ya no aportan slots. */
  advertencias: string[]
}

/* --------------------------------------------------------------------------
 * Comisiones
 * ----------------------------------------------------------------------- */

export interface ReglaComision {
  regla: ReglaOro
  etiqueta: string
  /** Porcentaje que retiene QBASwing. */
  comisionQBASwing: number
  /** Porcentaje que recibe el autor/vendedor. */
  comisionAutor: number
  descripcion: string
}

/* --------------------------------------------------------------------------
 * Pasarelas de pago (seccion 5)
 * ----------------------------------------------------------------------- */

/**
 * Las pasarelas las declara `pagos.ts`, no este archivo.
 *
 * Antes estaban duplicadas aqui con solo 4 valores y otro criterio, y eso era un
 * bug esperando: una transaccion creada con una pasarela de `pagos.ts` no
 *existia en este tipo, y el `CHECK` de la base rechazaba pagos legitimos.
 * Una sola fuente de verdad.
 */

export type { Pasarela, ClasePasarela, EstadoPago } from './pagos'

export interface Transaccion {
  id: string
  referencia: string
  compradorId: string
  productos: { productoId: string; cantidad: number; precio: Precio }[]
  pasarela: Pasarela
  total: Precio
  comision: { regla: ReglaOro; porcentaje: number; monto: number }
  estado: 'pendiente' | 'verificado' | 'rechazado' | 'reembolsado'
  /** Hash de blockchain, para pagos cripto. */
  hashBlockchain?: string
  creadoAt: string
  verificadoAt?: string
}

/* --------------------------------------------------------------------------
 * Roles (seccion 6)
 * ----------------------------------------------------------------------- */

export type Rol = 'owner' | 'administrador' | 'vendedor' | 'comprador'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
  /** Solo presente para el rol vendedor. */
  vendedorId?: string
  creadoAt: string
}

/* --------------------------------------------------------------------------
 * Utilidades de calculo
 * ----------------------------------------------------------------------- */

/** Deriva la regla de Oro a partir del tipo y el origen del producto. */
export function reglaDeOro(tipo: TipoProducto, origen: Origen): ReglaOro {
  if (tipo === 'fisico') return 'C'
  return origen === 'qbaswing' ? 'B' : 'A'
}

/**
 * Calcula el reparto de una venta segun la Regla de Oro.
 * `sinComision` debe venir de la regla, no de un parametro libre.
 */
export function repartir(
  monto: number,
  regla: ReglaOro,
): { qbaswing: number; autor: number; porcentaje: number } {
  const porcentaje = COMISIONES[regla].comisionQBASwing
  const qbaswing = Math.round(monto * (porcentaje / 100) * 100) / 100
  return { qbaswing, autor: Math.round((monto - qbaswing) * 100) / 100, porcentaje }
}

export const COMISIONES: Record<ReglaOro, ReglaComision> = {
  A: {
    regla: 'A',
    etiqueta: 'Digitales Externos',
    comisionQBASwing: 5,
    comisionAutor: 95,
    descripcion: 'Software, scripts, plantillas y UI kits de autores externos.',
  },
  B: {
    regla: 'B',
    etiqueta: 'Digitales Propios',
    comisionQBASwing: 0,
    comisionAutor: 100,
    descripcion: 'Productos oficiales creados por QBASwing Designer.',
  },
  C: {
    regla: 'C',
    etiqueta: 'Productos Fisicos',
    comisionQBASwing: 0,
    comisionAutor: 100,
    descripcion: 'Ropa, calzado, belleza, informatica y electronica.',
  },
}
