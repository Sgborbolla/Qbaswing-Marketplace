-- Migracion 0007: direcciones de cripto y arreglo del indice de carrito_items.
--
-- Sin esto, el carrito creaba una linea nueva cada vez que se anadia el mismo
-- producto, y no habia donde guardar una direccion de cobro.
--
-- Idempotente: se puede volver a aplicar sin romper nada.

-- ===========================================================================
-- 1. Indice unico real de `carrito_items`
-- ===========================================================================
--
-- El problema
-- -----------
-- 0001 creo `UNIQUE (carrito_id, producto_id, variante_id)`. Pero
-- `variante_id` es NULLABLE, y en SQLite los NULL se consideran DISTINTOS entre
-- si dentro de un indice unico. Es decir: dos lineas del mismo producto sin
-- variante no chocan, porque NULL nunca es igual a NULL.
--
-- Consecuencia: el `ON CONFLICT (carrito_id, producto_id, variante_id)` de
-- `src/worker/routers/carrito.ts` nunca se disparaba, y "anadir dos veces"
-- creaba dos lineas en vez de sumar la cantidad. Lo peor no era el doble
-- renglon: era que un producto CON variante si unia y uno SIN variante no, con
-- el mismo boton. Un comportamiento que depende del producto no se puede
-- aprender.
--
-- La solucion
-- -----------
-- Una columna VIRTUAL `variante_key` que vale `COALESCE(variante_id, 0)`. El 0 no
-- puede colisionar con un id real porque `producto_variantes.id` es un
-- `INTEGER PRIMARY KEY AUTOINCREMENT`, y eso empieza en 1.
--
-- Se conservan las TRES columnas: `variante_id` sigue siendo NULL cuando no hay
-- variante, que es la semantica correcta, y `variante_key` existe solo para que
-- el indice unico tenga algo que comparar.
--
-- Por que VIRTUAL y no STORED: VIRTUAL no ocupa espacio y se recalcula al leer,
-- asi que no hay nada que pueda quedar desincronizado. Con STORED habria dos
-- copias del mismo dato guardadas, y cualquier `UPDATE` que tocara solo una
-- dejaria el indice describiendo otra realidad. VIRTUAL hace que esa clase de
-- error sea imposible de escribir, no solo de evitar.
--
-- Por que no un indice parcial (`WHERE variante_id IS NULL`): funciona, pero
-- obliga a que el `ON CONFLICT` del Worker repita esa misma clausula `WHERE`, y
-- son dos cosas que tienen que coincidir en archivos separados. Ese tipo de
-- acoplamiento es como se cuelan los errores.
--
-- Por que no un trigger: SQLite no permite asignar a `NEW` dentro de un trigger.
-- No hay `SET NEW.columna = ...`. Un trigger que intentara mantener las dos
-- columnas al dia no se podria escribir. Por eso la columna generada.

ALTER TABLE carrito_items ADD COLUMN variante_key INTEGER
  GENERATED ALWAYS AS (COALESCE(variante_id, 0)) VIRTUAL;

-- El `UNIQUE` de tabla de 0001 se queda. No molesta: con `variante_id` a NULL
-- compara NULL con NULL y siempre da distinto, o sea que no restringe nada. Y no
-- se puede quitar con `DROP INDEX` porque fue declarado como restriccion de
-- tabla; quitarlo exigiria recrear la tabla, y para esto no compensa.

-- Este indice es el que manda. Sin el, "anadir dos veces" sigue creando lineas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_carrito_items_unico
  ON carrito_items (carrito_id, producto_id, variante_key);

-- ===========================================================================
-- 2. Direcciones de cobro en cripto
-- ===========================================================================
--
-- Una tabla propia y no una clave en `configuracion` porque hacen falta columnas
-- de verdad: hay que filtrar por red, desactivar una direccion vieja sin borrarla
-- (los pagos antiguos la tienen grabada y hay que poder explicar de donde salio)
-- y se tiene que poder auditar quien la cambio.
--
-- `direccion` es PUBLICO. Se puede mostrar en la pagina sin problema: es
-- justamente lo que hace que alguien te pueda pagar. Esto es lo contrario de un
-- secreto de API, y por eso esta tabla si puede editarse desde la web.

CREATE TABLE IF NOT EXISTS direcciones_cripto (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Simbolo de la moneda: 'USDT', 'BTC', 'ETH'. Solo mayusculas y digitos.
  -- El CHECK usa `NOT GLOB '*[^A-Z0-9]*'` en vez de `GLOB '[A-Z0-9]*'` porque
  -- este ultimo solo mira el PRIMER caracter: despues acepta cualquier cosa.
  moneda       TEXT    NOT NULL CHECK (moneda <> '' AND moneda NOT GLOB '*[^A-Z0-9]*'),

  -- Red. OBLIGATORIA y nunca vacia.
  --
  -- Es la columna mas importante de la tabla. USDT por TRON (TRC-20) y USDT por
  -- Ethereum (ERC-20) son fichas distintas con direcciones distintas, y mandar
  -- una a la direccion de la otra deja el dinero perdido sin error ni aviso. Una
  -- direccion sin red es un dato incompleto, no un dato valido, asi que el
  -- CHECK la rechaza en vez de dejarla llegar a la pagina.
  red          TEXT    NOT NULL CHECK (length(trim(red)) > 0),

  -- La direccion tal cual. Solo se comprueba la longitud minima. Fijar un patron
  -- por red seria mas estricto, pero cada familia de direcciones tiene el suyo y
  -- un patron demasiado estrecho dejaria fuera redes validas. Un formato
  -- erroneo lo detecta la exploradora de bloques cuando se busca el pago, que es
  -- donde el error se puede arreglar de verdad.
  direccion    TEXT    NOT NULL CHECK (length(trim(direccion)) >= 8),

  -- Lo que lee el comprador: "USDT por TRON", "Bitcoin".
  etiqueta     TEXT    NOT NULL,

  -- Si es la direccion que se muestra por defecto. Solo una por moneda, y lo
  -- garantiza el indice parcial de abajo.
  activa       INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),

  -- Cuantas unidades de esta moneda equivalen a una unidad. OJO: esto NO es un
  -- tipo de cambio. Es solo "por 1 USDT entra 1 USDT", que es la unica verdad
  -- que se puede guardar sin depender de un precio que cambia cada minuto. Si
  -- aqui metiera un tipo de cambio real, el importe que ve el comprador dejaria
  -- de cuadrar con el que le llega.
  unidades_por TEXT    NOT NULL DEFAULT '1',

  -- Confirmaciones minimas antes de dar el pago por bueno. Un numero alto
  -- protege al vendedor; uno bajo hace la compra mas rapida.
  confirmaciones INTEGER NOT NULL DEFAULT 20 CHECK (confirmaciones >= 1),

  notas        TEXT    NOT NULL DEFAULT '',
  creado_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_at TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_direcciones_cripto_activa
  ON direcciones_cripto (activa, moneda);

-- Solo una direccion activa por moneda.
--
-- Un indice PARCIAL: solo mira las filas con `activa = 1`, asi que las
-- direcciones viejas pueden tener la misma moneda sin chocar. Y es la forma de
-- que la base lo imponga: sin esto, dos filas activas de USDT obligarian a que
-- la pagina eligiera una, y depender de cual elige el codigo es exactamente
-- como se le muestra al comprador la direccion equivocada.
CREATE UNIQUE INDEX IF NOT EXISTS idx_direcciones_cripto_unica_activa
  ON direcciones_cripto (moneda)
  WHERE activa = 1;

-- ===========================================================================
-- 3. Cripto queda disponible
-- ===========================================================================
--
-- La semilla de 0001 lo tiene en `false` porque era la opcion de pago mas cara
-- de montar. Ahora es la unica que no cobra pasarela, asi que se activa.
--
-- Se comprueba antes de escribir con `IS NOT json('true')`. Si se aplicase con
-- `json_set` dos veces no rompe nada, pero si alguien lo reaplica cada semana
-- por costumbre, `actualizado_at` se moveria sin que nada haya cambiado de
-- verdad, y el campo existe justo para decir que cambio y cuando.

UPDATE configuracion
   SET valor = json_set(valor, '$.crypto', json('true')),
       actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE clave = 'payment_manager_habilitado'
   AND json_extract(valor, '$.crypto') IS NOT json('true');