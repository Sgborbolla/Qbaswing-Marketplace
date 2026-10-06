-- Migracion 0018: el indice unico pasa a mirar la CUENTA, no el TIPO.
--
-- ===========================================================================
--  EL PROBLEMA
-- ===========================================================================
-- La 0016 creo esto:
--
--   CREATE UNIQUE INDEX idx_medios_pago_usuario_unica_activa
--     ON medios_pago_usuario (usuario_id, tipo) WHERE activo = 1;
--
-- Un indice unico PARCIAL sobre (usuario_id, tipo) significa que cada usuario
-- puede tener UN SOLO medio activo por tipo. Como `tipo` solo admite cinco
-- valores ('tarjeta', 'app', 'cripto', 'efectivo', 'otro'), un vendedor con dos
-- bancos no puede tener los dos encendidos: BPA y BANDEC son los dos 'tarjeta',
-- y activar uno desactivaria al otro.
--
-- ===========================================================================
--  POR QUE ESTA MAL, Y NO ES UN DETALLE DE DISENO
-- ===========================================================================
-- La tabla del Owner, `medios_pago_plataforma`, NO tiene ningun indice asi. Su
-- unico indice no unico es `idx_medios_pago_activo (activo, orden)`, y por eso
-- el sitio puede ofrecer a la vez BPA, BANDEC, USDT por TRON y PYUSD por
-- Solana: dos 'tarjeta' y dos 'cripto' activos simultaneamente.
--
-- Es decir, la tienda de la plataforma si puede mostrar dos bancos y cada
-- vendedor no. La restriccion no venia de una decision, venia de no haberse
-- notado, y contradice lo que se le pide al vendedor: que ponga todas las
-- modalidades que quiera.
--
-- ===========================================================================
--  QUE SE SUSTITUYE Y POR QUE ESTAS DOS
-- ===========================================================================
-- Lo que el indice original queria impedir es que el comprador vea dos
-- distintivos identicos y no sepa cual usar. Pero el duplicado de verdad no es
-- "dos cosas del mismo tipo": es LA MISMA CUENTA dada de alta dos veces. Dos
-- tarjetas distintas activas a la vez son normales y utiles; la misma tarjeta
-- dos veces es un error.
--
-- Por eso el unico pasa a ser por dato identificatorio:
--
--   1. (usuario_id, numero_cuenta) WHERE activo = 1 AND tipo IN ('tarjeta','app')
--      Impide la misma tarjeta dos veces. No impide BPA y BANDEC, que tienen
--      numeros distintos.
--
--   2. (usuario_id, direccion) WHERE activo = 1 AND tipo = 'cripto'
--      Impide la misma direccion dos veces. Las direcciones de los distintos
--      tipos son incompatibles entre si (mandar USDT de TRON a una direccion de
--      Ethereum deja el dinero en una cadena donde no esta, sin error ni
--      devolucion), y repetirla activa seria el mismo problema de dos
--      distintivos iguales.
--
-- `clave` sigue siendo unica por usuario (indice de la 0016, sin tocar): es el
-- identificador que usa el codigo, no lo que lee el comprador.
--
-- ===========================================================================
--  POR QUE ESTA REHACER INDICES Y NO TOCAR LOS DATOS
-- ===========================================================================
-- Un DROP INDEX / CREATE INDEX no toca ninguna fila. No hace falta copiar nada
-- ni comprobar nada despues, porque la tabla no cambia de forma: solo cambian
-- las restricciones que vigilan las altas futuras.
--
-- Si la tabla ya tuviera dos filas activas que chocarian con el indice nuevo,
-- el CREATE INDEX fallaria y la migracion no se aplicaria. Se comprueba antes:
--
--   SELECT COUNT(*) FROM medios_pago_usuario WHERE activo = 1;
--   SELECT usuario_id, numero_cuenta, COUNT(*) FROM medios_pago_usuario
--     WHERE activo = 1 AND tipo IN ('tarjeta','app')
--    GROUP BY usuario_id, numero_cuenta HAVING COUNT(*) > 1;
--   SELECT usuario_id, direccion, COUNT(*) FROM medios_pago_usuario
--     WHERE activo = 1 AND tipo = 'cripto'
--    GROUP BY usuario_id, direccion HAVING COUNT(*) > 1;
--
-- Las tres devolvian 0 filas: la tabla esta vacia.

DROP INDEX IF EXISTS idx_medios_pago_usuario_unica_activa;

-- Misma tarjeta activa dos veces. El WHERE del tipo hace falta: sin el, una
-- fila 'cripto' tiene `numero_cuenta` NULL, y en SQLite los NULL no chocan en un
-- indice unico, asi que el indice dejaria de servir justo para los casos en los
-- que dos criptos distintas comparten (usuario_id, NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_medios_pago_usuario_unica_cuenta
  ON medios_pago_usuario (usuario_id, numero_cuenta)
  WHERE activo = 1 AND tipo IN ('tarjeta', 'app');

-- Misma direccion activa dos veces. NULL no puede aparecer aqui porque el CHECK
-- de la tabla exige direccion para tipo 'cripto', y el WHERE ya la acota a ese
-- tipo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_medios_pago_usuario_unica_direccion
  ON medios_pago_usuario (usuario_id, direccion)
  WHERE activo = 1 AND tipo = 'cripto';
