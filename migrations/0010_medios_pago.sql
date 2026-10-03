-- Migracion 0010: medios de pago de la plataforma.
--
-- ===========================================================================
--  POR QUE NO SE METEN EN `configuracion`
-- ===========================================================================
-- Porque un medio de pago no es un dato: tiene color de marca, tipo, si se
-- verifica solo o a mano, y un texto de instrucciones que hay que poder cambiar
-- sin tocar codigo. En `configuracion` todo eso seria un JSON opaco que el
-- Owner no puede editar desde la pagina.
--
-- ===========================================================================
--  LA DISTINCION IMPORTANTE: COMO SE VERIFICA
-- ===========================================================================
-- `verificacion` separa lo que se puede comprobar del origen de lo que no:
--
--   'automatica': el Worker puede ascertain por si mismo que el dinero llego.
--       Hoy no hay ninguno. En el futuro, un pago con cripto si.
--
--   'manual': NO hay forma de saberlo. El dinero llega a una cuenta personal o
--       a una app, y el Worker no tiene acceso a esa cuenta ni a esa app. Alguien
--       tiene que mirar un panel y darle al boton.
--
-- Los bancos y las apps son de pago manual, todos: BANDEC, BPA, Metropolitano,
-- Transfermovil y EnZona. No es que este mal implementado: es que ninguna de esas
-- plataformas ofrece una interfaz para que una tienda de terceros sepa si le
-- llego un pago.
--
-- Por eso la columna es NOT NULL y hay que elegir a proposito. Un medio de pago
-- sin decidir como se verifica no puede activarse, porque no hay forma de saber
-- cuando darle al comprador lo que compro.

CREATE TABLE IF NOT EXISTS medios_pago_plataforma (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identificador estable, en minusculas y sin espacios. Es lo que usa el codigo
  -- para referirse a un medio, asi que NO debe depender del nombre que se vea:
  -- renombrar 'Transfermovil' a 'ETECSA Transfermovil' no puede romper nada.
  clave        TEXT    NOT NULL UNIQUE
                       CHECK (clave <> '' AND clave NOT GLOB '*[^a-z0-9-]*'),

  -- Lo que lee el comprador. Aqui si puede cambiar de la nada.
  nombre       TEXT    NOT NULL,

  -- 'tarjeta' = cuenta bancaria con numero de tarjeta o cuenta.
  -- 'app'      = aplicacion movil (Transfermovil, EnZona).
  -- 'cripto'   = cadena de bloques.
  tipo         TEXT    NOT NULL CHECK (tipo IN ('tarjeta', 'app', 'cripto')),

  -- =========================================================================
  --  COLOR DE MARCA
  -- =========================================================================
  --
  -- NULL a proposito, y no '#000000' de relleno.
  --
  -- Un color inventado es peor que no tener color: el distintico se dibuja igual
  -- que los demas y el comprador ve el color equivocado. Si se dejara NOT NULL
  -- habria que poner algo, y lo que se pondria seria un color inventado que
  -- parece dato real.
  --
  -- Con NULL, la pagina dibuja el distintivo neutro y sin color de marca. Feo y
  -- cierto, que es mejor que bonito y falso.
  --
  -- El CHECK acepta NULL o un hexadecimal de 6 digitos CON almohadilla.
  --
  -- Se comprueba por partes y no con un solo `NOT GLOB`, porque una sola
  -- expresion no puede decir "los 6 del medio son hexadecimales Y el primero es
  -- una almohadilla". Con `NOT GLOB '*[^0-9A-Fa-f]*'` sobre la cadena entera se
  -- rechaza la `#` y no se acepta ningun color escrito como debe. Ese error
  -- costo dos filas de la siembra sin que se viera: la tabla quedo con tres
  -- medios de los cinco, y el `OR IGNORE` de la siembra no dio ningun aviso.
  color_marca  TEXT    CHECK (
                  color_marca IS NULL
                  OR (length(color_marca) = 7
                      AND substr(color_marca, 1, 1) = '#'
                      AND substr(color_marca, 2) NOT GLOB '*[^0-9A-Fa-f]*')
                ),

  -- Como sabe la plataforma que el dinero llego. Ver la nota de arriba.
  verificacion TEXT    NOT NULL CHECK (verificacion IN ('automatica', 'manual')),

  -- Texto que lee el comprador antes de pagar: a que numero, a que nombre, y en
  -- que concepto poner la referencia. Vacio esta permitido, pero un medio de
  -- cobro sin instrucciones es un medio de cobro que nadie puede usar bien.
  instrucciones TEXT    NOT NULL DEFAULT '',

  -- Enlace a la direccion cripto real, cuando este medio sea de cripto.
  --
  -- Va en la misma tabla en vez de tener dos listas paralelas para el comprador.
  -- Una tabla de bancos y otra de cripto significan dos sitios donde anadir un
  -- medio de cobro, y el momento en que uno se olvida del otro es cuando un
  -- medio queda sin aparecer en la pagina. Aqui todo esta junto y ordenado; la
  -- direccion concreta vive en `direcciones_cripto`, que es donde se guarda con
  -- su red y sus confirmaciones.
  direccion_cripto_id INTEGER REFERENCES direcciones_cripto(id) ON DELETE SET NULL,

  -- Si este medio es el que se ofrece. Un medio sin instrucciones puede estar
  -- en la tabla pero no disponible: es la diferencia entre "todavia no lo he
  -- escrito" y "no lo ofrezco".
  activo       INTEGER NOT NULL DEFAULT 0 CHECK (activo IN (0, 1)),

  -- Orden en que se muestran. Manual y no alfabetico: el primero es el que se
  -- usa mas, y ese es el que tiene que estar arriba.
  orden        INTEGER NOT NULL DEFAULT 0,

  creado_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_at TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_medios_pago_activo ON medios_pago_plataforma (activo, orden);

-- Un medio activo tiene que tener sus instrucciones escritas.
--
-- Se comprueba en el CHECK de `activo` y no con un trigger, para que el error
-- salga al intentar INSERT y no al intentar activar.
--
-- Se permite 'tarjeta', 'app' y 'cripto' sin texto: la tabla se llena antes de
-- tener los datos y no debe impedir rellenarla. Lo que no se permite es activar
-- algo sin explicar como pagar, porque eso no es una opcion de cobro: es un
--.formulario vacio que pide dinero.
CREATE TRIGGER IF NOT EXISTS trg_medios_pago_instrucciones
BEFORE UPDATE OF activo ON medios_pago_plataforma
WHEN NEW.activo = 1 AND length(trim(NEW.instrucciones)) = 0
BEGIN
  SELECT RAISE(ABORT, 'no se puede activar un medio de pago sin instrucciones');
END;

CREATE TRIGGER IF NOT EXISTS trg_medios_pago_instrucciones_ins
BEFORE INSERT ON medios_pago_plataforma
WHEN NEW.activo = 1 AND length(trim(NEW.instrucciones)) = 0
BEGIN
  SELECT RAISE(ABORT, 'no se puede activar un medio de pago sin instrucciones');
END;