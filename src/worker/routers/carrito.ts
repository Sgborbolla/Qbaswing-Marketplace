/**
 * Router del carrito: `/api/carrito`.
 *
 * ============================================================================
 *  QUE HACE Y QUE NO
 * ============================================================================
 *   GET    /api/carrito    el carrito de quien pregunta
 *   POST   /api/carrito    anade un producto
 *   DELETE /api/carrito    quita un producto, o vacia el carrito entero
 *
 * NO HACE NADA DE COBRAR. Cobrar es `/api/pagos`, que es otra ruta y otro
 * archivo. Aqui solo hay lineas de carrito. La razon no es purismo: el carrito
 * se puede tocar mil veces antes de que alguien pague, y mezclar las dos cosas
 * hace que un "anadir al carrito" pueda tocar dinero.
 *
 * ============================================================================
 *  POR QUE SIRVE SIN ESTAR DENTRO
 * ============================================================================
 * Porque casi nadie tiene cuenta cuando ve algo que quiere comprar. Si el
 * carrito exigiera entrar, habria que registrarse antes de saber si el producto
 * servia, y se pierde la venta en ese paso.
 *
 * Por eso `carritos` tiene dos columnas: `usuario_id` para quien esta dentro y
 * `token` para quien no. Cuando alguien entra con un carrito anonimo, sus lineas
 * se le pasan de una vez. Ese volcado se hace en `/api/sesion` al abrir sesion.
 *
 * ============================================================================
 *  EL PRECIO SE CONGELA AL ANADIR
 * ============================================================================
 * `precio_unitario` se guarda en el momento de anadir y no se vuelve a leer del
 * producto. Si el vendedor sube el precio, el carrito tiene que SEGUIR
 * mostrando lo que el comprador vio, y el cambio se avisa al pagar. Si aqui se
 * leyera el precio actual, un carrito abierto de noche podria costar mas por la
 * manana, y el comprador no tendria como enterarse.
 *
 * Lo que si se comprueba al anadir es que el precio siga siendo el mismo que
 * tiene el producto ahora. Si no, el carrito se queda con lo que habia y el
 * cambio se ve al pagar. Asi el comprador nunca paga un precio que no ha visto.
 */

import { ErrorApi, RUTAS } from '../constantes'
import { type Env } from '../entorno'
import { json } from '../http'
import { usuarioDePeticion } from './registro'

/** Escribe un numero aleatorio en hexadecimal, para el token de carrito anonimo. */
function tokenNuevo(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Cabecera donde viaja el token del carrito de quien no esta dentro. */
const CABECERA_TOKEN_CARRITO = 'X-QBASWing-Carrito'

/**
 * El carrito de esta peticion.
 *
 * Primero se busca el de la sesion, y si no hay sesion, el del token que manda
 * la cabecera. En ese orden y no al reves: si alguien esta dentro, su carrito es
 * el de la cuenta, aunque llegue con un token anonimo en la cabecera. Un token
 * anonimo no puede reclamar la sesion de otro.
 */
async function carritoDe(
  db: D1Database,
  peticion: Request,
  usuario: { id: number } | null,
) {
  if (usuario) {
    const existente = await db
      .prepare('SELECT id, token FROM carritos WHERE usuario_id = ? ORDER BY id DESC LIMIT 1')
      .bind(usuario.id)
      .first<{ id: number; token: string | null }>()

    if (existente) return existente

    // Primer carrito de la cuenta. Se crea ya con token para que el mismo
    // navegador pueda Mandar el mismo token desde ahi en adelante.
    const token = tokenNuevo()
    const creado = await db
      .prepare('INSERT INTO carritos (usuario_id, token) VALUES (?, ?)')
      .bind(usuario.id, token)
      .run()

    return { id: Number(creado.meta.last_row_id), token }
  }

  const token = peticion.headers.get(CABECERA_TOKEN_CARRITO)
  if (token && /^[a-f0-9]{32}$/.test(token)) {
    const existente = await db
      .prepare('SELECT id, token FROM carritos WHERE token = ? AND usuario_id IS NULL')
      .bind(token)
      .first<{ id: number; token: string | null }>()

    if (existente) return existente
  }

  // Carrito nuevo de alguien que no esta dentro. Nace VACIO: un carrito con
  // lineas que nadie ha pedido seria un sitio donde meter cosas gratis.
  const nuevo = tokenNuevo()
  const creado = await db
    .prepare('INSERT INTO carritos (token) VALUES (?)')
    .bind(nuevo)
    .run()

  return { id: Number(creado.meta.last_row_id), token: nuevo }
}

/**
 * El carrito, con lo que hay dentro y cuanto cuesta.
 *
 * Los nombres y los precios salen de una consulta unida a `productos`, no de lo
 * que guardo `carrito_items`. Se lee del producto actual porque el NOMBRE no
 * cambia: si el vendedor renombra el producto, el comprador tiene que ver el
 * nombre nuevo. El precio es el congelado, y por eso se pide el actual aparte
 * para poder avisar cuando no coincidan.
 */
const SQL_CARRITO = `
  SELECT
    ci.id,
    ci.cantidad,
    ci.precio_unitario,
    ci.moneda,
    ci.producto_id,
    ci.variante_id,
    p.slug,
    p.titulo,
    p.precio AS precio_actual,
    p.publicado,
    pv.nombre AS variante_nombre,
    v.slug AS vendedor_slug
    FROM carrito_items ci
    JOIN productos p ON p.id = ci.producto_id
    LEFT JOIN producto_variantes pv ON pv.id = ci.variante_id
    LEFT JOIN vendedores v ON v.id = p.vendedor_id
   WHERE ci.carrito_id = ?
   ORDER BY ci.id
`

/**
 * Lee y monta el carrito.
 *
 * `moneda` se mira de la primera linea y no de cada producto. Un carrito con
 * lineas en monedas distintas no tiene un total: se mezcla una cantidad en USD
 * con otra en CUP y la suma no significa nada. Por eso se devuelve el desglose y
 * el total va por moneda.
 */
async function leerCarrito(db: D1Database, carritoId: number) {
  const filas = await db.prepare(SQL_CARRITO).bind(carritoId).all<{
    id: number
    cantidad: number
    precio_unitario: number
    moneda: string
    producto_id: number
    variante_id: number | null
    slug: string
    titulo: string
    precio_actual: number
    publicado: number
    variante_nombre: string | null
    vendedor_slug: string | null
  }>()

  const lineas = filas.results.map((f) => ({
    id: f.id,
    cantidad: f.cantidad,
    // El precio congelado es el que se cobra. El actual va aparte SOLO para
    // poder decir "cambio desde que lo anadiste" sin alterar la cuenta.
    precioUnitario: f.precio_unitario,
    moneda: f.moneda,
    subtotal: f.precio_unitario * f.cantidad,
    producto: {
      id: f.producto_id,
      slug: f.slug,
      titulo: f.titulo,
      variante: f.variante_nombre,
      vendedorSlug: f.vendedor_slug,
      // Un producto que se ha retirado sigue en el carrito: borrarlo solo
      // haria desaparecer cosas que el comprador habia elegido. Se marca y se
      // dice en la pagina, que es la unica decision honesta.
      disponible: f.publicado === 1,
      // Solo cuando el precio ha cambiado de verdad. Un producto retirado con el
      // precio igual no genera aviso de precio, sino solo de retirada.
      precioCambiado: f.precio_actual !== f.precio_unitario,
      precioActual: f.precio_actual,
    },
  }))

  // Totales por moneda. Un numero redondito es mas util que un desglose, pero
  // un total unico con monedas mezcladas seria mentira, asi que hay uno por
  // moneda.
  const totales = new Map<string, { unidades: number; subtotal: number }>()
  for (const linea of lineas) {
    const actual = totales.get(linea.moneda) ?? { unidades: 0, subtotal: 0 }
    actual.unidades += linea.cantidad
    actual.subtotal += linea.subtotal
    totales.set(linea.moneda, actual)
  }

  return {
    lineas,
    totales: Array.from(totales, ([moneda, t]) => ({ moneda, ...t })),
    vacio: lineas.length === 0,
    // Si algo esta retirado o ha cambiado de precio, la pagina avisa antes de ir
    // a pagar. Es informacion que el comprador tiene que tener ANTES de pagar,
    // no despues.
    hayAvisos: lineas.some((l) => !l.producto.disponible || l.producto.precioCambiado),
  }
}

/** Lee el cuerpo JSON. Un cuerpo que no es objeto, no. */
async function cuerpoJson(peticion: Request): Promise<Record<string, unknown>> {
  try {
    const crudo = await peticion.text()
    if (!crudo) return {}
    const valor: unknown = JSON.parse(crudo)
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return {}
    return valor as Record<string, unknown>
  } catch {
    throw new ErrorApi('json_invalido', 'Los datos enviados no se pudieron leer.', 400)
  }
}

/** Un entero de 1 a 99. */
function entero(cuerpo: Record<string, unknown>, campo: string, min = 1, max = 99): number {
  const bruto = cuerpo[campo]
  const n = typeof bruto === 'string' ? Number(bruto) : bruto
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
    throw new ErrorApi('dato_invalido', 'La cantidad no es valida.', 400)
  }
  if (n < min || n > max) {
    throw new ErrorApi('dato_invalido', 'La cantidad esta fuera de lo permitido.', 400)
  }
  return n
}

/**
 * Pasa el carrito anonimo a la cuenta al entrar o al registrarse.
 *
 * ============================================================================
 *  POR QUE ESTA AQUI Y NO EN `GET /api/carrito`
 * ============================================================================
 * El momento de mover las lineas es CUANDO SE ABRE SESION, no cuando se mira
 * el carrito. La diferencia se ve cuando alguien esta dentro, cierra sesion y
 * vuelve a entrar: si el volcado estuviera en el `GET`, sus lineas se moverian
 * de vuelta a un carrito anonimo en cada visita, y tendria que volver a estar
 * dentro para verlas.
 *
 * ============================================================================
 *  POR QUE NO PODIA FALTAR
 * ============================================================================
 * El carrito sirve para quien no esta dentro, y la mayoria de las visitas
 * empiezan asi. El visitante elige productos y ENTONCES se registra. Si al
 * registrarse su carrito se quedara vacio, habria perdido lo que iba a
 * comprar justo en el paso del que mas se duda, y no tendria forma de saber si
 * fue un fallo o si se vacio solo. Por eso esto no es una comodidad: es el paso
 * donde se pierde la venta.
 *
 * ============================================================================
 *  POR QUE SUMA Y NO MUEVE A SECO
 * ============================================================================
 * El indice unico es `(carrito_id, producto_id, variante_key)`. Mover una linea
 * tal cual a un carrito que ya tiene ese producto revienta contra el indice, y
 * el `UPDATE` a pelo no se puede hacer "sumando": habria que resolver antes si
 * choca. Por eso se pregunta primero y, si choca, se suma la cantidad en la
 * linea que ya existe, igual que haria una tienda.
 *
 * El tope de 99 es el mismo que usa el `POST`, para que entrar con el carrito
 * lleno no pueda dejar una linea por encima de lo que permite el carrito.
 *
 * @returns Cuantas lineas se movieron. 0 significa que no habia carrito
 *   anonimo, que es el caso normal de quien ya estaba dentro.
 */
export async function trasladarCarritoAnonimo(
  db: D1Database,
  peticion: Request,
  usuarioId: number,
): Promise<number> {
  const token = peticion.headers.get(CABECERA_TOKEN_CARRITO)
  if (!token || !/^[a-f0-9]{32}$/.test(token)) return 0

  /*
    El `usuario_id IS NULL` no es opcional. Sin el, el `token` de una cuenta
    tambien casaria con este SELECT, y el token de la cabecera SALE en la
    respuesta de cada peticion del carrito. Con el, solo pueden mover lineas los
    carritos que de verdad no pertenecen a nadie.
  */
  const anonimo = await db
    .prepare('SELECT id FROM carritos WHERE token = ? AND usuario_id IS NULL')
    .bind(token)
    .first<{ id: number }>()

  if (!anonimo) return 0

  const destino = await db
    .prepare('SELECT id FROM carritos WHERE usuario_id = ? ORDER BY id DESC LIMIT 1')
    .bind(usuarioId)
    .first<{ id: number }>()

  let carritoDestino = destino?.id
  if (carritoDestino === undefined) {
    const creado = await db
      .prepare('INSERT INTO carritos (usuario_id, token) VALUES (?, ?)')
      .bind(usuarioId, tokenNuevo())
      .run()
    carritoDestino = Number(creado.meta.last_row_id)
  }

  const items = await db
    .prepare('SELECT id, producto_id, variante_id, cantidad FROM carrito_items WHERE carrito_id = ?')
    .bind(anonimo.id)
    .all<{ id: number; producto_id: number; variante_id: number | null; cantidad: number }>()

  for (const item of items.results) {
    /*
      Se compara con `variante_key` y no con `variante_id`. Es la misma trampa
      del `ON CONFLICT`: `variante_id` es NULL en la mayoria de los productos y
      dos NULL nunca son iguales, asi que buscando por `variante_id` un producto
      SIN variante no encontraria jamas su linea y cada entrada crearia una
      duplicada en vez de sumarse.
    */
    const existente = await db
      .prepare(
        'SELECT id FROM carrito_items WHERE carrito_id = ? AND producto_id = ? AND variante_key = COALESCE(?, 0)',
      )
      .bind(carritoDestino, item.producto_id, item.variante_id)
      .first<{ id: number }>()

    if (existente) {
      await db
        .prepare('UPDATE carrito_items SET cantidad = MIN(cantidad + ?, 99) WHERE id = ?')
        .bind(item.cantidad, existente.id)
        .run()
      await db.prepare('DELETE FROM carrito_items WHERE id = ?').bind(item.id).run()
    } else {
      // El precio congelado viaja con la fila. No se vuelve a leer del producto:
      // el comprador tiene que pagar lo que vio al anadirlo.
      await db.prepare('UPDATE carrito_items SET carrito_id = ? WHERE id = ?').bind(carritoDestino, item.id).run()
    }
  }

  // El carrito anonimo se borra, no se deja. Si se dejara y el mismo navegador
  // volviera a mandar ese token sin sesion, `carritoDe` lo encontraria y el
  // visitante veria un carrito fantasma con lineas que ya estan en su cuenta.
  await db.prepare('DELETE FROM carritos WHERE id = ?').bind(anonimo.id).run()

  return items.results.length
}

export async function responderCarrito(
  ruta: string,
  metodo: string,
  peticion: Request,
  env: Env,
): Promise<Response> {
  if (ruta !== RUTAS.carrito) throw ErrorApi.noEncontrado('Esa ruta')

  const { usuario } = await usuarioDePeticion(env.DB, peticion, env.QBASWING_SECRETO_FIRMA)
  const carrito = await carritoDe(env.DB, peticion, usuario)

  // El token viaja SIEMPRE de vuelta, tambien para quien esta dentro: es lo que
  // permite que el navegador guarde su carrito y lo mande en cada peticion.
  const cabeceras: Record<string, string> = {}
  if (carrito.token) cabeceras[CABECERA_TOKEN_CARRITO] = carrito.token

  if (metodo === 'GET') {
    const contenido = await leerCarrito(env.DB, carrito.id)
    return json({ ok: true, carrito: contenido }, 200, cabeceras)
  }

  if (metodo === 'POST') {
    const cuerpo = await cuerpoJson(peticion)
    const productoId = entero(cuerpo, 'producto_id', 1, 2_000_000_000)
    const cantidad = entero(cuerpo, 'cantidad')
    const varianteId =
      cuerpo.variante_id === undefined || cuerpo.variante_id === null
        ? null
        : entero(cuerpo, 'variante_id', 1, 2_000_000_000)

    const producto = await env.DB.prepare(
      'SELECT id, precio, moneda, publicado FROM productos WHERE id = ?',
    )
      .bind(productoId)
      .first<{ id: number; precio: number; moneda: string; publicado: number }>()

    // Mismo mensaje para "no existe" y para "no esta publicado". Distinguirlos
    // permitiria a alguien recorrer ids y saber que productos hay publicados.
    if (!producto || producto.publicado !== 1) {
      throw new ErrorApi('no_disponible', 'Ese producto no se puede anadir.', 404)
    }

    // La variante tiene que ser DE ESE producto. Sin esta comprobacion se
    // podria meter en un carrito una variante de otro producto, que es una
    // referencia valida en la base y un producto que no existe.
    if (varianteId !== null) {
      const variante = await env.DB.prepare(
        'SELECT id FROM producto_variantes WHERE id = ? AND producto_id = ?',
      )
        .bind(varianteId, productoId)
        .first()

      if (!variante) {
        throw new ErrorApi('no_disponible', 'Esa variante no pertenece al producto.', 400)
      }
    }

    // Si ya estaba, se SUMA en vez de crear otra linea.
    //
    // El destino del `ON CONFLICT` es `variante_key`, NO `variante_id`. Son
    // cosas distintas y equivocarse aqui cuesta un 500:
    //
    //   - `variante_id` es NULL cuando el producto no tiene variantes, y en
    //     SQLite dos NULL nunca son iguales, asi que el `UNIQUE` de 0001 sobre
    //     esa columna no detecta nada.
    //   - `variante_key` es la columna GENERATED que vale
    //     `COALESCE(variante_id, 0)`, y si es la que esta en el indice unico
    //     de verdad (creado en la migracion 0007).
    //
    // Si el `ON CONFLICT` apunta a `variante_id`, SQLite lo ata al `UNIQUE`
    // viejo, ese no dispara, el INSERT sigue adelante y revienta contra el
    // indice nuevo con un error que nadie intercepta. El sintoma es un 500 al
    // anadir por segunda vez un producto que ya esta en el carrito, que es
    // justo la operacion mas comun que hay.
    await env.DB.prepare(
      `INSERT INTO carrito_items (carrito_id, producto_id, variante_id, cantidad, precio_unitario, moneda)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (carrito_id, producto_id, variante_key)
       DO UPDATE SET cantidad = MIN(cantidad + excluded.cantidad, 99)`,
    )
      .bind(carrito.id, productoId, varianteId, cantidad, producto.precio, producto.moneda)
      .run()

    const contenido = await leerCarrito(env.DB, carrito.id)
    return json({ ok: true, carrito: contenido }, 200, cabeceras)
  }

  if (metodo === 'DELETE') {
    const cuerpo = await cuerpoJson(peticion)

    // Sin `id` se vacia el carrito entero. Es una operacion de una sola pasada:
    // vaciar no necesita saber CUAL linea se quita, y hacer que el boton de
    // "vaciar" mandara una linea por cada linea habria que inventar un id.
    if (cuerpo.id === undefined || cuerpo.id === null) {
      await env.DB.prepare('DELETE FROM carrito_items WHERE carrito_id = ?').bind(carrito.id).run()
      const contenido = await leerCarrito(env.DB, carrito.id)
      return json({ ok: true, carrito: contenido }, 200, cabeceras)
    }

    const idLinea = entero(cuerpo, 'id', 1, 2_000_000_000)

    // El `carrito_id` va en el WHERE y no solo en el `id`. Sin el, un
    // `DELETE` con un id ajeno borraria una linea de OTRO carrito, porque los
    // ids son consecutivos y se adivinan. Esto no es un detalle: es la razon de
    // que `DELETE /api/carrito` sin sesion no borre nada de nadie.
    const borrado = await env.DB.prepare(
      'DELETE FROM carrito_items WHERE id = ? AND carrito_id = ?',
    )
      .bind(idLinea, carrito.id)
      .run()

    const contenido = await leerCarrito(env.DB, carrito.id)
    return json(
      { ok: true, quitado: (borrado.meta.changes ?? 0) > 0, carrito: contenido },
      200,
      cabeceras,
    )
  }

  throw ErrorApi.metodoNoPermitido('El carrito no acepta ese metodo.', ['GET', 'POST', 'DELETE'])
}