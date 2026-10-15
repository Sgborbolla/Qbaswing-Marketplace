-- =============================================================================
-- Precios en varias monedas para un mismo producto.
-- =============================================================================
--
-- QUE HACE
--
--   Anade tres columnas a `productos` para que un producto pueda llevar precio
--   en CUP, USD y EUR a la vez:
--
--     precio_cup, precio_usd, precio_eur   INTEGER (NULL = esa moneda no se
--                                           ofrece)
--
-- POR QUE
--
--   Hasta ahora un producto tenia UNA moneda (`moneda` + `moneda_codigo`) y un
--   solo `precio`. Un vendedor cubano vende a la vez a clientes que pagan en CUP
--   y a clientes de fuera que pagan en USD o EUR, y no hay tipo de cambio en el
--   sitio (a proposito, ver `PanelCuenta.astro`). La unica forma honesta de
--   enseñar los tres precios es guardarlos los tres, como ya hacen los paquetes
--   de espacios (`precio_cup`, `precio_usd`, `precio_eur` en la tabla
--   `paquetes`).
--
-- `precio` Y `moneda` NO DESAPARECEN
--
--   Siguen siendo el "precio base": el que ordena el catalogo, el que usa el
--   filtro de precio de cada categoria y el que se cobra si el comprador no
--   elige una moneda concreta. El Worker lo deriva de las tres columnas nuevas
--   (la primera con precio, en el orden CUP, USD, EUR) para que no pueda
--   contradecirlas. `moneda` sigue guardando el `bucket` contable y
--   `moneda_codigo` el codigo ISO.
--
-- RELLENO
--
--   Los productos que ya existen tenian su precio en una sola moneda. Se copia
--   ese precio a la columna de SU moneda, y las otras dos quedan en NULL. Un
--   producto que estaba en una moneda que no es CUP/USD/EUR (por ejemplo MXN)
--   se queda sin columnas nuevas y conserva solo su precio base, que es lo que
--   habia.
-- =============================================================================

ALTER TABLE productos ADD COLUMN precio_cup INTEGER;
ALTER TABLE productos ADD COLUMN precio_usd INTEGER;
ALTER TABLE productos ADD COLUMN precio_eur INTEGER;

UPDATE productos
   SET precio_cup = CASE WHEN COALESCE(moneda_codigo, moneda) = 'CUP' THEN precio ELSE precio_cup END,
       precio_usd = CASE WHEN COALESCE(moneda_codigo, moneda) = 'USD' THEN precio ELSE precio_usd END,
       precio_eur = CASE WHEN COALESCE(moneda_codigo, moneda) = 'EUR' THEN precio ELSE precio_eur END;
