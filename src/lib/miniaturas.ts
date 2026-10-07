/**
 * Las miniaturas de producto.
 *
 * ============================================================================
 *  QUE ES
 * ============================================================================
 * `public/imagenes/*.svg` son 22 dibujos de 96x96 generados por
 * `scripts/imagenes.mjs`: diez categorias fisicas (las del paquete de 60 dias),
 * ocho digitales y cuatro para estados vacios y pasos del vendedor. Pesa ~460
 * bytes cada uno, no pide nada a terceros y se ve bien de 40 a 160 px.
 *
 * ============================================================================
 *  POR QUE UN MAPA Y NO CONCATENAR EL NOMBRE
 * ============================================================================
 * Si el dibujo se pidiera como `/imagenes/${categoria}.svg`, una categoria nueva
 * o un cambio de nombre escribiria una ruta que no existe y la imagen saldria
 * rota en la pagina sin que nada falle en la compilacion. Aqui la lista de
 * nombres es el tipo: pedir `miniaturaDe('trineos')` no compila.
 *
 * ============================================================================
 *  NADA DE FOTOS
 * ============================================================================
 * Un dibujo de categoria dice "aqui se vende ropa". Una foto de stock dice
 * "alguien esta vendiendo esta camiseta", que es un dato inventado. Mientras el
 * catalogo este vacio, solo lo primero es cierto.
 */

/** Todas las miniaturas que existen. Debe coincidir con `scripts/imagenes.mjs`. */
export const MINIATURAS = [
  'ropa',
  'calzado',
  'belleza',
  'joyeria',
  'hogar',
  'electronica',
  'electrodomesticos',
  'informatica',
  'automotriz',
  'construccion',
  'software',
  'plantilla',
  'ebook',
  'curso',
  'audio',
  'grafico',
  'codigo',
  'servicio',
  'carrito',
  'paquete',
  'dinero',
  'cuenta',
] as const

export type NombreMiniatura = (typeof MINIATURAS)[number]

/**
 * Categoria de producto o de paquete -> miniatura.
 *
 * Las categorias son texto libre en `productos.categoria`, asi que lo que no
 * este en la tabla se resuelve por parecidas y solo entonces cae en `paquete`,
 * que es la caja generica: mejor una caja que una camiseta al lado de un
 * producto de software.
 *
 * La tabla esta escrita a mano y no derivada del slug a proposito: `joyeria`
 * es la miniatura de `accesorios`, y esa relacion solo existe aqui.
 */
const POR_CATEGORIA: Record<string, NombreMiniatura> = {
  ropa: 'ropa',
  moda: 'ropa',
  calzado: 'calzado',
  zapatos: 'calzado',
  belleza: 'belleza',
  cuidado_personal: 'belleza',
  accesorios: 'joyeria',
  joyeria: 'joyeria',
  hogar: 'hogar',
  muebles: 'hogar',
  decoracion: 'hogar',
  electronica: 'electronica',
  electrodomesticos: 'electrodomesticos',
  equipos_electricos: 'electrodomesticos',
  informatica: 'informatica',
  perifericos: 'informatica',
  automotriz: 'automotriz',
  repuestos: 'automotriz',
  construccion: 'construccion',
  herramientas: 'construccion',
  maquinaria: 'construccion',
  software: 'software',
  aplicaciones: 'software',
  plantillas: 'plantilla',
  diseno: 'grafico',
  grafico: 'grafico',
  libros: 'ebook',
  ebooks: 'ebook',
  cursos: 'curso',
  formacion: 'curso',
  musica: 'audio',
  audio: 'audio',
  codigo: 'codigo',
  desarrollo: 'codigo',
  servicios: 'servicio',
}

/**
 * La miniatura que le toca a una categoria.
 *
 * `normalizar` se quita acentos y pasa a minusculas: la categoria se escribe a
 * mano en el formulario del vendedor y "Electrónica" y "electronica" son la
 * misma cosa para quien la escribio y dos rutas distintas para la imagen.
 */
export function miniaturaDeCategoria(categoria: string | null | undefined): NombreMiniatura {
  if (!categoria) return 'paquete'
  const normalizar = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')

  const clave = normalizar(categoria)
  const directa = POR_CATEGORIA[clave]
  if (directa) return directa

  // "Ropa y Moda", "Informatica y Perifericos": si la categoria trae varias
  // palabras, se mira cada una por separado antes de rendirse.
  for (const palabra of clave.split('_')) {
    const parcial = POR_CATEGORIA[palabra]
    if (parcial) return parcial
  }
  return 'paquete'
}

/** La ruta del fichero. Siempre absoluta: las 22 idiomas llevan prefijo. */
export function rutaMiniatura(nombre: NombreMiniatura): string {
  return `/imagenes/${nombre}.svg`
}
