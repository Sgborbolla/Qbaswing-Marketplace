-- Migracion 0028: pagos. Ensancha la lista de pasarelas de `transacciones` y
-- crea la tabla de evidencias, que es la auditoria de quien confirmo cada pago.
--
-- ===========================================================================
--  POR QUE HAY QUE REHACER `transacciones`
-- ===========================================================================
-- La columna `pasarela` tiene un `CHECK` con cuatro valores:
--
--     ('qva-pay', 'tropi-pay', 'crypto', 'tarjeta-qbaswing')
--
-- y el checkout ofrece cinco. `src/lib/pagos.ts` es la fuente de verdad de las
-- pasarelas, y declara `tarjeta-cubana` y `whatsapp` con esos nombres. El propio
-- `src/lib/tipos.ts` deja escrito que esa discrepancia era "un bug esperando":
-- una transaccion creada con una pasarela de `pagos.ts` no cabia en el `CHECK`,
-- y la base rechazaba un pago legitimo en el momento de cobrarlo.
--
-- Un `CHECK` no se puede alterar en SQLite. La unica forma de cambiarlo es
-- rehacer la tabla, y eso es lo que se hace aqui.
--
-- ===========================================================================
--  POR QUE ES SEGURO
-- ===========================================================================
-- Porque las tres tablas del dinero estan VACIAS. Se comprobo antes de escribir
-- esto:
--
--     SELECT COUNT(*) FROM transacciones;      ->  0
--     SELECT COUNT(*) FROM transaccion_items;  ->  0
--     SELECT COUNT(*) FROM biblioteca;         ->  0
--
-- Y estan vacias por una razon, no por suerte: no ha existido forma de pagar
-- hasta que se escribe `/api/pagos`. Nadie pudo crear una transaccion.
--
-- Ademas hay una red: `transaccion_items` y `biblioteca` referencian esta tabla
-- con `ON DELETE RESTRICT`. Si alguna fila existiera, el `DROP` fallaria en vez
-- de llevarse datos por delante. La migracion se cae, no pierde nada.
--
-- ===========================================================================
--  POR QUE `tarjeta-qbaswing` SE QUEDA EN LA LISTA
-- ===========================================================================
-- La lista nueva es la vieja MAS las dos que faltaban, no la lista nueva en
-- lugar de la vieja. El identificador `tarjeta-qbaswing` aparece en la tabla
-- `configuracion` (`payment_manager_habilitado`) y pudo quedar grabado en
-- cualquier instalacion que ya tenga datos. Quitarlo seria romper un pago viejo
-- para ahorrar una entrada en un `CHECK`.

DROP TABLE IF EXISTS transacciones;

CREATE TABLE IF NOT EXISTS transacciones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Referencia unica visible al comprador. Formato MP-CU-XXXX-XXX para pagos
  -- con tarjeta nacional, segun el documento maestro.
  referencia     TEXT    NOT NULL UNIQUE,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  pasarela       TEXT    NOT NULL
                 CHECK (pasarela IN ('qva-pay', 'tropi-pay', 'crypto',
                                     'tarjeta-qbaswing', 'tarjeta-cubana',
                                     'whatsapp')),
  moneda         TEXT    NOT NULL CHECK (moneda IN ('CUP', 'USD', 'EUR')),
  -- La moneda REAL que eligio el vendedor (MXN, ARS, BRL...), que puede no ser
  -- una de las tres fuertes de arriba. La puso la 0022 y por eso tiene que
  -- seguir aqui: esta migracion rehace la tabla, y una columna que no se copie
  -- se pierde. Nulo significa "de antes de la 0022"; se lee `moneda` y ya.
  moneda_codigo  TEXT,
  -- Enteros. Ver nota 3 en la cabecera de 0001.
  subtotal       INTEGER NOT NULL CHECK (subtotal >= 0),
  comision_qbaswing INTEGER NOT NULL CHECK (comision_qbaswing >= 0),
  total          INTEGER NOT NULL CHECK (total >= 0),
  -- Regla de Oro aplicada, congelada en el momento de la compra. Si el Owner
  -- cambia la comision manana, esta transaccion conserva la original.
  regla_aplicada TEXT    NOT NULL CHECK (regla_aplicada IN ('A', 'B', 'C')),
  estado         TEXT    NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'verificado', 'rechazado', 'reembolsado')),
  -- Hash de blockchain para pagos cripto (USDT TRC-20, BTC).
  hash_blockchain TEXT,
  -- Comprobante subido por el comprador para pagos manuales. URL firmada, no
  -- el archivo.
  comprobante_url TEXT,
  creado_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  verificado_at  TEXT,
  CHECK (total = subtotal)
);

CREATE INDEX IF NOT EXISTS idx_transacciones_usuario ON transacciones(usuario_id, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_transacciones_estado  ON transacciones(estado, creado_at DESC);
-- Webhooks de QvaPay y TropiPay llegan por referencia. Tiene que ser unico.
CREATE INDEX IF NOT EXISTS idx_transacciones_webhook ON transacciones(referencia, pasarela);

-- ===========================================================================
--  Evidencias de pago
-- ===========================================================================
-- Ningun camino marca una compra como pagada sin dejar constancia de POR QUE.
-- Eso es lo que separa un marketplace con pagos manuales de una pagina de
-- descargas gratis: sin esta tabla, "el Owner pulso verificado" no deja rastro,
-- y un pago confirmado a mano es indistinguible de uno confirmado por un
-- webhook o de uno inventado.
--
-- Una fila por confirmacion. Se conserva el texto crudo (el cuerpo del webhook,
-- la respuesta del proveedor o el motivo escrito por quien confirmo) para poder
-- reconstruir la decision meses despues, que es justo cuando hace falta.
CREATE TABLE IF NOT EXISTS evidencias_pago (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaccion_id  INTEGER NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
  -- De que clase tecnica es la prueba. Es la misma clase que declara
  -- `src/lib/pagos.ts`: webhook (QvaPay/TropiPay), sondeo (tarjeta/cripto) o
  -- manual (WhatsApp).
  clase           TEXT    NOT NULL CHECK (clase IN ('webhook', 'sondeo', 'manual')),
  -- Texto de la prueba, tal como llego, acotado. Lo que se guarda es lo que
  -- permite auditar; por eso no se normaliza ni se resume.
  crudo           TEXT    NOT NULL DEFAULT '',
  -- Verificacion criptografica, si la clase la tiene (QvaPay HMAC, TropiPay).
  hash            TEXT,
  -- Quien confirmo, para la clase manual. `ON DELETE SET NULL` porque borrar la
  -- cuenta de quien confirmo no puede borrar la evidencia de que un pago se
  -- confirmo: el hecho es del marketplace, no de la persona.
  confirmado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  confirmado_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Monto que se verifico, para detectar que el proveedor cobro distinto de lo
  -- pedido. NULL cuando la confirmacion no trae monto (un webhook que solo dice
  -- "pagado").
  monto_verificado INTEGER CHECK (monto_verificado IS NULL OR monto_verificado >= 0),
  moneda          TEXT    CHECK (moneda IS NULL OR moneda IN ('CUP', 'USD', 'EUR'))
);

CREATE INDEX IF NOT EXISTS idx_evidencias_pago
  ON evidencias_pago(transaccion_id, confirmado_at DESC);
