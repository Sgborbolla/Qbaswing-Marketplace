/**
 * Router de webhooks de QvaPay y TropiPay.
 *
 * ============================================================================
 *  LO UNICO QUE HACE ESTA VERSION: RECHAZAR CON CLARIDAD
 * ============================================================================
 * La firma de los webhooks se valida con un secreto que todavia no esta
 * cargado. Este router NO acepta pagos, NO marca transacciones y NO inventa
 * ningun camino para hacerlo. Responde 503 y explica que falta.
 *
 * Eso es distinto de responder 404, y la diferencia importa de verdad:
 *
 *   404  -> la pasarela cree que la URL esta mal. No reintenta, y el pago queda
 *          en un limbo del que hay que salir a mano.
 *   503  -> la pasarela reintenta. Cuando se cargue el secreto, el reintento
 *          entra solo y el pago se confirma sin que nadie tenga que ir a buscarlo.
 *
 * La ruta EXISTE y RESPONDE porque QvaPay valida la URL al crear la aplicacion.
 * Una URL que devuelve 404 no pasa esa validacion, y sin aplicacion no hay token.
 *
 * ============================================================================
 *  POR QUE NUNCA SE ACEPTA UN WEBHOOK SIN VERIFICAR
 * ============================================================================
 * Un webhook es una peticion POST publica. Si el Worker marca una transaccion
 * como pagada porque llego un POST con el id de la transaccion, cualquiera puede
 * marcar pagada cualquier compra con un curl. Eso es escribir en la base a
 * partir de un dato que el cliente controla.
 *
 * Por eso la unica forma de aceptar es verificar la firma con el secreto
 * compartido, comparar el timestamp contra la ventana de tolerancia, y MARCAR
 * COMO RECIBIDO el evento antes de procesar. Ese ultimo paso es lo que impide
 * que un reintento procese dos veces el mismo evento.
 *
 * ============================================================================
 *  POR QUE DOS RUTAS Y NO UNA
 * ============================================================================
 * Los dos formatos de firma son incompatibles: QvaPay hashea el cuerpo crudo de
 * la peticion, TropiPay hashea monto y codigo de orden. Un unico endpoint
 * tendria que ramificar dentro del calculo de la firma, que es la parte donde un
 * error no se ve: el hash sale distinto y el pago se rechaza con un 401 que
 * parece un problema de credenciales.
 *
 * Con dos rutas, cada una tiene su calculo y probarlo es independiente.
 */

import { json } from '../http'
import { RUTAS, VENTANA_TIMESTAMP_SEG } from '../constantes'
import type { Env } from '../entorno'
import { cambiarEstado, ordenPorReferencia } from '../pagos'
import type { EstadoPago } from '../../lib/pagos'

/** Rutas que este router atiende. */
type Pasarela = 'qva_pay' | 'tropi_pay'

export async function responderWebhooks(
  ruta: string,
  peticion: Request,
  env: Env,
): Promise<Response> {
  const pasarela: Pasarela = ruta === RUTAS.webhookQvaPay ? 'qva_pay' : 'tropi_pay'

  // Un webhook llega por POST. Un GET significa que alguien abrio la URL en un
  // navegador, y no hay nada que responderle. 405 con `Allow` deja claro que la
  // ruta existe.
  if (peticion.method !== 'POST') {
    return json(
      { ok: false, codigo: 'metodo_no_permitido', mensaje: 'Este endpoint solo acepta POST.' },
      405,
      { Allow: 'POST' },
    )
  }

  const credenciales = credencialesDe(pasarela, env)

  if (!credenciales.configurado) {
    // 503 y no 401. 401 diria "tus credenciales estan mal", y el problema es
    // que todavia no hay ninguna. La pasarela reintenta y el mensaje dice
    // exactamente que cargar.
    return json(
      {
        ok: false,
        codigo: 'pasarela_sin_configurar',
        mensaje: `${pasarela} todavia no esta configurada en este Worker.`,
        // El nombre del secreto que falta. Es el mismo dato que ya esta escrito
        // en `wrangler.toml`, asi que no revela nada nuevo, y sin el
        // operador tendria que adivinar el nombre del comando.
        falta_configurar: credenciales.falta,
        // Se devuelve el cuerpo como lo recibio, en texto. Sirve para
        // desarrollo: permite ver que campo trae el webhook real y compararlo
        // con lo que el codigo espera. Sin esto, el primer webhook de prueba se
        // pierde en un 401 sin informacion util.
        recibido: await cuerpoComoTexto(peticion),
      },
      503,
    )
  }

  // ===========================================================================
  //  TROPIPAY: TODAVIA NO, Y A PROPOSITO
  // ===========================================================================
  // La firma de TropiPay no es HMAC sobre el cuerpo: cubre dos campos sueltos
  // (monto y codigo de orden) y se verifica con una funcion propia. Mientras esa
  // funcion no este escrita y probada contra el proveedor, este endpoint NO
  // acepta nada. Aceptar un webhook sin verificar seria dejar que cualquiera
  // marque pagos como pagados con un curl.
  if (pasarela === 'tropi_pay') {
    return json(
      {
        ok: false,
        codigo: 'no_implementado',
        mensaje:
          'TropiPay esta configurada, pero su verificacion de firma todavia no esta escrita. ' +
          'Hasta entonces este endpoint no acepta pagos.',
      },
      501,
    )
  }

  // ===========================================================================
  //  QVAPAY
  // ===========================================================================
  // El cuerpo se lee como TEXTO CRUDO y se hashea tal cual. Si se parseara el
  // JSON y se volviera a serializar, la firma no cuadraria nunca: el orden de
  // las claves y los espacios cambian entre lo que mando el proveedor y lo que
  // produce `JSON.stringify`. Por eso el texto crudo es obligatorio.
  const crudo = await peticion.text()

  const firma = peticion.headers.get('x-qvapay-signature') ?? ''
  const sello = Number(peticion.headers.get('x-qvapay-timestamp') ?? '')

  const firmaEsperada = await hmacHex(env.QVAPAY_APP_SECRET, crudo)
  if (!firma || !iguales(firma, firmaEsperada)) {
    return json({ ok: false, codigo: 'firma_invalida', mensaje: 'La firma no coincide.' }, 401)
  }

  // El sello tiene que ser reciente. Sin esto, un webhook bueno capturado hoy
  // vale para siempre: quien lo copie puede reenviarlo cuando quiera.
  const ahora = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(sello) || Math.abs(ahora - sello) > VENTANA_TIMESTAMP_SEG) {
    return json({ ok: false, codigo: 'sello_vencido', mensaje: 'El timestamp esta fuera de la ventana.' }, 401)
  }

  let evento: Record<string, unknown>
  try {
    const parseado: unknown = JSON.parse(crudo)
    if (typeof parseado !== 'object' || parseado === null) throw new Error('no es objeto')
    evento = parseado as Record<string, unknown>
  } catch {
    return json({ ok: false, codigo: 'cuerpo_invalido', mensaje: 'El cuerpo no es un JSON valido.' }, 400)
  }

  // Idempotencia. QvaPay reintenta hasta tres veces; sin esto, el mismo pago
  // se confirmaria tres veces. `evento_id` es el `transaction_uuid`, que es
  // estable entre reintentos.
  const eventoId = String(evento.transaction_uuid ?? '')
  if (!eventoId) {
    return json({ ok: false, codigo: 'evento_sin_id', mensaje: 'El webhook no trae transaction_uuid.' }, 400)
  }

  const registro = await env.DB.prepare(
    'INSERT OR IGNORE INTO webhooks_recibidos (pasarela, evento_id) VALUES (?, ?)',
  )
    .bind(pasarela, eventoId)
    .run()

  // Si `changes` es 0, ese evento ya se habia recibido. Se contesta 200 sin
  // volver a procesarlo: es un reintento, y procesarlo otra vez cobraria o
  // entregaria dos veces.
  if ((registro.meta.changes ?? 0) === 0) {
    return json({ ok: true, repetido: true })
  }

  // La referencia de nuestra orden viaja como `remote_id`. Es el campo con el
  // que QvaPay devuelve el identificador que nosotros pusimos al crear la
  // factura, y por eso es el unico con el que se puede casar el pago.
  const referencia = String(evento.remote_id ?? evento.reference ?? '')
  if (!referencia) {
    return json({ ok: true, sin_referencia: true })
  }

  const orden = await ordenPorReferencia(env, referencia)
  // Una referencia desconocida no es un error del proveedor. Se contesta 200
  // para que no reintente: no hay nada que procesar.
  if (!orden) return json({ ok: true, orden_desconocida: true })

  const estado = estadoDeQvaPay(String(evento.status ?? ''))
  if (!estado) {
    // Pendiente o cualquier estado intermedio: no se toca la orden. El pago
    // puede estar en camino, y marcarlo como fallido perderia una venta real.
    return json({ ok: true, sin_cambio: true, estado_proveedor: evento.status ?? null })
  }

  // Si la orden ya no esta pendiente, no se toca. Un segundo webhook sobre una
  // orden ya verificada no es un reintento (esos los corta la idempotencia de
  // arriba): es otro evento, y moverlo otra vez no tiene sentido. Se contesta
  // 200 para que el proveedor no siga reintentando.
  if (orden.estado !== 'pendiente') {
    return json({ ok: true, sin_cambio: true, estado_actual: orden.estado })
  }

  await cambiarEstado(env, orden, estado, {
    clase: 'webhook',
    crudo,
    hash: firma,
    montoVerificado:
      typeof evento.amount === 'number' ? Math.round(evento.amount * 100) : null,
    moneda: (orden.moneda as 'CUP' | 'USD' | 'EUR') ?? null,
  })

  return json({ ok: true, referencia, estado })
}

/** Traduce el estado de QvaPay a uno de los nuestros. `null` = no se toca. */
function estadoDeQvaPay(estado: string): EstadoPago | null {
  const e = estado.toLowerCase()
  if (e === 'paid' || e === 'completed' || e === 'success' || e === 'confirmed') {
    return 'verificado'
  }
  if (e === 'cancelled' || e === 'canceled' || e === 'failed' || e === 'declined' || e === 'expired') {
    return 'rechazado'
  }
  return null
}

/** HMAC-SHA256 en hexadecimal, con la clave del secreto compartido. */
async function hmacHex(secreto: string, mensaje: string): Promise<string> {
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(mensaje))
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Comparacion en tiempo constante.
 *
 * Comparar con `===` deja medir, por lo que tarda, cuantos caracteres de la
 * firma acerto quien prueba. Con una firma corta no da para adivinarla, pero
 * escribir esto una vez cuesta tres lineas y quita el debate.
 */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferencia === 0
}

/**
 * Si la pasarela tiene lo necesario para verificar firmas.
 *
 * Se comprueba el secreto y NO la variable de ambiente: `TROPIPAY_SANDBOX` esta
 * declarada y vacia hasta que se configure, y usarla para decidir si TropiPay
 * esta activa haria que el endpoint dijera "no configurado" con el secreto
 * puesto, que es un diagnostico que lleva en la direccion contraria.
 */
function credencialesDe(
  pasarela: Pasarela,
  env: Env,
): { configurado: boolean; falta: string[] } {
  if (pasarela === 'qva_pay') {
    const falta = vacios(['QVAPAY_APP_SECRET'], env)
    return { configurado: falta.length === 0, falta }
  }
  const falta = vacios(['TROPIPAY_CLIENT_ID', 'TROPIPAY_CLIENT_SECRET'], env)
  return { configurado: falta.length === 0, falta }
}

function vacios(nombres: string[], env: Env): string[] {
  return nombres.filter((n) => !String(env[n as keyof Env] ?? '').trim())
}

/**
 * Lee el cuerpo como texto, sin fallar nunca.
 *
 * El cuerpo ya se puede haber leido, y volver a leerlo lanza. Ademas el cuerpo
 * crudo es lo que hay que hashear para la firma, asi que guardarlo es
 * obligatorio. Se lee una vez y se devuelve como string: si viene JSON, el
 * desarrollo lo formatea.
 */
async function cuerpoComoTexto(peticion: Request): Promise<string> {
  try {
    const texto = await peticion.text()
    // Se acota. Un webhook son unos cientos de bytes; si llegan varios
    // megabytes, no es un webhook y no vale la pena guardarlo.
    return texto.length > 8000 ? `${texto.slice(0, 8000)}...` : texto
  } catch {
    return '<no se pudo leer el cuerpo>'
  }
}
