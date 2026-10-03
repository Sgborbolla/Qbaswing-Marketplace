-- Migracion 0013: los medios de pago que pone cada vendedor.
--
-- ===========================================================================
--  POR QUE UNA TABLA Y NO LA MISMA `medios_pago_plataforma`
-- ===========================================================================
-- Porque son dos cosas distintas con dos dueños distintos:
--
--   `medios_pago_plataforma`  los cuentas del OWNER. El los crea y edita el
--                             Owner desde su panel. Sirven para lo que vende el
--                             Owner y para lo que la plataforma cobra por
--                             medio suyo.
--
--   `medios_pago_usuario`     los cuentas de CADA VENDEDOR. Cada uno pone los
--                             suyos y solo ve los suyos.
--
-- Meter a todos en una tabla obligaria a inventar un campo "de quien es" y a
-- filtrar por el en cada consulta. Peor: el Owner tendria que poder editar el
-- numero de cuenta de otro, que no es asunto suyo. Que sea una tabla aparte lo
-- hace imposible por construccion, y no por acordarse de no hacerlo.
--
-- ===========================================================================
--  `tipo` ES UNA AGRUPACION, `nombre` ES LA ETIQUETA
-- ===========================================================================
-- `tipo` decide en como se dibuja el distintivo. `nombre` es lo que lee el
-- comprador y es texto libre a proposito.
--
-- Eso es lo que permite que el Owner escriba "Transfermovil", "EnZona" o
-- "Metropolitano" sin que este proyecto tenga que saber que existen. No se
-- hardcodea una lista de medios de Cuba porque esa lista no esta cerrada: el
-- Owner la escribe, y anadir uno es rellenar un formulario en vez de escribir
-- una migracion.
--
-- Los valores de `tipo` son los grupos minimos para que la pagina pueda pintar
-- cada medio de una manera. `otro` existe justamente para no tener que ampliar
-- la lista cada vez que aparezca algo que no estaba previsto.
--
-- ===========================================================================
--  LO QUE NO SE INVENTA
-- ===========================================================================
-- Esta tabla no se siembra. No hay ni un medio de pago de ningun vendedor
-- porque no hay ningun vendedor dado de alta con sus cuentas, y un numero de
-- cuenta inventado tiene dos finales posibles y ninguno bueno: que alguien le
-- transfiera a un titular inexistente, o que el Owner no se note y lo deje
-- puesto.

CREATE TABLE IF NOT EXISTS medios_pago_usuario (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Dueño del medio. `ON DELETE CASCADE` y no `SET NULL` a proposito: si se
  -- borra la cuenta, sus numeros de cuenta tambien se borran. Dejar el medio
  -- huerfano en una tabla con `usuario_id` a NULL no tiene a quien pertenecer y
  -- haria que `usuario_id` admitiera nulo solo para guardar basura.
  --
  -- Va por USUARIO y no por `vendedor_id` porque quien se identifica en el
  -- Worker es el usuario. `vendedor_id` es para la tienda, y una persona
  -- puede tener tienda y no estar vendiendo todavia.
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Identificador estable dentro de este usuario. Solo minusculas, digitos y
  -- guiones. NO es global como el `clave` de `medios_pago_plataforma`: dos
  -- vendedores pueden tener ambos "bpa" sin que esten en conflicto, porque son
  -- cuentas distintas. Por eso la unicidad es por usuario y no global.
  --
  -- Aqui NO va `UNIQUE (usuario_id, clave)`: va como indice creado aparte, mas
  -- abajo, y la razon esta al lado de ese `CREATE UNIQUE INDEX`.
  clave      TEXT    NOT NULL
                     CHECK (clave <> '' AND clave NOT GLOB '*[^a-z0-9-]*'),

  -- Lo que lee el comprador. Texto libre.
  nombre     TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),

  -- Como se dibuja. Ver la nota de arriba sobre tipo y nombre.
  tipo       TEXT    NOT NULL
                     CHECK (tipo IN ('tarjeta', 'app', 'cripto', 'efectivo', 'otro')),

  -- ---------------------------------------------------------------------------
  --  COLOR DE MARCA
  ---------------------------------------------------------------------------
  --
  -- NULL a proposito, y no un color de relleno. Un color inventado es peor que
  -- ninguno: el distintivo se dibuja igual que los demas y el comprador ve el
  -- color equivocado, y duda de la tienda justo en el paso donde hay que
  -- cederle el dinero.
  --
  -- El CHECK se parte por partes y no usa un solo `NOT GLOB` sobre la cadena
  -- entera, porque asi se rechazaria la almohadilla y no se aceptaria ningun
  -- color escrito como debe. Ese error ya ocurrio una vez en 0010 y costo dos
  -- filas de la siembra sin que saliera ni un error.
  color_marca TEXT    CHECK (
                    color_marca IS NULL
                    OR (length(color_marca) = 7
                        AND substr(color_marca, 1, 1) = '#'
                        AND substr(color_marca, 2) NOT GLOB '*[^0-9A-Fa-f]*')
                  ),

  -- ---------------------------------------------------------------------------
  --  LOS DATOS DEL MEDIO, SEGUN EL TIPO
  ---------------------------------------------------------------------------
  --
  -- Para 'tarjeta' y 'app': el numero donde se transfiere, y el titular.
  numero_cuenta TEXT,
  titular       TEXT,

  -- Para 'cripto': la direccion y, sobre todo, la RED.
  --
  -- La red es lo que evita que el dinero se pierda sin error: USDT por TRON y
  -- USDT por Ethereum son fichas distintas, y mandar una a la direccion de la
  -- otra deja el dinero en una cadena donde no esta. Va en su propia columna y
  -- no en `direcciones_cripto` porque esa tabla es del Owner y tiene un indice
  -- unico de una sola direccion activa POR MONEDA en todo el sitio: meter ahi las
  -- direcciones de los vendedores las haria chocar entre si.
  direccion     TEXT,
  red           TEXT,

  -- Texto que lee el comprador antes de pagar.
  instrucciones TEXT    NOT NULL DEFAULT '',

  -- ---------------------------------------------------------------------------
  --  `verificado`: LO REVISA EL OWNER
  -- ---------------------------------------------------------------------------
  --
  -- El vendedor lo activa, pero eso NO lo vuelve de fiar. El Owner revisa y
  -- marca. Mientras no este verificado, la pagina lo muestra con una
  -- advertencia, en vez de ocultarlo.
  --
  -- Ocultarlo bloquearia al vendedor, y bloquear al vendedor es quitarle al
  -- marketplace su unico motivo de existir. Mostrarlo con una advertencia deja
  -- que el comprador decida, que es quien pone el dinero.
  --
  -- Por defecto 0, no 1: que el valor por defecto sea "no verificado" es lo que
  -- hace que el estado verificado sea el raro. Si el defecto fuera 1, con un
  -- solo olvido bastaria para que un numero sin mirar se diera por bueno.
  verificado   INTEGER NOT NULL DEFAULT 0 CHECK (verificado IN (0, 1)),

  -- Lo controla el vendedor.
  activo       INTEGER NOT NULL DEFAULT 0 CHECK (activo IN (0, 1)),

  orden        INTEGER NOT NULL DEFAULT 0,

  creado_at      TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_at TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- ===========================================================================
  --  QUE DATOS HACE FALTA CADA TIPO
  -- ===========================================================================
  --
  -- Sin esto, el Owner rellena "cripto" y deja el numero en blanco, y el
  -- comprador ve un medio de pago cripto sin direccion a la que enviar nada.
  -- El error no salta al guardar, y ya no se puede arreglar porque el comprador
  -- ya vio el medio.
  --
  -- El tipo decide que datos son obligatorios:
  --
  --   'cripto'         direccion + red. Las dos, o el dinero se pierde.
  --   'tarjeta'/'app'  numero de cuenta.
  --   'efectivo'/'otro' nada: lo que haga falta va en `instrucciones`.
  --
  -- El `numero_cuenta` solo puede tener digitos en 'tarjeta' y 'app'. En
  -- 'efectivo' y 'otro' se permite cualquier texto, porque ahi puede hacer falta
  -- un correo o un alias de app.
  CHECK (
    CASE tipo
      WHEN 'cripto'
        THEN direccion IS NOT NULL
         AND length(trim(direccion)) >= 8
         AND red IS NOT NULL
         AND length(trim(red)) > 0
      WHEN 'tarjeta' OR 'app'
        THEN numero_cuenta IS NOT NULL
         AND numero_cuenta <> ''
         AND numero_cuenta NOT GLOB '*[^0-9]*'
      ELSE 1
    END
  )
);

-- ===========================================================================
--  LA UNICIDAD VA EN UN INDICE, NO EN EL `CREATE TABLE`
-- ===========================================================================
--
-- Escribiendolo como restriccion de tabla, dentro de los parentesis:
--
--     UNIQUE (usuario_id, clave),
--
-- el `CREATE TABLE` no se puede aplicar en D1. Da:
--
--     near "nombre": syntax error
--
-- Y el error apunta a la columna que viene DESPUES, que es innocua: el problema
-- es que una restriccion de tabla cierra la lista de definiciones de columna y
-- ya no se admite ninguna mas. Se comprobo aislando el caso:
--
--     CREATE TABLE q1 (a INT, UNIQUE (a, b), b TEXT);   -> error
--     CREATE TABLE q2 (a INT, b TEXT, UNIQUE (a, b));   -> bien
--
-- El aviso es especialmente traicionero porque el texto que señala el parser no
-- tiene nada que ver con lo que esta mal:asi que el error aparece en la columna
-- que sigue y hace sospechar de ella.
--
-- Por eso la unicidad va en un `CREATE UNIQUE INDEX` aparte, que no tiene ese
-- limite y que ademas dice en una linea sola exactamente que es unico.
CREATE UNIQUE INDEX IF NOT EXISTS idx_medios_pago_usuario_clave
  ON medios_pago_usuario (usuario_id, clave);

-- Los medios de un usuario, en el orden que el puso.
CREATE INDEX IF NOT EXISTS idx_medios_pago_usuario
  ON medios_pago_usuario (usuario_id, activo, orden);

-- Un vendedor no puede tener dos veces el mismo `tipo` visible.
--
-- NO es un `UNIQUE` normal: es PARCIAL, y solo mira `activo = 1`. Asi el
-- vendedor puede apartar una tarjeta vieja sin borrarla (los pagos antiguos la
-- tienen grabada) y aun asi tener la nueva activa.
--
-- Sin este indice, un vendedor que da de alta su BANDEC dos veces muestra dos
-- distintivos identicos y el comprador no sabe cual usar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_medios_pago_usuario_unica_activa
  ON medios_pago_usuario (usuario_id, tipo)
  WHERE activo = 1;

-- ===========================================================================
--  ACTIVAR ESTA EN UNA TABLA VACIA DE ESTADO
-- ===========================================================================
-- No hay nada que activar todavia. Cuando lo haya, `medios_pago_plataforma` lleva
-- una restriccion que esta no tiene: no se puede activar un medio sin
-- instrucciones, porque un medio de cobro sin explicar como pagar es un
-- formulario vacio que pide dinero.
--
-- Aqui NO se aplica el mismo filtro. La razon es que el vendedor escribe sus
-- propias instrucciones y puede tenerlas en blanco un momento; el Owner tiene
-- una sola cuenta y la deja bien puesta desde el principio. Bloquear al
-- vendedor por un texto que se le pasa medio segundo es tapar una venta para
-- proteger una comision. El texto se le recuerda en el panel y ya esta.
