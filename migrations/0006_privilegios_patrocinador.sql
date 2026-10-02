-- =============================================================================
-- 0006_privilegios_patrocinador.sql
--
-- QUE ARREGLA ESTA MIGRACION
-- =============================================================================
-- Tres huecos reales que salieron al implementar el registro de usuarios:
--
--   1. `vendedores` no tenia forma de saber a que CUENTA pertenece una tienda.
--      `usuarios.vendedor_id` apunta a `vendedores.id`, pero no habia camino de
--      vuelta: al registrarse, el sistema no tenia con que emparejar el correo
--      de quien se registra con la tienda que le corresponde. Sin la columna
--      `email`, la exencion de Freeman no se podia translated a un vendedor real
--      y `usuarios.vendedor_id` se quedaba siempre en NULL.
--
--   2. La nota de la exencion de Freeman decia literalmente "Usuario comun: SIN
--      permisos de administracion", que es lo CONTRARIO de lo que decidio el
--      Owner. Era solo texto, asi que no rompia nada, pero es la primera cosa que
--      lee cualquiera que abra la base, y dejaba escrito lo contrario de la
--      decision. Se corrige.
--
--   3. No existia forma de conceder privilegios administrativos sin cambiar el
--      rol a 'administrador'. Y cambiar el rol no servia: Freeman TIENE que
--      poder vender, y `rol = 'administrador'` no es vender. Hacen falta las dos
--      cosas a la vez.
--
-- POR QUE UNA TABLA Y NO UN CASO ESPECIAL EN EL CODIGO
-- El Owner dijo que Freeman es el patrocinador, y que si entra otro patrocinador
-- "ya tiene panel". Eso descarta un `if (email === 'frankfreemansariol...')` en
-- el Worker: seria un caso especial que hay que editar cada vez que entra uno.
-- Con la tabla, conceder privilegios es un INSERT, y el Worker no cambia.
--
-- `alcance` es texto con CHECK y no ENUM porque D1 no soporta ENUM, igual que
-- en el resto del esquema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. El correo de la tienda: el puente entre la cuenta y el vendedor
-- -----------------------------------------------------------------------------
-- Se anade como columna y NO como tabla aparte porque la relacion es de uno a
-- uno y optional: casi todos los vendedores tendran cuenta, pero la tienda se
-- puede crear antes de que el dueño se registre, asi que admite NULL.
--
-- NULL y no cadena vacia a proposito: `''` no se distingue de un correo mal
-- escrito, y `UNIQUE` en SQLite trata varios NULL como distintos, que es
-- exactamente lo que hace falta aqui.
ALTER TABLE vendedores ADD COLUMN email TEXT;

-- Unico, pero solo entre los que no son NULL. SQLite ya hace eso con un indice
-- UNICO normal sobre una columna nullable: los NULL no chocan entre si.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendedores_email ON vendedores(email);

-- La consulta del registro la hace por correo, asi que el indice tambien sirve
-- para ese uso, no solo para la restriccion.

-- -----------------------------------------------------------------------------
-- 2. Privilegios adicionales, aparte del rol
-- -----------------------------------------------------------------------------
-- Tabla NUEVA, no una columna en `usuarios`, por dos razones:
--
--   - Los privilegios tienen HISTORIA. Quien concedio el privilegio, cuando y
--     por que. Con una columna no hay donde dejar esa informacion, y "el Owner
--     se lo dio porque es patrocinador" es justo lo que hay que poder contestar
--     dentro de seis meses.
--   - La revocacion. `revocado_at` con NULL mientras sigue vivo es el mismo
--     patron que `exencion_usuario` y `owner_registro_preautorizado`. Borrar la
--     fila perderia la constancia; marcarla la conserva.
CREATE TABLE IF NOT EXISTS privilegio_usuario (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Del correo sale el enlace con `usuarios.email`. Se guarda el correo y no el
  -- `usuario_id` a proposito: el privilegio tiene que existir ANTES de que la
  -- persona se registre, igual que `owner_registro_preautorizado`. Si apuntara
  -- al id, no habria forma de concederselo a alguien que aun no tiene cuenta.
  email         TEXT    NOT NULL,

  -- Que concede. 'administracion' da acceso a los paneles de gestion; para
  -- vender no hace falta privilegio, basta con tener tienda, asi que
  -- 'vendedor' NO esta aqui: se deduce de que exista fila en `vendedores`.
  alcance       TEXT    NOT NULL
                 CHECK (alcance IN ('administracion')),

  autorizado_por TEXT   NOT NULL,
  motivo         TEXT   NOT NULL DEFAULT '',
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),

  creado_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revocado_at   TEXT
);

-- Un correo no puede tener dos veces el mismo alcance. El indice unico lo
-- impide en vez de confiar en que el codigo lo compruebe antes de insertar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_privilegio_email_alcance
  ON privilegio_usuario(email, alcance);

-- -----------------------------------------------------------------------------
-- 3. La nota que decia lo contrario de lo decidido
-- -----------------------------------------------------------------------------
-- Solo se corrige el texto. Los valores `exento_comision` y `slots_ilimitados`
-- ya eran correctos y no se tocan.
--
-- El texto nuevo dice las tres cosas que el Owner decidio, para que no dependa
-- de la memoria de nadie: es VENDEDOR, tiene privilegios ADMINISTRATIVOS, y
-- esta exento de comision y de paquetes.
--
-- El texto se arma con `||` y no escribiendo el literal partido en varias lineas:
-- SQLite NO concatena literales adyacentes como hacen C o Postgres, asi que
-- `'uno '  'dos'` es un error de sintaxis. Se deja en una sola linea larga
-- justamente para que se vea el motivo.
UPDATE exencion_usuario
   SET motivo = 'Patrocinador de la plataforma. Es VENDEDOR con privilegios administrativos: vende como cualquier vendedor y ademas accede a los paneles de gestion. Exento de comision y con slots ilimitados. Si entra otro patrocinador se le anade una fila a exencion_usuario y otra a privilegio_usuario: el codigo no cambia.'
 WHERE email = 'frankfreemansariol2016@gmail.com';

-- -----------------------------------------------------------------------------
-- 4. El privilegio que le corresponde a esa exencion
-- -----------------------------------------------------------------------------
-- `INSERT OR IGNORE` para que volver a aplicar la migracion no duplique la fila
-- ni reviente por el indice unico.
--
-- Se escribe su correo a mano, como una fila de dato. Es lo mismo que hace
-- `owner_registro_preautorizado` con el del Owner, y es lo unico que hay que
-- editar cuando entra un patrocinador nuevo.
INSERT OR IGNORE INTO privilegio_usuario (email, alcance, autorizado_por, motivo, activo)
VALUES (
  'frankfreemansariol2016@gmail.com',
  'administracion',
  'fundacion',
  'Patrocinador. Acceso a paneles de gestion ademas de su tienda de vendedor.',
  1
);

-- -----------------------------------------------------------------------------
-- 5. La tienda del patrocinador
-- -----------------------------------------------------------------------------
-- Se crea SU tienda, que es un dato real: Freeman Impresiones existe y es el
-- patrocinador de la plataforma.
--
-- Lo que NO se hace aqui es inventar actividad. Todos los contadores se quedan
-- en 0 y `verificado` en 0, porque un contador en 0 es la verdad y una estrella
-- de "verificado" puesta a mano seria una mentira. La verifica el Owner cuando
-- elija, que para eso existe `verificado` como columna y no como constante.
--
-- El slug es el identificador publico y no se cambia nunca: es lo que aparece
-- en `/vendedor/freeman-impresiones` y en los enlaces que ya se hayan
-- compartido.
INSERT OR IGNORE INTO vendedores
  (slug, nombre, nombre_comercial, descripcion, avatar_url, ubicacion,
   verificado, productos, ventas, valoracion, opiniones, email)
VALUES (
  'freeman-impresiones',
  'Freeman Impresiones',
  'Freeman Impresiones',
  'Tienda del patrocinador de la plataforma. Sin productos publicados todavia.',
  NULL,
  '',
  0, 0, 0, 0, 0,
  'frankfreemansariol2016@gmail.com'
);

-- =============================================================================
-- LO QUE SIGUE SIN RESOLVER, Y POR QUE NO SE RESUELVE AQUI
-- =============================================================================
-- La tabla `paquetes` esta sembrada con los 10 planes y sus precios, y los
-- precios se leen de ahi, no del codigo. No se toca aqui porque no tiene que ver
-- con identidades.
--
-- La FAQ 2 y la 13 de `faq` dicen que "el comprador te paga directamente a
-- vos", lo que contradice la Regla de Oro A (digital externo: 5% para la
-- plataforma y el pago pasa por la pasarela). Es un problema de TEXTO de la
-- base, no de esquema, y la redaccion la decide el Owner. No se corrige a
-- espaldas.
-- =============================================================================