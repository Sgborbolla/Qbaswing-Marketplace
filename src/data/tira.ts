/*
  LA TIRA DE PRODUCTOS DEL HERO.

  Dieciseis fotos reales de dieciseis cosas distintas que aqui se venden:
  cafe, artesania, audio, camara, ropa, zapatos, panel solar, almacenamiento
  de energia (inversor mas bateria, lo que aqui se compra como un EcoFlow),
  celdas fotovoltaicas soldadas, gafas, herramientas, reloj, mochila, joyas,
  cosmetica y un dron. Todas CC0 o de dominio publico de Wikimedia Commons,
  recortadas a 400x300 y optimizadas; las sirve el propio sitio. Los creditos
  (titulo y enlace) estan en `creditos-productos.json`.

  Dieciseis, y no quince ni diecisiete, porque ocho tarjetas de tres fotos con
  paso cuatro recorre justamente esas posiciones: `(k + 4·j) mod 16` para k de
  0 a 7 y j de 0 a 2 da 0..15 sin que sobre ni falte ninguna. Con doce pasaba
  lo mismo y por eso el pool tenia doce.

  Ocho tarjetas decorativas. La tarjeta k apila tres fotos: k, k+4 y k+8 del
  pool, asi que la pareja (k, k+4) comparte las tres. Eso no importa mientras
  las dos no las enseñen a la vez, que es exactamente lo que comprueba
  `scripts/simular-tira.mjs` con la misma matematica que el keyframes
  `producto-ciclo` (18 s, 6 s por foto):

    - cobertura 1 en todo instante: nunca se ve el fondo de la tarjeta;
    - al menos una foto visible: nunca hay hueco;
    - ninguna pareja vecina enseñando la misma foto, en las dos maquetas
      (4 columnas en movil y 8 en escritorio, mas las diagonales).

  El retraso de la tarjeta k es 0,4·k: una onda unica que recorre las ocho
  en 2,8 s. Con la segunda fila separada 6 s (7,6 s entre la pareja) las
  parejas k y k+4 llegaban a enseñar la misma foto durante 4,8 s de cada 18,
  y por eso se quito el salto.

  En el navegador no se puede observar: si la pestana esta oculta Chrome
  congela el reloj de animaciones (document.timeline.currentTime se queda en
  0), asi que la verificacion vive en el script.
*/

export const POOL = [
  'cafe',
  'artesania',
  'audio',
  'camara',
  'ropa',
  'zapatos',
  'solar',
  'energia',
  'celdas',
  'gafas',
  'herramientas',
  'reloj',
  'mochila',
  'joyas',
  'belleza',
  'dron',
] as const

/** Una foto apilada en una tarjeta y el retardo con el que entra. */
export type FotoTira = {
  src: string
  retraso: string
}

/** Las ocho tarjetas de la tira, en orden. Cada una apila tres fotos. */
export const TIRA: FotoTira[][] = Array.from({ length: 8 }, (_, k) => {
  const base = 0.4 * k
  return Array.from({ length: 3 }, (_, j) => ({
    src: `/imagenes/productos/${POOL[(k + 4 * j) % POOL.length]}.jpg`,
    retraso: (base - 6 * j).toFixed(1),
  }))
})
