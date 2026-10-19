/**
 * Subida de fotos de perfil desde el navegador.
 *
 * ============================================================================
 *  POR QUE LA FOTO SE REDUCE ANTES DE SALIR DE AQUI
 * ============================================================================
 * Una foto de movil pesa 4-8 MB y mide 4000 px de lado. Para un avatar de 512 px
 * eso es 60 veces mas pixeles de los que se van a ver, y el tope de la API son
 * 2 MB: sin reducir, la mayoria de las fotos se rechazarian por grandes. Aqui se
 * recorta al cuadrado central, se lleva a 512x512 y se comprime, todo en el
 * navegador, antes de que el archivo salga del dispositivo.
 *
 * Recortar al centro y no estirar: estirar una foto que no es cuadrada deforma
 * la cara. El recorte se lleva la parte de en medio, que es donde esta.
 *
 * ============================================================================
 *  POR QUE ESTO NO ES UNA DEFENSA
 * ============================================================================
 * Reducir la foto es comodidad, no seguridad. Quien no use esta pantalla puede
 * mandar a la API lo que quiera: por eso el Worker valida la FIRMA del archivo
 * (`src/worker/routers/avatar.ts`) y el tope de 2 MB de su lado. Aqui se confia
 * en el navegador; alli, en nadie.
 */

import { pedir, type Respuesta } from './identidad-cliente'

/** Lado del avatar ya normalizado. El mismo que espera el panel al pintarlo. */
const LADO = 512

/** Calidad de la compresion. 0,9 en WEBP casi no se distingue del original. */
const CALIDAD = 0.9

/**
 * Lado minimo del recorte, en pixeles.
 *
 * Por debajo de esto el avatar se ve borroso en la ficha, y agrandarlo solo
 * empeora: un cuadrado de 32 px estirado a 512 es mas feo que no tener foto.
 * Mejor decirlo que dejar que suba algo que no se va a poder mirar.
 */
const MINIMO_PX = 64

/** El mismo tope que aplica la API. Se comprueba aqui para no gastar la subida. */
const TOPE_BYTES = 2 * 1024 * 1024

/**
 * Recorta al cuadrado central, reduce a 512x512 y devuelve la imagen lista.
 *
 * Lanza `Error` con un mensaje escrito para leerse cuando algo no se puede
 * preparar; `subirFoto` lo convierte en la misma `Respuesta` que devuelve el
 * resto de llamadas.
 */
export async function normalizarAvatar(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.')
  }

  let mapa: ImageBitmap
  try {
    mapa = await createImageBitmap(archivo)
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con JPG, PNG o WEBP.')
  }

  try {
    const lado = Math.min(mapa.width, mapa.height)
    if (lado < MINIMO_PX) {
      throw new Error(
        `La imagen es muy pequeña: el lado mas corto tiene ${lado} px y hacen falta ${MINIMO_PX}.`,
      )
    }

    const lienzo = document.createElement('canvas')
    lienzo.width = LADO
    lienzo.height = LADO
    const pincel = lienzo.getContext('2d')
    if (!pincel) throw new Error('Tu navegador no pudo preparar la imagen.')

    // Fondo blanco antes de pintar. Si la imagen tiene transparencia y el
    // navegador acaba usando JPEG (el respaldo cuando no hay WEBP), sin esto
    // los bordes transparentes salen negros.
    pincel.fillStyle = '#ffffff'
    pincel.fillRect(0, 0, LADO, LADO)
    pincel.drawImage(
      mapa,
      Math.round((mapa.width - lado) / 2),
      Math.round((mapa.height - lado) / 2),
      lado,
      lado,
      0,
      0,
      LADO,
      LADO,
    )

    // WEBP primero por tamano; JPEG de respaldo. Un navegador que no sabe WEBP
    // devuelve igualmente algo valido (PNG) o `null`, y las dos cosas se
    // resuelven aqui sin llegar a fallarle a nadie la subida.
    const blob = (await aBlob(lienzo, 'image/webp')) ?? (await aBlob(lienzo, 'image/jpeg'))
    if (!blob) throw new Error('No se pudo convertir la imagen.')
    if (blob.size > TOPE_BYTES) {
      throw new Error('La foto sigue pesando demasiado despues de reducirla. Prueba con otra.')
    }
    return blob
  } finally {
    mapa.close?.()
  }
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolver) => {
    try {
      lienzo.toBlob((blob) => resolver(blob), tipo, CALIDAD)
    } catch {
      resolver(null)
    }
  })
}

/**
 * Sube una foto y devuelve su URL publica.
 *
 * `ruta` es la de la foto que se esta cambiando: la de la cuenta
 * (`/api/panel/avatar`) o la de la tienda (`/api/panel/tienda/avatar`). El
 * nombre del archivo que se manda no importa: el Worker decide la extension por
 * los primeros bytes, no por como se llame.
 */
async function subirFoto(ruta: string, archivo: File): Promise<Respuesta<{ avatar: string }>> {
  let normalizada: Blob
  try {
    normalizada = await normalizarAvatar(archivo)
  } catch (error) {
    return {
      ok: false,
      codigo: 'imagen_invalida',
      mensaje: error instanceof Error ? error.message : 'No se pudo preparar la imagen.',
    }
  }

  const forma = new FormData()
  forma.append('imagen', normalizada, 'avatar.webp')
  return pedir<{ avatar: string }>(ruta, { method: 'POST', body: forma })
}

/** Cambia la foto de la cuenta. */
export function subirAvatarCuenta(archivo: File): Promise<Respuesta<{ avatar: string }>> {
  return subirFoto('/api/panel/avatar', archivo)
}

/** Cambia la foto de la tienda. */
export function subirAvatarTienda(archivo: File): Promise<Respuesta<{ avatar: string }>> {
  return subirFoto('/api/panel/tienda/avatar', archivo)
}

/** Quita la foto de la cuenta. */
export function quitarAvatarCuenta(): Promise<Respuesta<{ avatar: null }>> {
  return pedir<{ avatar: null }>('/api/panel/avatar', { method: 'DELETE' })
}

/** Quita la foto de la tienda. */
export function quitarAvatarTienda(): Promise<Respuesta<{ avatar: null }>> {
  return pedir<{ avatar: null }>('/api/panel/tienda/avatar', { method: 'DELETE' })
}

/**
 * Avisa de una foto que no deberia estar.
 *
 * Es publico: se manda desde la ficha de un producto o desde la pagina de un
 * vendedor sin necesidad de tener cuenta.
 */
export function reportarFoto(datos: {
  vendedorSlug: string
  tipo: 'cuenta' | 'tienda'
  motivo: string
}): Promise<Respuesta<unknown>> {
  return pedir('/api/reportes/avatar', {
    method: 'POST',
    body: JSON.stringify({
      vendedor_slug: datos.vendedorSlug,
      tipo: datos.tipo,
      motivo: datos.motivo,
    }),
  })
}

/** Aviso de foto pendiente, tal como lo ve el Owner en su panel. */
export interface ReporteAvatar {
  id: number
  tipo: 'cuenta' | 'tienda'
  url: string
  motivo: string
  vendedorSlug: string
  vendedorNombre: string
  vendedorEmail: string | null
  creadoAt: string
  atendido: boolean
}

/** La cola de avisos, para el Owner. */
export function listarReportesAvatar(): Promise<Respuesta<{ reportes: ReporteAvatar[] }>> {
  return pedir<{ reportes: ReporteAvatar[] }>('/api/owner/reportes-avatar')
}

/** Cierra un aviso y borra la foto reportada. Solo el Owner. */
export function atenderReporteAvatar(id: number): Promise<Respuesta<unknown>> {
  return pedir(`/api/owner/reportes-avatar/${id}/atender`, { method: 'POST' })
}
