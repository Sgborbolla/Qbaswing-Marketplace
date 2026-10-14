-- ============================================================================
-- 0024 — Espacios de los paquetes: 8/5/3 pasan a 10 y las de 10 pasan a 20
-- ============================================================================
--
-- QUE HACE
--   Sube los espacios simultaneos de cada paquete:
--     - Ropa, Belleza y Accesorios: 10 -> 20
--     - Calzado (8), Hogar (5) y las de 3 (electronica, electrodomesticos,
--       informatica, automotriz, construccion): 10
--   No toca precios ni vigencia: solo `slots` y el texto de `caracteristicas`,
--   que hasta ahora repetia el numero viejo ("8 espacios simultaneos").
--
-- POR QUE POR CATEGORIA Y NO POR VALOR
--   Un `UPDATE ... WHERE slots = 10` seguido de otro que ponga los 3/5/8 a 10
--   dejaría espacios en 10 que, al re-aplicar, el primer UPDATE volveria a
--   subir a 20. Fijando la categoria, cada paquete recibe su numero exacto y
--   volver a pasar el archivo no cambia nada.
--
-- LAS SUSCRIPCIONES YA PAGADAS NO SE TOCAN: `suscripciones.slots_totales` es una
-- copia congelada al momento de la compra. Quien ya pago conserva lo que pago.
-- ============================================================================

UPDATE paquetes SET slots = 20
 WHERE categoria IN ('ropa', 'belleza', 'accesorios');

UPDATE paquetes SET slots = 10
 WHERE categoria IN ('calzado', 'hogar', 'electronica', 'electrodomesticos',
                     'informatica', 'automotriz', 'construccion');

-- El texto de las caracteristicas lleva el numero escrito. Se reemplaza el token
-- exacto (con comillas) para no tocar otras palabras de la lista.
UPDATE paquetes
   SET caracteristicas = REPLACE(caracteristicas, '"10 espacios simultaneos"', '"20 espacios simultaneos"')
 WHERE categoria IN ('ropa', 'belleza', 'accesorios');

UPDATE paquetes
   SET caracteristicas = REPLACE(caracteristicas, '"8 espacios simultaneos"', '"10 espacios simultaneos"')
 WHERE categoria = 'calzado';

UPDATE paquetes
   SET caracteristicas = REPLACE(caracteristicas, '"5 espacios simultaneos"', '"10 espacios simultaneos"')
 WHERE categoria = 'hogar';

UPDATE paquetes
   SET caracteristicas = REPLACE(caracteristicas, '"3 espacios simultaneos"', '"10 espacios simultaneos"')
 WHERE categoria IN ('electronica', 'electrodomesticos', 'informatica',
                     'automotriz', 'construccion');
