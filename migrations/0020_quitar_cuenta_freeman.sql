-- =============================================================================
-- 0020_quitar_cuenta_freeman.sql
--
-- QUE HACE ESTA MIGRACION
-- =============================================================================
-- Elimina los datos semilla del patrocinador (Freeman Impresiones) que el
-- esquema dejo creados "en seco" al aplicar 0001 y 0006.
--
-- La cuenta no debe existir hasta que su dueno real se registre. Hasta ahora
-- habia una tienda `freeman-impresiones` sin dueno, con una exencion de
-- comision y un privilegio de administracion concedidos por anticipado a un
-- correo cuya cuenta aun no existe. Ese estado intermedio no sirve:
--
--   1. La tienda aparece en el catalogo y en las busquedas aunque su dueno
--      nunca haya confirmado que quiere vender.
--   2. El correo del patrocinador quedaba con privilegios y exenciones ACTIVOS
--      desde el primer dia, sin que nadie haya verificado la cuenta.
--   3. Si el correo se corrige o el patrocinio no se concreta, quedan filas
--      huerfanas en tres tablas que nadie se acuerda de limpiar.
--
-- Cuando el dueno real se registre, la tienda, la exencion y el privilegio se
-- crean en ese momento (como para cualquier vendedor), no antes.
--
-- ===========================================================================
-- POR QUE SE BORRA Y NO SE DESACTIVA
-- ===========================================================================
-- `exencion_usuario.activo` y `privilegio_usuario.revocado_at` existen para
-- conservar historial de una cuenta que FUE real. Aca la cuenta nunca existio:
-- no hay ventas, no hay historial, no hay nada que auditar. Marcar como
-- revocado lo que nunca estuvo vigente seria mentira; borrarlo es la verdad.
--
-- Se borra la fila de `vendedores` por su `email`, no por su `slug`. El slug
-- identifica la tienda, pero la cuenta a la que se la quita es el correo, y
-- asi la proxima persona que lea esto ve que el criterio fue "esa cuenta",
-- no "ese texto".
-- ===========================================================================

-- El orden importa: primero se suelta todo lo que apunta al correo y
-- despues la tienda. No hay productos, suscripciones ni carritos asociados
-- (nunca hubo actividad), pero el orden deja la base en un estado valido
-- aunque manana alguien anada una FK hacia estas filas.

DELETE FROM privilegio_usuario WHERE email = 'frankfreemansariol2016@gmail.com';

DELETE FROM exencion_usuario   WHERE email = 'frankfreemansariol2016@gmail.com';

DELETE FROM vendedores         WHERE email = 'frankfreemansariol2016@gmail.com';