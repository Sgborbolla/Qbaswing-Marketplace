-- =============================================================================
-- 0027_avisos.sql
--
-- QUE RESUELVE
-- =============================================================================
-- El dueño de una tienda tiene que enterarse de que alguien eligio sus
-- productos, aunque no tenga el sitio abierto. En Cuba eso no es comodidad: sin
-- internet o sin luz, el unico canal que sigue llegando es el SMS, y el
-- WhatsApp llega en cuanto vuelva la conexion. Un aviso que solo se ve dentro
-- de la pagina es un aviso que no llega.
--
-- Por eso hay DOS tablas y no una:
--
--   `avisos`         -> el hecho, uno por tienda y por producto elegido. Es lo
--                       que el vendedor ve en su panel, y no depende de ningun
--                       servicio externo.
--
--   `avisos_envios`  -> un intento por CANAL (panel, correo, WhatsApp, SMS) con
--                       su estado. Un fallo de Twilio o de correo no puede
--                       borrar el aviso: el aviso queda, y lo que falla es el
--                       envio, que se ve y se reintenta.
--
-- =============================================================================
--  POR QUE EL AVISO NO VIVE SOLO EN LA MEMORIA DEL WORKER
-- =============================================================================
-- Si el aviso existiera solo mientras corre la peticion, cualquier caida del
-- proveedor de SMS lo perderia para siempre. Guardarlo primero y enviar despues
-- es lo que hace que "se envio" y "llego" sean dos cosas distintas, que es la
-- verdad.
--
-- =============================================================================
--  POR QUE `tipo` ES TEXTO CON CHECK Y NO UN ENUM
-- =============================================================================
-- D1 no soporta ENUM, igual que en el resto del esquema. El CHECK mantiene la
-- restriccion en la base, que es donde no se puede olvidar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS avisos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,

  -- A que tienda le toca. Es la tienda del PRODUCTO elegido, no la de la
  -- plataforma: el que tiene que enterarse es quien vende eso.
  vendedor_id          INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,

  -- "carrito" cuando lo anaden, "compra" cuando lo pagan. Son dos momentos
  -- distintos y el vendedor no los quiere mezclados: un carrito abandonado no
  -- es una venta.
  tipo                 TEXT    NOT NULL CHECK (tipo IN ('carrito', 'compra')),

  -- El producto puede borrarse despues. El aviso NO: se queda como historia.
  -- Por eso ON DELETE SET NULL y no CASCADE, y por eso se copia el titulo.
  producto_id          INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  producto_titulo      TEXT    NOT NULL DEFAULT '',
  cantidad             INTEGER NOT NULL DEFAULT 1,

  -- Quien lo eligio. Puede ser nadie (carrito anonimo), asi que todo admite
  -- NULL o texto vacio. El telefono se guarda porque es lo que permite al
  -- vendedor DEVOLVER la llamada, que es como se cierran los negocios aqui.
  comprador_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  comprador_nombre     TEXT    NOT NULL DEFAULT '',
  comprador_email      TEXT    NOT NULL DEFAULT '',
  comprador_telefono   TEXT    NOT NULL DEFAULT '',

  leido                INTEGER NOT NULL DEFAULT 0 CHECK (leido IN (0, 1)),
  creado_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- La consulta del panel es "los mios, los no leidos primero". El indice la
-- cubre entera, incluido el `ORDER BY`.
CREATE INDEX IF NOT EXISTS idx_avisos_vendedor ON avisos (vendedor_id, leido, id);

CREATE TABLE IF NOT EXISTS avisos_envios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  aviso_id   INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,

  canal      TEXT    NOT NULL CHECK (canal IN ('panel', 'correo', 'whatsapp', 'sms')),

  -- El numero o el correo al que se intento mandar. Se guarda aunque falle:
  -- un envio fallido sin destino no se puede diagnosticar.
  destino    TEXT    NOT NULL DEFAULT '',

  -- 'sin_configurar' es distinto de 'error' y por eso es un estado propio: si
  -- falta la credencial del proveedor, no hay nada que reintentar, solo una
  -- variable que poner. Confundirlos hace buscar un fallo de red que no existe.
  estado     TEXT    NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'enviado', 'error', 'sin_configurar')),

  detalle    TEXT    NOT NULL DEFAULT '',
  creado_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_avisos_envios_aviso ON avisos_envios (aviso_id);
