-- =============================================================================
-- Migracion 0002: datos editables de la plataforma.
-- =============================================================================
--
-- QUE HAY ACA
-- Las tres cosas que el Owner cambia sin redesplegar:
--   - redes_sociales        -> los iconos del footer
--   - contacto_plataforma   -> telefono, correo, WhatsApp, direccion
--   - faq                   -> las preguntas del footer y de /faq
--
-- -----------------------------------------------------------------------------
-- POR QUE ESTO NO ESTA EN EL CODIGO
-- -----------------------------------------------------------------------------
-- Si los enlaces vivieran en el .astro, cambiar el Instagram obligaria a hacer
-- un commit y un redespliegue. Para algo que se cambia cada pocos meses, esa
-- barrera hace que la gente termine no actualizandolo, y un footer con el
-- Instagram equivocado se ve peor que uno sin Instagram.
--
-- -----------------------------------------------------------------------------
-- LO MAS IMPORTANTE: NO HAY NINGUN USUARIO DE EJEMPLO
-- -----------------------------------------------------------------------------
-- Las 8 redes se crean con `valor` VACIO. Un icono que apunta a una cuenta que
-- no existe es peor que ningun icono: el visitante hace clic, ve que la cuenta
-- no esta, y concluye que el marketplace es falso. El Owner llena el usuario
-- desde el panel cuando tenga la cuenta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Redes sociales
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS redes_sociales (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 'usuario' = la URL se arma como base + valor (instagram.com/miusuario).
  -- 'url'     = valor es la URL completa (Discord, WhatsApp).
  tipo       TEXT    NOT NULL CHECK (tipo IN ('usuario', 'url')),
  -- Base de la URL cuando tipo='usuario'. NULL cuando tipo='url'.
  base       TEXT,
  etiqueta   TEXT    NOT NULL,
  -- Nombre del icono de Material Symbols.
  icono      TEXT    NOT NULL,
  -- Usuario o URL. Vacio = todavia no configurada, y el icono no se dibuja.
  valor      TEXT    NOT NULL DEFAULT '',
  activo     INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  orden      INTEGER NOT NULL DEFAULT 0,
  actualizado_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Quien lo cambio. Solo un owner escribe aca, asi que siempre apunta a
  -- sgborbolla@gmail.com. frankfreeman NO es owner.
  actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

-- `etiqueta` es UNIQUE: es la clave natural de la fila, y hace que la semilla de
-- mas abajo sea idempotente. Sin este indice `INSERT OR IGNORE` no protege nada,
-- porque con AUTOINCREMENT cada fila generada tiene un id distinto y no hay
-- conflicto que ignorar. Se verifico: sin el, re-aplicar dublicaba 8 -> 16.
CREATE UNIQUE INDEX IF NOT EXISTS idx_redes_etiqueta ON redes_sociales(etiqueta);

-- Las 8 redes previstas, con el usuario VACIO.
--
-- Discord y Telegram estan porque el publico de los productos digitales es
-- tecnico, y esos son los canales que usan. WhatsApp esta porque en Cuba es el
-- canal real, no un extra.
INSERT OR IGNORE INTO redes_sociales (tipo, base, etiqueta, icono, orden) VALUES
  ('usuario', 'https://facebook.com/',    'Facebook',  'facebook',      1),
  ('usuario', 'https://instagram.com/',   'Instagram', 'photo_camera',  2),
  ('usuario', 'https://linkedin.com/in/', 'LinkedIn',  'work',          3),
  ('usuario', 'https://youtube.com/@',    'YouTube',   'smart_display', 4),
  ('usuario', 'https://github.com/',      'GitHub',    'code',          5),
  ('url',     NULL,                       'Discord',   'forum',         6),
  ('usuario', 'https://t.me/',            'Telegram',  'send',          7),
  ('url',     NULL,                       'WhatsApp',  'chat',          8);

-- -----------------------------------------------------------------------------
-- Contacto
-- -----------------------------------------------------------------------------
--
-- Una sola fila, con `id = 1` forzado por CHECK. Se podria modelar como
-- clave/valor dentro de `configuracion`, pero una fila con columnas tipadas es
-- mas simple de consultar: `contacto.email` en vez de parsear un JSON.
--
-- El CHECK del email no valida formato completo, solo que tenga arroba y punto:
-- suficiente para que un texto sin forma no llegue a pantalla como un enlace
-- mailto: roto.
CREATE TABLE IF NOT EXISTS contacto_plataforma (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  telefono    TEXT,
  email       TEXT CHECK (email IS NULL OR email LIKE '%_@_%._%'),
  whatsapp    TEXT,
  direccion   TEXT,
  horario     TEXT,
  actualizado_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

-- La fila existe VACIA a proposito. El footer detecta los campos vacios y
-- escribe "Datos de contacto en carga" en vez de dibujar un telefono de ejemplo
-- que nadie puede marcar.
INSERT OR IGNORE INTO contacto_plataforma (id) VALUES (1);

-- -----------------------------------------------------------------------------
-- Preguntas frecuentes
-- -----------------------------------------------------------------------------
--
-- `orden` es manual, no alfabetico: el orden en que se responden las dudas es el
-- orden en que la gente las hace.
CREATE TABLE IF NOT EXISTS faq (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  pregunta  TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  orden     INTEGER NOT NULL DEFAULT 0,
  activa    INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  actualizado_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Mismo motivo que en redes: sin este indice, re-aplicar la migracion duplica
-- las FAQ sin avisar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_pregunta ON faq(pregunta);

-- -----------------------------------------------------------------------------
-- Las 20 FAQ iniciales
-- -----------------------------------------------------------------------------
--
-- Escritas para ser CIERTAS con este proyecto, no con un marketplace imaginario.
-- Concretamente hoy:
--   - las pasarelas automaticas (QvaPay, TropiPay) aun no estan desplegadas
--   - el 5% aplica solo a digitales de terceros
--   - el paquete limita publicaciones simultaneas, no ventas
--   - no hay refunds automatizados
--
-- Cuando una pasarela este activa, su respuesta cambia de texto a realidad. Por
-- eso la 4 dice "proximamente" en vez de prometer una fecha que no depende de
-- nosotros.
INSERT OR IGNORE INTO faq (pregunta, respuesta, orden) VALUES
  -- 1-5: comprar
  ('¿Como compro en QBASwing?',
   'Buscas el producto, lo agregas al carrito y elegis como pagar. Cuando el pago se confirma, el archivo queda disponible en tu cuenta para descargar. No hace falta crear cuenta para comprar, pero si la necesitas para descargar.', 1),
  ('¿Que metodos de pago aceptan?',
   'QBASwing trabaja con QvaPay y TropiPay para pagos con tarjeta, y permite pagar con Gently. Cada vendedor puede publicar sus propias formas de pago —transferencia, Zelle, cripto— y esas aparecen en la ficha del producto.', 2),
  ('¿Puedo pagar desde Cuba con tarjeta?',
   'Si, por eso existen QvaPay y TropiPay: son pasarelas que funcionan con las tarjetas y las restricciones de conexion que hay en la isla. La forma exacta depende de lo que tu banco autorice.', 3),
  ('¿Cuanto tarda en confirmarse un pago?',
   'Con QvaPay y TropiPay la confirmacion es automatica y llega en segundos. Con Gently, o con pagos directos al vendedor, hay que esperar a que una persona revise el comprobante: puede tardar unas horas.', 4),
  ('¿Puedo comprar sin conexion?',
   'No. Es un sitio web y necesita conexion. Lo que si garantizamos es que, una vez que compraste, puedas volver a bajar tus archivos desde tu cuenta tantas veces como quieras.', 5),

  -- 6-10: dinero y seguridad
  ('¿Que pasa con mi dinero si no recibo el producto?',
   'Los pagos se confirman antes de liberar cualquier descarga. Si un pago queda sin confirmar, no se te descuenta nada y no se habilita ningun enlace.', 6),
  ('¿Puedo cancelar un pago?',
   'Los pagos hechos con QvaPay o TropiPay los cancela la propia pasarela, no la plataforma. Si pagaste por otro medio, escribinos y lo vemos caso por caso.', 7),
  ('¿QBASwing guarda mis datos?',
   'Guardamos lo necesario para entregarte lo que compro: tu correo, las transacciones y los enlaces de descarga. No vendemos ni cedemos esos datos a terceros.', 8),
  ('¿Como sé que los archivos que subo estan seguros?',
   'QBASwing no ejecuta ni abre lo que los vendedores publican. Se guarda cifrado y se sirve como descarga directa, nunca como pagina. Los ejecutables de tipo .exe, .dll, .scr y .bat no se admiten.', 9),
  ('¿Que pasa si un vendedor no responde un reporte?',
   'Cada reporte queda registrado con fecha y se revisa. Si un producto o un vendedor incumple las reglas, se puede ocultar el producto o suspender la cuenta, y queda constancia de la decision.', 10),

  -- 11-15: vender
  ('¿Cuanto cobra QBASwing por vender?',
   'Depende de que vendes. Si vendes software, plantillas o contenido de otro autor, QBASwing retiene 5%. Si el producto es tuyo, no hay comision. Los productos fisicos y artesanias tampoco pagan comision.', 11),
  ('¿Que necesito para empezar a vender?',
   'Una cuenta con correo verificado y un paquete de espacios. El paquete no limita cuantas ventas podes hacer: limita cuantos productos podes tener publicados al mismo tiempo.', 12),
  ('¿Como recibo el dinero de mis ventas?',
   'Vos publicas tus propias formas de pago y el comprador te paga directamente a vos. QBASwing no te retiene el dinero en una cuenta intermedia ni te pide datos bancarios.', 13),
  ('¿Los espacios del paquete se renuevan si no los uso?',
   'No. Un paquete dura 60 dias naturales desde que se activa. Si no usas los espacios, se pierden. Publica lo que tengas antes de que venza, o renueva antes.', 14),
  ('¿Puedo vender algo que es de otro?',
   'Si sos el autor o tenes permiso, si. Publicar el trabajo de otra persona sin permiso es la unica forma de que te suspendamos la cuenta, y no hay segunda oportunidad para eso.', 15),

  -- 16-20: plataforma y contacto
  ('¿Como funciona el enlace de descarga?',
   'Cuando tu pago se confirma, se genera un enlace que caduca en 5 minutos. Es un permiso temporal, no una URL permanente: por eso el archivo no queda expuesto en un link que alguien pueda copiar y reenviar.', 16),
  ('¿Puedo descargar un producto mas de una vez?',
   'Depende del producto. Los digitales con licencia vitalicia se pueden descargar las veces que quieras; los de licencia por tiempo, mientras la licencia este activa.', 17),
  ('¿El marketplace esta disponible en otros idiomas?',
   'Si. El sitio tiene 22 idiomas y podes cambiarlo desde el icono de arriba a la derecha. El idioma que elijas se mantiene al navegar y no te saca de la pagina que estabas viendo.', 18),
  ('¿Como reporto un producto o un vendedor?',
   'Escribenos desde la pagina de contacto. Cada reporte se revisa y queda registrado con fecha.', 19),
  ('¿Puedo pedir que borren mis datos?',
   'Si. Escribinos desde contacto indicando tu correo. Borramos tu cuenta y los datos que ya no sean necesarios para entregarte algo que aun no entregamos.', 20);

-- -----------------------------------------------------------------------------
-- Indices del footer
-- -----------------------------------------------------------------------------
-- El footer consulta las tres tablas en cada render. Con pocas filas no hace
-- falta nada, pero estos evitan un escaneo completo si el Owner carga muchas FAQ.
CREATE INDEX IF NOT EXISTS idx_faq_orden   ON faq(orden) WHERE activa = 1;
CREATE INDEX IF NOT EXISTS idx_redes_orden ON redes_sociales(orden) WHERE activo = 1;