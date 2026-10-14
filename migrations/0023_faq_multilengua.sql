-- ============================================================================
-- 0023 — FAQ en todos los idiomas y ampliada a mas de 30
-- ============================================================================
--
-- QUE HACE
--   1. Anade `idioma` a `faq`. Hasta hoy la FAQ era una sola lista en espanol.
--      Ahora cada idioma tiene la suya: `/faq` pide las preguntas del idioma
--      activo y, si ese idioma todavia no esta traducido, cae al espanol.
--   2. El indice unico pasa de `pregunta` a `(idioma, pregunta)`, para que la
--      misma pregunta pueda existir en los 22 idiomas.
--   3. Suma las preguntas nuevas hasta pasar de 30.
--
-- El ALTER lleva DEFAULT 'es' para que las 20 filas que ya existian queden
-- marcadas como espanol sin un UPDATE aparte.
-- ============================================================================

ALTER TABLE faq ADD COLUMN idioma TEXT NOT NULL DEFAULT 'es';

DROP INDEX IF EXISTS idx_faq_pregunta;
CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_pregunta_idioma ON faq(idioma, pregunta);

DROP INDEX IF EXISTS idx_faq_orden;
CREATE INDEX IF NOT EXISTS idx_faq_idioma_orden ON faq(idioma, orden) WHERE activa = 1;

-- -----------------------------------------------------------------------------
-- De la 21 a la 35. Cubren lo que cambio en las fases 2 y 3.
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO faq (idioma, pregunta, respuesta, orden) VALUES
  ('es', '¿Que monedas puedo usar para poner precios?',
   'Las que necesites. Hay mas de 30 monedas del mundo (peso mexicano, argentino, colombiano, chileno, sol, real, bolivar, dolar, euro, libra, yen...) y cada una lleva su propio simbolo. El comprador ve el precio en tu moneda, tal cual.', 21),
  ('es', '¿Puedo publicar un producto sin foto?',
   'Si. Nombre, precio y detalles son obligatorios; la foto no. Si no pones ninguna, en el catalogo aparece la miniatura de su categoria. Sube la foto cuando la tengas.', 22),
  ('es', '¿Cuantas fotos puedo poner a un producto?',
   'Las que quieras. La primera es la portada y las demas forman la galeria. Cada imagen puede pesar hasta 2 MB y se admiten JPG, PNG, WEBP, GIF y AVIF.', 23),
  ('es', '¿Que son las variantes de un producto?',
   'Las opciones entre las que elige el comprador: una talla, un color, una capacidad. Cada variante lleva sus propias existencias, y cuando se agotan se marca sola como agotada.', 24),
  ('es', '¿Que pasa cuando se me acaba el stock de un producto fisico?',
   'El producto se despublica solo y libera el espacio que ocupaba, asi que puedes publicar otro en su lugar. La foto y los datos se conservan: cuando repongas existencias, lo vuelves a publicar y aparece otra vez.', 25),
  ('es', '¿Puedo tener diez productos digitales con un paquete pequeño?',
   'Si. El paquete limita cuantos productos puedes tener publicados a la vez, no cuantos puedes vender ni cuantos puedes guardar como borrador. Lo que no esta publicado no ocupa espacio.', 26),
  ('es', '¿Como se calcula la comision del 5%?',
   'Solo la pagan los productos digitales de un autor externo (Regla A). Se calcula producto por producto, no sobre el total del carrito, y se redondea en cada linea. Un carrito con un digital externo y un fisico solo paga comision por el digital.', 27),
  ('es', 'Si vendo mi propio material digital, ¿pago comision?',
   'No. Cuando el producto es tuyo y se aloja y descarga desde QBASwing (Regla B), la comision es 0%. El 5% es solo para material de otros que se distribuye desde aqui.', 28),
  ('es', '¿Que pasa si edito un producto despues de publicado?',
   'Los cambios de nombre, precio o descripcion se guardan al momento. Si un producto pasa a ser digital de autor externo (Regla A), vuelve a revision del Owner antes de mostrarse otra vez, porque cambia la regla que se le aplica.', 29),
  ('es', '¿Puedo cobrar con PayPal, Stripe o tarjeta internacional?',
   'El sitio ya reserva el hueco para esas modalidades. Mientras no esten integradas, puedes anotarlas como forma de cobro escribiendo tu correo o el numero, y el comprador te paga directo. Tambien puedes generar un QR con tus datos, igual que con el resto.', 30),
  ('es', '¿Quien ve mis datos de contacto y mis redes?',
   'Los que tu decidas publicar: se muestran en tu tienda y en la ficha de cada uno de tus productos. Puedes dejarlas vacias y no aparece nada. El correo con el que entras no se muestra nunca: para eso esta el correo de contacto, que pones tu aparte.', 31),
  ('es', '¿Puedo cambiar de idioma sin perder lo que estoy haciendo?',
   'Si. El selector de arriba cambia el idioma del sitio y mantiene la pagina en la que estas. El nombre y la descripcion de tus productos se quedan tal como los escribiste: el idioma cambia los textos del sitio, no lo que tu escribes.', 32),
  ('es', '¿Mis productos y mi tienda aparecen en todos los idiomas?',
   'La interfaz si. El nombre, la descripcion y los detalles de tus productos los escribes tu, en el idioma que quieras, y se muestran tal cual en todos los idiomas del sitio.', 33),
  ('es', '¿Como funciona el panel de mi tienda?',
   'Desde tu panel editas el nombre comercial, la descripcion, la ubicacion, el avatar, tu contacto y tus redes. Todo es opcional menos el nombre. Los precios y el catalogo van aparte, en tu lista de productos.', 34),
  ('es', '¿Puedo pedir que el Owner revise algo de mi tienda?',
   'Si. Desde la pagina de contacto. La verificacion de una tienda y la aprobacion de los productos de Regla A las hace el Owner a mano; no es automatico y no tiene fecha garantizada.', 35);
