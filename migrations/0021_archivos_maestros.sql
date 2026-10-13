-- 0021_archivos_maestros.sql
-- Archivo maestro único por producto digital
-- Se sube UNA SOLA VEZ. Cada compra descarga ese mismo archivo original vía proxy autorizado.

CREATE TABLE IF NOT EXISTS archivos_producto (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id       INTEGER NOT NULL UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  almacen           TEXT    NOT NULL CHECK (almacen IN ('kv','fraccionado','r2','drive','pixeldrain','gofile')),
  clave             TEXT    NOT NULL,        -- Referencia privada: drive=fileId, pixeldrain=id, gofile=fileId
  nombre_descarga   TEXT    NOT NULL,
  content_type      TEXT    NOT NULL DEFAULT 'application/zip',
  bytes             INTEGER NOT NULL,
  hash_sha256       TEXT    NOT NULL,
  subido_por        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_archivos_producto_producto ON archivos_producto(producto_id);

-- Trigger para actualizado_at
CREATE TRIGGER IF NOT EXISTS trg_archivos_producto_upd
AFTER UPDATE ON archivos_producto
BEGIN
  UPDATE archivos_producto
     SET actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id = NEW.id;
END;
