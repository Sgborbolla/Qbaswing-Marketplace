/**
 * Cobro: convierte el carrito en ordenes de compra.
 *
 * ============================================================================
 *  QUE ES UNA ORDEN Y POR QUE NO ES "EL CARRITO"
 * ============================================================================
 * El carrito es una intencion; la orden es un pedido con un precio congelado y
 * una referencia con la que se cobra. Se separan porque el carrito se toca mil
 * veces y la orden no se toca nunca: nace con su comision, su regla y su total
 * escritos, y a partir de ahi solo cambia de estado.
 *
 * ============================================================================
 *  UNA ORDEN POR VENDEDOR, MONEDA Y REGLA
 * ============================================================================
 * `transacciones` guarda UNA sola `regla_aplicada` y UNA sola `moneda`, y el
 * dinero de la Regla A va por la pasarela mientras el de la B y la C va directo
 * al autor. Meterse dos vendedores, dos monedas o dos reglas en una sola fila
 * obligaria a inventar una regla "mixta" y un total que no significa nada.
 *
 * Por eso el carrito se PARTE: cada combinacion (vendedor, moneda, regla) es una
 * orden con su referencia. Un carrito de un solo vendedor, una sola moneda y una
 * sola regla —el caso normal— produce una sola orden.
 *
 * ============================================================================
 *  LA COMISION SE CONGELA AQUI
 * ===========================================================================
 * El 5% de la Regla A se calcula y se guarda en el momento de crear la orden.
 * Si el Owner cambia el porcentaje manana, la orden vieja conserva el suyo: lo
 * que se le prometio al comprador no cambia porque cambie una politica.
 *
 * La comision sale del vendedor, no se suma al comprador: `total = subtotal`
 * (el comprador paga el precio que vio) y `neto_vendedor` es lo que le queda al
 * autor despues de retener. El documento maestro lo dice asi: "la plataforma
 * retiene el 5% y entrega el 95% al autor".
 *
 * ============================================================================
 *  LA REFERENCIA VA EN EL PAGO
 * ===========================================================================
 * `MP-CU-XXXX-XXX`. El segmento del medio dice la moneda fuerte de la orden y
 * los dos grupos finales son azar. Se genera en el servidor y se guarda con
 * `UNIQUE`: una referencia adivinada o repetida la rechaza la base, no un `if`.
 */

import { ErrorApi } from './constantes'
import { type Env } from './entorno'
import type { UsuarioSesion } from './routers/registro'
import { PASARELAS, puedeTransicionar, type EstadoPago, type Pasarela, type ClasePasarela } from '../lib/pagos'
import { bucketDe } from '../lib/monedas'
import { avisarVendedor } from './avisos'

/** El porcentaje que retiene la plataforma, por regla. A retiene; B y C no. */
const COMISION_POR_REGLA: Record<'A' | 'B' | 'C', number> = { A: 5, B: 0, C: 0 }

/** Letras y digitos sin los que se confunden al leerlos en voz alta (O/0, I/1). */
const ALFABETO_REFERENCIA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** El segmento de moneda de la referencia. */
function segmentoMoneda(moneda: string): string {
  if (moneda === 'CUP') return 'CU'
  if (moneda === 'USD') return 'US'
  return 'EU'
}

/** `n` caracteres al azar del alfabeto, con el generador del sistema. */
function azar(n: number): string {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  let salida = ''
  for (const b of bytes) salida += ALFABETO_REFERENCIA[b % ALFABETO_REFERENCIA.length]
  return salida
}

/** Una referencia nueva, con la forma del documento maestro. */
export function nuevaReferencia(moneda: string): string {
  return `MP-${segmentoMoneda(moneda)}-${azar(4)}-${azar(3)}`
}

/** Una linea del carrito, con lo que hace falta para cobrarla. */
interface LineaCarrito {
  carritoItemId: number
  productoId: number
  vendedorId: number
  vendedorSlug: string | null
  productoTitulo: string
  cantidad: number
  precioUnitario: number
  monedaCodigo: string
  regla: 'A' | 'B' | 'C'
  publicado: number
}

/** La orden ya creada, tal como se devuelve al cliente. */
export interface OrdenCreada {
  id: number
  referencia: string
  moneda: string
  monedaCodigo: string
  pasarela: Pasarela
  regla: 'A' | 'B' | 'C'
  subtotal: number
  comision: number
  total: number
  estado: string
  vendedorId: number
  vendedorSlug: string | null
  productos: { productoId: number; titulo: string; cantidad: number; precioUnitario: number }[]
}

/**
 * Lee el carrito con los campos que necesita el cobro.
 *
 * No reutiliza el SELECT del carrito porque son cosas distintas: alli se pinta
 * (nombre, variante, vendedor), aqui se cobra (regla, vendedor id, moneda real).
 * Compartir una consulta obligaria a traer las columnas de las dos en cada uso.
 */
async function leerLineas(
  db: D1Database,
  carritoId: number,
): Promise<LineaCarrito[]> {
  const { results } = await db
    .prepare(
      `SELECT ci.id AS carrito_item_id,
              ci.cantidad,
              ci.precio_unitario,
              COALESCE(ci.moneda_codigo, ci.moneda) AS moneda_codigo,
              p.id AS producto_id,
              p.vendedor_id,
              p.titulo,
              p.publicado,
              p.regla,
              v.slug AS vendedor_slug
         FROM carrito_items ci
         JOIN productos p ON p.id = ci.producto_id
         LEFT JOIN vendedores v ON v.id = p.vendedor_id
        WHERE ci.carrito_id = ?
        ORDER BY ci.id`,
    )
    .bind(carritoId)
    .all<{
      carrito_item_id: number
      cantidad: number
      precio_unitario: number
      moneda_codigo: string
      producto_id: number
      vendedor_id: number
      titulo: string
      publicado: number
      regla: 'A' | 'B' | 'C'
      vendedor_slug: string | null
    }>()

  return results.map((f) => ({
    carritoItemId: f.carrito_item_id,
    productoId: f.producto_id,
    vendedorId: f.vendedor_id,
    vendedorSlug: f.vendedor_slug,
    productoTitulo: f.titulo,
    cantidad: f.cantidad,
    precioUnitario: f.precio_unitario,
    monedaCodigo: f.moneda_codigo,
    regla: f.regla,
    publicado: f.publicado,
  }))
}

/** El resultado del cobro: las ordenes creadas, sin el carrito (lo relee quien llama). */
export interface ResultadoCobro {
  ordenes: OrdenCreada[]
}

/**
 * Crea las ordenes del carrito y lo vacia.
 *
 * El orden importa: primero se crean las ordenes, luego se avisa a los
 * vendedores y SOLO AL FINAL se vacia el carrito. Si algo falla antes del final,
 * el comprador conserva su carrito y puede reintentar; nunca se queda sin
 * pedido y sin carrito a la vez.
 */
export async function cobrarCarrito(
  env: Env,
  carritoId: number,
  usuario: UsuarioSesion,
  pasarela: Pasarela,
): Promise<ResultadoCobro> {
  const definicion = PASARELAS[pasarela]
  if (!definicion) {
    throw ErrorApi.invalido('pasarela', 'Esa forma de pago no existe.')
  }

  const lineas = await leerLineas(env.DB, carritoId)
  if (lineas.length === 0) {
    throw new ErrorApi('carrito_vacio', 'El carrito esta vacio.', 400)
  }

  // Un producto retirado no se puede cobrar. Se comprueba ANTES de tocar la
  // base para no dejar una orden a medias por un producto que ya no esta.
  const retirados = lineas.filter((l) => l.publicado !== 1)
  if (retirados.length > 0) {
    const titulos = retirados.map((l) => l.productoTitulo).join(', ')
    throw new ErrorApi(
      'producto_no_disponible',
      `Estos productos ya no estan disponibles: ${titulos}. Quitalos del carrito para pagar.`,
      409,
    )
  }

  // Se agrupa por (vendedor, moneda real, regla). El mapa conserva el orden de
  // insercion, asi que las ordenes salen en el orden en que se anadieron.
  const grupos = new Map<string, LineaCarrito[]>()
  for (const linea of lineas) {
    const clave = `${linea.vendedorId}|${linea.monedaCodigo}|${linea.regla}`
    const lista = grupos.get(clave) ?? []
    lista.push(linea)
    grupos.set(clave, lista)
  }

  const ordenes: OrdenCreada[] = []

  for (const lista of grupos.values()) {
    const primera = lista[0]
    const monedaCodigo = primera.monedaCodigo
    const regla = primera.regla

    // La pasarela tiene que aceptar la moneda de ESTA orden. No se comprueba una
    // vez por carrito porque una orden en CUP y otra en USD pueden convivir, y
    // hay pasarelas (cripto) que solo cobran USD.
    if (!definicion.monedas.includes(monedaCodigo as 'CUP' | 'USD' | 'EUR')) {
      throw new ErrorApi(
        'moneda_no_soportada',
        `La forma de pago "${definicion.nombre}" no cobra en ${monedaCodigo}.`,
        409,
      )
    }

    // La Regla A OBLIGA a pasar por la plataforma: su 5% solo existe si el dinero
    // pasa por la pasarela. Para la A, la pasarela tiene que ser de clase webhook
    // (QvaPay o TropiPay), que son las que confirman el pago solas.
    if (regla === 'A' && definicion.clase !== 'webhook') {
      throw new ErrorApi(
        'regla_a_gateway',
        'Los productos de Regla A solo se pueden pagar por QvaPay o TropiPay.',
        409,
      )
    }

    const subtotal = lista.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0)
    const porcentaje = COMISION_POR_REGLA[regla]
    const comision = lista.reduce(
      (s, l) => s + Math.round((l.precioUnitario * l.cantidad * porcentaje) / 100),
      0,
    )
    const bucket = bucketDe(monedaCodigo)

    const orden = await insertarOrden(env, usuario.id, pasarela, bucket, monedaCodigo, regla, subtotal, comision, lista)

    ordenes.push({
      id: orden.id,
      referencia: orden.referencia,
      moneda: bucket,
      monedaCodigo,
      pasarela,
      regla,
      subtotal,
      comision,
      total: subtotal,
      estado: 'pendiente',
      vendedorId: primera.vendedorId,
      vendedorSlug: primera.vendedorSlug,
      productos: lista.map((l) => ({
        productoId: l.productoId,
        titulo: l.productoTitulo,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
      })),
    })

    // El aviso al vendedor. Va despues de la orden y NUNCA puede tumbar el
    // cobro: `avisarVendedor` se traga sus propios errores. Una compra no se
    // pierde porque falle un SMS.
    for (const linea of lista) {
      await avisarVendedor(env, {
        vendedorId: linea.vendedorId,
        tipo: 'compra',
        productoId: linea.productoId,
        productoTitulo: linea.productoTitulo,
        cantidad: linea.cantidad,
        comprador: {
          usuarioId: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          telefono: '',
        },
      })
    }
  }

  // El carrito se vacia SOLO cuando todas las ordenes estan creadas. Se borra el
  // carrito entero y no linea a linea: todo lo que habia se acaba de cobrar.
  await env.DB.prepare('DELETE FROM carrito_items WHERE carrito_id = ?').bind(carritoId).run()

  return { ordenes }
}

/** Inserta la cabecera y sus lineas. Reintenta si la referencia choca. */
async function insertarOrden(
  env: Env,
  usuarioId: number,
  pasarela: Pasarela,
  bucket: string,
  monedaCodigo: string,
  regla: 'A' | 'B' | 'C',
  subtotal: number,
  comision: number,
  lista: LineaCarrito[],
): Promise<{ id: number; referencia: string }> {
  // Cinco intentos. La probabilidad de chocar con 31^7 combinaciones es nula;
  // el bucle existe para que un fallo de azar no sea un 500, no porque se espere
  // que choque.
  for (let intento = 0; intento < 5; intento++) {
    const referencia = nuevaReferencia(bucket)
    try {
      const creada = await env.DB.prepare(
        `INSERT INTO transacciones
           (referencia, usuario_id, pasarela, moneda, moneda_codigo,
            subtotal, comision_qbaswing, total, regla_aplicada, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      )
        .bind(referencia, usuarioId, pasarela, bucket, monedaCodigo, subtotal, comision, subtotal, regla)
        .run()

      const id = Number(creada.meta.last_row_id)

      const porcentaje = COMISION_POR_REGLA[regla]
      try {
        for (const linea of lista) {
          const bruto = linea.precioUnitario * linea.cantidad
          const neto = bruto - Math.round((bruto * porcentaje) / 100)
          await env.DB.prepare(
            `INSERT INTO transaccion_items
               (transaccion_id, producto_id, cantidad, precio_unitario, neto_vendedor)
             VALUES (?, ?, ?, ?, ?)`,
          )
            .bind(id, linea.productoId, linea.cantidad, linea.precioUnitario, neto)
            .run()
        }
      } catch (error) {
        // No hay transacciones de varias sentencias en D1 desde un Worker. Si
        // una linea falla, se borra la cabecera para no dejar una orden sin
        // detalle, que seria un pedido que nadie puede entregar.
        await env.DB.prepare('DELETE FROM transacciones WHERE id = ?').bind(id).run().catch(() => {})
        throw error
      }

      return { id, referencia }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : ''
      // Solo se reintenta si el choque es de la referencia. Cualquier otro error
      // (una pasarela que el CHECK no acepta, un id de usuario que no existe) se
      // propaga: reintentarlo cinco veces solo repite el mismo fallo.
      if (!/UNIQUE|referencia/i.test(mensaje)) throw error
    }
  }

  throw new ErrorApi('referencia_agotada', 'No se pudo generar la referencia. Intentalo de nuevo.', 500)
}

/* ===========================================================================
 * Confirmacion
 * ======================================================================== */

/** Se lee la orden para saber de que estado sale antes de moverla. */
export interface OrdenResumen {
  id: number
  referencia: string
  usuario_id: number
  pasarela: Pasarela
  moneda: string
  estado: EstadoPago
  total: number
}

/** La prueba que autoriza el cambio de estado. */
export interface Evidencia {
  clase: ClasePasarela
  crudo: string
  hash?: string | null
  confirmadoPor?: number | null
  montoVerificado?: number | null
  moneda?: 'CUP' | 'USD' | 'EUR' | null
}

/** Busca una orden por su referencia visible. */
export async function ordenPorReferencia(
  env: Env,
  referencia: string,
): Promise<OrdenResumen | null> {
  const fila = await env.DB.prepare(
    `SELECT id, referencia, usuario_id, pasarela, moneda, estado, total
       FROM transacciones WHERE referencia = ?`,
  )
    .bind(referencia)
    .first<OrdenResumen>()
  return fila ?? null
}

/**
 * Mueve una orden de estado y deja constancia.
 *
 * ============================================================================
 *  NINGUN CAMBIO SIN EVIDENCIA
 * ===========================================================================
 * Cada transicion escribe una fila en `evidencias_pago` con su texto crudo. Ese
 * es el punto entero de la tabla: dentro de seis meses, cuando alguien pregunte
 * por que esta compra se dio por pagada, la respuesta esta en la base y no en la
 * memoria de nadie.
 *
 * ============================================================================
 *  LA TRANSICION SE VALIDA CON EL MAPA, NO CON `if`s
 * ===========================================================================
 * `puedeTransicionar` viene de `src/lib/pagos.ts`, la misma que usa el sitio.
 * Sin ella se podria pasar de `verificado` a `pendiente`, que es "reabrir" un
 * pago ya cobrado para volver a cobrarlo.
 */
export async function cambiarEstado(
  env: Env,
  orden: OrdenResumen,
  hacia: EstadoPago,
  evidencia: Evidencia,
): Promise<{ entregados: number }> {
  if (!puedeTransicionar(orden.estado, hacia)) {
    throw new ErrorApi(
      'transicion_invalida',
      `Una orden ${orden.estado} no puede pasar a ${hacia}.`,
      409,
    )
  }

  // La evidencia PRIMERO. Si se marcara pagada y luego fallara el registro,
  // quedaria un pago confirmado sin prueba, que es justo lo que hay que evitar.
  await env.DB.prepare(
    `INSERT INTO evidencias_pago
       (transaccion_id, clase, crudo, hash, confirmado_por, monto_verificado, moneda)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      orden.id,
      evidencia.clase,
      (evidencia.crudo ?? '').slice(0, 4000),
      evidencia.hash ?? null,
      evidencia.confirmadoPor ?? null,
      evidencia.montoVerificado ?? null,
      evidencia.moneda ?? orden.moneda,
    )
    .run()

  const verificadoAt =
    hacia === 'verificado'
      ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
      : 'verificado_at'

  await env.DB.prepare(
    `UPDATE transacciones
        SET estado = ?, verificado_at = ${verificadoAt}
      WHERE id = ?`,
  )
    .bind(hacia, orden.id)
    .run()

  // Una compra verificada entrega los digitales a la biblioteca del comprador.
  // Se hace solo al VERIFICAR; un rechazo no entrega nada.
  let entregados = 0
  if (hacia === 'verificado') {
    entregados = await entregarBiblioteca(env, orden)
  }

  return { entregados }
}

/**
 * Mete en la biblioteca del comprador los productos digitales de la orden.
 *
 * Solo los digitales: una biblioteca es de archivos, y un producto fisico no
 * tiene nada que re-descargar.
 *
 * El `INSERT OR IGNORE` se apoya en el `UNIQUE (usuario_id, producto_id)` de la
 * tabla: si el comprador ya tiene ese producto (lo compro antes), no se duplica
 * ni se pisa su fila vieja.
 *
 * `expira_at` tiene que ser NULL si y solo si `vitalicia = 1`, o el disparador
 * `trg_biblioteca_vitalicia` aborta el INSERT. Por eso un digital no marcado
 * como vitalicio recibe una fecha (un año), y uno vitalicio, NULL.
 */
async function entregarBiblioteca(env: Env, orden: OrdenResumen): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT ti.producto_id, p.tipo, p.vitalicia, p.publicado
       FROM transaccion_items ti
       JOIN productos p ON p.id = ti.producto_id
      WHERE ti.transaccion_id = ?`,
  )
    .bind(orden.id)
    .all<{ producto_id: number; tipo: string; vitalicia: number | null; publicado: number }>()

  let entregados = 0
  for (const fila of results) {
    if (fila.tipo !== 'digital') continue

    // Nulo es "producto de antes de la columna": el documento maestro ofrece
    // re-descarga perpetua, asi que se trata como vitalicio.
    const vitalicia = fila.vitalicia === 0 ? 0 : 1
    const expira =
      vitalicia === 1
        ? null
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO biblioteca
         (usuario_id, producto_id, transaccion_id, vitalicia, expira_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(orden.usuario_id, fila.producto_id, orden.id, vitalicia, expira)
      .run()

    if ((r.meta.changes ?? 0) > 0) entregados++
  }

  return entregados
}
