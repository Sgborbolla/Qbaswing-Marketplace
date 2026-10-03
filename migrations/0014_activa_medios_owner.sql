-- Migracion 0014: se activan los cuatro medios de cobro del Owner.
--
-- ===========================================================================
--  POR QUE ESTA EN SQL Y NO EN EL PANEL
-- ===========================================================================
-- Porque el panel todavia no existe. Esto es lo que haria el: cuatro textos y
-- cuatro interruptores. Se deja escrito una vez aqui para que el Owner pueda
-- cobrar desde hoy, y cuando el panel exista esto ya no se vuelve a tocar: a
-- partir de ahi se edita desde la pagina y esta migracion queda como el estado
-- inicial de los datos.
--
-- ===========================================================================
--  LOS TEXTOS Dicen LO MISMO PARA LAS TARJETAS
-- ===========================================================================
-- Las dos tarjetas tienen el mismo texto a proposito. No es por pereza: para
-- quien paga, el procedimiento es identico. Se diferencian en el numero, en el
-- color y en el nombre, que es lo que ve de diferente.
--
-- El texto dice que se puede pagar desde cualquier lado. Es la idea que pidio el
-- Owner: no importa de donde venga el dinero, mientras que llegue a una de sus
-- dos cuentas. Y es cierto, porque un mismo numero de tarjeta recibe
-- transferencias hechas desde otro banco, desde una aplicacion movil o en
-- efectivo.
--
-- ===========================================================================
--  LO QUE NO DICE NINGUN TEXTO
-- ===========================================================================
-- Ningun texto promete que el pago se confirme solo, ni en un tiempo concreto,
-- ni que se compruebe automaticamente. Ninguno de los cuatro medios se comprueba
-- solo hoy: el Owner mira su cuenta o su cartera y confirma. Prometer otra cosa
-- seria hacer que el comprador espere algo que no llega.
--
-- Tampoco se dice "pago seguro" ni "comprobado". Son palabras que un banco usa
-- porque puede respaldarlas y aqui no se puede.

-- ---------------------------------------------------------------------------
--  Las dos tarjetas
-- ---------------------------------------------------------------------------
--
-- El texto menciona "cualquier banco o aplicacion de Cuba" a proposito: es lo
-- que hace que la diferencia entre tener una BANDEC y una BPA no importa. El
-- comprador puede mandar desde la suya, desde una aplicacion movil o en
-- efectivo, y en los tres casos llega al mismo numero.
UPDATE medios_pago_plataforma
   SET instrucciones = 'Puedes transferir desde cualquier banco o aplicacion de Cuba, o dejarlo en efectivo y pagar en persona. Transfiere al numero de arriba, guarda el comprobante y escribenos el monto exacto para confirmar la compra.',
       activo = 1
 WHERE clave IN ('bpa', 'bandec')
   AND numero_cuenta IS NOT NULL
   AND length(trim(numero_cuenta)) > 0;

-- ---------------------------------------------------------------------------
--  Los dos cripto
-- ---------------------------------------------------------------------------
--
-- El texto dice lo de la red porque es el error que se paga caro. USDT por TRON
-- y USDT por Ethereum son fichas distintas, y mandar una a la direccion de la
-- otra deja el dinero en una cadena donde no esta: no hay error, no hay aviso y
-- no hay devolucion. Se avisa antes de enviar, no despues.
--
-- Y se dice que el monto sea EXACTO. Es la unica forma de saber cual de los
-- pagos que llegan es este, y por eso `/api/pagos` rechaza carritos que mezclen
-- monedas distintas.
UPDATE medios_pago_plataforma
   SET instrucciones = 'Envia el monto exacto a la direccion de arriba por la red indicada. Comprueba la red dos veces antes de enviar: mandar una moneda por otra red pierde el dinero y no se puede recuperar. Guarda el hash de la operacion y escribenos el monto para confirmar la compra.',
       activo = 1
 WHERE clave IN ('usdt-trc20', 'pyusd-solana')
   AND direccion_cripto_id IS NOT NULL;

-- ===========================================================================
--  LO QUE SIGUE SIN ESTAR
-- ===========================================================================
-- El `titular` de las dos tarjetas sigue vacio. No se inventa: es el nombre que
-- sale impreso en la tarjeta y hay que teclearlo bien, porque una transferencia
-- a nombre que no coincide no la acepta el banco.
--
-- Faltaria tambien una prueba de verdad: una transferencia pequena a cada numero,
-- para confirmar que los 16 digitos son correctos. Los dos numeros dados por el
-- Owner NO superaron la comprobacion de Luhn, que detecta el error de tecleo mas
-- frecuente. Lo mas probable es que esas tarjetas no apliquen ese digito de
-- control, pero desde aqui no hay forma de confirmarlo y por eso queda escrito.
