/**
 * Las tarifas de los paquetes de 60 dias, desde el navegador del Owner.
 *
 * ============================================================================
 *  QUE ES ESTA RUTA Y QUE NO ES
 * ============================================================================
 * `/api/plataforma/paquetes` deja dos cosas: ver la matriz tarifaria entera y
 * cambiar los tres precios de un paquete. No crea paquetes, no los apaga, no
 * cambia sus espacios ni su vigencia. Crear un paquete es todo lo demas
 * (nombre, categoria, slots, duracion, caracteristicas) y no se pide aqui.
 *
 * ============================================================================
 *  POR QUE NO SE VALIDA NADA AQUI
 * ============================================================================
 * Mismo motivo que en `productos-panel.ts`: el sitio es HTML estatico y su
 * JavaScript se puede editar desde la consola. Si esta funcion decidiera que
 * `1000` esta bien escrito para USD, bastaria con cambiar una linea y mandar lo
 * que sea. La validacion vive en el Worker, una sola vez, y aqui lo unico que
 * se hace es devolver el mensaje que el Worker escribio.
 *
 * ============================================================================
 *  LAS TRES MONEDAS CONVIVEN EN LA MISMA FILA
 * ============================================================================
 * Un producto tiene UN precio y UNA moneda. Un paquete tiene TRES precios, uno
 * por moneda, y por eso el formulario no tiene desplegable de moneda: las tres
 * columnas se editan a la vez en la misma fila.
 *
 * Y cada una en su unidad, que no es la misma:
 *
 *   precio_cup  pesos enteros.  250 CUP -> 250
 *   precio_usd  centavos.       $10.00  -> 1000
 *   precio_eur  centimos.       10,00 EUR -> 1000
 *
 * El valor que se manda y el que se recibe estan ya en esa unidad, igual que en
 * `productos-panel.ts`. Quien teclea `10` en el campo de USD esta poniendo diez
 * centavos, y por eso el formulario enseña `formatearPrecio` con el resultado
 * delante mientras se teclea.
 *
 * ============================================================================
 *  EL PRECIO VACIO
 * ============================================================================
 * `null` no es un error: significa "este paquete no se vende en esta moneda" y
 * el catalogo lo pinta como "no disponible". Se puede limpiar un precio a
 * proposito dejando el campo en blanco.
 */

import { pedir, type Respuesta } from './identidad-cliente'

/** Ruta del Worker. Copiada a mano y no importada desde `worker/constantes.ts`. */
const RUTA = '/api/plataforma/paquetes'

/**
 * Un paquete con su matriz de precios.
 *
 * Los tres precios pueden ser `null` (sin precio en esa moneda) y son enteros
 * en la unidad de su propia columna: ver el bloque de arriba.
 *
 * `precio_configurable` marca las dos categorias que el Documento Maestro deja
 * con rango en vez de precio fijo (Informatica y Construccion). En la base es un
 * 0/1; aqui sale como booleano porque es un si/no, no una cantidad.
 */
export interface PaqueteTarifa {
  id: number
  nombre: string
  categoria: string
  slots: number
  vigencia_dias: number
  precio_cup: number | null
  precio_usd: number | null
  precio_eur: number | null
  precio_configurable: boolean
  activo: boolean
}

/**
 * Lo que se manda en `PATCH`.
 *
 * Los cuatro campos van siempre, aunque solo se haya tocado uno. El servidor
 * conservaria los que no lleguen, pero mandar el formulario entero hace que la
 * respuesta describa la fila tal cual quedo.
 *
 * Cada precio acepta cadena porque el campo de texto manda texto, y vacio para
 * limpiarlo. Es el servidor quien decide si eso es un numero.
 */
export interface TarifaEnvio {
  id: number
  precio_cup: number | string | null
  precio_usd: number | string | null
  precio_eur: number | string | null
}

/** Lo que quedo guardado en las tres columnas. */
export interface TarifaGuardada {
  id: number
  precio_cup: number | null
  precio_usd: number | null
  precio_eur: number | null
}

/**
 * Toda la matriz tarifaria, activos y apagados.
 *
 * Requiere sesion de Owner: lo pide el Worker y no hace falta comprobarlo aqui.
 */
export function tarifasDePaquetes(): Promise<
  Respuesta<{ paquetes: PaqueteTarifa[] }>
> {
  return pedir(RUTA)
}

/** Cambia los tres precios de un paquete. */
export function cambiarTarifa(
  cambios: TarifaEnvio,
): Promise<Respuesta<{ paquete: TarifaGuardada }>> {
  return pedir(RUTA, { method: 'PATCH', body: JSON.stringify(cambios) })
}
