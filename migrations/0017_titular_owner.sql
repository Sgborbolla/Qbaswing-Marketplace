-- Migracion 0017: el titular de las dos tarjetas del Owner.
--
-- ===========================================================================
--  EL NOMBRE TAL COMO LO DIJO EL OWNER
-- ===========================================================================
-- "Sergio Grabiel Borbolla Verdecia". Se guarda exactamente asi, sin reordenar,
-- sin pasar a mayusculas y sin quitar tildes.
--
-- Reordenar seria corregir por cuenta propia un dato que es suyo. En un nombre
-- propio no hay
-- una forma correcta que el codigo pueda decidir: el que sabe como se escribe en
-- su tarjeta es el Owner, y lo ha escrito el.
--
-- ===========================================================================
--  AVISO QUE NO SE PUEDE COMPROBAR DESDE AQUI
-- ===========================================================================
-- En los datos cubanos el uso normal es poner los DOS APELLIDOS primero y el
-- nombre al final, de forma que un banco muestre:
--
--     Borbolla Verdecia, Sergio Grabiel
--
-- Lo que va escrito aqui es el orden natural en que se dice en voz alta. Si el
-- banco exige el orden inverso, el nombre no coincide y la transferencia se
-- rechaza.
--
-- Con una tarjeta de pago cubana la cuenta de destino es el numero, no el
-- nombre, asi que es probable que no haga falta. Pero eso NO se puede confirmar
-- desde aqui y por eso queda escrito: si alguna vez se rechaza una transferencia,
-- este es el primer sitio donde mirar.
--
-- ===========================================================================
--  POR QUE UNA MIGRACION Y NO UN `UPDATE` SUELTO
-- ===========================================================================
-- Porque un `UPDATE` a mano no queda en ningun sitio. Las migraciones son el
-- registro de como llego la base a su estado actual, y esto es un dato que hace
-- falta: sin el, el proximo que abra el repositorio no sabe de donde salio el
-- titular ni si se ha revisado alguna vez.

UPDATE medios_pago_plataforma
   SET titular = 'Sergio Grabiel Borbolla Verdecia'
 WHERE clave IN ('bpa', 'bandec')
   AND numero_cuenta IS NOT NULL;

-- Se escribe tambien en `direcciones_cripto` porque alli el titular es el unico
-- dato de contacto que hay: una transferencia que llega a una cartera no lleva
-- ningun nombre suyo, asi que sin esto no hay forma de saber de quien es cada una.
--
-- `notas` es el unico campo de texto libre de esa tabla, y es donde cabe: no es
-- una nota interna, es el nombre que hay que conocer para responder a quien
-- manda el dinero.
UPDATE direcciones_cripto
   SET notas = 'Sergio Grabiel Borbolla Verdecia'
 WHERE moneda IN ('USDT', 'PYUSD');
