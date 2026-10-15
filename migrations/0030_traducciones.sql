-- =============================================================================
-- Traducciones de los productos, por idioma.
-- =============================================================================
--
-- QUE HACE
--
--   Crea `producto_traducciones`, donde el Worker guarda el titulo y las
--   descripciones de cada producto traducidos a los idiomas del sitio. Cada
--   fila es (producto, idioma). `productos.titulo` y sus descripciones siguen
--   siendo el texto ORIGINAL que escribio el vendedor (en espanol); esta tabla
--   solo anade las versiones en los demas idiomas.
--
-- POR QUE
--
--   El marketplace es mundial y los productos se publican a cada rato. Pedirle
--   al vendedor que escriba el mismo texto en 22 idiomas no es realista, y
--   dejar a todos los idiomas cayendo al espanol deja el sitio a medias. La
--   traduccion la hace Workers AI al guardar el producto (ver
--   `src/worker/traduccion.ts`) y se guarda aqui una sola vez: leer una ficha
--   no vuelve a traducir, solo lee.
--
-- LOS IDIOMAS SON "BASE"
--
--   Se guarda por idioma base (`en`, `pt`, `fr`, `zh`...), no por cada variante
--   regional (`en-GB`, `en-US`, `pt-BR`...). El modelo no distingue "color" de
--   "colour": traducir dos veces el mismo texto al ingles daria el mismo
--   resultado y no valdria el doble de IA. El Worker reduce la variante a su
--   base antes de leer y de escribir (`idiomaBaseDe`).
--
-- SIN TRADUCCION NO HAY PROBLEMA
--
--   Si una fila no esta, la API cae al texto original del producto
--   (`COALESCE(t.titulo, p.titulo)`). Una tabla incompleta nunca deja un hueco
--   en blanco en la ficha: a lo sumo, ese idioma se ve en espanol.
-- =============================================================================

CREATE TABLE IF NOT EXISTS producto_traducciones (
  producto_id       INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  idioma            TEXT    NOT NULL,
  titulo            TEXT    NOT NULL,
  descripcion       TEXT    NOT NULL,
  descripcion_larga TEXT,
  actualizado_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (producto_id, idioma)
);

CREATE INDEX IF NOT EXISTS idx_producto_traducciones_idioma
  ON producto_traducciones (idioma);
