/**
 * Datos editables de la plataforma: contacto, redes sociales y FAQ.
 *
 * ============================================================================
 *  POR QUE ESTO ESTA SEPARADO DE api.ts
 * ============================================================================
 * `api.ts` son los datos del DOMINIO: productos, vendedores, transacciones. Esto
 * son los datos de la PLATAFORMA: como nos escriben, donde estan nuestras redes,
 * que se responde en la FAQ.
 *
 * La diferencia importa por la seguridad. Todo lo de aca es publico y se puede
 * leer sin sesion. Si estuviera mezclado con los tipos de owner, un endpoint mal
 * hecho podria devolver configuracion interna junto a los datos del footer. Con
 * los archivos separados, el import ya dice de que mundo estoy: un `.astro` que
 * importa `api-plataforma` no puede por error alcanzar cifras de la plataforma.
 *
 * ============================================================================
 *  LECTURA: YA FUNCIONA CONTRA EL WORKER
 * ============================================================================
 * Los tres endpoints de lectura estan desplegados. Las funciones de escritura
 * NO, y lanzan `PendienteDeImplementar` a proposito: son escrituras
 * autenticadas y un `fetch` sin verificacion de rol seria un endpoint que
 * acepta un POST de cualquiera.
 *
 * Endpoints:
 *   GET /api/plataforma/redes        -> { ok, redes }
 *   GET /api/plataforma/contacto     -> { ok, contacto }   contacto es null si esta vacio
 *   GET /api/plataforma/faq          -> { ok, faq }
 *   PUT /api/plataforma/contacto     (solo owner)   pendiente
 *   PUT /api/plataforma/redes/:id    (solo owner)   pendiente
 *   POST /api/plataforma/faq         (solo owner)   pendiente
 * ============================================================================
 */

import { API_BASE, ApiError, backendConfigurado, pedir, PendienteDeImplementar } from './api'
import { FAQ_INICIALES, REDES_INICIALES, type RedSocialPlataforma } from './plataforma'

/* -------------------------------------------------------------------------
 * Formas
 * ---------------------------------------------------------------------- */

/** Datos de contacto de la plataforma. Todos opcionales. */
export interface ContactoPlataforma {
  telefono?: string
  email?: string
  whatsapp?: string
  direccion?: string
  /** Horario de atencion, texto libre. Ej. "Lunes a viernes, 9 a 18h". */
  horario?: string
}

/* -------------------------------------------------------------------------
 * Consulta
 * ---------------------------------------------------------------------- */

/**
 * La API envuelve todo en `{ ok: true, ... }` y mete la lista en una clave
 * distinta segun el endpoint: `redes`, `contacto`, `faq`.
 *
 * Por eso hay que leer el sobre y no devolverlo entero. Y por eso `contacto`
 * devuelve `null` cuando la fila esta vacia, que se traduce a `{}` aca: el
 * footer hace `contacto.telefono` y un `null` lo rompia con "no se puede leer
 * la propiedad de null" en vez de mostrar el bloque de contacto como vacio.
 */
async function pedirLista<T>(ruta: string, clave: string): Promise<T[]> {
  if (!backendConfigurado) {
    throw new PendienteDeImplementar(`GET ${ruta}`, `${API_BASE || '<PUBLIC_API_BASE>'}${ruta}`)
  }
  const cuerpo = await pedir(ruta)
  const valor = cuerpo[clave]
  if (!Array.isArray(valor)) {
    throw new ApiError(
      `${ruta} no devolvio la lista "${clave}".`,
      `${API_BASE}${ruta}`,
    )
  }
  return valor as T[]
}

/**
 * Redes sociales del marketplace.
 *
 * Devuelve las ocho redes con `valor: ''` porque eso es lo que hay en la base:
 * el Owner todavia no completo ninguna. NO devuelve `@usuario` de ejemplo: un
 * icono de Instagram que apunta a una cuenta inexistente es PEOR que ningun
 * icono, porque el visitante hace clic, ve que la cuenta no esta, y concluye que
 * el marketplace es falso. El footer filtra las vacias y no las dibuja.
 */
export async function listarRedes(): Promise<RedSocialPlataforma[]> {
  const redes = await pedirLista<RedSocialPlataforma>('/api/plataforma/redes', 'redes')
  return redes.sort((a, b) => a.orden - b.orden)
}

/**
 * Datos de contacto.
 *
 * `{}` cuando la API dice `null`, o sea cuando la fila esta vacia o no existe.
 * Es un caso real: la migracion `0002` deja el contacto vacio a proposito.
 */
export async function listarContacto(): Promise<ContactoPlataforma> {
  if (!backendConfigurado) {
    throw new PendienteDeImplementar('GET /api/plataforma/contacto', `${API_BASE}/api/plataforma/contacto`)
  }
  const cuerpo = await pedir('/api/plataforma/contacto')
  const valor = cuerpo.contacto
  if (!valor || typeof valor !== 'object') return {}
  const c = valor as ContactoPlataforma
  // Se descartan los campos en blanco. El router ya devuelve `null` si la fila
  // entera esta vacia, pero un contacto a medio llenar llega con cadenas vacias
  // en los huecos, y `contacto.telefono && (...)` los trataria como datos.
  return Object.fromEntries(
    Object.entries(c).filter(([, v]) => String(v ?? '').trim() !== ''),
  ) as ContactoPlataforma
}

/**
 * Preguntas frecuentes, en el orden que fijo el Owner.
 *
 * Ordenar en el cliente y no confiar en el orden del servidor no aporta nada:
 * el router ya manda `ORDER BY orden, id`. Se deja igual, porque el fallback
 * (`FAQ_INICIALES`) viene de una constante y ese si hay que ordenar.
 */
export async function listarFAQ(): Promise<
  { id: string; pregunta: string; respuesta: string; orden: number; activa: boolean }[]
> {
  const faqs = await pedirLista<{
    pregunta: string
    respuesta: string
    orden: number
    activa: number
  }>('/api/plataforma/faq', 'faq')
  return faqs
    .map((f) => ({ ...f, id: String(f.orden), activa: f.activa === 1 }))
    .sort((a, b) => a.orden - b.orden)
}

/* -------------------------------------------------------------------------
 * Escritura (solo owner). Verificar SIEMPRE el rol en el Worker.
 * ---------------------------------------------------------------------- */

/**
 * Actualiza los datos de contacto.
 *
 * NO se implementa aca a proposito. Es una escritura autenticada: necesita
 * token de sesion, verificacion de rol y validacion en el servidor. Implementar
 * solo el `fetch` sin esas tres cosas dejaria un endpoint que acepta un POST de
 * cualquiera y cambia el telefono de contacto del marketplace.
 *
 * Cuando exista el Worker, se escribe del lado del servidor con la verificacion
 * de `rol = 'owner'`, que en este proyecto es sgborbolla@gmail.com y nadie mas.
 * Recordar: frankfreeman NO es owner, aunque tenga exencion economica.
 */
export async function actualizarContacto(_datos: Partial<ContactoPlataforma>): Promise<never> {
  throw new PendienteDeImplementar(
    'actualizarContacto',
    'PUT /api/plataforma/contacto  (requiere sesion con rol owner)',
  )
}

/** Guarda una red social. Solo owner. */
export async function guardarRed(_id: string, _datos: Partial<RedSocialPlataforma>): Promise<never> {
  throw new PendienteDeImplementar(
    'guardarRed',
    `PUT /api/plataforma/redes/${_id}  (requiere sesion con rol owner)`,
  )
}

/** Crea, edita o borra una FAQ. Solo owner. */
export async function guardarFAQ(_datos: {
  id?: string
  pregunta: string
  respuesta: string
  activa?: boolean
}): Promise<never> {
  throw new PendienteDeImplementar(
    'guardarFAQ',
    'POST /api/plataforma/faq  (requiere sesion con rol owner)',
  )
}

/* -------------------------------------------------------------------------
 * Siembra
 * ---------------------------------------------------------------------- */

/**
 * Las FAQ y las redes por defecto, para insertar la primera vez.
 *
 * Las usa `scripts/sembrar-plataforma.mjs` al aplicar el esquema. Van como
 * semilla en la base, no como fallback en el codigo: una FAQ que edito desde el
 * panel tiene que seguir editada, y si el codigo la sobrescribiera en cada
 * visita, la edicion se perderia.
 */
export function datosIniciales(): {
  redes: Omit<RedSocialPlataforma, 'id'>[]
  faqs: Omit<(typeof FAQ_INICIALES)[number], 'id'>[]
} {
  return {
    redes: REDES_INICIALES,
    faqs: FAQ_INICIALES,
  }
}