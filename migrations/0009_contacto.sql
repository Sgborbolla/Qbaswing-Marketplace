-- Migracion 0009: WhatsApp de contacto.
--
-- Va en su propia migracion, y no en la 0008 junto a las direcciones, por una
-- razon concreta: la 0008 ya se aplico en remoto. Si se le añadiera el WhatsApp
-- ahora y se volviera a aplicar, los INSERT de las direcciones volverian a
-- correr y chocarian con el indice unico de "una direccion activa por moneda".
--
-- Las migraciones son un registro de lo que fue pasando, no una descripcion de
-- como deberia estar la base. Por eso lo que ya se aplico se queda como
-- estaba y lo nuevo va en su archivo.
--
-- Idempotente: si se repite, actualiza el mismo numero en lugar de duplicar.

UPDATE contacto_plataforma
   SET whatsapp = '+5358147030',
       actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE id = 1;

-- El numero va en `whatsapp` y no en `telefono`. No son la misma cosa: `telefono`
-- la pinta el pie como texto para marcar, y un numero al que hay que entrar a
-- WhatsApp necesita su propia columna para poder ser un enlace.
--
-- Se guardan los 53 sin el mas y con un 0 delante, en formato E.164. El mas es
-- parte del numero, no un adorno, y separarlo haria que al construir el enlace
-- `wa.me` se tenga que volver a poner.