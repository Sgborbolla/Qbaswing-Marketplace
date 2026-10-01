-- ===========================================================================
-- QBASwing Marketplace — Esquema D1 inicial
-- ===========================================================================
--
-- CÓMO APLICAR ESTE ARCHIVO
--
--   En local (base de desarrollo, NO toca produccion):
--     npx wrangler d1 execute qbaswing-marketplace --local --file=./db/schema.sql
--
--   En produccion (SIEMPRE via migraciones, nunca con `execute`):
--     npx wrangler d1 migrations apply qbaswing-marketplace --remote
--
-- `wrangler d1 execute --remote --file=schema.sql` esta PROHIBIDO en este
-- proyecto. Ejecutar DDL suelto contra produccion no queda registrado en el
-- historial de migraciones, asi que la proxima persona que clone el repo no
-- sabe que el esquema ya cambio y corre migraciones que chocan.
--
-- REGLAS DE DISEÑO
--
-- 1. D1 es SQLite. No hay `SERIAL`, ni `ENUM`, ni `JSONB`, ni funciones
--    `now()` del servidor. Se usan `INTEGER PRIMARY KEY AUTOINCREMENT` y
--    `CHECK` para simular enumeraciones.
--
-- 2. Fechas en TEXT ISO-8601 UTC ('2026-09-30T14:30:00Z'). SQLite no tiene
--    tipo fecha nativo y las funciones de fecha son fragile con formats.
--
-- 3. Montos: se guardan en ENTEROS, nunca en texto. Sumar dinero en
--    `REAL` (float) acumula error de redondeo. Un precio de 0.10 guardado
--    como REAL puede volver 0.09999999999999999. Con enteros, 10.
--    La division a formato ocurre solo al presentar.
--
-- 4. Toda tabla de dinero lleva `moneda` (codigo ISO 4217 de 3 letras).
--    El documento maestro opera en CUP, USD y EUR en la misma plataforma.
--
-- 5. Toda columna de `creado_at` tiene DEFAULT con `strftime`, que si es
--    parte del motor de SQLite y no del reloj de la app.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Identidad y roles (Documento Maestro, seccion 6)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL UNIQUE,
  nombre         TEXT    NOT NULL,
  -- CHECK en vez de ENUM: D1 no soporta ENUM y esta es la forma de mantener
  -- la restriccion en la base.
  rol            TEXT    NOT NULL DEFAULT 'comprador'
                 CHECK (rol IN ('owner', 'administrador', 'vendedor', 'comprador')),
  -- SHA-256 del hash de la contrasena. NUNCA la contrasena en claro.
  -- El documento maestro exige que la identidad del Owner se valide de forma
  -- criptografica; el hash vive aca y la comparacion, en el Worker.
  password_hash  TEXT    NOT NULL,
  verificado     INTEGER NOT NULL DEFAULT 0 CHECK (verificado IN (0, 1)),
  creado_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Un usuario con rol vendedor debe apuntar a un vendedor. Se valida con un
  -- trigger porque un CHECK no puede consultar otra tabla.
  vendedor_id    INTEGER REFERENCES vendedores(id) ON DELETE SET NULL,
  CHECK (rol <> 'vendedor' OR vendedor_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol      ON usuarios(rol);
-- `IF NOT EXISTS` en TODOS los CREATE, sin exception. Una migracion de D1
-- puede ejecutarse mas de una vez (un re-despliegue, una restauracion, un
-- `wrangler d1 migrations apply` repetido) y sin esta linea la segunda corrida
-- aborta con "index already exists" a mitad del esquema, dejando la base a
-- medias. Se detecto con scripts/validar-schema.mjs, que aplica el esquema dos
-- veces justamente para cazar esto.
CREATE INDEX IF NOT EXISTS idx_usuarios_vendedor ON usuarios(vendedor_id);


-- ---------------------------------------------------------------------------
-- Owners fundacionales: registro que los crea como owner
-- ---------------------------------------------------------------------------
-- El owner de la plataforma (identificado abajo) no se registra como comprador
-- y despues se le cambia el rol a mano. Al registrarse, la base lo reconoce y
-- le asigna 'owner' sin intervencion del Worker.
--
-- Ojo con la palabra "owners": hay UN owner (el creador). La otra cuenta
-- fundacional, la del patrocinador, NO entra por esta puerta: no es owner y no
-- tiene por que serlo. Va exenta por `exencion_usuario`, que es otra cosa.
--
-- POR QUE UNA TABLA Y NO UNA CONSTANTE EN EL CODIGO
--
-- La regla tiene que ser auditable desde SQL ("quien es owner y por que") y
-- modificable sin desplegar. Si viviera en el Worker, habria que redeplegar
-- para cambiar un correo, y nadie podria responder "desde cuando es owner este
-- usuario" con una consulta.
--
-- Dónde queda la exención de comisión: NO acá, y NO solo acá.
--
-- Hay DOS mecanismos, porque son dos preguntas distintas:
--
--   1. Por ROL   -> esta tabla, clave 'exencion_owner'. Dice "cualquier owner
--                    no paga comision". Es la regla general.
--   2. Por PERSONA -> tabla `exencion_usuario`, columna 'exento_comision'.
--                    Dice "esta cuenta concreta no paga", sin importar su rol.
--
-- Se necesitan los dos porque el patrocinador tiene la misma exencion del
-- creador pero NO es owner. Si la exencion fuera solo por rol, a el se le
-- cobraria el 5%; si fuera solo por persona, un tercer owner futuro pagaria.
--
-- PREVALENCIA: gana la exencion por persona. Si una cuenta estuviera
-- en las dos, el resultado es el mismo (0%), asi que el orden no cambia nada
-- en el resultado, pero importa para el log de auditoria: el Worker debe
-- registrar cual de los dos mecanismo aplico, o nadie puede explicar despues
-- por que esa venta no retuvo nada.
--
-- Esta tabla solo decide el ROL. La exencion vive en `exencion_usuario`.

CREATE TABLE IF NOT EXISTS owner_registro_preautorizado (
  email       TEXT PRIMARY KEY,
  -- Quien decide que esta cuenta es owner. Es la bitacora de por que existe
  -- la fila: si aparece un tercero con nombre "admin", hay que ver quien lo
  -- puso.
  autorizado_por TEXT   NOT NULL DEFAULT 'fundacion',
  nota        TEXT,
  -- QUE PUEDE HACER, no solo QUE ES.
  --
  -- 'completo' -> edita catalogo, perfiles, usuarios, comisiones, precios y
  --               contenido del sitio. Es el rol del creador.
  -- 'limitado' -> opera y consulta, pero NO modifica datos de terceros ni
  --               configuracion que altere lo que gana otra persona.
  --
  -- Existe como columna y no como `if (email = ...)` en el codigo por dos
  -- razones: el siguiente owner hereda el alcance que se le asigne sin tocar
  -- TypeScript, y cambiar el alcance de alguien es un UPDATE de una fila, no
  -- un redespliegue.
  --
  -- El valor por defecto es 'limitado'. Si alguien agrega una fila sin
  -- acordarse de esto, nace sin permiso de escritura sobre terceros, que es el
  -- fallo que duele.
  alcance     TEXT    NOT NULL DEFAULT 'limitado' CHECK (alcance IN ('completo', 'limitado')),
  -- 1 = puede registrarse y recibir rol owner. 0 = se le revoca el privilegio
  -- sin borrar la fila, para conservar la bitacora.
  activo      INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- UN SOLO OWNER.
--
-- sgborbolla@gmail.com es el creador y dueno del marketplace, y el unico con
-- todos los privilegios: edita catalogo, perfiles, usuarios, comisiones,
-- precios y contenido del sitio.
--
-- Quien es PATROCINADOR (frankfreemansariol2016@gmail.com) NO esta en esta tabla
-- y no debe agregarse. Es un usuario comun con exencion economica: no paga
-- paquetes de espacios ni comision. Va en `exencion_usuario` de mas abajo.
--
-- La razon de separarlos es que las dos cosas son de naturaleza distinta. Ser
-- owner concede poder de escritura sobre el marketplace entero; la exencion
-- concede que no se cobre una factura. Meter la exencion dentro del rol owner
-- obligaria a darle el panel de administracion a quien solo debe quedar
-- exento de pago, y eso le daria a un tercero capacidad de cambiar las
-- comisiones que se aplican a todos los demas.
INSERT OR IGNORE INTO owner_registro_preautorizado
  (email, autorizado_por, alcance, nota) VALUES
  ('sgborbolla@gmail.com', 'fundacion', 'completo',
   'Creador y dueno del marketplace. Unico owner con alcance completo.');

-- TRIGGER 1: nadie puede auto-asignarse 'owner'.
--
-- Sin esto, cualquiera que mande un POST a /api/registro con {"rol":"owner"}
-- queda como owner. El trigger aborta la insercion, no la "corrige": un
-- registro que pide privilegios no elevated tiene que fallar de forma visible.
--
-- La comparacion es con lower() porque el email no tiene colacion: "SGBorbolla"
-- y "sgborbolla" son cadenas distintas para UNIQUE, asi que sin normalizar
-- habria dos cuentas del mismo owner. El CHECK no lo arregla porque solo ve
-- la fila que se esta insertando.
CREATE TRIGGER IF NOT EXISTS trg_usuarios_no_autopromocion
BEFORE INSERT ON usuarios
WHEN NEW.rol = 'owner'
 AND lower(trim(NEW.email)) NOT IN (
       SELECT lower(email) FROM owner_registro_preautorizado WHERE activo = 1)
BEGIN
  SELECT RAISE(ABORT, 'rol owner solo para correos preautorizados');
END;

-- Misma proteccion en UPDATE, que es el vector obvio: un usuario legitimo
-- compra, pasa su id por la API y se manda rol='owner'.
CREATE TRIGGER IF NOT EXISTS trg_usuarios_no_promocion_update
BEFORE UPDATE OF rol ON usuarios
WHEN NEW.rol = 'owner'
 AND lower(trim(NEW.email)) NOT IN (
       SELECT lower(email) FROM owner_registro_preautorizado WHERE activo = 1)
BEGIN
  SELECT RAISE(ABORT, 'rol owner solo para correos preautorizados');
END;

-- TRIGGER 2: al registrarse, el correo preautorizado queda como owner.
--
-- Es AFTER INSERT porque SQLite no permite asignar NEW.rol en BEFORE. El
-- UPDATE corre dentro de la misma transaccion que el INSERT, asi que ningun
-- lector ve el estado intermedio 'comprador': si la transaccion hace commit,
-- la fila ya quedo como owner; si hace rollback, no existe.
--
-- verificado=1 va aqui porque un owner no puede operar sobre la plataforma sin
-- pasar por la verificacion de email, y nadie se la haria desde el flujo
-- normal. Es la unica excepcion a esa regla.
CREATE TRIGGER IF NOT EXISTS trg_usuarios_owner_automatico
AFTER INSERT ON usuarios
WHEN lower(trim(NEW.email)) IN (
       SELECT lower(email) FROM owner_registro_preautorizado WHERE activo = 1)
 AND NEW.rol <> 'owner'
BEGIN
  UPDATE usuarios
     SET rol = 'owner',
         verificado = 1,
         vendedor_id = NULL
   WHERE id = NEW.id;
END;


-- ---------------------------------------------------------------------------
-- Exenciones economicas (NO son permisos)
-- ---------------------------------------------------------------------------
--
-- QUE ES ESTA TABLA
-- Registra a quien NO se le cobra algo. No concede ningun poder: no da acceso
-- al panel, no cambia el rol, no permite ver metricas de la plataforma. Solo
-- hace que una cuenta concreta no genere un cargo.
--
-- POR QUE NO ES "ROL OWNER"
-- La exencion no es un privilegio de administracion. Si el patrocinador fuera
-- owner para no pagar, recibiria tambien el panel de administracion completo,
-- con la capacidad de editar los productos, los perfiles y las comisiones de
-- todos los demás. Eso es mucho mas poder del que hace falta para no facturar.
-- Con esta tabla el patrocinador queda como usuario: compra y vende como
-- cualquiera, exento de pagar paquetes y sin un solo permiso de escritura.
--
-- QUE HACE CADA COLUMNA
--   exento_comision  -> no se retiene el porcentaje de QBASwing. Se consulta
--                       en `repartir()`, en el Worker, al calcular cada venta.
--   slots_ilimitados -> puede publicar sin limite y no necesita comprar
--                       ningun paquete de espacios.
--
-- POR QUE `slots_ilimitados` Y NO TAMBIEN `exento_espacios`
-- Los paquetes de espacios no son otra cosa mas que la via de conseguir slots:
-- se pagan para tener donde publicar. Si una cuenta tiene slots ilimitados, no
-- hay nada que comprar, asi que "exento de espacios" y "slots ilimitados"
-- serian dos banderas que nunca pueden tener valores distintos. Una sola
-- columna evita el estado imposible y evita que alguien lea una y olvide
-- consultar la otra al decidir si puede publicar.
--
-- Se aplica en el Worker ANTES de contar `v_slots_usados`: si el usuario esta
-- exento, el conteo no se hace. No es solo un salto en la interfaz, porque si
-- el conteo se aplicara igual en la base, un producto publicado de mas
-- terminaria con el contador en negativo.
--
-- SE RESUELVE POR CORREO, NO POR ID
-- Igual que `owner_registro_preautorizado`: la exencion tiene que existir
-- ANTES de que la persona se registre, porque si dependiera del id habria que
-- crearla despues y habria una ventana en la que se le cobra de mas.
--
-- `INSERT OR IGNORE` en el trigger de alta: si alguien se registra con un
-- correo exento, la fila ya esta y no se toca. Si se registra otro, no hay fila
-- y paga normal.
CREATE TABLE IF NOT EXISTS exencion_usuario (
  email            TEXT PRIMARY KEY,
  -- No se le retiene el porcentaje de QBASwing. 0 = se le aplica la Regla de Oro.
  exento_comision  INTEGER NOT NULL DEFAULT 0 CHECK (exento_comision IN (0, 1)),
  -- Publica sin limite y no compra ningun paquete de espacios.
  -- 0 = su capacidad la dan los slots de `suscripciones_espacios`.
  slots_ilimitados INTEGER NOT NULL DEFAULT 0 CHECK (slots_ilimitados IN (0, 1)),
  autorizado_por   TEXT   NOT NULL,
  -- Por que se exime. Es la bitacora: una exencion sin motivo escrito no se
  -- puede defender despues ante una revision.
  motivo         TEXT   NOT NULL,
  -- 1 = vigente, 0 = revocada. No se borra la fila, para conservar el
  -- historial de quien estuvo exento y desde cuando.
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_at      TEXT   NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revocado_at    TEXT
);

-- Las dos cuentas fundacionales, con la MISMA exencion economica.
--
-- Lo que las diferencia NO esta en esta tabla: esta en `usuarios.rol`.
-- sgborbolla es owner y ademas administra el marketplace.
-- frankfreeman es usuario comun, sin ningun permiso de administracion.
-- Las dos pagan cero por comision y las dos publican sin limite.
--
-- El motivo de cada una esta escrito para que la proxima persona que lea el
-- esquema no deduzca que falto una fila ni que sobro un owner.
INSERT OR IGNORE INTO exencion_usuario
  (email, exento_comision, slots_ilimitados, autorizado_por, motivo) VALUES
  ('sgborbolla@gmail.com', 1, 1, 'fundacion',
   'Creador y dueno del marketplace. Exento de comision y con slots ilimitados. Es el unico owner: administracion completa.'),
  ('frankfreemansariol2016@gmail.com', 1, 1, 'fundacion',
   'Patrocinador de la plataforma. Exento de comision y con slots ilimitados. Usuario comun: SIN permisos de administracion.');


-- ---------------------------------------------------------------------------
-- Vendedores
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendedores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    NOT NULL UNIQUE,
  nombre          TEXT    NOT NULL,
  nombre_comercial TEXT   NOT NULL,
  descripcion     TEXT    NOT NULL DEFAULT '',
  -- URL absoluta. Ver nota sobre imagenes en README: nada de blobs en D1.
  avatar_url      TEXT,
  ubicacion       TEXT    NOT NULL DEFAULT '',
  verificado      INTEGER NOT NULL DEFAULT 0 CHECK (verificado IN (0, 1)),
  -- Acumulados. Se actualizan con triggers o desde el Worker, nunca a mano.
  productos       INTEGER NOT NULL DEFAULT 0,
  ventas          INTEGER NOT NULL DEFAULT 0,
  valoracion      REAL    NOT NULL DEFAULT 0,
  opiniones       INTEGER NOT NULL DEFAULT 0,
  creado_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_vendedores_verificado ON vendedores(verificado);


-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS productos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT    NOT NULL UNIQUE,
  vendedor_id      INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  titulo           TEXT    NOT NULL,
  descripcion      TEXT    NOT NULL,
  descripcion_larga TEXT   NOT NULL DEFAULT '',
  -- tipo y origen se combinan para derivar la Regla de Oro (columna `regla`).
  tipo             TEXT    NOT NULL CHECK (tipo IN ('digital', 'fisico', 'servicio')),
  origen           TEXT    NOT NULL CHECK (origen IN ('qbaswing', 'externo')),
  -- Regla de Oro: A (digital externo, 5%), B (digital propio, 0%),
  -- C (fisico, 0%). Se deriva con el trigger de abajo para que nunca pueda
  -- contradecir tipo/origen.
  regla            TEXT    NOT NULL CHECK (regla IN ('A', 'B', 'C')),
  categoria        TEXT    NOT NULL,
  -- Precio en enteros de la unidad menor. 250 CUP -> 250, $10.00 -> 1000.
  precio           INTEGER NOT NULL CHECK (precio >= 0),
  precio_anterior  INTEGER          CHECK (precio_anterior IS NULL OR precio_anterior >= precio),
  moneda           TEXT    NOT NULL CHECK (moneda IN ('CUP', 'USD', 'EUR')),
  destacado        INTEGER NOT NULL DEFAULT 0 CHECK (destacado IN (0, 1)),
  publicado        INTEGER NOT NULL DEFAULT 0 CHECK (publicado IN (0, 1)),
  -- Solo para digitales. El documento maestro ofrece re-descarga perpetua.
  vitalicia        INTEGER          CHECK (vitalicia IN (0, 1) OR vitalicia IS NULL),
  creado_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_productos_vendedor   ON productos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_productos_publicados ON productos(publicado, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_productos_categoria  ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_regla      ON productos(regla);
CREATE INDEX IF NOT EXISTS idx_productos_tipo       ON productos(tipo);

-- El catalogo se filtra por casi todos estos campos a la vez. Un indice
-- compuesto cubre el caso comun (publicado + categoria + precio) y evita
-- escanear la tabla entera en cada consulta de listado.
CREATE INDEX IF NOT EXISTS idx_productos_catalogo
  ON productos(publicado, categoria, precio);

-- ---------------------------------------------------------------------------
-- Regla de Oro derivada
-- ---------------------------------------------------------------------------
-- `regla` es redundante con (tipo, origen) pero se materializa para poder
-- filtrar e indexar por comision. Este trigger garantiza la coherencia:
-- no hay forma de insertar un digital externo con regla 'C'.
CREATE TRIGGER IF NOT EXISTS trg_productos_regla
BEFORE INSERT ON productos
WHEN NEW.regla <> CASE
  WHEN NEW.tipo = 'fisico' THEN 'C'
  WHEN NEW.origen = 'qbaswing' THEN 'B'
  ELSE 'A'
END
BEGIN
  SELECT RAISE(ABORT, 'regla incoherente con tipo/origen');
END;

CREATE TRIGGER IF NOT EXISTS trg_productos_regla_update
BEFORE UPDATE OF tipo, origen ON productos
WHEN NEW.regla <> CASE
  WHEN NEW.tipo = 'fisico' THEN 'C'
  WHEN NEW.origen = 'qbaswing' THEN 'B'
  ELSE 'A'
END
BEGIN
  SELECT RAISE(ABORT, 'regla incoherente con tipo/origen');
END;

-- Mantiene `actualizado_at` sin que la app tenga que acordarse.
CREATE TRIGGER IF NOT EXISTS trg_productos_touch
AFTER UPDATE ON productos
BEGIN
  UPDATE productos
     SET actualizado_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;


-- ---------------------------------------------------------------------------
-- Imagenes
-- ---------------------------------------------------------------------------
-- NO se guardan blobs. Solo URLs firmadas (el Documento Maestro lo pide
-- explicitamente: sin R2, con verificacion por hash SHA-256).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS producto_imagenes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  url          TEXT    NOT NULL,
  alt          TEXT    NOT NULL,
  -- Texto alternativo. `alt` es obligatorio: todos los mockups traian
  -- `data-alt` y ningun `alt`, lo que deja las imagenes inaccesibles.
  orden        INTEGER NOT NULL DEFAULT 0,
  -- SHA-256 del archivo, para integridad (Documento Maestro, seccion 4).
  hash_sha256  TEXT,
  bytes        INTEGER,
  creado_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_imagenes_producto ON producto_imagenes(producto_id, orden);


-- ---------------------------------------------------------------------------
-- Detalles por tipo
-- ---------------------------------------------------------------------------
-- Tres tablas en vez de columnas nullable: un producto digital no tiene stock
-- y uno fisico no tiene stack. Con columnas nullable habria que Filtrar en
-- cada consulta "WHERE digital IS NOT NULL OR ...".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS detalles_digitales (
  producto_id           INTEGER PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  stack                 TEXT    NOT NULL DEFAULT '[]',  -- JSON array
  licencia              TEXT    NOT NULL,
  version               TEXT    NOT NULL,
  ultima_actualizacion  TEXT,
  hash_zip              TEXT,
  demo_url              TEXT,
  -- Formato de entrega: descarga inmediata, clave por email, etc.
  formato_entrega       TEXT    NOT NULL DEFAULT 'descarga'
                        CHECK (formato_entrega IN ('descarga', 'clave', 'licencia', 'repositorio'))
);

CREATE TABLE IF NOT EXISTS detalles_fisicos (
  producto_id     INTEGER PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  envio           TEXT    NOT NULL,
  processing_time TEXT    NOT NULL,
  peso_kg         REAL,
  alto_cm         REAL,
  ancho_cm        REAL,
  largo_cm        REAL
);

CREATE TABLE IF NOT EXISTS detalles_servicio (
  producto_id      INTEGER PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  modalidad        TEXT    NOT NULL
                   CHECK (modalidad IN ('presencial', 'remoto', 'hibrido')),
  duracion_estimada TEXT   NOT NULL,
  incluye          TEXT    NOT NULL DEFAULT '[]'  -- JSON array
);

-- Variantes (talla, color) y stock por combinacion.
CREATE TABLE IF NOT EXISTS producto_variantes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre       TEXT    NOT NULL,   -- 'Talla', 'Color'
  valor        TEXT    NOT NULL,   -- 'M', 'Azul'
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (producto_id, nombre, valor)
);


-- ---------------------------------------------------------------------------
-- Paquetes de espacios fisicos (Documento Maestro, seccion 3)
-- ---------------------------------------------------------------------------
-- REGLA CENTRAL DEL MODELO: un paquete NO limita ventas, limita SLOTS
-- SIMULTANEOS. Vender o retirar un producto libera su slot automaticamente.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paquetes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre              TEXT    NOT NULL,
  categoria           TEXT    NOT NULL,
  slots               INTEGER NOT NULL CHECK (slots > 0),
  vigencia_dias       INTEGER NOT NULL DEFAULT 60 CHECK (vigencia_dias > 0),
  -- El Owner puede alterar las tarifas base. Por eso viven en la base y no
  -- en el codigo: el documento dice "configurables por el Owner".
  precio_cup          INTEGER,
  precio_usd          INTEGER,
  precio_eur          INTEGER,
  precio_configurable  INTEGER NOT NULL DEFAULT 0 CHECK (precio_configurable IN (0, 1)),
  caracteristicas     TEXT    NOT NULL DEFAULT '[]',  -- JSON array
  activo               INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Una suscripcion otorga slots mientras el paquete este vigente.
CREATE TABLE IF NOT EXISTS suscripciones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vendedor_id     INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  paquete_id      INTEGER NOT NULL REFERENCES paquetes(id) ON DELETE RESTRICT,
  activado_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- COPIA del numero de slots al momento de contratar. Si el Owner sube el
  -- precio o los slots del paquete despues, las suscripciones existentes no
  -- se alteran: quien pago por 10 espacios sigue teniendo 10.
  slots_totales   INTEGER NOT NULL CHECK (slots_totales > 0),
  estado          TEXT    NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo', 'vencido', 'suspendido')),
  creado_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_suscripciones_vendedor ON suscripciones(vendedor_id, estado);

-- `slots_usados` NO se guarda: se calcula con un COUNT sobre los productos
-- publicados. Es la unica forma de que la regla de reutilizacion se cumpla
-- sola. Si se guardara un contador, vender un producto lo dejaria stale y el
-- vendedor veria un espacio ocupado que ya libero.
CREATE VIEW IF NOT EXISTS v_slots_usados AS
SELECT s.id           AS suscripcion_id,
       s.vendedor_id,
       s.slots_totales,
       COUNT(p.id)    AS slots_usados,
       s.slots_totales - COUNT(p.id) AS slots_libres
  FROM suscripciones s
  LEFT JOIN productos p
    ON p.vendedor_id = s.vendedor_id
   AND p.tipo = 'fisico'
   AND p.publicado = 1
   AND p.creado_at >= s.activado_at
 WHERE s.estado = 'activo'
 GROUP BY s.id, s.vendedor_id, s.slots_totales;


-- ---------------------------------------------------------------------------
-- Carrito
-- ---------------------------------------------------------------------------
-- El carrito vive en la base, no en localStorage: el documento maestro exige
-- "carrito unificado" y que el estado sobreviva al cambio de dispositivo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS carritos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Sesion anonima: permite carrito sin login, que es como compra la
  -- mayoria hasta que se pide la direccion de envio.
  token        TEXT    UNIQUE,
  creado_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_at TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (usuario_id IS NOT NULL OR token IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS carrito_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  carrito_id   INTEGER NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad     INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  -- Variante eleccionada (talla, color). Referencia por id en vez de guardar
  -- el texto, para que renombrar una variante no corrompa carritos previos.
  variante_id  INTEGER REFERENCES producto_variantes(id) ON DELETE SET NULL,
  -- El precio se congela al agregar. Si el vendedor lo cambia despues, el
  -- carrito debe mostrar la diferencia antes de cobrar.
  precio_unitario INTEGER NOT NULL CHECK (precio_unitario >= 0),
  moneda       TEXT    NOT NULL CHECK (moneda IN ('CUP', 'USD', 'EUR')),
  UNIQUE (carrito_id, producto_id, variante_id)
);


-- ---------------------------------------------------------------------------
-- Transacciones y pagos (Documento Maestro, seccion 5)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transacciones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Referencia unica visible al comprador. Formato MP-CU-XXXX-XXX para
  -- pagos con tarjeta nacional, segun el documento maestro.
  referencia     TEXT    NOT NULL UNIQUE,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  pasarela       TEXT    NOT NULL
                 CHECK (pasarela IN ('qva-pay', 'tropi-pay', 'crypto', 'tarjeta-qbaswing')),
  moneda         TEXT    NOT NULL CHECK (moneda IN ('CUP', 'USD', 'EUR')),
  -- Enteros. Ver nota 3 en la cabecera.
  subtotal       INTEGER NOT NULL CHECK (subtotal >= 0),
  comision_qbaswing INTEGER NOT NULL CHECK (comision_qbaswing >= 0),
  total          INTEGER NOT NULL CHECK (total >= 0),
  -- Regla de Oro aplicada, congelada en el momento de la compra. Si el Owner
  -- cambia la comision mañana, esta transaccion conserva la original.
  regla_aplicada TEXT    NOT NULL CHECK (regla_aplicada IN ('A', 'B', 'C')),
  estado         TEXT    NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'verificado', 'rechazado', 'reembolsado')),
  -- Hash de blockchain para pagos cripto (USDT TRC-20, BTC).
  hash_blockchain TEXT,
  -- Comprobante subido por el comprador para pagos manuales. URL firmada, no
  -- el archivo.
  comprobante_url TEXT,
  creado_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  verificado_at  TEXT,
  CHECK (total = subtotal)
);

CREATE INDEX IF NOT EXISTS idx_transacciones_usuario ON transacciones(usuario_id, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_transacciones_estado  ON transacciones(estado, creado_at DESC);
-- Webhooks de QvaPay y TropiPay llegan por referencia. Tiene que ser unico.
CREATE INDEX IF NOT EXISTS idx_transacciones_webhook ON transacciones(referencia, pasarela);

-- Idempotencia de webhook: un proveedor puede reenviar la misma notificacion.
-- Sin esta tabla, un reintento duplica el credito al vendedor.
CREATE TABLE IF NOT EXISTS webhooks_recibidos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pasarela      TEXT    NOT NULL,
  evento_id     TEXT    NOT NULL,
  recibido_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (pasarela, evento_id)
);

CREATE TABLE IF NOT EXISTS transaccion_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaccion_id INTEGER NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
  producto_id    INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario INTEGER NOT NULL CHECK (precio_unitario >= 0),
  -- Lo que se llevo el vendedor. Se congela con la regla vigente.
  neto_vendedor  INTEGER NOT NULL CHECK (neto_vendedor >= 0)
);


-- ---------------------------------------------------------------------------
-- Biblioteca digital
-- ---------------------------------------------------------------------------
-- El comprador re-descarga su producto acquired. "Vitalicia" segun el
-- documento maestro.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS biblioteca (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto_id    INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  transaccion_id INTEGER NOT NULL REFERENCES transacciones(id) ON DELETE RESTRICT,
 version_actual TEXT,
  vitalicia      INTEGER NOT NULL DEFAULT 0 CHECK (vitalicia IN (0, 1)),
  -- Vence solo si el producto NO es vitalicio. Regla del documento maestro.
  expira_at      TEXT,
  creado_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (usuario_id, producto_id)
);

-- Un producto vitalicio no puede tener fecha de vencimiento.
CREATE TRIGGER IF NOT EXISTS trg_biblioteca_vitalicia
BEFORE INSERT ON biblioteca
WHEN (NEW.vitalicia = 1 AND NEW.expira_at IS NOT NULL)
  OR (NEW.vitalicia = 0 AND NEW.expira_at IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'expira_at debe ser NULL si el producto es vitalicio');
END;

CREATE INDEX IF NOT EXISTS idx_biblioteca_usuario ON biblioteca(usuario_id, creado_at DESC);


-- ---------------------------------------------------------------------------
-- Opinion y Dew0 (modales)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opiniones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Solo puede opinar quien compro: lo verifica el trigger.
  calificacion INTEGER NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  texto       TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (producto_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_opiniones_producto ON opiniones(producto_id, created_at DESC);

-- Nadie se opina a si mismo. El trigger lo bloquea, no la app.
CREATE TRIGGER IF NOT EXISTS trg_opiniones_no_propia
BEFORE INSERT ON opiniones
WHEN NEW.usuario_id = (SELECT vendedor_id FROM productos WHERE id = NEW.producto_id)
BEGIN
  SELECT RAISE(ABORT, 'no se puede opinar sobre un producto propio');
END;


-- ---------------------------------------------------------------------------
-- Configuracion del Owner
-- ---------------------------------------------------------------------------
-- Comisiones y tarifas base. El documento dice que el Owner puede alterarlas;
-- por eso son filas de base de datos y no constantes del codigo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS configuracion (
  clave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,   -- JSON
  actualizado_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Quien hizo el cambio, para auditoria. El documento maestro exige
  -- auditar saldos y tarifas.
  actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Semilla. Usa INSERT OR IGNORE para no pisar cambios del Owner al re-aplicar.
--
-- 'exencion_owner': los usuarios con rol='owner' no pagan comision QBASwing.
-- Se resuelve por ROL, no por id, para que un tercer owner futuro lo herede
-- sin tocar configuracion. El Worker lee esta clave antes de repartir; si
-- estuviera hardcodeado en el frontend, cualquiera que lea el JS sabria
-- exactamente que campo tocar.
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
  ('comisiones', '{"A":{"qbaswing":5,"autor":95},"B":{"qbaswing":0,"autor":100},"C":{"qbaswing":0,"autor":100}}'),
  ('exencion_owner', '{"activa":true,"aplica_a_rol":"owner","comision_autor":0,"comision_qbaswing":0,"nota":"Los owners no pagan comision. Se resuelve por rol, no por id."}'),
  ('vigencia_paquetes_dias', '60'),
  ('payment_manager_habilitado', '{"qva-pay":false,"tropi-pay":false,"crypto":false,"tarjeta-qbaswing":true}');
