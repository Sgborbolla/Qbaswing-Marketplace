-- Direcciones de cobro reales. Base LOCAL unicamente.
--
-- Solo USDT y PYUSD. La direccion de USDC se descarto porque es la misma que la
-- de USDT: en TRON una sola direccion recibe todos los tokens TRC-20, asi que
-- listarla dos veces era mostrar al comprador dos opciones que son la misma
-- cuenta. No es un error mio de tecleo: se lo confirmo para que no se anuncie
-- como algo que no es.

-- TRON (TRC-20). Direccion de 34 caracteres que empieza por T, toda ella en
-- base58: los caracteres 0, O, I y l no pueden aparecer, y no aparecen.
INSERT INTO direcciones_cripto
  (moneda, red, direccion, etiqueta, activa, unidades_por, confirmaciones, notas)
VALUES
  ('USDT', 'TRON (TRC-20)', 'TEy7Pr8rnJzP3eTJsSKEEPxjUZHqFw1uy2',
   'USDT por TRON', 1, '1', 20,
   'Direccion de deposito de un exchange centralizado. El dinero no llega a una cartera propia hasta que se retira: ver la nota sobre retiros.');

-- Solana. Direccion de 43 caracteres en base58.
INSERT INTO direcciones_cripto
  (moneda, red, direccion, etiqueta, activa, unidades_por, confirmaciones, notas)
VALUES
  ('PYUSD', 'Solana', 'Yd2kjTQe3R7caax9wR2yvGJ3ZNrviXcPVpnY8mBtvEf',
   'PYUSD por Solana', 1, '1', 20,
   'Stablecoin de PayPal. Red de bloques de ~400 ms, asi que 20 confirmaciones llegan en menos de un minuto.');