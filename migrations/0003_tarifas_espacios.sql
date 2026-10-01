-- ============================================================================
-- 0003 — Tarifas oficiales, aprobacion de la Regla A y slots reutilizables
-- ============================================================================
--
-- QUE TRAE Y POR QUE
--
-- El Documento Maestro 2026 fija tres cosas que el esquema de 0001 no tenia:
--
--   1. LA MATRIZ TARIFARIA (seccion 3). Diez categorias fisicas con precio en
--      CUP y en USD/EUR, vigencia estricta de 60 dias, y dos categorias
--      marcadas como configurables. En 0001 la tabla `paquetes` existia VACIA:
--      era el contenedor, no el contenido.
--
--   2. LA APROBACION DEL OWNER EN LA REGLA A (seccion 2). "Publicacion directa
--      tras aprobacion". En 0001 `publicado` era un booleano y no habia estado
--      intermedio: un vendedor de software externo podia publicarse solo, que
--      es justo lo que la regla prohibe.
--
--   3. LA VIGENCIA REAL DE 60 DIAS (seccion 3). `suscripciones.estado` existia
--      pero nada venciera las suscripciones: nadie iba a ponerlas en 'vencido'.
--      Un paquete de 2 meses que no expira es un paquete eterno.
--
-- ESTE ARCHIVO NO ES UN SNAPSHOT: 0001 se aplico y no se toca. Cada migracion
-- suma. Por eso hay DROP de la vista vieja y no una version corregida de 0001.
-- La vista se recrea porque una vista no tiene ALTER TABLE y la correccion
-- necesita cambiar la forma de la consulta, no solo sus filas.
--
-- EL ORDEN DE ESTE ARCHIVO ES PARTE DEL DISENO
-- La vista `v_slots_usados` consulta `productos.estado_publicacion`, y los
-- triggers de la Regla C consultan la misma columna. Por eso los ALTER TABLE de
-- `productos` van ANTES de la vista. SQLite no valida el cuerpo de una vista al
-- crearla, asi que el orden inverso tambien "funciona" hoy; se deja el orden
-- correcto para que no dependa de ese detalle.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Vigencia real de las suscripciones
-- ---------------------------------------------------------------------------
--
-- `vigencia_dias` es una COPIA, igual que `slots_totales`. Si el Owner sube la
-- vigencia de un paquete manana, las suscripciones ya pagadas no cambian: quien
-- compro 60 dias sigue teniendo 60.
--
-- Se puede agregar con NOT NULL y DEFAULT en la misma sentencia que el ALTER
-- porque SQLite lo permite cuando hay default. Se comprobo antes de escribir
-- esto: `ALTER TABLE ... ADD COLUMN x TEXT NOT NULL DEFAULT 'y'` funciona, y por
-- eso no hace falta reconstruir la tabla para estas dos columnas.
--
-- ---------------------------------------------------------------------------
-- ESTA SENTENCIA NO ES IDEMPOTENTE, Y ESO ES LO CORRECTO
-- ---------------------------------------------------------------------------
-- SQLite no tiene `ADD COLUMN IF NOT EXISTS`. No hay forma de escribirla: es una
-- limitacion del motor, no una falta de esfuerzo. Re-aplicar este archivo a mano
-- aborta con "duplicate column name: vigencia_dias".
--
-- No es un bug. Wrangler registra que la migracion se aplico y no la vuelve a
-- ejecutar, que es justamente lo que se quiere: una migracion que cambia el
-- esquema se aplica UNA vez. El unico escenario peligroso seria re-aplicarla, y
-- para eso esta `wrangler d1 migrations list`, que dice que queda.
--
-- La diferencia con el resto del archivo: los CREATE llevan `IF NOT EXISTS` y
-- los INSERT `OR IGNORE` porque esas sentencias anaden filas y volver a pasarlas
-- tiene que ser inocuo. Un ALTER TABLE no anade filas, cambia la forma de la
-- tabla, y por eso se ejecuta una vez. `scripts/validar-datos.mjs` comprueba
-- esta diferencia en lugar de fingir que las dos son lo mismo.

ALTER TABLE suscripciones ADD COLUMN vigencia_dias INTEGER NOT NULL DEFAULT 60
  CHECK (vigencia_dias > 0);

-- `vence_at` se calcula en el trigger, no en cada consulta. Guardarlo en vez de
-- derivarlo con `datetime(activado_at, '+60 days')` en cada SELECT evita tener
-- dos verdades: si alguien corrije una suscripcion a mano, el valor guardado y
-- el calculado divergen.
ALTER TABLE suscripciones ADD COLUMN vence_at TEXT;

CREATE INDEX IF NOT EXISTS idx_suscripciones_vence ON suscripciones(vendedor_id, vence_at);


-- ---------------------------------------------------------------------------
-- 2. El trigger que calcula `vence_at`
-- ---------------------------------------------------------------------------
--
-- Se dispara en INSERT y en UPDATE de las dos columnas que lo determinan. Sin
-- el trigger del UPDATE, corregir una suscripcion a mano (el Owner suspendiendo y
-- reactivando) dejaria `vence_at` en el pasado y la suscripcion pareceria vigente
-- cuando ya no lo es.
--
-- ---------------------------------------------------------------------------
-- POR QUE SON `AFTER` Y NO `BEFORE` CON `SELECT NEW.x = ...`
-- ---------------------------------------------------------------------------
-- La forma que aparece en la documentacion de SQLite es BEFORE INSERT con
-- `SELECT NEW.vence_at = strftime(...)`. Se probo en este proyecto y NO asigna:
-- la sentencia se ejecuta, la fila se inserta, y `vence_at` queda en NULL. No
-- da error, que es lo que la hace peligrosa: parece funcionar y no hace nada.
--
-- Se comprobo que tampoco sirve un BEFORE que haga UPDATE, porque la fila todavia
-- no existe y el UPDATE no encuentra nada que cambiar.
--
-- La forma que SI funciona es `AFTER` con un UPDATE por `id`. Es la que usan de
-- verdad las columnas `GENERATED`, y tiene una consecuencia que hay que manejar:
-- un AFTER UPDATE vuelve a disparar los triggers de UPDATE. Por eso el trigger
-- lleva la guarda `WHEN NEW.activado_at IS NOT OLD.activado_at OR ...`: si el
-- UPDATE no cambio las columnas de las que depende `vence_at`, no hace nada, y
-- la cadena se detiene sola en el segundo paso. Sin esa guarda, la suspension de
-- una suscripcion entraria en un bucle.
--
-- El orden de las columnas importa: los triggers se crean DESPUES del ALTER, y
-- `vence_at` tiene que existir ya o el UPDATE falla.

CREATE TRIGGER IF NOT EXISTS trg_suscripciones_vence_ins
AFTER INSERT ON suscripciones
WHEN NEW.vence_at IS NULL
BEGIN
  UPDATE suscripciones
     SET vence_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.activado_at, '+' || NEW.vigencia_dias || ' days')
   WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_suscripciones_vence_upd
AFTER UPDATE OF activado_at, vigencia_dias ON suscripciones
WHEN NEW.activado_at IS NOT OLD.activado_at OR NEW.vigencia_dias IS NOT OLD.vigencia_dias
BEGIN
  UPDATE suscripciones
     SET vence_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.activado_at, '+' || NEW.vigencia_dias || ' days')
   WHERE id = NEW.id;
END;


-- ---------------------------------------------------------------------------
-- 3. Estado de publicacion y aprobacion del Owner
-- ---------------------------------------------------------------------------
--
-- `publicado` queda como el interruptor de visibilidad, que es lo que consulta
-- el catalogo. Lo nuevo es `estado_publicacion`, que es el CIRCUITO:
--
--   borrador    el vendedor lo esta escribiendo. No existe para el publico.
--   pendiente   esperando al Owner. Es el unico estado al que puede salir un
--               producto de la Regla A.
--   aprobado    el Owner lo vio. Se puede publicar.
--   rechazado   el Owner lo rechazo, con motivo. El vendedor puede corregirlo.
--
-- El circuito lo impone la base, no el panel. Un trigger que aborta es la unica
-- forma de que "aprobado" signifique de verdad que un Owner lo aprobo: si la
-- regla viviera en el frontend, bastaria una peticion manipulada para publicar
-- software de otro sin permiso.

ALTER TABLE productos ADD COLUMN estado_publicacion TEXT NOT NULL DEFAULT 'borrador'
  CHECK (estado_publicacion IN ('borrador', 'pendiente', 'aprobado', 'rechazado'));

-- Quien aprobo y cuando. Sin esto, "aprobado" es un estado sin responsable, y el
-- documento maestro pide decisiones auditables.
ALTER TABLE productos ADD COLUMN aprobado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE productos ADD COLUMN aprobado_at TEXT;

-- Por que se rechazo. El vendedor tiene que saber que cambiar.
ALTER TABLE productos ADD COLUMN motivo_rechazo TEXT;

-- Indice parcial: el catalogo solo mira publicados y aprobados, que son una
-- fraccion pequena de la tabla. El indice cubre exactamente esa consulta.
CREATE INDEX IF NOT EXISTS idx_productos_publicos
  ON productos(categoria, precio) WHERE publicado = 1 AND estado_publicacion = 'aprobado';

-- ---------------------------------------------------------------------------
-- EL CIRCUITO DE LA REGLA A, Y POR QUE INSERT Y UPDATE SON DISTINTOS
-- ---------------------------------------------------------------------------
-- En INSERT, un producto de Regla A no puede nacer visible. Ni siquiera
-- declarandose "aprobado" en la misma sentencia: en un INSERT no hay fila previa,
-- asi que no hay de donde deducir que un Owner lo miro. El unico camino es nacer
-- pendiente y que el Owner lo apruebe despues con un UPDATE, que si queda
-- auditado.
--
-- En UPDATE, la regla es distinta porque hay dos cosas que la base tiene que
-- distinguir:
--
--   1. El Owner aprueba  -> se registra QUIEN. Sin `aprobado_por` no hay
--      decision responsable, y el documento pide auditoria.
--   2. El vendedor deja de publicar y vuelve a publicar SU producto de Regla C
--      -> eso NO es una aprobacion. Es cambiar un interruptor. Si el trigger lo
--      confundiera con una aprobacion, el vendedor no podria volver a subir su
--      producto sin pedirle permiso al Owner, y quedaria atrapado.
--
-- Por eso el trigger que exige `aprobado_por` esta limitado a `regla = 'A'`. En
-- las Reglas B y C el estado 'aprobado' significa "visible", no "alguien lo
-- aprobo", y por eso la columna se llama `estado_publicacion`. El detalle se
-- descubrio probando el escenario de slots: un vendedor que despublicaba y
-- republicaba un producto fisico se encontraba con el abort.
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS trg_productos_aprobacion_obligatoria
BEFORE INSERT ON productos
WHEN NEW.publicado = 1 AND NEW.regla = 'A'
BEGIN
  SELECT RAISE(ABORT, 'Regla A: un producto de otro autor nace pendiente y lo aprueba el Owner despues');
END;

CREATE TRIGGER IF NOT EXISTS trg_productos_aprobacion_obligatoria_upd
BEFORE UPDATE OF publicado, estado_publicacion, regla ON productos
WHEN NEW.publicado = 1 AND NEW.regla = 'A' AND NEW.estado_publicacion <> 'aprobado'
BEGIN
  SELECT RAISE(ABORT, 'Regla A: un producto de otro autor necesita la aprobacion del Owner antes de publicarse');
END;

-- Aprobar tiene que dejar nombre, Y SOLO EN LA REGLA A.
--
-- El `AND NEW.regla = 'A'` no es un detalle menor. Sin el, el trigger tambien
-- dispara en la Regla C, donde 'aprobado' significa "visible" y no "alguien lo
-- aprobo". Entonces un vendedor que despublicaba un producto fisico y queria
-- volver a subirlo se encontraba con un abort: "Aprobar un producto exige
-- registrar quien lo aprobo". No habia Owner de quien pedirlo, y el producto
-- quedaba trabado. Seidio probando el escenario de reutilizacion de slots.
CREATE TRIGGER IF NOT EXISTS trg_productos_aprobacion_con_autor
BEFORE UPDATE OF estado_publicacion ON productos
WHEN NEW.regla = 'A'
  AND NEW.estado_publicacion = 'aprobado'
  AND OLD.estado_publicacion <> 'aprobado'
  AND NEW.aprobado_por IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Aprobar un producto exige registrar quien lo aprobo');
END;

CREATE TRIGGER IF NOT EXISTS trg_productos_rechazo_con_motivo
BEFORE UPDATE OF estado_publicacion ON productos
WHEN NEW.estado_publicacion = 'rechazado' AND OLD.estado_publicacion <> 'rechazado'
  AND (NEW.motivo_rechazo IS NULL OR NEW.motivo_rechazo = '')
BEGIN
  SELECT RAISE(ABORT, 'Rechazar un producto exige escribir el motivo');
END;


-- ---------------------------------------------------------------------------
-- 4. La vista de slots, corregida
-- ---------------------------------------------------------------------------
--
-- QUE ESTA MAL EN LA VISTA DE 0001
--
-- La vista anterior contaba los productos con este filtro:
--
--     AND p.creado_at >= s.activado_at
--
-- y agrupaba por `s.id`. Eso produce dos numeros falsos:
--
--   a) Si el vendedor ya tenia publicados 3 productos y despues compra un
--      paquete, los 3 anteriores quedan FUERA del conteo. El panel le dice que
--      tiene 10 espacios libres cuando en realidad tiene 7. El paquete deja de
--      limitar nada.
--
--   b) Si el vendedor tiene DOS paquetes activos, cada fila de la vista cuenta
--      los mismos productos. Con 2 paquetes de 10 y 3 publicados, muestra "10-3"
--      y "10-3" por separado: 17 espacios libres de un total de 20. La suma de
--      una columna y la suma de la otra no cuadran.
--
-- POR QUE `creado_at >= activado_at` estaba ahi
-- La intencion era no contar productos que ya estaban publicados cuando se
-- compro el paquete. El problema es que un slot ocupado por un producto
-- publicado sigue ocupado: la siguiente compra de paquete no lo libera. El
-- slot no se ocupa al publicar, se ocupa mientras haya algo publicado.
--
-- LA REGLA CORRECTA, tal cual dice el Documento Maestro
-- "Espacios 100% reutilizables durante la vigencia del paquete": lo que se
-- cuenta es la cantidad de productos FISICOS PUBLICADOS ahora mismo. Vender,
-- quitar o editar uno lo devuelve al saldo solo, sin tocar una sola fila.
--
-- POR QUE AGRUPA POR VENDEDOR Y NO POR SUSCRIPCION
-- Porque el saldo es la SUMA de todos los pacotes vigentes. Calcular slots
-- usados y libres por paquete daria dos verdades distintas que no suman.
--
-- POR QUE NO USA LA VISTA DENTRO DEL TRIGGER DE LA REGLA C
-- Un trigger se crea antes de que exista la vista que invoca si el orden del
-- archivo es otro, y la validacion diferida de SQLite lo permitiria, pero
-- entonces la regla de slots estaria escrita dos veces y las dos copias
-- divergen con el tiempo. Abajo, en el trigger, esta escrita una sola vez y en
-- el mismo sitio donde se lee.

DROP VIEW IF EXISTS v_slots_usados;

CREATE VIEW IF NOT EXISTS v_slots_usados AS
WITH vigentes AS (
  SELECT vendedor_id,
         SUM(slots_totales) AS slots_totales
    FROM suscripciones
   WHERE estado = 'activo'
     AND vence_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   GROUP BY vendedor_id
),
ocupados AS (
  SELECT vendedor_id,
         COUNT(*) AS slots_usados
    FROM productos
   WHERE tipo = 'fisico'
     AND publicado = 1
     AND estado_publicacion = 'aprobado'
   GROUP BY vendedor_id
)
SELECT v.id                                                       AS vendedor_id,
       COALESCE(g.slots_totales, 0)                              AS slots_totales,
       COALESCE(o.slots_usados, 0)                                AS slots_usados,
       COALESCE(g.slots_totales, 0) - COALESCE(o.slots_usados, 0) AS slots_libres,
       -- Un vendedor con slots ilimitados no compra paquetes, asi que su
       -- `slots_libres` es 0 para siempre. Sin esta columna apareceria como
       -- "sin saldo" y el panel lo trataria como si debiera algo.
       CASE WHEN EXISTS (
              SELECT 1
                FROM usuarios u
                JOIN exencion_usuario e ON e.email = u.email
               WHERE u.vendedor_id = v.id
                 AND e.activo = 1
                 AND e.slots_ilimitados = 1
            ) THEN 1 ELSE 0 END                                   AS slots_ilimitados
  FROM vendedores v
  LEFT JOIN vigentes g ON g.vendedor_id = v.id
  LEFT JOIN ocupados  o ON o.vendedor_id = v.id;


-- ---------------------------------------------------------------------------
-- 5. Regla C: ningun fisico visible sin slot pagado y libre
-- ---------------------------------------------------------------------------
--
-- El trigger mira los slots ANTES de insertar esta fila, que es lo correcto: si
-- el vendedor tiene 1 libre y publica este, queda en 0. Si tuviera 0, se
-- rechaza. Y el subquery excluye la fila nueva por construccion: en un INSERT la
-- fila todavia no esta en la tabla, y en el UPDATE el trigger corre con OLD
-- intacto y solo dispara cuando `OLD.publicado = 0`, o sea cuando la fila no
-- contaba todavia.
--
-- La exencion va primero en el OR a proposito: un vendedor con slots ilimitados
-- no tiene suscripcion, y sin esa rama el trigger lo rechazaria aunque la
-- exencion sea valida.

CREATE TRIGGER IF NOT EXISTS trg_productos_slots_requeridos
BEFORE INSERT ON productos
WHEN NEW.tipo = 'fisico' AND NEW.publicado = 1
BEGIN
  SELECT RAISE(ABORT, 'Regla C: publicar un producto fisico requiere un espacio libre en un paquete vigente')
   WHERE NOT EXISTS (
     SELECT 1
       FROM vendedores v
      WHERE v.id = NEW.vendedor_id
        AND (
          EXISTS (
            SELECT 1
              FROM usuarios u
              JOIN exencion_usuario e ON e.email = u.email
             WHERE u.vendedor_id = v.id
               AND e.activo = 1
               AND e.slots_ilimitados = 1
          )
          OR COALESCE((SELECT SUM(s.slots_totales)
                          FROM suscripciones s
                         WHERE s.vendedor_id = v.id
                           AND s.estado = 'activo'
                           AND s.vence_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), 0)
             - (SELECT COUNT(*)
                  FROM productos p
                 WHERE p.vendedor_id = v.id
                   AND p.tipo = 'fisico'
                   AND p.publicado = 1
                   AND p.estado_publicacion = 'aprobado') > 0
        )
   );
END;

-- La misma comprobacion al pasar de no publicado a publicado. Guardar un
-- borrador no gasta nada; hacerlo visible si.
CREATE TRIGGER IF NOT EXISTS trg_productos_slots_requeridos_upd
BEFORE UPDATE OF publicado, tipo, estado_publicacion ON productos
WHEN NEW.tipo = 'fisico' AND NEW.publicado = 1 AND OLD.publicado = 0
BEGIN
  SELECT RAISE(ABORT, 'Regla C: publicar un producto fisico requiere un espacio libre en un paquete vigente')
   WHERE NOT EXISTS (
     SELECT 1
       FROM vendedores v
      WHERE v.id = NEW.vendedor_id
        AND (
          EXISTS (
            SELECT 1
              FROM usuarios u
              JOIN exencion_usuario e ON e.email = u.email
             WHERE u.vendedor_id = v.id
               AND e.activo = 1
               AND e.slots_ilimitados = 1
          )
          OR COALESCE((SELECT SUM(s.slots_totales)
                          FROM suscripciones s
                         WHERE s.vendedor_id = v.id
                           AND s.estado = 'activo'
                           AND s.vence_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), 0)
             - (SELECT COUNT(*)
                  FROM productos p
                 WHERE p.vendedor_id = v.id
                   AND p.tipo = 'fisico'
                   AND p.publicado = 1
                   AND p.estado_publicacion = 'aprobado') > 0
        )
   );
END;


-- ---------------------------------------------------------------------------
-- 6. La matriz tarifaria oficial
-- ---------------------------------------------------------------------------
--
-- PRECIOS Y UNIDADES
--
--   precio_cup  CUP enteros.       250 CUP -> 250
--   precio_usd  centavos.          $10.00  -> 1000
--   precio_eur  centimos.          10,00 EUR -> 1000
--
-- La diferencia no es un descuido: los precios en dolares y euros tienen
-- centavos reales ($10.50 son 1050) y guardarlos como enteros los perderia. La
-- moneda SIEMPRE se toma del nombre de la columna, no de la fila.
-- `productos.precio` usa la misma convencion.
--
-- PRECIO Y VIGENCIA
--
-- El documento dice "500 - 750 CUP (configurable)" en Informatica y
-- "750 - 1.000 CUP (configurable)" en Construccion. Se guarda el valor bajo del
-- rango con `precio_configurable = 1`, que es la senal para que el panel muestre
-- esas dos como editables. Guardar el rango en una columna INTEGER obligaria a
-- decidir que hacer con la parte alta, y lo que hace falta es que el Owner la
-- escriba.
--
-- LA TABLA INTERNACIONAL AGRUPA, LA DE CUBA NO
--
-- El documento tiene 10 filas en CUP y 8 en USD/EUR, con "Ropa, Belleza &
-- Accesorios" en una sola fila de $10. Aqui hay 10 paquetes, uno por categoria,
-- y los tres de esa fila partida repiten el mismo $10. No se fusionan en uno
-- solo porque el precio en CUP de Ropa, Belleza y Accesorios es identico pero los
-- slots del Calzado son 8 y los de los otros dos son 10: un paquete unificado
-- tendria que mentir en los slots o en el precio.
--
-- La clave natural es la CATEGORIA, no el id. Por eso el indice es UNIQUE:
-- re-aplicar esta migracion no puede crear 20 paquetes, que es el mismo bug que
-- se corrigio en 0002 con las FAQ.

CREATE UNIQUE INDEX IF NOT EXISTS idx_paquetes_categoria ON paquetes(categoria);

INSERT OR IGNORE INTO paquetes
  (nombre, categoria, slots, vigencia_dias, precio_cup, precio_usd, precio_eur, precio_configurable, caracteristicas, activo)
VALUES
  -- --- Mercado Cuba. Los 250 CUP son por los 60 dias completos, no por mes. ---
  ('Ropa & Moda',                 'ropa',         10, 60, 250, 1000, 1000, 0,
   '["10 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  ('Belleza & Cuidado Personal',  'belleza',      10, 60, 250, 1000, 1000, 0,
   '["10 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  ('Calzado',                     'calzado',       8, 60, 250, 1000, 1000, 0,
   '["8 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  ('Accesorios & Joyeria',        'accesorios',   10, 60, 250, 1000, 1000, 0,
   '["10 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  ('Hogar, Muebles & Decoracion', 'hogar',         5, 60, 350, 1200, 1200, 0,
   '["5 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  ('Electronica de Consumo',      'electronica',   3, 60, 500, 1500, 1500, 0,
   '["3 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  ('Equipos Electricos & Electrodomesticos', 'electrodomesticos', 3, 60, 600, 1700, 1700, 0,
   '["3 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  -- Las dos unicas categorias configurables. El Owner puede moverlas del valor
  -- guardado a cualquiera de los dos extremos del rango del documento.
  ('Informatica & Perifericos',   'informatica',   3, 60, 500, 1500, 1500, 1,
   '["3 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Precio editable por el Owner"]', 1),

  ('Automotriz & Repuestos',      'automotriz',    3, 60, 750, 2000, 2000, 0,
   '["3 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Sin limite de ventas"]', 1),

  ('Construccion, Herramientas & Maquinaria', 'construccion', 3, 60, 750, 2500, 2500, 1,
   '["3 espacios simultaneos","60 dias de vigencia","Espacios reutilizables","Precio editable por el Owner"]', 1);


-- ---------------------------------------------------------------------------
-- 7. Configuracion que documenta las reglas
-- ---------------------------------------------------------------------------
--
-- Se guarda en `configuracion` y no en el codigo por una razon concreta: el
-- Worker lee estos valores antes de repartir una venta, y si estuvieran en un
-- archivo TS habria que redeployar para cambiar una tarifa. Ademas, con
-- `INSERT OR IGNORE`, cambiar el valor aca NO pisa lo que el Owner ya edito en el
-- panel: re-aplicar la migracion no le deshace sus cambios.

INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
  ('tarifas_fisicas', '{"moneda_cup_unidad":"CUP","moneda_usd_unidad":"centavos","moneda_eur_unidad":"centimos","vigencia_dias":60,"categorias_configurables":["informatica","construccion"],"fuente":"migrations/0003_tarifas_espacios.sql","nota":"Los precios en USD y EUR son centavos y centimos. La moneda se lee del nombre de la columna."}'),

  -- El reparto de cada Regla de Oro. Se congela en cada transaccion, asi que
  -- cambiar esto no reescribe pagos ya cobrados.
  ('reglas_oro', '{"A":{"tipo":"digital","origen":"externo","comision_qbaswing":5,"comision_autor":95,"espacios":"sin_restriccion","publicacion":"aprobacion_del_owner","pasarela":"obligatoria_plataforma"},"B":{"tipo":"digital","origen":"qbaswing","comision_qbaswing":0,"comision_autor":100,"espacios":"sin_restriccion","publicacion":"directa","pasarela":"opcional"},"C":{"tipo":"fisico","comision_qbaswing":0,"comision_autor":100,"espacios":"paquete_60_dias","publicacion":"directa","pasarela":"opcional"}}'),

  -- Por que la Regla A no admite los metodos de cobro del autor. Se guarda para
  -- que la duda se responda leyendo la base y no preguntando.
  ('pasarela_obligatoria_regla_a', '{"motivo":"El 5% solo existe si el pago pasa por la plataforma. Si el autor cobra directo, QBASwing no puede retener ni confirmar.","reglas":["A"],"metodos_plataforma":["qva-pay","tropi-pay"],"metodos_autor_permitidos":["B","C"]}'),

  -- La aprobacion de la Regla A, en la misma forma que se lee desde el Worker.
  ('aprobacion_requerida', '{"regla":"A","estados":["borrador","pendiente","aprobado","rechazado"],"reglas_sin_aprobacion":["B","C"],"nota":"Publicar un producto de Regla A sin estado aprobado lo rechaza un trigger de la base, no el panel."}');
