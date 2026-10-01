-- ============================================================================
-- 0004 — Orden de las redes sociales
-- ============================================================================
--
-- QUE TRAE Y POR QUE
--
-- Un solo cambio en `redes_sociales`: el ORDEN. Sale de mirar el footer de la
-- pasarela con la que vamos a cobrar, https://www.qvapay.com
--
-- TELEGRAM SUBE A LA PRIMERA POSICION
--
-- El orden de las redes no es estetico: es el orden en el que el visitante las
-- VE, y el primero es el que entra al ojo. QvaPay pone Telegram el primero de
-- sus ocho, no por costumbre, sino porque su canal de soporte
-- (`t.me/qvapaysupport_bot`) y el de ventas son el mismo, y ahi es donde llega
-- la gente. En Cuba pasa igual: Telegram es por donde un marketplace recibe
-- preguntas y cierra ventas. WhatsApp va segundo por la misma razon, es el
-- canal real de la compra por transferencia.
--
-- DISCORD BAJA AL ULTIMO LUGAR, NO SE QUITA
--
-- Discord estaba en el puesto 6, entre GitHub y Telegram, que es el peor sitio
-- posible para el: siendo el canal mas especifico de la lista, debio estar
-- arriba. Se decidio bajarlo en vez de borrarlo, porque sirve para otra cosa
-- —comunidad tecnica, que es exactamente el publico de los productos digitales—
-- y esa no es la gente que entra por el icono, sino la que ya esta dentro. Un
-- pie de pagina se ordena por quien esta COMPRANDO, no por quien ya esta
-- adherido.
--
-- Discord queda el ultimo, no eliminado: siete enlaces sin el y uno al fondo es
-- el orden de un marketplace, y un enlace al fondo sigue siendo un enlace.
--
-- LO QUE NO HACE ESTA MIGRACION
--
-- No toca `valor`. Las ocho redes siguen VACIAS a proposito: el Owner las
-- completa desde el panel. Esta migracion solo reordena; no inventa ninguna URL.
--
-- IDEMPOTENCIA
--
-- Los ocho bloques son idempotentes a proposito: el reorden se hace con
-- `UPDATE ... WHERE etiqueta = ?`, que no falla si la fila ya tiene ese orden.
-- Esta migracion se puede volver a aplicar sin romper nada, a diferencia de los
-- `ALTER TABLE` de 0003, que no lo son por naturaleza.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- El reorden
-- ---------------------------------------------------------------------------
--
-- Un `UPDATE` por red y no un solo `UPDATE` con `CASE`, por una razon que no es
-- estetica: un unico `UPDATE ... SET orden = CASE etiqueta ...` evalua los CASE
-- sobre el estado ANTERIOR de la fila, no sobre el que acaba de escribir. Por
-- ejemplo, si Telegram pasara de 7 a 1 y WhatsApp de 8 a 2 en la misma
-- sentencia, ambos leen los numeros viejos. Como aqui los numeros nuevos son
-- todos distintos de los viejos y la columna no tiene UNIQUE, no Habria
-- colision: aun asi se hace uno a uno, porque es el orden de ejecucion el que
-- lo haria correcto y conviene no depender de que hoy no colisionen.
UPDATE redes_sociales SET orden = 1 WHERE etiqueta = 'Telegram';
UPDATE redes_sociales SET orden = 2 WHERE etiqueta = 'WhatsApp';
UPDATE redes_sociales SET orden = 3 WHERE etiqueta = 'Facebook';
UPDATE redes_sociales SET orden = 4 WHERE etiqueta = 'Instagram';
UPDATE redes_sociales SET orden = 5 WHERE etiqueta = 'LinkedIn';
UPDATE redes_sociales SET orden = 6 WHERE etiqueta = 'YouTube';
UPDATE redes_sociales SET orden = 7 WHERE etiqueta = 'GitHub';
UPDATE redes_sociales SET orden = 8 WHERE etiqueta = 'Discord';


-- ---------------------------------------------------------------------------
-- Comprobacion
-- ---------------------------------------------------------------------------
--
-- Esta migracion no tiene triggers, ni vistas, ni datos que puedan quedar a
-- medias: ocho UPDATE. El fallo silencioso posible es "se aplico pero no cambio
-- nada", que pasa cuando la base remota ya tenia otros valores. Por eso se
-- deja la consulta que lo demuestra, para correrla despues de aplicar.
--
-- SELECT etiqueta, tipo, orden, valor
--   FROM redes_sociales
--  WHERE activo = 1
--  ORDER BY orden;
--
-- Esperado: 8 filas, Telegram 1 y Discord 8, todas con `valor` vacio.
