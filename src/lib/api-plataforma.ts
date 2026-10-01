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
 *  HOY: TODO LANZA `PendienteDeImplementar`
 * ============================================================================
 * No hay datos ficticios. Cuando exista el Worker, se implementan las funciones
 * de abajo contra estos mismos endpoints y el footer, la pagina de contacto y
 * la de FAQ empiezan a mostrar contenido sin tocarse.
 *
 * Endpoints esperados (ver PENDIENTES-PAGOS.md para el orden de despliegue):
 *   GET /api/plataforma/redes
 *   GET /api/plataforma/contacto
 *   GET /api/plataforma/faq
 *   PUT /api/plataforma/contacto     (solo owner)
 *   PUT /api/plataforma/redes/:id    (solo owner)
 *   POST/PUT /api/plataforma/faq     (solo owner)
 */

import { API_BASE, backendConfigurado, pedir, PendienteDeImplementar } from './api'
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
 * GET generico para estos tres endpoints.
 *
 * Lanza `PendienteDeImplementar` si no hay backend, que es lo que permite que el
 * footer distinguishes "todavia no hay datos" de "el servidor se cayo".
 */
async function pedirPlataforma<T>(ruta: string): Promise<T> {
  if (!backendConfigurado) {
    throw new PendienteDeImplementar(`GET ${ruta}`, `${API_BASE || '<PUBLIC_API_BASE>'}${ruta}`)
  }
  return pedir<T>(ruta)
}

/**
 * Redes sociales del marketplace.
 *
 * Devuelve `REDES_INICIALES` con los campos de id y valor vacios para que el
 * Owner las complete desde el panel. NO devuelve `@usuario` de ejemplo: un icono
 * que apunta a una cuenta inexistente es peor que no tener icono.
 */
export async function listarRedes(): Promise<(RedSocialPlataforma & { id: string; valor: string })[]> {
  const redes = await pedirPlataforma<(RedSocialPlataforma & { id: string; valor: string })[]>(
    '/api/plataforma/redes',
  )
  return redes.sort((a, b) => a.orden - b.orden)
}

/** Datos de contacto. Objeto vacio si no hay backend. */
export async function listarContacto(): Promise<ContactoPlataforma> {
  return pedirPlataforma<ContactoPlataforma>('/api/plataforma/contacto')
}

/**
 * Preguntas frecuentes.
 *
 * Devuelve `FAQ_INICIALES` cuando no hay backend. No es un dato ficticio: son
 * respuestas escritas a mano que dicen la verdad sobre como funciona ESTE
 * proyecto, no sobre un marketplace imaginario.
 */
export async function listarFAQ(): Promise<
  { id: string; pregunta: string; respuesta: string; orden: number; activa: boolean }[]
> {
  const faqs = await pedirPlataforma<
    { id: string; pregunta: string; respuesta: string; orden: number; activa: boolean }[]
  >('/api/plataforma/faq')
  return faqs.sort((a, b) => a.orden - b.orden)
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
  redes: (Omit<RedSocialPlataforma, 'id'> & { valor: string })[]
  faqs: (Omit<(typeof FAQ_INICIALES)[number], 'id'>)[]
} {
  return {
    redes: REDES_INICIALES.map((r) => ({ ...r, valor: '' })),
    faqs: FAQ_INICIALES,
  }
}