/**
 * Categorias de producto, con su grupo y su etiqueta.
 *
 * ============================================================================
 *  POR QUE ESTA LISTA Y NO LA DE `tipos.ts`
 * ============================================================================
 * `tipos.ts` declara un tipo `Categoria` con 16 valores, que es un TIPO: no
 * existe en tiempo de ejecucion y por tanto no se puede recorrer para pintar un
 * `<select>` ni contra el que validar lo que llega por la API. Esta lista es el
 * dato: los mismos valores, con nombre legible y agrupados por tipo de producto
 * para que el formulario no ofrezca "Software" a quien vende zapatos.
 *
 * ============================================================================
 *  LAS FISICAS SON LAS DE LOS PAQUETES, MAS `joyeria`
 * ============================================================================
 * Las diez primeras coinciden con las categorias de `paquetes` de la migracion
 * 0003: son las que tienen un paquete de espacios con precio. `joyeria` se
 * separa de `accesorios` porque es un rubro propio y el Documento Maestro la
 * nombra aparte; el vendedor que la elija compra igualmente un paquete de
 * espacios, porque el trigger de slots cuenta ESPACIOS, no categorias.
 *
 * `electrodomesticos` es una categoria de paquete de 0003 ("Equipos Electricos
 * & Electrodomesticos") que en `tipos.ts` no aparecia. Se incluye aqui porque si
 * tiene paquete, tiene que poder elegirse.
 *
 * ============================================================================
 *  EL ORDEN IMPORTA
 * ============================================================================
 * Las fisicas van primero y los servicios al final. Es el orden en que se pintan
 * en el formulario, y agrupar por tipo evita que alguien que vende ropa tenga
 * que bajar entre "software" y "ui-kits" para encontrar "calzado".
 */

/** A que tipo de producto corresponde un grupo de categorias. */
export type GrupoCategoria = 'fisico' | 'digital' | 'servicio'

export interface CategoriaProducto {
  /** Valor que se guarda en `productos.categoria`. Sin mayusculas ni espacios. */
  valor: string
  /** Texto que se ve en el formulario. */
  etiqueta: string
  grupo: GrupoCategoria
}

export const CATEGORIAS_PRODUCTO: CategoriaProducto[] = [
  // --- Fisicas. Coinciden con las categorias de paquete de 0003. ---
  { valor: 'ropa', etiqueta: 'Ropa & Moda', grupo: 'fisico' },
  { valor: 'calzado', etiqueta: 'Calzado', grupo: 'fisico' },
  { valor: 'accesorios', etiqueta: 'Accesorios', grupo: 'fisico' },
  { valor: 'joyeria', etiqueta: 'Joyeria & Relojes', grupo: 'fisico' },
  { valor: 'belleza', etiqueta: 'Belleza & Cuidado Personal', grupo: 'fisico' },
  { valor: 'hogar', etiqueta: 'Hogar, Muebles & Decoracion', grupo: 'fisico' },
  { valor: 'electronica', etiqueta: 'Electronica de Consumo', grupo: 'fisico' },
  { valor: 'electrodomesticos', etiqueta: 'Electrodomesticos', grupo: 'fisico' },
  { valor: 'informatica', etiqueta: 'Informatica & Perifericos', grupo: 'fisico' },
  { valor: 'automotriz', etiqueta: 'Automotriz & Repuestos', grupo: 'fisico' },
  { valor: 'construccion', etiqueta: 'Construccion, Herramientas & Maquinaria', grupo: 'fisico' },

  // --- Digitales. ---
  { valor: 'software', etiqueta: 'Software', grupo: 'digital' },
  { valor: 'plantillas', etiqueta: 'Plantillas', grupo: 'digital' },
  { valor: 'ui-kits', etiqueta: 'UI Kits & Disenos', grupo: 'digital' },
  { valor: 'menus-digitales', etiqueta: 'Menus & Catalogos Digitales', grupo: 'digital' },
  { valor: 'identidad-marca', etiqueta: 'Identidad de Marca', grupo: 'digital' },

  // --- Servicios. ---
  { valor: 'consultoria', etiqueta: 'Consultoria', grupo: 'servicio' },
  { valor: 'desarrollo', etiqueta: 'Desarrollo & Programacion', grupo: 'servicio' },
]

/** Los valores validos, para comprobar en la API. */
export const VALORES_CATEGORIA: string[] = CATEGORIAS_PRODUCTO.map((c) => c.valor)

/** `true` si el valor es una categoria conocida. */
export function esCategoriaValida(valor: string): boolean {
  return VALORES_CATEGORIA.includes(valor)
}

/** La etiqueta de una categoria, o el propio valor si no se conoce. */
export function etiquetaDeCategoria(valor: string): string {
  return CATEGORIAS_PRODUCTO.find((c) => c.valor === valor)?.etiqueta ?? valor
}
