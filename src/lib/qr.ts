/**
 * Generacion del codigo QR en el navegador.
 *
 * ============================================================================
 *  QUE HACE ESTE ARCHIVO Y POR QUE ESTA SEPARADO
 * ============================================================================
 * Es un envoltorio de una linea sobre la libreria `qrcode`. No parece que aporte
 * nada, y ese es el punto.
 *
 * La razon es que un `import` a una libreria dentro de un `<script>` de un
 * `.astro` se escribe una vez por componente. Si manana hay otro sitio que
 * necesite un QR (la ficha del vendedor, un comprobante, la pagina de un
 * pedido), ese segundo sitio tendria que volver a decidir lo mismo: que margen
 * poner, que nivel de correccion, que color de fondo, y que hacer cuando la
 * libreria no carga. Y la segunda decision seria distinta de la primera, porque
 * nadie recuerda que la tomo.
 *
 * Con las tres cosas aqui, cualquier sitio que quiera un QR llama a `pintarQr` y
 * hereda lo mismo. Y si hay que cambiar el margen, se cambia en un archivo y
 * cambia en todos los sitios a la vez.
 *
 * ============================================================================
 *  POR QUE FONDO BLANCO Y NO TRANSPARENTE
 * ============================================================================
 * Porque muchos lectores de QR buscan las esquinas por el contraste con el
 * fondo, y sobre el modo oscuro del sistema un fondo transparente puede quedar
 * gris oscuro y hacer el modulo indistinguible. Un QR que depende del tema del
 * sistema es un QR que funciona en un movil y en otro no, sin que se pueda
 * reproducir el fallo.
 *
 * El rectángulo blanco es de 8 pixeles a cada lado. Es lo que hacen los
 * generadores de verdad, y no es un margen decorativo.
 *
 * ============================================================================
 *  NIVEL DE CORRECCION 'M'
 * ============================================================================
 * Es el equilibrio. 'L' aguanta menos y los QR salen mas pequeños; 'H'
 * aguanta mas y son mas grandes de leer pero meten menos informacion. 'M' es el
 * que aguanta que una esquina del telefono se ponga medio sucia, que es lo que
 * pasa de verdad.
 *
 * Aqui no hace falta 'H' porque el dato no es un dato de sobra: es un numero de
 * cuenta. Si el QR se lee a medias y sale un numero con un digito cambiado, el
 * cliente paga a una cuenta que no existe. Mas bits de correccion no evitan eso,
 * evitan que el ESCANEO falle, y 'M' ya cubre ese caso.
 */

import QRCode from 'qrcode'

export async function pintarQr(contenedor: HTMLElement, contenido: string): Promise<void> {
  const svg = await QRCode.toString(contenido, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 180,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  })

  contenedor.innerHTML = svg
}

/**
 * Lo mismo, pero devuelve el SVG como texto en vez de pintarlo.
 *
 * Sirve para el comprobante descargable y para las pruebas. Que exista por
 * comodidad de las pruebas es correcto: una prueba que tiene que montar un
 * elemento del DOM para comprobar una cadena es una prueba que depende del
 * navegador, y aqui no se necesita un navegador para esto.
 */
export async function qrComoSvg(contenido: string): Promise<string> {
  return QRCode.toString(contenido, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}

/** Reexportado para las pruebas, que comparan contra la misma libreria. */
export { QRCode }