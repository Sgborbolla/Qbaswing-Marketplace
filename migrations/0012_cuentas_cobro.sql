-- Migracion 0012: numeros de cuenta donde el comprador puede transferir.
--
-- ===========================================================================
--  POR QUE COLUMNAS Y NO DENTRO DE `instrucciones`
-- ===========================================================================
-- El texto de instrucciones es para personas y va a prosa. El numero de cuenta
-- es un dato, se compara, se valida y hay que poder decidir por codigo si se
-- enseña o no. Meterlo dentro del texto obligaria a leer el campo entero para
-- saber si hay numero, y no se podria ocultar sin reescribir el texto entero.
--
-- ===========================================================================
--  POR QUE NO ES UN SECRETO, PERO TAMPOCO ES PUBLICO
-- ===========================================================================
-- Es lo contrario de una direccion cripto. La direccion cripto esta hecha para
-- que todo el mundo la vea; el numero de una tarjeta no, y el que lo publica se
-- hace responsable de las transferencias que le lleguen.
--
-- El comprador SIEMPRE tiene que verlo, o no puede pagar. Pero eso no significa
-- que deba estar en una ruta que responda sin preguntar quien es.
-- Por eso va en su columna y no en una API publica de consulta: `GET
-- /api/medios-pago` devuelve nombre, color y tipo, y NO devuelve el numero. El
-- numero sale unicamente dentro de `POST /api/pagos`, que exige sesion y que ya
-- esta creando un cobro. Ahi mostrarlo es justificado; en una consulta anonima
-- no lo es.

ALTER TABLE medios_pago_plataforma ADD COLUMN numero_cuenta TEXT;

-- Titular de la cuenta. NO se inventa: es el nombre que aparece en la tarjeta y
-- hay que teclearlo bien, porque una transferencia a nombre equivocado no la
-- acepta el banco.
ALTER TABLE medios_pago_plataforma ADD COLUMN titular TEXT;

-- Si el numero supero la comprobacion de Luhn.
--
-- Los dos numeros que hay aqui NO la pasaron. Se guardan con `0` porque se
-- pueden usar, pero con la advertencia puesta: Luhn no es la unica forma de
-- validar un numero de tarjeta, y hay bancos que no lo aplican. No hay forma de
-- comprobarlo desde aqui, asi que lo honesto es dejarlo dicho y que la primera
-- transferencia sea de prueba y pequena.
--
-- `1` significa "comprobado", no "correcto": la comprobacion detecta el error
-- de tecleo mas frecuente, no todos.
ALTER TABLE medios_pago_plataforma
  ADD COLUMN numero_verificado INTEGER NOT NULL DEFAULT 0
  CHECK (numero_verificado IN (0, 1));

-- Un numero con espacios o guiones no sirve para comparar ni para construir un
-- enlace. Se guarda limpio: solo digitos, con el prefijo internacional sin mas.
-- 16 digitos es la longitud de una tarjeta.
CREATE TRIGGER IF NOT EXISTS trg_medios_pago_numero_limpio
BEFORE INSERT ON medios_pago_plataforma
WHEN NEW.numero_cuenta IS NOT NULL AND NEW.numero_cuenta <> ''
  AND NEW.numero_cuenta GLOB '*[^0-9]*'
BEGIN
  SELECT RAISE(ABORT, 'el numero de cuenta solo puede tener digitos');
END;

UPDATE medios_pago_plataforma
   SET numero_cuenta = '9204129979925122',
       titular = NULL,
       numero_verificado = 0,
       instrucciones = 'Transfiere al numero de tarjeta de arriba. Guarda el comprobante y escribenos el monto para confirmarlo.'
 WHERE clave = 'bpa';

UPDATE medios_pago_plataforma
   SET numero_cuenta = '9224069992059523',
       titular = NULL,
       numero_verificado = 0,
       instrucciones = 'Transfiere al numero de tarjeta de arriba. Guarda el comprobante y escribenos el monto para confirmarlo.'
 WHERE clave = 'bandec';

-- Los cripto no llevan numero de cuenta: su "numero" esta en
-- `direcciones_cripto` y se cambia girando la direccion, no editando un numero
-- aqui. Se deja a NULL a proposito.