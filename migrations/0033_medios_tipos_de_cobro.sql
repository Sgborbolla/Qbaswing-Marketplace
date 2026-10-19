-- Migracion 0033: `medios_pago_usuario` admite TODAS las formas de cobro.
--
-- ===========================================================================
--  QUE CAMBIA
-- ===========================================================================
--  1. El `CHECK` de `tipo` pasa de cinco valores a diez. Los cinco nuevos son
--     los que un vendedor de verdad usa para cobrar hoy: PayPal, Stripe,
--     Payeer, cuenta bancaria y pago movil (Zelle, Transfermovil, Pago Movil).
--     `app` se queda: hay filas escritas con el y borrarla romperia sus datos.
--  2. Se cambia que datos exige cada tipo. Antes solo habia dos ramas con
--     requisitos: cripto (direccion + red) y tarjeta/app (numero). Ahora
--     tambien:
--
--       'paypal', 'stripe', 'payeer'  el ENLACE de pago, y solo el enlace.
--       'cuenta', 'movil'             o un numero/alias, o un enlace.
--
--     El enlace de pago es lo que decidio el sitio: el vendedor pega su enlace
--     publico (paypal.me/sutienda, buy.stripe.com/xxx) y el comprador lo abre.
--     NO se guardan claves de API de nadie: una clave de Stripe en una tabla
--     que sirve una web publica es una clave filtrada.
--  3. Desaparece `idx_medios_pago_usuario_unica_activa`, el indice unico
--     `(usuario_id, tipo) WHERE activo = 1`.
--
-- ===========================================================================
--  POR QUE SE VA EL INDICE DE "UNA ACTIVA POR TIPO"
-- ===========================================================================
-- Se puso cuando `tipo` tenia cinco valores y cada uno era un cajon unico: la
-- tarjeta, la cartera, el efectivo. Con los tipos de ahora el cajon ya no es
-- unico, y el indice estorba en casos que son de lo mas normal:
--
--   - dos cuentas bancarias distintas, las dos encendidas (la del banco y la
--     de la cooperativa);
--   - USDT por TRON y BTC, las dos cripto, con redes distintas;
--   - PayPal y Payeer, los dos "pasarela".
--
-- Lo que impide duplicados sin sentido no es ese indice: es la clave
-- (`(usuario_id, clave)`, unica), que se deriva del nombre. Dos numeros
-- distintos son dos medios distintos, y el vendedor decide cual deja encendido.
--
-- ===========================================================================
--  POR QUE HAY QUE REHACER LA TABLA ENTERA
-- ===========================================================================
-- SQLite no permite cambiar un `CHECK` con `ALTER TABLE`: la unica via es
-- crear la tabla nueva, copiar las filas, borrar la vieja y renombrar. Se hace
-- en una sola llamada a la API de D1, que es como se aplican estas
-- migraciones (`scripts/aplicar-migraciones.mjs`), asi que o entra todo o no
-- entra nada.
--
-- El orden importa: los indices se crean DESPUES del `RENAME`, porque el
-- `DROP TABLE` se lleva por delante los de la tabla vieja y el `RENAME` no los
-- devuelve.

CREATE TABLE IF NOT EXISTS medios_pago_usuario_nuevo (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,

  -- `ON DELETE CASCADE`: si se borra la cuenta, sus numeros se borran con ella.
  --
  -- Va por USUARIO y no por `vendedor_id` porque quien se identifica en el
  -- Worker es el usuario. `vendedor_id` es para la tienda, y tener cuenta no
  -- es lo mismo que tener tienda.
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Repetida por cada usuario, no global: dos vendedores pueden tener ambos
  -- "bpa" sin conflicto, porque son cuentas distintas. Se deriva del nombre, el
  -- vendedor no la elige.
  clave      TEXT    NOT NULL
                     CHECK (clave <> '' AND clave NOT GLOB '*[^a-z0-9-]*'),

  -- Lo que lee el comprador. Texto libre: "Transfermovil", "Zelle de mi mama".
  nombre     TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),

  -- ---------------------------------------------------------------------------
  --  LOS DIEZ TIPOS
  ---------------------------------------------------------------------------
  -- `tipo` decide que campos se piden y como se dibuja el medio. `nombre` es lo
  -- que lee el comprador, asi que el tipo puede ser general ("cuenta") y el
  -- nombre exacto ("BPA de 23 y 12").
  --
  -- `otro` sigue estando para lo que no estaba previsto: un vendedor que cobra
  -- por algo que no esta en la lista no tiene que esperar a una migracion.
  tipo       TEXT    NOT NULL
                     CHECK (tipo IN ('tarjeta', 'cuenta', 'cripto', 'efectivo',
                                     'paypal', 'stripe', 'payeer', 'movil',
                                     'app', 'otro')),

  -- NULL a proposito: un color inventado es peor que ninguno, porque el
  -- distintivo se dibuja igual y el comprador ve el color equivocado y duda de
  -- la tienda justo donde tiene que soltar el dinero.
  color_marca TEXT    CHECK (
                    color_marca IS NULL
                    OR (length(color_marca) = 7
                        AND substr(color_marca, 1, 1) = '#'
                        AND substr(color_marca, 2) NOT GLOB '*[^0-9A-Fa-f]*')
                  ),

  -- Para 'tarjeta', 'cuenta', 'movil' y 'app': el numero o el alias donde se
  -- entrega el dinero, y quien lo recibe.
  numero_cuenta TEXT,
  titular       TEXT,

  -- Para 'cripto'. La RED es lo que evita perder el dinero: USDT por TRON y
  -- USDT por Ethereum son fichas distintas, y mandar una a la direccion de la
  -- otra deja el dinero en una cadena donde no esta, sin error ni devolucion.
  direccion     TEXT,
  red           TEXT,

  -- El enlace de pago publico del vendedor (paypal.me/..., buy.stripe.com/...).
  --
  -- Es `TEXT` sin `CHECK` de forma a proposito: la base no puede comprobar que
  -- un `href` sea `http(s)` sin rehacer la tabla, y ademas hay filas de antes
  -- de la 0019 en `NULL`. Quien valida el esquema es el Worker, que es el unico
  -- que puede distinguir `https://` de `javascript:` y devolver un error que se
  -- lea. Ver `leerCampos` en `routers/mis-medios.ts`.
  enlace        TEXT,

  -- Texto que lee el comprador antes de pagar.
  instrucciones TEXT    NOT NULL DEFAULT '',

  -- Lo enciende y lo apaga el VENDEDOR, que es de quien es el numero. No se
  -- exige nada para encenderlo: bloquearle una venta por un texto que se le
  -- pasa medio segundo es tapar una venta para proteger una formalidad.
  activo       INTEGER NOT NULL DEFAULT 0 CHECK (activo IN (0, 1)),

  orden        INTEGER NOT NULL DEFAULT 0,

  creado_at      TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_at TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- Que datos hacen falta en cada tipo, para que el error salte al GUARDAR y no
  -- cuando el comprador ya esta viendo un medio de pago al que no puede pagar.
  --
  -- Es un `CASE` de BUSQUEDA: con el `CASE` simple, `WHEN 'tarjeta' OR 'app'` se
  -- evalua como booleano y la rama queda muerta (paso en la 0016). Cada rama de
  -- aqui compara con `IN` y no hay nada que resolver.
  --
  -- Las pasarelas exigen ENLACE y solo enlace: sin el, "paga con PayPal" es una
  -- frase sin a donde ir. Una pasarela que se cobra escribiendo un correo no es
  -- una pasarela, es una cuenta: para eso esta 'cuenta' o 'otro'.
  CHECK (
    CASE
      WHEN tipo = 'cripto'
        THEN direccion IS NOT NULL
         AND length(trim(direccion)) >= 8
         AND red IS NOT NULL
         AND length(trim(red)) > 0
      WHEN tipo IN ('tarjeta', 'app')
        THEN numero_cuenta IS NOT NULL
         AND numero_cuenta <> ''
         AND numero_cuenta NOT GLOB '*[^0-9]*'
      WHEN tipo IN ('paypal', 'stripe', 'payeer')
        THEN enlace IS NOT NULL
         AND length(trim(enlace)) > 0
      WHEN tipo IN ('cuenta', 'movil')
        THEN (numero_cuenta IS NOT NULL AND length(trim(numero_cuenta)) > 0)
          OR (enlace IS NOT NULL AND length(trim(enlace)) > 0)
      ELSE 1
    END
  )
);

-- Copia explicita, columna a columna, y en el orden del `CREATE` de arriba.
-- Un `INSERT INTO ... SELECT *` ataria esta migracion al orden fisico de la
-- tabla vieja, que es justo lo que se esta cambiando.
INSERT INTO medios_pago_usuario_nuevo (
  id, usuario_id, clave, nombre, tipo, color_marca,
  numero_cuenta, titular, direccion, red, enlace,
  instrucciones, activo, orden, creado_at, actualizado_at
)
SELECT id, usuario_id, clave, nombre, tipo, color_marca,
       numero_cuenta, titular, direccion, red, enlace,
       instrucciones, activo, orden, creado_at, actualizado_at
  FROM medios_pago_usuario;

DROP TABLE IF EXISTS medios_pago_usuario;

ALTER TABLE medios_pago_usuario_nuevo RENAME TO medios_pago_usuario;

-- Las tres unicidades/indices que tenia, menos el parcial por `tipo`: ese es el
-- que se retira en esta migracion (ver la cabecera).
CREATE UNIQUE INDEX IF NOT EXISTS idx_medios_pago_usuario_clave
  ON medios_pago_usuario (usuario_id, clave);

CREATE INDEX IF NOT EXISTS idx_medios_pago_usuario
  ON medios_pago_usuario (usuario_id, activo, orden);
