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
import { RUTAS } from '../constantes'
import type { Env } from '../entorno'

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
        // en `wrangler.api.toml`, asi que no revela nada nuevo, y sin el
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

  // A partir de aqui empiezan a hacer falta las 0004 y 0005.
  //
  // Cuando se escriban, el orden va a ser:
  //
  //   1. Registrar el evento en `webhooks_recibidos`. Si ya esta, se responde
  //      200 sin procesar: es un reintento de la pasarela, y procesarlo otra vez
  //      cobraria dos veces al comprador o entregaria el archivo dos veces.
  //   2. Verificar la firma con el secreto. Si no coincide, 401.
  //   3. Verificar el timestamp contra `VENTANA_TIMESTAMP_SEG`. Si esta fuera,
  //      401: un webhook con timestamp viejo es una repeticion enviada a mano.
  //   4. Buscar la transaccion por la referencia de la pasarela.
  //   5. Moverla de 'pendiente' a 'pagado', guardar `verificado_at`, y crear la
  //      fila en `biblioteca` para que el comprador pueda descargar.
  //
  // El orden importa: registrar antes de verificar evita que alguien que no
  // tiene el secreto llene la tabla de `webhooks_recibidos` con basura. Por eso
  // el paso 1 tiene que comprobar la firma despues de insertar y borrar la fila
  // si no cuadra, o equivalentemente registrar con una columna `verificado`.

  return json(
    {
      ok: false,
      codigo: 'no_implementado',
      mensaje: `${pasarela} esta configurada, pero el procesamiento del pago todavia no esta escrito.`,
    },
    501,
  )
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
