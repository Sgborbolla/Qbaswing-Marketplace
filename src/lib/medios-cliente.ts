/**
 * Formas de cobro propias de cada cuenta, desde el navegador.
 *
 * ============================================================================
 *  QUE ES ESTA TABLA Y QUE NO
 * ============================================================================
 * `medios_pago_usuario` es donde cada vendedor pone por donde quiere cobrar:
 * su BPA, su BANDEC, su direccion de cartera, su efectivo en mano. No tiene
 * nada que ver con `medios_pago_plataforma`, que es la del Owner y la que
 * aparece en el pie de pagina.
 *
 * Las dos rutas se distinguen por el nombre (`/api/medios-pago` contra
 * `/api/panel/medios-pago`) y no por el metodo, y es deliberado: que algo sea
 * privado o publico no deberia depender de que alguien acierte con el HTTP.
 *
 * ============================================================================
 *  POR QUE NO SE VALIDA NADA AQUI
 * ============================================================================
 * Mismo motivo que en `identidad-cliente.ts`: el sitio es HTML estatico y se
 * puede editar con cualquier texto. Si esta funcion decidiera que un numero de
 * cuenta esta bien, bastaria con cambiar el JavaScript en la consola para
 * mandar lo que sea. La validacion vive en el Worker, una sola vez, y aqui lo
 * unico que se hace es devolver el mensaje que el Worker escribio, que ya esta
 * en castellano y ya dice cual de los campos ha fallado.
 */

import { pedir, type Respuesta } from './identidad-cliente'

/** Ruta del Worker. Copiada a mano y no importada desde `worker/constantes.ts`. */
const RUTA = '/api/panel/medios-pago'

/** Tipos que la tabla admite. Los mismos cinco que el `CHECK` de la migracion. */
export type TipoMedio = 'tarjeta' | 'app' | 'cripto' | 'efectivo' | 'otro'

/**
 * Una fila tal cual sale de la base: `snake_case` y sin transformar.
 *
 * Se devuelve entera aunque el comprador solo vaya a mirar cuatro campos, y es
 * la misma decision que en `medios-pago.ts`: si aqui se recortara a lo que hoy
 * se muestra, la proxima vez que se quiera editar `titular` habria que tocar
 * dos sitios, y uno se olvida.
 */
export interface MedioCobro {
  id: number
  clave: string
  nombre: string
  tipo: TipoMedio
  color_marca: string | null
  /** Solo para `tarjeta` y `app`. En cripto y efectivo es `null`, no `''`. */
  numero_cuenta: string | null
  titular: string | null
  direccion: string | null
  red: string | null
  instrucciones: string
  /** 1 encendido, 0 apagado. Nunca es booleano: viene de SQLite. */
  activo: 0 | 1
  orden: number
}

/**
 * Lo que se puede mandar en `POST` o `PATCH`.
 *
 * Todo opcional en `PATCH`, todo obligatorio salvo lo marcado en `POST`. El
 * servidor decide con lo que llegue y con lo que ya habia; de aqui no se
 * deduce nada, porque un campo ausente y un campo vacio significan dos cosas
 * distintas y quien las distingue es quien lee la base.
 */
export interface MedioCobroEnvio {
  nombre?: string
  tipo?: TipoMedio
  color_marca?: string | null
  numero_cuenta?: string | null
  titular?: string | null
  direccion?: string | null
  red?: string | null
  instrucciones?: string
  activo?: boolean | 0 | 1
  orden?: number
}

/** Lista lo tuyo, encendidos y apagados. */
export function misMedios(): Promise<Respuesta<{ medios: MedioCobro[] }>> {
  return pedir(RUTA)
}

/** Anade uno. El `clave` lo genera el servidor y no hace falta mandarlo. */
export function anadirMedio(
  cuerpo: MedioCobroEnvio,
): Promise<Respuesta<{ medio: MedioCobro }>> {
  return pedir(RUTA, { method: 'POST', body: JSON.stringify(cuerpo) })
}

/**
 * Cambia uno. El `id` va dentro del cuerpo y no en la URL.
 *
 * Eso no es una preferencia de formato: con `id` en el cuerpo, la propiedad se
 * comprueba una sola vez y dentro del `WHERE` (`... AND usuario_id = ?`), y no
 * hay dos lugares que puedan no coincidir.
 */
export function cambiarMedio(
  id: number,
  cambios: MedioCobroEnvio,
): Promise<Respuesta<{ medio: MedioCobro }>> {
  return pedir(RUTA, { method: 'PATCH', body: JSON.stringify({ id, ...cambios }) })
}

/** Borra. No hay "desactivar": un numero que ya no se quiere no debe seguir en la base. */
export function borrarMedio(id: number): Promise<Respuesta<object>> {
  return pedir(RUTA, { method: 'DELETE', body: JSON.stringify({ id }) })
}
