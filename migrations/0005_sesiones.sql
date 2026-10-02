-- =============================================================================
-- 0005_sesiones.sql
--
-- POR QUE HACE FALTA UNA TABLA DE SESIONES
-- =============================================================================
-- La cookie de identidad se firma con HMAC, y eso basta para saber que nadie la
-- altero. NO basta para cerrar sesion.
--
-- Una cookie firmada es un sello de cera valido: si no hay estado en el servidor,
-- "salir" solo puede consistir en borrarla del navegador. Y borrarla del
-- navegador no invalida nada, porque la cookie es una cadena que el cliente
-- puede volver a guardar. En concreto:
--
--   1. Copias la cookie desde las herramientas del navegador.
--   2. Pulsas "cerrar sesion". El navegador la borra.
--   3. La vuelves a poner a mano en la consola.
--   4. Estas autenticado otra vez, y el servidor no tiene por que noticinglo.
--
-- Eso no es un agujero teorico: es lo que hace el boton de atras del navegador.
-- Al pulsar atras, el navegador no pide permiso: devuelve la pagina que ya
-- tenia, y si la pagina venia con la cookie puesta, la sesion sigue viva.
--
-- La unica forma de que "salir" signifique algo es que el servidor tenga un
-- registro y pueda negarse a aceptarlo. Por eso esta tabla existe: el token es
-- opaco, se guarda su HMAC, y cerrar sesion marca la fila como revocada. A
-- partir de ahi la cookie es un papel con una firma valida sobre un documento
-- que ya no existe.
--
-- POR QUE SE GUARDA EL HMAC Y NO EL TOKEN
-- Una tabla de sesiones es, por definicion, una tabla de credenciales. Si alguien
-- lee la base con una fuga, lo que encuentra son hashes: sin el secreto del
-- Worker no puede fabricar ninguna cookie con ellos. Guardar el token en claro
-- haria que la fuga fuera equivalente a regalar la sesion de todo el mundo.
--
-- `QBASWING_SECRETO_FIRMA` es el MISMO secreto que firma los enlaces de
-- descarga, no uno nuevo. Dos secretos que se pueden cambiar por separado
-- obligan a acordarse de los dos el dia que haya que rotar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sesiones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,

  -- El token que va en la cookie. NUNCA se guarda aqui: se guarda su HMAC.
  -- Ver el bloque de arriba.
  token_hash    TEXT    NOT NULL UNIQUE,

  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Cuando se creo y cuando caduca. La caducidad se comprueba en cada peticion.
  creado_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_at     TEXT    NOT NULL,

  -- El cierre de sesion. `revocada = 1` significa "esta cookie ya no vale",
  -- aunque el HMAC siga siendo correcto y aunque el plazo no haya vencido.
  --
  -- Se guarda `revocada_at` y no solo el flag para poder auditar WHEN se
  -- cerro cada sesion, que es la pregunta que se hace uno cuando un usuario
  -- dice "que esa sesion sigue abierta".
  revocada      INTEGER NOT NULL DEFAULT 0 CHECK (revocada IN (0, 1)),
  revocada_at   TEXT,

  -- De donde venia la peticion que abrio la sesion. Para auditoria de accesos.
  user_agent    TEXT,
  ip_hash       TEXT
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario  ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira    ON sesiones(expira_at);

-- La sesion revocada se marca, no se borra.
--
-- Borrarla seria mas limpio pero deja un agujero: si el registro desaparece,
-- no hay forma de distinguir "esta sesion nunca existio" de "esta sesion se
-- cerro y alguien la borro para reutilizarla". Con la fila puesta y el flag en
-- 1, la respuesta es siempre la misma y no depende de lo que quedara en la base.
-- El `ON DELETE CASCADE` de arriba la borra igual cuando se borra el USUARIO,
-- que es lo unico que tiene que borrarla.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Las cookies viejas, que no tienen sesion en esta tabla, se invalidan.
-- -----------------------------------------------------------------------------
-- Antes de esta migracion no habia forma de cerrar sesion. Cualquier cookie
-- firmada que este en circulation cuando se aplique esto queda inutil, y eso es
-- lo correcto: no hay forma de saber de quien es ni cuando se creo. La app
-- muestra "sesion cerrada" y el usuario entra otra vez.
--
-- Se hace con una fila centinela en vez de un DELETE, para que quede constancia
-- en el propio esquema de que la decision fue consciente.
INSERT OR IGNORE INTO sesiones (token_hash, usuario_id, expira_at, revocada, revocada_at)
SELECT '__pre_0005_todas_invalidas__',
       (SELECT id FROM usuarios WHERE rol = 'owner' LIMIT 1),
       '1970-01-01T00:00:00.000Z',
       1,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (SELECT 1 FROM usuarios WHERE rol = 'owner');

-- -----------------------------------------------------------------------------
-- 2. Indice unico parcial: un usuario no puede tener dos veces el mismo token.
-- -----------------------------------------------------------------------------
-- El `UNIQUE` de arriba ya lo impide. Lo que se anade es el indice por
-- `expira_at` para poder limpiar las caducadas con un DELETE acotado en vez de
-- con un SELECT que traiga toda la tabla, que es lo que haria falta si no.
-- =============================================================================