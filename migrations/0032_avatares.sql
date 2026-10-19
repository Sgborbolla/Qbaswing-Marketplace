-- ============================================================================
-- 0032 — Avatares de cuenta y de tienda, y sus reportes
-- ============================================================================
--
-- QUE HACE
--   1. Anade `avatar` a `usuarios`: la foto de la CUENTA. Hasta ahora lo unico
--      que se podia subir era la foto de la tienda (`vendedores.avatar_url`), y
--      quien no tenia tienda no tenia donde poner su cara.
--   2. Crea `reportes_avatar`: los avisos de "esta foto no deberia estar" que
--      cualquier visitante puede mandar sobre la foto de una cuenta o de una
--      tienda. El Owner los atiende desde su panel y la foto se borra.
--
-- QUE NO TOCA
--   - `vendedores.avatar_url` sigue siendo la foto de la TIENDA. Las dos fotos
--     conviven: la de cuenta es de la persona, la de tienda es del negocio, y
--     por eso no se reutiliza una columna para las dos.
--   - Ni `productos` ni `producto_imagenes`: las imagenes de producto van por
--     su propio camino (`img/`) y tienen su propio borrado.
--
-- LA COLUMNA GUARDA UNA URL ABSOLUTA, NO UNA CLAVE
--   Igual que `vendedores.avatar_url`: `https://api.../api/imagenes/avatar/...`.
--   La clave de KV se saca de la URL para borrar el objeto, y el `<img>` de un
--   sitio estatico en otro origen necesita la URL entera. Guardar solo la clave
--   obligaria a que cada sitio supiera montar la URL de la API.
--
-- CLAVES DE AVATAR
--   Van en `avatar/<usuarioId>/<uuid>.<ext>`, separadas del prefijo `img/` de
--   las imagenes de producto. Asi un barrido por prefijo no mezcla las dos
--   cosas, y el borrado de una foto de perfil no puede tocar una galeria.
--
-- POR QUE EL REPORTE GUARDA `vendedor_id` Y NO `usuario_id`
--   La foto de cuenta se ve siempre dentro de una tienda (en la ficha de sus
--   productos y en su pagina), nunca suelta: quien la reporta ve un vendedor.
--   Guardar el vendedor deja el aviso atado a lo que la persona señalo, y el
--   `usuario_id` se deduce al atender con `usuarios.vendedor_id`.
-- ============================================================================

-- 1. Foto de la cuenta -------------------------------------------------------

ALTER TABLE usuarios ADD COLUMN avatar TEXT;

-- 2. Reportes de foto --------------------------------------------------------

CREATE TABLE reportes_avatar (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  -- El vendedor al que pertenece la foto reportada. Es el contexto en el que
  -- se vio, tanto si la foto es la de la tienda como si es la de la cuenta.
  vendedor_id   INTEGER NOT NULL REFERENCES vendedores(id),
  -- Cual de las dos fotos: la de la cuenta o la de la tienda. Sin esto, atender
  -- el aviso no sabria que borrar y borraria la que no era.
  tipo          TEXT    NOT NULL CHECK (tipo IN ('cuenta', 'tienda')),
  -- La URL que se estaba viendo al reportar. Se guarda la foto reportada tal
  -- cual, y no se sigue la pista despues: si la persona cambio su foto entre el
  -- aviso y la revision, el Owner ve lo que se reporto, no lo nuevo.
  url           TEXT    NOT NULL,
  motivo        TEXT    NOT NULL,
  creado_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- `NULL` mientras espera. Al atenderlo (y borrar la foto) queda la fecha, y
  -- el aviso sale de la lista de pendientes sin perderse.
  atendido_at   TEXT
);

CREATE INDEX idx_reportes_avatar_pendientes
  ON reportes_avatar (atendido_at, creado_at DESC);
