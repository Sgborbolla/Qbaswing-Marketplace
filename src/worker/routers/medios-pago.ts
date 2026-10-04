/**
 * Router de las formas de pago.
 *
 * ============================================================================
 *  QUE SE DEVUELVE Y QUE NO
 * ============================================================================
 * Se devuelve `numero_cuenta`, `direccion` y `red`. Es decir, lo que hace falta
 * para pagar, y no solo el nombre y el color.
 *
 * Es una decision consciente, y no un descuido. El comprador tiene que ver a
 * donde transfiere antes de transferir, y si esta ruta solo devolviera nombres,
 * habria que poner el numero en otro sitio mas adelante, que es donde se
 * escribiria una segunda vez y se quedaria viejo.
 *
 * La 0012 dice lo contrario: decia que el numero solo saldria dentro de
 * `POST /api/pagos`, que exige sesion. Eso era un plano de mas. Con el numero
 * escondido detras de una sesion, el visitante que solo esta mirando no puede
 * saber si le sirve ese metodo, y el comprador que ya esta decidido tiene que
 * registrarse para ver el numero que le estan pidiendo en la pagina.
 *
 * ============================================================================
 *  LO QUE ESO COSTA
 * ============================================================================
 * Que cualquiera que abra el sitio ve las dos cuentas del Owner. Es lo que pasa
 * en cualquier tienda que vende productos digitales con transferencia bancaria,
 * y la alternativa no es que el numero no sea publico, es que la gente no pueda
 * comprar.
 *
 * El unico riesgo real es recibir transferencias que no son compras, que se
 * detectan igual que cualquier pago: no hay ninguna compra con ese importe y con
 * esa referencia. Por eso `referencia` va SIEMPRE en el pedido y el numero por si
 * solo no sirve de nada para saber que es.
 *
 * Si algun dia molesta, esta ruta se mueve detras de la sesion sin tocar el
 * esquema: solo habria que quitar el numero del SELECT.
 *
 * ============================================================================
 *  MEDIOS DEL VENDEDOR
 * ============================================================================
 * Esta ruta devuelve los del Owner. Los de cada vendedor van con su producto y
 * los lee `catalogo.ts`, porque dependen de quien vende ese producto y no de la
 * plataforma. Meter los dos en una respuesta unica obligaria al cliente a
 * elegir de una lista mezclada que no corresponde a lo que esta comprando.
 */

import { json } from '../http'
import type { Env } from '../entorno'

export async function responderMediosPago(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT m.clave,
            m.nombre,
            m.tipo,
            m.color_marca,
            m.verificacion,
            m.instrucciones,
            m.numero_cuenta,
            m.titular,
            d.direccion AS direccion_cripto,
            d.red         AS red_cripto
       FROM medios_pago_plataforma m
       LEFT JOIN direcciones_cripto d ON d.id = m.direccion_cripto_id
      WHERE m.activo = 1
      ORDER BY m.orden, m.id`,
  ).all()

  return json({ ok: true, medios: results as Record<string, unknown>[] })
}