# PENDIENTE: alta en QvaPay

**Estado:** esperando a que exista el Worker. No se puede completar antes.

## Por qué no se puede hacer todavía

QvaPay valida las URLs al crear la aplicación. Si apuntan a un host que no
existe, la creación falla y hay que rehacerla. Además, un webhook que nadie
atiende hace que QvaPay reintente 3 veces y después pierda la notificación: el
pago queda `pendiente` para siempre aunque el dinero haya llegado.

Secuencia obligatoria:

1. Desplegar el Worker (`wrangler deploy`).
2. Cloudflare devuelve la dirección `*.workers.dev`.
3. Crear la aplicación en QvaPay con las URLs del apartado siguiente.
4. Solo entonces se puede cobrar.

## Direcciones a rellenar

El proyecto en Pages y el Worker son hosts distintos. QvaPay no exige que
coincidan.

| Campo del formulario | Valor |
|---|---|
| Nombre de la aplicación | `QBASwing Marketplace` |
| URL de la aplicación | `https://qbaswing-marketplace.pages.dev` |
| Descripción | Marketplace de productos digitales, software y artesanía de Cuba. |
| URL Callback (Webhook) | `https://<WORKER>.workers.dev/webhook/qvapay` |
| URL de Éxito | `https://qbaswing-marketplace.pages.dev/success` |
| URL de Cancelación | `https://qbaswing-marketplace.pages.dev/cancel` |
| Logo | `public/logo-qbaswing.png` (1.6 MB; **el límite es 1 MB, hay que reducirlo**) |

`<WORKER>` se reemplaza con la dirección real que devuelva `wrangler deploy`.
**No inventarla:** si se pone una que no existe, la aplicación no se crea.

## Por qué `/success` y `/cancel` NO van en el Worker

Son páginas que ve el comprador, con diseño y textos. El Worker no sirve
HTML: no hay Astro ahí. `/webhook` sí va en el Worker, porque recibe POST
automatizados y nunca se navega a él.

## Restricción de QvaPay

Solo opera en **USD**. La aplicación rechaza pagos en CUP. Para cobrar en pesos
cubanos hace falta otra pasarela (WhatsApp manual, o tarjeta cubana).

## Datos que devuelve al crear una factura

`POST /v2/create_invoice` responde con:

- `transaction_uuid` — llave de idempotencia. Un webhook puede llegar hasta
  3 veces por los reintentos; hay que deduplicar por este valor.
- `url` — `https://www.qvapay.com/pay/{transaction_uuid}`, a donde se redirige
  al comprador.
- `remote_id` — el identificador de nuestro pedido, que es lo que permite
  casar el webhook con la fila de `transacciones`.

## Verificación del webhook

Dos cabeceras:

- `x-qvapay-signature` — HMAC-SHA256 hexadecimal del **cuerpo crudo**, con la
  `app-secret` como llave.
- `x-qvapay-timestamp` — Unix en segundos. Se acepta una ventana de **±300 s**
  para mitigar replays.

**Detalle que rompe la integracion si se ignora:** hay que hashear el body
crudo. Si se parsea el JSON y se vuelve a serializar, la firma nunca cuadra.
En Workers: `await request.text()`, y hashear ese string.

Política de reintentos de QvaPay: 3 intentos con backoff `[0s, 5s, 30s]`.
`2xx` = éxito. `429` y `5xx` = reintenta. El resto de `4xx` = no reintenta.

## Credenciales

La `app-secret` **nunca** va en el panel de Owner ni en el repositorio. Firma
los webhooks: quien la tenga puede declarar pagos falsos.

```powershell
npx wrangler secret put QVAPAY_APP_ID
npx wrangler secret put QVAPAY_APP_SECRET
```

---

# PENDIENTE: alta en TropiPay

Requiere cuenta **Business**. Credenciales separadas para sandbox y producción.

Flujo distinto al de QvaPay: OAuth2 client-credentials, no cabeceras estáticas.

1. `POST /api/v2/access/authorize` con `client_id` + `client_secret`
2. `POST /api/v2/access/token` → access token
3. `POST /api/v2/paymentcards` → link de pago

## Eventos que importan

- `transaction_guarded` — la payment card fue pagada
- `transaction_charged` — fue liberada
- `transaction_cancelled` — cancelada

El resto de los ~27 eventos son de usuario (signup, login, KYC) y no aplican a
un marketplace.

## Firma

Distinta de QvaPay: no es HMAC sobre el body, sino
`verifySignature(clientId, clientSecret, originalCurrencyAmount, bankOrderCode, signature)`.
La firma cubre **monto y código de orden**, no el cuerpo completo. Hay que
implementarla aparte, no se puede reutilizar la de QvaPay.

## Credenciales

```powershell
npx wrangler secret put TROPIPAY_CLIENT_ID
npx wrangler secret put TROPIPAY_CLIENT_SECRET
```

---

# Orden de implementación

Ninguno de los dos se puede probar hasta que haya una transaccion real en la
base. Secuencia:

1. Desplegar D1 con el esquema (`wrangler d1 migrations apply`).
2. Desplegar el Worker con los endpoints `/webhook/qvapay` y `/webhook/tropipay`.
3. Crear la app en QvaPay con las URLs reales.
4. Obtener `app_id` y `app_secret`, ponerlos como secrets.
5. Probar con una factura de 1 USD en sandbox antes de cobrar de verdad.
6. Repetir con TropiPay.
