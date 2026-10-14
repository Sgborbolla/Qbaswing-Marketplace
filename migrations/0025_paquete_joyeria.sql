-- ============================================================================
-- 0025 — Paquete propio para Joyeria & Relojes
-- ============================================================================
--
-- QUE HACE
--   1. Separa `joyeria` de `accesorios`: hasta ahora el rubro lo cubria el
--      paquete "Accesorios & Joyeria". Se renombra ese a "Accesorios" y se crea
--      una fila propia para `joyeria`.
--   2. Precio del paquete nuevo: 500 CUP / $20 / EUR20 (2000 centavos/centimos),
--      10 espacios y 60 dias. Es el peldaño premium, el mismo donde estan
--      Electronica, Informatica y Automotriz.
--
-- POR QUE 10 ESPACIOS Y NO 20
--   Joyeria mueve menos referencias que accesorios, pero de mas valor por pieza.
--   Diez espacios (el suelo nuevo de todos los paquetes) es coherente con el
--   resto; subirlo a 20 seria regalar cuota en el rubro mas caro.
--
-- IDEMPOTENTE: el INSERT va con OR IGNORE y el indice UNIQUE de `categoria`
-- (idx_paquetes_categoria) impide que re-aplicar cree dos paquetes de joyeria.
-- ============================================================================

UPDATE paquetes
   SET nombre = 'Accesorios'
 WHERE categoria = 'accesorios' AND nombre = 'Accesorios & Joyeria';

INSERT OR IGNORE INTO paquetes
  (nombre, categoria, slots, vigencia_dias, precio_cup, precio_usd, precio_eur, precio_configurable, caracteristicas, activo)
VALUES
  ('Joyería y Relojes', 'joyeria', 10, 60, 500, 2000, 2000, 0,
   '["10 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1);
