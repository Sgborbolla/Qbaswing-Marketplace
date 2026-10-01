/**
 * Tipos del panel de Owner.
 *
 * ============================================================================
 *  POR QUE ESTO NO ESTA EN tipos.ts
 * ============================================================================
 * Un owner no es "un vendedor con mas permisos". Mira cosas que el vendedor
 * nunca ve: los ingresos de la plataforma, la comision de todos los autores,
 * los pagos que esperan confirmacion humana, y las liquidaciones pendientes.
 *
 * Si estos tipos vivieran junto a los del dominio, cualquier vista de
 * vendedor podria importarlos por error y acabaria mostrando cifras de la
 * plataforma a un usuario que no debe verlas. Separarlos hace que el
 * accidentally-readable sea visible en el import.
 *
 * ============================================================================
 *  LO QUE UN OWNER PUEDE HACER Y UN VENDEDOR NO
 * ============================================================================
 *   - cambiar las comisiones (viven en `configuracion`, no en el codigo)
 *   - cambiar los precios de los paquetes de espacios
 *   - confirmar pagos manuales de WhatsApp
 *   - ver la comision de TODOS los autores, no solo la suya
 *   - liquidar a los vendedores
 *   - moderar el catalogo
 *   - cambiar el tipo de cambio CUP/USD
 *
 * Cada uno de esos es una fila en `configuracion`. Ese es el motivo por el que
 * esta pantalla no se puede "activar" con un interruptor: cambiar una comision
 * tiene quePersistir.
 */

import type { Moneda, ReglaOro, Rol } from './tipos'
import type { EstadoPago, Pasarela } from './pagos'

/* ===========================================================================
 * Liquidaciones
 * ======================================================================== */

/**
 * Lo que QBASwing le debe a un vendedor.
 *
 * Es una tabla real (`liquidaciones` en db/schema.sql) y no un calculo en el
 * momento, porque el dinero se liquida por periodos: un vendedor con 40 USD
 * acumulados no recibe 40 USD hoy, sino en la proxima fecha de liquidacion.
 */
export interface Liquidacion {
  id: string
  vendedorId: string
  /** Periodo que cubre, ej. '2026-09'. */
  periodo: string
  /** Ventas incluidas en el periodo. */
  ventas: number
  /** Suma bruta de las ventas. */
  bruto: number
  /** Comision retenida, ya calculada con la regla de cada producto. */
  comision: number
  /** Lo que le toca al vendedor. `bruto - comision`. */
  neto: number
  moneda: Moneda
  estado: 'pendiente' | 'pagada' | 'anulada'
  /** Cuando se le pago. NULL si sigue pendiente. */
  pagadoAt?: string
  /** Metodo por el que se le pago. */
  metodo?: 'transferencia' | 'qva-pay' | 'tropi-pay' | 'efectivo'
  /** Referencia del pago hecho al vendedor, para conciliar. */
  referenciaPago?: string
}

/* ===========================================================================
 * Pagos que esperan confirmacion humana
 * ======================================================================== */

/**
 * Un pago que llego por WhatsApp y que solo una persona puede confirmar.
 *
 * `evidencia` es lo que el Owner adjunta al confirmar. Sin ella, el pago no se
 * puede marcar como pagado: es la diferencia entre "el Owner pulso el boton" y
 * "el Owner pulso el boton y dejo constancia de que vio el comprobante".
 *
 * Sin esto, un marketplace con pagos manuales es imposible de auditar, que es
 * exactamente lo que hace que nadie se fíe de un negocio que cobra por
 * WhatsApp.
 */
export interface PagoManual {
  transaccionId: string
  referencia: string
  compradorNombre: string
  compradorEmail: string
  monto: number
  moneda: Moneda
  pasarela: Pasarela
  /** Texto del mensaje que mando el comprador, si se guardo. */
  mensaje?: string
  /** URL del comprobante que subio, si lo subio. */
  comprobanteUrl?: string
  creadoAt: string
  /** Quien lo confirmo. NULL mientras esta pendiente. */
  confirmadoPor?: string
  confirmadoAt?: string
  /** Nota de por que se confirmo o se rechazo. */
  nota?: string
  estado: EstadoPago
}

/* ===========================================================================
 * Metricas de la plataforma
 * ======================================================================== */

/**
 * Lo que ve el owner al entrar. Son las cifras del negocio entero, no las suyas.
 *
 * `ingresosPorMes` viene como serie ya que la plataforma necesita el grafico.
 * Se pide al backend con la consulta hecha, no se arma con datos de ejemplo.
 */
export interface MetricasPlataforma {
  /** Ingresos brutos del periodo actual. */
  ingresosPeriodo: number
  /** Ingresos del periodo anterior, para calcular la variacion. */
  ingresosPeriodoAnterior: number
  moneda: Moneda

  /** Comision retenida. La suma del 5% de los digitales de terceros. */
  comisionAcumulada: number

  /** Por cobrar a vendedores que aun no se liquidaron. */
  porLiquidar: number

  /** Series para el grafico, ordenados de mas antiguo a mas reciente. */
  ingresosPorMes: { mes: string; ingresos: number; comision: number }[]

  /** Reparto de la comision por Regla de Oro. */
  porRegla: Record<ReglaOro, { ventas: number; comision: number }>

  conteos: {
    usuarios: number
    vendedores: number
    productos: number
    productosPublicados: number
    /** Ventas del periodo. */
    ventas: number
    /** Pagos esperando confirmacion humana. */
    pagosPendientes: number
  }
}

/* ===========================================================================
 * Configuracion editable
 * ======================================================================== */

/**
 * Un valor de `configuracion` que el Owner puede cambiar.
 *
 * El campo `clave` es la clave primaria de la tabla. El tipo se declara para que
 * la UI sepa que control renderizar: un numero no se edita igual que un JSON.
 */
export interface Configuracion {
  clave: string
  /** Texto crudo, tal como esta en la base. */
  valor: string
  /** Descripcion en espanol de que hace este valor, para el panel. */
  etiqueta: string
  tipo: 'numero' | 'porcentaje' | 'texto' | 'json' | 'booleano'
  /** Grupo para ordenar el panel. */
  seccion: 'comisiones' | 'paquetes' | 'pagos' | 'plataforma'
  /** Si cambiarlo afecta a operaciones en curso. */
  requiereReinicio?: boolean
  actualizadoAt: string
  /** Quien lo cambio. */
  actualizadoPor?: string
}

/* ===========================================================================
 * Liquidacion calculada, para la vista previa
 * ======================================================================== */

/**
 * Resultado de "cuanto le toca a este vendedor", calculado al vuelo.
 *
 * Es una vista previa, no un compromiso. El monto real se congela cuando se
 * crea la liquidacion, porque entre el calculo y el pago el vendedor puede
 * vender mas.
 */
export interface PreviaLiquidacion {
  vendedorId: string
  vendedorNombre: string
  periodo: string
  ventas: number
  /** Reparto por Regla de Oro, para que el owner vea de donde sale el 5%. */
  desglose: {
    regla: ReglaOro
    ventas: number
    bruto: number
    comision: number
    neto: number
  }[]
  bruto: number
  comisionTotal: number
  neto: number
  moneda: Moneda
}

/* ===========================================================================
 * Permisos
 * ======================================================================== */

/**
 * Que puede hacer un rol.
 *
 * Se declara como datos y no con `if (rol === 'owner')` esparcidos por las
 * vistas. Con una tabla, la pregunta "el vendedor puede ver las comisiones de
 * la plataforma?" tiene una respuesta en un solo lugar.
 */
export const PERMISOS: Record<Rol, string[]> = {
  owner: [
    'ver-comisiones-globales',
    'editar-comisiones',
    'editar-precios-paquetes',
    'confirmar-pagos-manuales',
    'ver-liquidaciones',
    'pagar-liquidaciones',
    'moderar-catalogo',
    'editar-tipo-cambio',
    'gestionar-usuarios',
    'configurar-pasarelas',
  ],
  administrador: [
    'ver-comisiones-globales',
    'confirmar-pagos-manuales',
    'moderar-catalogo',
    'gestionar-usuarios',
  ],
  vendedor: ['ver-sus-ventas', 'gestionar-sus-productos', 'ver-sus-liquidaciones'],
  comprador: ['ver-su-biblioteca', 'comprar', 'opinar'],
}

export function puede(rol: Rol, permiso: string): boolean {
  return PERMISOS[rol]?.includes(permiso) ?? false
}
