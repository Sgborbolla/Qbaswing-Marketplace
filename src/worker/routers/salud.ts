/**
 * Router de salud.
 *
 * ============================================================================
 *  PARA QUE ESTE ENDPOINT Y POR QUE NO ES UN `SELECT 1` PELADO
 * ============================================================================
 * QvaPay y TropiPay validan, al crear la aplicacion, que la URL del webhook
 * responda. No basta con que la URL exista: tiene que devolver algo con sentido.
 * Por eso el endpoint dice que version del esquema hay y si el Worker tiene los
 * secretos de las pasarelas, que es justo lo que uno descubre tarde si espera a
 * la primera venta.
 *
 * Tambien separa dos fallos que se ven iguales desde afuera:
 *
 *   - "no responde"          -> el Worker no esta desplegado, o la URL esta mal.
 *   - responde `degraded`    -> el Worker esta vivo, la base no responde.
 *
 * En el primer caso el problema es de despliegue. En el segundo, de datos. Sin
 * esta distincion se pierde una hora buscando el problema equivocado.
 *
 * ============================================================================
 *  QUE NO DICE
 * ============================================================================
 * No dice el nombre de la base, ni el id del proyecto, ni la lista de secretos
 * que faltan con sus valores. Dice solo SI falta cada uno. Este endpoint es
 * publico por necesidad, y un detalle de mas es informacion para quien quiera
 * atacar la instalacion.
 */

import { json } from '../http'
import { numero, type Env } from '../entorno'

/**
 * Secretos que el Worker necesita para funcionar completo.
 *
 * El valor `true`/`false` es la unica informacion que sale de aca. El `nombre` es
 * el nombre del binding, que ya esta en `wrangler.api.toml` y en el repositorio:
 * publicarlo no revela nada.
 */
const SECRETOS_REQUERIDOS = [
  'QBASWING_SECRETO_FIRMA',
  'QVAPAY_APP_SECRET',
  'TROPIPAY_CLIENT_ID',
  'TROPIPAY_CLIENT_SECRET',
] as const

export async function responderSalud(env: Env, soloLectura: boolean): Promise<Response> {
  // `/api/salud` acepta GET y HEAD, y nada mas. Con POST devuelve 405: un
  // endpoint que dice "estoy vivo" no deberia poder escribir nada.
  if (!soloLectura) {
    return json({ ok: false, codigo: 'metodo_no_permitido', mensaje: 'Usa GET.' }, 405)
  }

  // Los numeros se normalizan aca, y no en cada router. `numero()` ya esta
  // escrita para esto: un `[vars]` vacio da `undefined` en vez de `NaN`, y
  // comparar `NaN > 0` da `false`, que es el resultado que uno quiere.
  const expiracion = numero(env.EXPIRACION_ENLACE_SEG, 300)
  const ventana = numero(env.VENTANA_TIMESTAMP_SEG, 300)

  const faltan = SECRETOS_REQUERIDOS.filter(
    (nombre) => !String(env[nombre as keyof Env] ?? '').trim(),
  )

  const base = await estadoDeLaBase(env)
  const ok = base.ok

  return json(
    {
      ok,
      estado: ok ? (faltan.length > 0 ? 'degraded' : 'ok') : 'error',
      version: '0.1.0',
      // Que parte de la API existe. Sin esto, no hay forma de saber desde
      // afuera que la parte de pagos todavia no esta desplegada.
      endpoints: {
        lectura: true,
        escritura: false,
        descargas: false,
        pagos: false,
      },
      base: base.detalle,
      pasarelas: {
        // Un secreto ausente se reporta como NO configurado, nunca como
        // "funciona". Un panel que dice que QvaPay esta lista cuando no hay
        // `app-secret` hace que se cobre mal y no se sepa por que.
        qva_pay: { webhook: RUTA_QVAPAY, configurado: !faltan.includes('QVAPAY_APP_SECRET') },
        tropi_pay: {
          webhook: RUTA_TROPIPAY,
          configurado: !faltan.includes('TROPIPAY_CLIENT_ID'),
          sandbox: env.TROPIPAY_SANDBOX === 'true',
        },
      },
      enlaces: { expiran_en_seg: expiracion, tolerancia_webhook_seg: ventana },
      // Solo el NOMBRE de lo que falta, y solo porque sin esto no hay forma de
      // saber que cargar con `wrangler secret put`.
      secretos_faltantes: faltan,
      ahora: new Date().toISOString(),
    },
    ok ? 200 : 503,
  )
}

/**
 * Comprueba que D1 responde y que el esquema esta aplicado.
 *
 * Devuelve el numero de tablas, no los nombres: el conjunto de tablas ya es
 * informacion de la estructura, y este endpoint es publico. El conteo basta para
 * distinguir "base vacia" de "base con el esquema", que es lo unico que hace
 * falta para diagnosticar.
 */
async function estadoDeLaBase(
  env: Env,
): Promise<{ ok: boolean; detalle: Record<string, unknown> }> {
  try {
    const fila = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    ).first<{ n: number }>()

    const tablas = fila?.n ?? 0

    // Si no hay tablas, la migracion no se aplico. Se dice con nombre propio en
    // vez de devolver un error generico: es el fallo mas comun de un despliegue
    // nuevo y el mas facil de arreglar si se dice.
    if (tablas === 0) {
      return {
        ok: false,
        detalle: {
          conectada: true,
          esquema: 'no_aplicado',
          mensaje: 'La base no tiene tablas. Aplica las migraciones.',
        },
      }
    }

    const productos = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM productos WHERE publicado = 1 AND estado_publicacion = 'aprobado'`,
    )
      .first<{ n: number }>()
      .catch(() => null)

    return {
      ok: true,
      detalle: {
        conectada: true,
        esquema: 'aplicado',
        tablas,
        // `null` cuando la columna no existe todavia, o sea cuando 0003 no se
        // aplico. Se distingue de 0 a proposito: "no hay productos" y "no se
        // puede preguntar" son estados distintos.
        productos_publicados: productos ? productos.n : null,
      },
    }
  } catch (error) {
    return {
      ok: false,
      detalle: {
        conectada: false,
        mensaje: 'La base de datos no responde.',
        error: error instanceof Error ? error.name : 'desconocido',
      },
    }
  }
}

// Se repiten aqui en vez de importarse de `constantes.ts` para que este archivo
// no dependa del router. `RUTAS` ya se importa en `index.ts` y el bundle lo
// comparte; escribir la cadena es lo que hace que las dos no divergan.
const RUTA_QVAPAY = '/webhook/qva-pay'
const RUTA_TROPIPAY = '/webhook/tropi-pay'
