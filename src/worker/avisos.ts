/**
 * Avisos al dueño de la tienda cuando le eligen o le compran un producto.
 *
 * ============================================================================
 *  QUE HACE
 * ============================================================================
 * Guarda el hecho en `avisos` (lo que el vendedor ve en su panel) y despues,
 * canal por canal, intenta avisarle por correo, WhatsApp y SMS. Cada intento
 * queda en `avisos_envios` con su estado.
 *
 * ============================================================================
 *  POR QUE SE GUARDA ANTES DE ENVIAR
 * ============================================================================
 * Porque "el vendedor tiene un aviso" y "al vendedor le llego el mensaje" son
 * dos cosas distintas, y confundirlas pierde avisos. Si el SMS falla —y en Cuba
 * el SMS falla— el hecho tiene que seguir ahi. El aviso se inserta primero y el
 * envio es lo que puede fallar sin llevarselo por delante.
 *
 * ============================================================================
 *  POR QUE NINGUN ENVIO PUEDE ROMPER AL QUE LLAMA
 * ============================================================================
 * Esto corre dentro de `POST /api/carrito`. Si mandar el correo lanza, el
 * comprador veria un error al anadir al carrito por un problema de un tercero
 * que no tiene nada que ver con su compra. Por eso cada canal se intenta dentro
 * de un `try` y un fallo solo se escribe en `avisos_envios`, nunca se propaga.
 *
 * ============================================================================
 *  EL SMS Y CUBA
 * ============================================================================
 * Twilio dejo de entregar SMS a Cuba el 15-sep-2025, y ETECSA se cae seguido.
 * Eso NO se resuelve aqui: aqui se manda y se registra si salio. Que llegue o no
 * depende del proveedor que se configure. Por eso el estado distingue
 * 'sin_configurar' de 'error': si falta la credencial, no hay nada que
 * reintentar, solo una variable que poner.
 *
 * ============================================================================
 *  SECRETOS QUE SE LEEN (todos opcionales)
 * ============================================================================
 *   CORREO_API_KEY, CORREO_REMITENTE      -> proveedor de correo (Resend)
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID     -> WhatsApp Cloud API de Meta
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *   TWILIO_FROM                           -> SMS (Twilio)
 *
 * Un canal sin sus secretos queda en 'sin_configurar' y no intenta nada. Por
 * eso el panel funciona desde el primer despliegue, aunque todavia no haya
 * proveedor: el aviso siempre queda.
 */

import { type Env } from './entorno'

/** El hecho que genera el aviso. */
export interface DatosAviso {
  vendedorId: number
  tipo: 'carrito' | 'compra'
  productoId: number | null
  productoTitulo: string
  cantidad: number
  comprador: {
    usuarioId: number | null
    nombre: string
    email: string
    telefono: string
  }
}

type Canal = 'panel' | 'correo' | 'whatsapp' | 'sms'
type Estado = 'pendiente' | 'enviado' | 'error' | 'sin_configurar'

/** Deja el numero como E.164 sin inventar pais: solo quita lo que no es digito. */
function aE164(crudo: string): string {
  const digitos = (crudo || '').replace(/[^0-9]/g, '')
  return digitos ? `+${digitos}` : ''
}

/** Registra un intento de envio. Su propio fallo no puede tumbar nada. */
async function registrarEnvio(
  env: Env,
  avisoId: number,
  canal: Canal,
  destino: string,
  estado: Estado,
  detalle: string,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO avisos_envios (aviso_id, canal, destino, estado, detalle)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(avisoId, canal, destino, estado, detalle.slice(0, 500))
      .run()
  } catch {
    // Registrar el intento es diagnostico, no parte del aviso. Si esto falla,
    // el aviso ya esta guardado: se sigue.
  }
}

/** Asunto y cuerpo del aviso, iguales para los tres canales de texto. */
function textoAviso(datos: DatosAviso): { asunto: string; cuerpo: string } {
  const quien = datos.comprador.nombre || datos.comprador.email || 'Alguien sin cuenta'
  const accion = datos.tipo === 'carrito' ? 'anadio a su carrito' : 'compro'
  const contacto = datos.comprador.telefono
    ? `\nTelefono del comprador: ${datos.comprador.telefono}`
    : ''
  return {
    asunto:
      datos.tipo === 'carrito'
        ? `Alguien quiere tu producto: ${datos.productoTitulo}`
        : `Vendiste tu producto: ${datos.productoTitulo}`,
    cuerpo:
      `${quien} ${accion} "${datos.productoTitulo}" (cantidad: ${datos.cantidad}).` +
      contacto +
      `\n\nEntra a tu panel para ver el detalle.`,
  }
}

/** Correo por Resend. */
async function enviarCorreo(
  env: Env,
  destino: string,
  asunto: string,
  cuerpo: string,
): Promise<{ estado: Estado; detalle: string }> {
  if (!env.CORREO_API_KEY || !env.CORREO_REMITENTE) {
    return { estado: 'sin_configurar', detalle: 'Falta CORREO_API_KEY o CORREO_REMITENTE' }
  }
  if (!destino.trim()) return { estado: 'error', detalle: 'La tienda no tiene correo' }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CORREO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.CORREO_REMITENTE,
        to: [destino.trim()],
        subject: asunto,
        text: cuerpo,
      }),
    })
    if (!r.ok) return { estado: 'error', detalle: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` }
    return { estado: 'enviado', detalle: '' }
  } catch (e) {
    return { estado: 'error', detalle: e instanceof Error ? e.message : 'fallo de red' }
  }
}

/** WhatsApp Cloud API de Meta. */
async function enviarWhatsapp(
  env: Env,
  destino: string,
  cuerpo: string,
): Promise<{ estado: Estado; detalle: string }> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    return { estado: 'sin_configurar', detalle: 'Falta WHATSAPP_TOKEN o WHATSAPP_PHONE_ID' }
  }
  const numero = aE164(destino)
  if (!numero) return { estado: 'error', detalle: 'La tienda no tiene WhatsApp' }
  try {
    const r = await fetch(
      `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numero,
          type: 'text',
          text: { body: cuerpo },
        }),
      },
    )
    if (!r.ok) return { estado: 'error', detalle: `WhatsApp ${r.status}: ${(await r.text()).slice(0, 200)}` }
    return { estado: 'enviado', detalle: '' }
  } catch (e) {
    return { estado: 'error', detalle: e instanceof Error ? e.message : 'fallo de red' }
  }
}

/** SMS por Twilio. Ojo con Cuba: Twilio ya no entrega ahi (ver arriba). */
async function enviarSms(
  env: Env,
  destino: string,
  cuerpo: string,
): Promise<{ estado: Estado; detalle: string }> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
    return { estado: 'sin_configurar', detalle: 'Falta TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_FROM' }
  }
  const numero = aE164(destino)
  if (!numero) return { estado: 'error', detalle: 'La tienda no tiene telefono' }
  try {
    const cuerpoForm = new URLSearchParams({ From: env.TWILIO_FROM, To: numero, Body: cuerpo })
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: cuerpoForm,
      },
    )
    if (!r.ok) return { estado: 'error', detalle: `Twilio ${r.status}: ${(await r.text()).slice(0, 200)}` }
    return { estado: 'enviado', detalle: '' }
  } catch (e) {
    return { estado: 'error', detalle: e instanceof Error ? e.message : 'fallo de red' }
  }
}

/**
 * Genera el aviso y reparte los envios.
 *
 * Nunca lanza. Devuelve el id del aviso guardado, o `null` si ni siquiera se
 * pudo guardar (lo unico que de verdad importa).
 */
export async function avisarVendedor(env: Env, datos: DatosAviso): Promise<number | null> {
  const { asunto, cuerpo } = textoAviso(datos)

  let avisoId: number
  try {
    const creado = await env.DB.prepare(
      `INSERT INTO avisos
         (vendedor_id, tipo, producto_id, producto_titulo, cantidad,
          comprador_usuario_id, comprador_nombre, comprador_email, comprador_telefono)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        datos.vendedorId,
        datos.tipo,
        datos.productoId,
        datos.productoTitulo,
        datos.cantidad,
        datos.comprador.usuarioId,
        datos.comprador.nombre,
        datos.comprador.email,
        datos.comprador.telefono,
      )
      .run()
    avisoId = Number(creado.meta.last_row_id)
  } catch {
    return null
  }

  // El panel es el unico canal que no depende de nadie: el aviso ya esta.
  await registrarEnvio(env, avisoId, 'panel', '', 'enviado', '')

  // El destino sale del contacto de la tienda y de su correo de cuenta. Se lee
  // aqui y no se pasa desde el carrito porque el carrito no tiene por que saber
  // como se avisa.
  const contacto = await env.DB.prepare(
    `SELECT v.email AS vendedor_email,
            c.correo, c.whatsapp, c.telefono
       FROM vendedores v
       LEFT JOIN contacto_vendedor c ON c.vendedor_id = v.id
      WHERE v.id = ?`,
  )
    .bind(datos.vendedorId)
    .first<{
      vendedor_email: string | null
      correo: string | null
      whatsapp: string | null
      telefono: string | null
    }>()
    .catch(() => null)

  const correo = (contacto?.correo || contacto?.vendedor_email || '').trim()
  const whatsapp = (contacto?.whatsapp || '').trim()
  const telefono = (contacto?.telefono || '').trim()

  const rCorreo = await enviarCorreo(env, correo, asunto, cuerpo)
  await registrarEnvio(env, avisoId, 'correo', correo, rCorreo.estado, rCorreo.detalle)

  const rWa = await enviarWhatsapp(env, whatsapp, cuerpo)
  await registrarEnvio(env, avisoId, 'whatsapp', whatsapp, rWa.estado, rWa.detalle)

  const rSms = await enviarSms(env, telefono, cuerpo)
  await registrarEnvio(env, avisoId, 'sms', telefono, rSms.estado, rSms.detalle)

  return avisoId
}
