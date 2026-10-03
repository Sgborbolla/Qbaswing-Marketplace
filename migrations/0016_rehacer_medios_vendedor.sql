-- Migracion 0016: se rehace `medios_pago_usuario` con la validacion correcta.
--
-- ===========================================================================
--  POR QUE HAY QUE REHACERLA Y NO CORRIGIRLA
-- ===========================================================================
-- Un `CHECK` no se puede alterar en SQLite. No hay `ALTER TABLE ... ALTER
-- COLUMN`, y tampoco vale la pena recrear solo una restriccion. La unica forma de
-- cambiarlo es rehacer la tabla.
--
-- ===========================================================================
--  POR QUE ES SEGURO
-- ===========================================================================
-- Porque la tabla esta VACIA. Se comprobo antes de escribir esto:
--
--     SELECT COUNT(*) FROM medios_pago_usuario;   ->  0
--
-- Las unicas filas que hubo fueron cuatro de prueba, creadas al buscar el error
-- del `CASE`, y se borraron. No hay datos de ningun vendedor que perder.
--
-- Esto no es un criterio general. Rehacer una tabla con datos exige copiar los
-- datos a la nueva, comprobar que coinciden y borrar la vieja. Aqui no hay nada
-- que copiar, y por eso el metodo barato es el correcto.
--
-- ===========================================================================
--  POR QUE ESTA FORMA FINAL Y NO `0013` MAS `0015`
-- ===========================================================================
-- Porque el resultado que se quiere es una sola tabla con la validacion buena y
-- sin la columna `verificado`, y este archivo la deja asi de una vez. Aplicar
-- `0013` y luego `0015` tambien llegaria al mismo sitio, pero habria que dejar
-- esta tabla vacia otra vez entre las dos, y no hace falta.
--
-- En una base nueva se aplican las tres en orden (0013 crea, 0015 quita
-- `verificado`, 0016 rehace) y el resultado es el mismo. Esta migracion es
-- idempotente en cuanto al resultado final: repetirla devuelve la misma tabla.
--
-- ===========================================================================
--  EL ERROR QUE CORRIGE
-- ===========================================================================
-- El `CHECK` de 0013 escribia el reparto por tipo asi:
--
--     CASE tipo
--       WHEN 'cripto'          THEN <exigir direccion y red>
--       WHEN 'tarjeta' OR 'app' THEN <exigir numero de solo digitos>
--       ELSE 1
--     END
--
-- En un `CASE` simple, lo que va detras de `WHEN` se COMPARA con `tipo`. Y
-- `'tarjeta' OR 'app'` no es una lista: es una expresion booleana, y como las dos
-- cadenas son verdaderas, vale 1. La comparacion que SQLite hacia de verdad era
--
--     CASE 'tarjeta' WHEN 1  ->  sin coincidencia
--
-- de modo que las tarjetas y las apps caian siempre al `ELSE 1`, que siempre
-- pasa. La validacion de esos dos tipos no existia. Entro un numero escrito
-- `9204-1299-7992-5122`, con guiones, que es exactamente lo que el CHECK
-- prohibia, y entro sin decir nada.
--
-- El `GLOB` de solo digitos siempre estuvo bien: con guiones daba 0 y con solo
-- digitos daba 1. Lo que no existia era el camino que llegaba a evaluarlo.
--
-- Por eso `cripto` SI se validaba: su rama es `WHEN 'cripto'`, que si es una
-- comparacion literal y si coincide. Un error que solo afecta a unas ramas deja
-- las de al lado funcionando, y por eso una prueba que solo mira "un caso falla"
-- no dice nada sobre si los demas funcionan.
--
-- La correccion es un `CASE` de BUSQUEDA con `IN`, donde cada rama dice que
-- compara con que y no hay nada que resolver.

DROP TABLE IF EXISTS medios_pago_usuario;

-- Las notas largas de cada columna estan en 0013; aqui se deja la forma final y
-- el porque de las decisiones que no se ven leyendo el SQL.
CREATE TABLE IF NOT EXISTS medios_pago_usuario (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,

  -- `ON DELETE CASCADE`: si se borra la cuenta, sus numeros se borran. Un medio
  -- sin dueno en una tabla con `usuario_id` NOT NULL no tiene donde estar.
  --
  -- Va por USUARIO y no por `vendedor_id` porque quien se identifica en el Worker
  -- es el usuario. `vendedor_id` es para la tienda, y tener cuenta no es lo
  -- mismo que tener tienda.
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Repetido por cada usuario, no global como el `clave` de
  -- `medios_pago_plataforma`: dos vendedores pueden tener ambos "bpa" sin
  -- conflicto, porque son cuentas distintas.
  --
  -- Sin `verificado`: el Owner said que no revisa los medios de los demas, y es
  -- lo correcto. En un producto de Regla A el comprador le paga al VENDEDOR por
  -- una cuenta del VENDEDOR, y el que confirma es el VENDEDOR. Que el Owner mire
  -- esa cuenta no cambia si el pago llego, porque no tiene acceso a ella.
  --
  -- Lo unico que controla es `activo`, y lo controla el dueno del numero.
  clave      TEXT    NOT NULL
                     CHECK (clave <> '' AND clave NOT GLOB '*[^a-z0-9-]*'),

  -- Texto libre a proposito: el Owner escribe "Transfermovil", "EnZona" o lo que
  -- sea. La lista de medios de Cuba no esta cerrada y no se hardcodea.
  nombre     TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),

  -- `tipo` agrupa para el diseno; `nombre` es lo que lee el comprador. `otro`
  -- existe para no ampliar esta lista cada vez que aparezca algo imprevisto.
  tipo       TEXT    NOT NULL
                     CHECK (tipo IN ('tarjeta', 'app', 'cripto', 'efectivo', 'otro')),

  -- NULL a proposito: un color inventado es peor que ninguno, porque el
  -- distintivo se dibuja igual y el comprador ve el color equivocado y duda de
  -- la tienda justo en el paso donde tiene que soltar el dinero.
  --
  -- El CHECK se parte por partes porque un solo `NOT GLOB` sobre la cadena entera
  -- rechazaria la almohadilla y no aceptaria ningun color bien escrito. Ese
  -- error ya ocurrio una vez en 0010.
  color_marca TEXT    CHECK (
                    color_marca IS NULL
                    OR (length(color_marca) = 7
                        AND substr(color_marca, 1, 1) = '#'
                        AND substr(color_marca, 2) NOT GLOB '*[^0-9A-Fa-f]*')
                  ),

  -- Para 'tarjeta' y 'app'.
  numero_cuenta TEXT,
  titular       TEXT,

  -- Para 'cripto'. La RED es lo que evita perder el dinero: USDT por TRON y USDT
  -- por Ethereum son fichas distintas, y mandar una a la direccion de la otra
  -- deja el dinero en una cadena donde no esta, sin error ni devolucion.
  --
  -- No se guarda en `direcciones_cripto` porque esa tabla es del Owner y tiene
  -- un indice unico de una sola direccion activa POR MONEDA en todo el sitio:
  -- meter ahi las direcciones de los vendedores las haria chocar entre si.
  direccion     TEXT,
  red           TEXT,

  -- Texto que lee el comprador antes de pagar.
  instrucciones TEXT    NOT NULL DEFAULT '',

  -- Lo enciende y lo apaga el VENDEDOR, que es de quien es el numero.
  --
  -- NO hay ninguna restriccion que exija instrucciones para activar, y a
  -- proposito. En `medios_pago_plataforma` si la hay, porque el Owner tiene una
  -- sola cuenta y la deja bien puesta desde el principio. Aqui el vendedor
  -- escribe las suyas y puede tenerlas en blanco un momento; bloquearle una
  -- venta por un texto que se le pasa medio segundo es tapar una venta para
  -- proteger una formalidad. El panel se lo recuerda y ya esta.
  activo       INTEGER NOT NULL DEFAULT 0 CHECK (activo IN (0, 1)),

  orden        INTEGER NOT NULL DEFAULT 0,

  creado_at      TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_at TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- Que datos hacen falta en cada tipo, para que el error salte al GUARDAR y no
  -- cuando el comprador ya esta viendo un medio de pago cripto sin direccion.
  --
  -- Es un `CASE` de BUSQUEDA. Ver la nota de arriba sobre por que el simple no
  -- servia: con `WHEN 'tarjeta' OR 'app'` la rama era codigo muerto.
  CHECK (
    CASE
      WHEN tipo = 'cripto'
        THEN direccion IS NOT NULL
         AND length(trim(direccion)) >= 8
         AND red IS NOT NULL
         AND length(trim(red)) > 0
      WHEN tipo IN ('tarjeta', 'app')
        THEN numero_cuenta IS NOT NULL
         AND numero_cuenta <> ''
         AND numero_cuenta NOT GLOB '*[^0-9]*'
      ELSE 1
    END
  )
);

-- Las dos unicidades van como indice aparte, no como restriccion de tabla: en D1
-- una restriccion de tabla `UNIQUE` CIERRA la lista de columnas, y no se puede
-- declarar ninguna despues. Ponerla entre columnas da error de sintaxis, y el
-- mensaje senala la columna siguiente, que no tiene nada que ver.
CREATE UNIQUE INDEX IF NOT EXISTS idx_medios_pago_usuario_clave
  ON medios_pago_usuario (usuario_id, clave);

CREATE INDEX IF NOT EXISTS idx_medios_pago_usuario
  ON medios_pago_usuario (usuario_id, activo, orden);

-- PARCIAL: solo mira `activo = 1`, asi el vendedor puede apartar una tarjeta vieja
-- sin borrarla (los pagos antiguos la tienen grabada) y aun asi tener la nueva
-- activa. Sin esto, dar de alta la misma tarjeta dos veces muestra dos distintivos
-- identicos y el comprador no sabe cual usar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_medios_pago_usuario_unica_activa
  ON medios_pago_usuario (usuario_id, tipo)
  WHERE activo = 1;
