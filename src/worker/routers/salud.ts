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
 * el nombre del binding, que ya esta en `wrangler.toml` y en el repositorio:
 * publicarlo no revela nada.
 */
const SECRETOS_REQUERIDOS = [
  'QBASWING_SECRETO_FIRMA',
  'QVAPAY_APP_SECRET',
  'TROPIPAY_CLIENT_ID',
  'TROPIPAY_CLIENT_SECRET',
] as const

/**
 * Integraciones que se pueden quedar sin configurar sin que nada se rompa.
 *
 * Cada grupo son las variables que tienen que estar TODAS para que el canal
 * funcione. Se informan aparte de `SECRETOS_REQUERIDOS` a proposito: la falta de
 * una de estas no es una averia, y marcarlas como requeridas pondria el estado
 * en `degraded` para siempre por canales que quiza no se quieran usar (el SMS,
 * por ejemplo, no entrega a Cuba).
 *
 * El valor es la lista de variables, que ya esta en el repositorio: publicarla
 * no revela nada y ahorra tener que buscar en el codigo que hay que cargar.
 */
const INTEGRACIONES_OPCIONALES = {
  drive: ['GOOGLE_SERVICE_ACCOUNT_JSON'],
  gofile: ['GOFILE_API_TOKEN'],
  pixeldrain: ['PIXELDRAIN_API_KEY'],
  correo: ['CORREO_API_KEY', 'CORREO_REMITENTE'],
  whatsapp: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID'],
  sms: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'],
} as const satisfies Record<string, readonly (keyof Env)[]>

type NombreIntegracion = keyof typeof INTEGRACIONES_OPCIONALES

/** Un secreto esta puesto si existe y no es solo espacios. */
function presente(env: Env, nombre: keyof Env): boolean {
  return String(env[nombre] ?? '').trim().length > 0
}

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

  const faltan = SECRETOS_REQUERIDOS.filter((nombre) => !presente(env, nombre))

  // Que canales opcionales estan listos. No entra en `ok` ni en `estado`: una
  // integracion sin configurar no es un fallo, y mezclarlas haria que el estado
  // mintiera.
  const integraciones = Object.fromEntries(
    (Object.keys(INTEGRACIONES_OPCIONALES) as NombreIntegracion[]).map((canal) => [
      canal,
      {
        configurado: INTEGRACIONES_OPCIONALES[canal].every((nombre) => presente(env, nombre)),
      },
    ]),
  ) as Record<NombreIntegracion, { configurado: boolean }>

  const integracionesFaltantes = (Object.keys(integraciones) as NombreIntegracion[])
    .filter((canal) => !integraciones[canal].configurado)

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
      // Canales que se pueden usar, con la verdad de cada uno. `drive` y
      // `gofile` son almacenes de archivos maestros; `correo`, `whatsapp` y
      // `sms` son avisos de venta. Ninguno hace falta para vender.
      integraciones,
      integraciones_faltantes: integracionesFaltantes,
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
