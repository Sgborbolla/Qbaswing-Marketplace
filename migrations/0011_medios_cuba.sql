-- Migracion 0011: los medios de pago PROPIOS de la plataforma.
--
-- ===========================================================================
--  QUE HAY AQUI Y QUE NO
-- ===========================================================================
-- Aqui van unicamente los medios por los que el OWNER cobra: su BANDEC, su BPA y
-- sus cuentas de cripto.
--
-- NO van los medios de los vendedores. Cada uno pone los suyos, y se guardan en
-- `medios_pago_usuario` (migracion 0013).
--
-- Se estuvo a punto de meter aqui Metropolitano, Transfermovil y EnZona, y fue
-- un error con consecuencias reales: un medio de pago de esta tabla es una cuenta
-- DONDE LLEGA EL DINERO. Si el Owner no tiene cuenta en el Banco Metropolitano
-- y la tabla dice "Metropolitano", el cliente transfiere ahi y el dinero se va a
-- una cuenta que no es nuestra, sin error de por medio y sin manera de
-- recuperarlo.
--
-- Que el comprador pueda PAGAR DESDE su cuenta de Metropolitano, su
-- Transfermovil o su EnZona es otra cosa y no va aqui: eso no es un sitio donde
-- Receive el dinero, es un ORIGEN. Se explica en el texto de instrucciones de
-- estos medios, que lo escribe el Owner, y no en una fila que finge ser una
-- cuenta.
--
-- ===========================================================================
--  TODO ENTRA INACTIVO
-- ===========================================================================
-- Ninguno se activa. No es descuido: para activarlo hacen falta las
-- instrucciones, y las instrucciones necesitan el numero de cuenta y el titular,
-- que son datos que solo tiene el Owner.
--
-- Aqui NO se inventan numeros. Un numero inventado, aunque sea de prueba, tiene
-- dos formas de acabar mal: que alguien lo copie y le transfiera a un titular que
-- no existe, o que el Owner no lo note y lo deje puesto. Por eso `numero_cuenta`
-- y `titular` se rellenan despues, desde el panel.
--
-- Los colores SI vienen dados por el Owner, que ve sus propias tarjetas. No se
-- buscaron en ningun sitio:
--
--   - BPA      verde
--   - BANDEC   roja
--
-- La busqueda en la red no sirvio: `websearch` fallo y las webs de los bancos no
-- cargan. Wikipedia tampoco dice de que color son las tarjetas, solo que BPA es
-- el Banco Popular de Ahorro y BANDEC el Banco de Credito y Comercio, y que los
-- dos junto a Metropolitano son los autorizados a hacer remesas.
--
-- El Owner escribe lo que quiera. Si sus tarjetas cambian de color, lo cambia
-- desde el panel con un campo de color y no hace falta commit ni redespliegue.

-- SIN `OR IGNORE`.
--
-- Se arma con `INSERT ... SELECT ... WHERE NOT EXISTS` en vez de `INSERT OR
-- IGNORE` para que sea idempotente sin tragarse los errores. Con `OR IGNORE`, un
-- `CHECK` que no se cumple no falla: la fila desaparece sin aviso. Eso es
-- exactamente lo que paso con BPA y BANDEC: el `CHECK` del color estaba escrito
-- al reves y rechazaba los dos unicos colores que si sabiamos, la siembra los
-- peridio en silencio, y la tabla quedo con tres medios de los cinco sin que
-- hubiera un solo error.
--
-- Con `WHERE NOT EXISTS` la fila no se duplica al repetir la migracion, pero si
-- algo esta mal, revienta. Que es lo que se quiere.
INSERT INTO medios_pago_plataforma
  (clave, nombre, tipo, color_marca, verificacion, instrucciones, activo, orden)
SELECT 'bpa', 'BPA', 'tarjeta', '#00A650', 'manual', '', 0, 10
  WHERE NOT EXISTS (SELECT 1 FROM medios_pago_plataforma WHERE clave = 'bpa');

INSERT INTO medios_pago_plataforma
  (clave, nombre, tipo, color_marca, verificacion, instrucciones, activo, orden)
SELECT 'bandec', 'BANDEC', 'tarjeta', '#D40000', 'manual', '', 0, 20
  WHERE NOT EXISTS (SELECT 1 FROM medios_pago_plataforma WHERE clave = 'bandec');

-- ---------------------------------------------------------------------------
-- Cripto
-- ---------------------------------------------------------------------------
--
-- `verificacion` es 'manual' y no 'automatica' a proposito, aunque el cripto sea
-- lo unico que se PUEDA comprobar solo. La columna dice lo que va a pasar, no lo
-- que podria pasar.
--
-- La version de hoy no consulta ninguna cadena de bloques: el Owner mira su
-- cartera y confirma. Marcarlo como 'automatica' seria anotar una capacidad que
-- el codigo no tiene.
--
-- Cuando se escriba el codigo que consulta la cadena, aqui se cambia a
-- 'automatica'. Es un UPDATE de una fila y no una migracion nueva, porque el
-- cambio es de comportamiento y no de estructura.
INSERT INTO medios_pago_plataforma
  (clave, nombre, tipo, color_marca, verificacion, instrucciones, activo, orden,
   direccion_cripto_id)
SELECT
  'usdt-trc20',
  'USDT por TRON',
  'cripto',
  NULL,
  'manual',
  '',
  0,
  60,
  d.id
FROM direcciones_cripto d
WHERE d.moneda = 'USDT'
  AND d.id = (SELECT MIN(id) FROM direcciones_cripto WHERE moneda = 'USDT')
  AND NOT EXISTS (SELECT 1 FROM medios_pago_plataforma WHERE clave = 'usdt-trc20');

INSERT INTO medios_pago_plataforma
  (clave, nombre, tipo, color_marca, verificacion, instrucciones, activo, orden,
   direccion_cripto_id)
SELECT
  'pyusd-solana',
  'PYUSD por Solana',
  'cripto',
  NULL,
  'manual',
  '',
  0,
  70,
  d.id
FROM direcciones_cripto d
WHERE d.moneda = 'PYUSD'
  AND d.id = (SELECT MIN(id) FROM direcciones_cripto WHERE moneda = 'PYUSD')
  AND NOT EXISTS (SELECT 1 FROM medios_pago_plataforma WHERE clave = 'pyusd-solana');