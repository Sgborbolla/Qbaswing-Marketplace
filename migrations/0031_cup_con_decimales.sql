-- ============================================================================
-- 0031 — CUP pasa a tener centimos: las tres monedas, iguales
-- ============================================================================
--
-- QUE HACE
--   1. Pasa `decimales` de CUP de 0 a 2 en `src/lib/monedas.ts` (codigo): a
--      partir de ahora 22,86 CUP se escribe como se lee y se guarda como 2286,
--      igual que 12,50 USD se guarda como 1250. No hay distincion entre las
--      tres monedas.
--   2. Multiplica por 100 TODOS los precios que ya estaban guardados en CUP
--      como enteros de pesos, para que la misma cantidad siga significando lo
--      mismo: 250 pesos guardados pasan a 25000 centimos, que 25000/100 sigue
--      pintando 250,00 CUP.
--   3. Corrige la FAQ de monedas, que prometia 30 cuando el sitio cobra en tres.
--
-- QUE NO TOCA
--   - Los precios en USD y EUR: ya estaban en centavos/centimos (x100).
--   - Los productos que se ofrecen en una moneda o dos: `precio_cup` NULL
--     sigue siendo NULL (esa moneda no se ofrece).
--
-- TABLAS QUE LLEVAN DINERO EN CUP Y SE MIGRAN
--   productos          precio_cup (siempre), precio y precio_anterior solo
--                      cuando la moneda base del producto es CUP.
--   paquetes           precio_cup de la matriz tarifaria.
--   carrito_items      precio_unitario congelado, cuando la linea es CUP.
--   transacciones      subtotal, comision_qbaswing y total de las CUP.
--   transaccion_items  precio_unitario y neto_vendedor de esas transacciones.
--   evidencias_pago    monto_verificado de las CUP.
--
-- Los montos historicos se multiplican tambien a proposito: pintar una
-- transaccion de enero con la unidad vieja la enseñaria cien veces mas barata.
--
-- La moneda de cada fila se lee con COALESCE(moneda_codigo, moneda): el
-- `moneda_codigo` es la moneda real del vendedor y es la que manda a la hora de
-- saber en que unidad esta el numero (ver 0022 y 0029).
-- ============================================================================

-- 1. Productos ----------------------------------------------------------------

UPDATE productos SET precio_cup = precio_cup * 100 WHERE precio_cup IS NOT NULL;

UPDATE productos
   SET precio = precio * 100,
       precio_anterior = CASE WHEN precio_anterior IS NULL THEN NULL ELSE precio_anterior * 100 END
 WHERE COALESCE(moneda_codigo, moneda) = 'CUP';

-- 2. Matriz tarifaria de espacios --------------------------------------------

UPDATE paquetes SET precio_cup = precio_cup * 100 WHERE precio_cup IS NOT NULL;

-- 3. Carrito: la linea congelada ---------------------------------------------

UPDATE carrito_items SET precio_unitario = precio_unitario * 100 WHERE moneda = 'CUP';

-- 4. Transacciones ya cobradas -----------------------------------------------

UPDATE transacciones
   SET subtotal = subtotal * 100,
       comision_qbaswing = comision_qbaswing * 100,
       total = total * 100
 WHERE moneda = 'CUP';

UPDATE transaccion_items
   SET precio_unitario = precio_unitario * 100,
       neto_vendedor = neto_vendedor * 100
 WHERE transaccion_id IN (SELECT id FROM transacciones WHERE moneda = 'CUP');

UPDATE evidencias_pago
   SET monto_verificado = monto_verificado * 100
 WHERE moneda = 'CUP' AND monto_verificado IS NOT NULL;

-- 5. La FAQ que prometia 30 monedas ------------------------------------------
-- Solo existe en espanol: los otros idiomas caen al espanol (ver 0023).

UPDATE faq
   SET respuesta = 'Tres: pesos cubanos (CUP), dolares (USD) y euros (EUR). Puedes ofrecer el producto en una, dos o las tres a la vez, y cada precio admite decimales: 250, 12.50 o 0.01. El comprador ve el precio en la moneda que elija, tal cual.'
 WHERE idioma = 'es'
   AND pregunta = '¿Que monedas puedo usar para poner precios?';
