-- ============================================================================
-- 0022 — Panel del vendedor
-- ============================================================================
--
-- Tres cosas:
--
--   1. LIBERAR EL ESPACIO AL AGOTARSE. Un producto fisico que se queda sin
--      existencias deja de estar visible y su espacio vuelve al saldo solo. La
--      regla vive en un trigger y no en el panel porque el descuento de
--      existencias lo hace el cobro, que es otra ruta: si la regla estuviera
--      escrita en el panel de productos, una venta no la aplicaria.
--
--   2. CONTACTO PROPIO DE CADA TIENDA. Hasta hoy el telefono, el correo y la
--      direccion eran de la plataforma (`contacto_plataforma`). Cada vendedor
--      necesita los suyos.
--
--   3. REDES SOCIALES PROPIAS DE CADA TIENDA, por el mismo motivo.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Agotado -> deja de estar visible y libera el espacio
-- ---------------------------------------------------------------------------
-- El espacio lo ocupa "estar publicado", no "estar vendido". Bastaba con
-- despublicar, pero nadie lo hace a mano al vender la ultima unidad: por eso lo
-- hace la base.
--
-- Solo cuando el stock LLEGA a 0 (OLD <> 0). Si ya era 0 no se repite el UPDATE,
-- y si vuelve a subir, el vendedor republica cuando quiera.

CREATE TRIGGER IF NOT EXISTS trg_productos_agotado_despublica
AFTER UPDATE OF stock ON detalles_fisicos
WHEN NEW.stock = 0 AND OLD.stock <> 0
BEGIN
  UPDATE productos
     SET publicado = 0
   WHERE id = NEW.producto_id
     AND tipo = 'fisico';
END;

-- Mismo criterio al crear el detalle, por si alguna ruta futura insertara un
-- fisico ya publicado con stock 0. Hoy el alta siempre nace como borrador.
CREATE TRIGGER IF NOT EXISTS trg_productos_agotado_insert
AFTER INSERT ON detalles_fisicos
WHEN NEW.stock = 0
BEGIN
  UPDATE productos
     SET publicado = 0
   WHERE id = NEW.producto_id
     AND tipo = 'fisico'
     AND publicado = 1;
END;


-- ---------------------------------------------------------------------------
-- 2. Contacto de la tienda
-- ---------------------------------------------------------------------------
-- Una fila por tienda. Columnas de texto con DEFAULT '' y no NULL: una tienda
-- sin telefono se lee igual que una que no lo escribio, y el formulario siempre
-- tiene algo que mostrar.

CREATE TABLE IF NOT EXISTS contacto_vendedor (
  vendedor_id    INTEGER PRIMARY KEY REFERENCES vendedores(id) ON DELETE CASCADE,
  telefono       TEXT NOT NULL DEFAULT '',
  whatsapp       TEXT NOT NULL DEFAULT '',
  correo         TEXT NOT NULL DEFAULT '',
  direccion      TEXT NOT NULL DEFAULT '',
  sitio_web      TEXT NOT NULL DEFAULT '',
  actualizado_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- ---------------------------------------------------------------------------
-- 3. Redes sociales de la tienda
-- ---------------------------------------------------------------------------
-- Una fila por red y tienda. `orden` decide como se pintan, igual que en las de
-- plataforma. El indice unico impide dos veces la misma red en la misma tienda.

CREATE TABLE IF NOT EXISTS redes_vendedor (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vendedor_id INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  red         TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (vendedor_id, red)
);

CREATE INDEX IF NOT EXISTS idx_redes_vendedor ON redes_vendedor(vendedor_id, orden);


-- ---------------------------------------------------------------------------
-- 4. La moneda que elige cada vendedor
-- ---------------------------------------------------------------------------
-- El marketplace no puede obligar a un venezolano, un mexicano o un brasileno a
-- poner sus precios en CUP o USD: quien no ve su moneda, no vende. Pero la
-- columna `moneda` tiene un CHECK que solo acepta CUP, USD y EUR (lo usa la
-- contabilidad de la comision), y SQLite no deja ampliar un CHECK sin recrear la
-- tabla entera. Rehacer `productos`, `carrito_items` y `transacciones` --con sus
-- disparadores, indices y claves foraneas— es mucho mas riesgo que anadir una
-- columna.
--
-- Solucion: `moneda` se queda como la moneda "fuerte" a la que se contabiliza
-- (CUP, USD o EUR, el `bucket` de `monedas.ts`), y el codigo real que eligio el
-- vendedor (MXN, ARS, BRL, JPY...) se guarda aqui. La ficha y los precios se
-- pintan con `moneda_codigo`; la comision y los pagos siguen usando `moneda`.
--
-- Nulo significa "producto de antes de esta columna": se lee `moneda` y ya.

ALTER TABLE productos ADD COLUMN moneda_codigo TEXT;
ALTER TABLE carrito_items ADD COLUMN moneda_codigo TEXT;
ALTER TABLE transacciones ADD COLUMN moneda_codigo TEXT;

-- Lo ya guardado no cambia de moneda: su codigo es el que ya tenia.
UPDATE productos SET moneda_codigo = moneda WHERE moneda_codigo IS NULL;
UPDATE carrito_items SET moneda_codigo = moneda WHERE moneda_codigo IS NULL;
UPDATE transacciones SET moneda_codigo = moneda WHERE moneda_codigo IS NULL;
