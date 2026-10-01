/**
 * Diccionario de traducciones.
 *
 * ============================================================================
 *  POR QUE ESTO NO SON ARCHIVOS .JSON
 * ============================================================================
 * Con 22 idiomas, un archivo por idioma significa abrir 22 archivos para
 * encontrar la clave de un texto. Y el error tipico de esa organizacion —que es
 * el que se paga caro— es TRADUCIR UNA CLAVE QUE NO EXISTE.
 *
 * Aqui el tipo lo hace imposible: `Diccionario` exige exactamente las claves de
 * `es`. Si a un idioma le falta una, TypeScript da error de compilacion. No
 * hay forma de desplegar un idioma incompleto sin que se note.
 *
 * La alternativa (JSON sueltos) deja que falten claves y que aparezcan en
 * pantalla como "carrito.tituloVacio" literal, que es como se ve un sitio a medio
 * traducir.
 *
 * ============================================================================
 *  `es` ES EL DICCIONARIO DE REFERENCIA
 * ============================================================================
 * `es` define la forma del tipo. Todos los demas deben cumplirlo. Por eso sus
 * valores son `string` y no un tipo literal: si fueran literales, cada traduccion
 * tendria que repetir exactamente el mismo texto y no habria forma de traducir.
 *
 * ============================================================================
 *  IDIOMAS SIN TRADUCCION NO SE INVENTAN
 * ============================================================================
 * Cuando se conecte el backend habra una API de traduccion. Este archivo va a
 * ser su destino: las claves sin valorFilled se piden, y las que llegan se
 * cachean en KV.
 *
 * HOY hay traducciones reales solo para `es`. Poner traducciones aproximadas de
 * 21 idiomas seria la forma mas rapida de tener un sitio "multidioma" que en
 * realidad tiene la mitad de las paginas en espanol sin avisar. Un visitante
 * japones que lee "Productos digitales" y "Comprar" mezclados con texto
 * japones descarga menos y piensa que el sitio esta roto.
 *
 * La decision de no traducir todavia es reversible; inventar 21 traducciones
 * malas no lo es, porque habria que revisarlas una por una.
 */

/* ===========================================================================
 * Forma del diccionario
 * ======================================================================== */

export const ES = {
  /* --- Navegacion --- */
  nav: {
    productos: 'Productos',
    espacios: 'Espacios',
    vender: 'Vender',
    carrito: 'Carrito',
    cuenta: 'Mi cuenta',
    panel: 'Panel del vendedor',
    owner: 'Administracion',
    buscar: 'Buscar productos',
    menu: 'Menu',
    cerrar: 'Cerrar',
  },

  /* --- Estados vacios. La diferencia con un error importa. --- */
  vacio: {
    sinProductos: 'Todavia no hay productos publicados',
    sinProductosAyuda:
      'Apenas los vendedores publiquen, sus productos apareceran aqui. Varios de ellos ya estan preparando su catalogo.',
    sinVentas: 'Aun no tenes ventas',
    sinVentasAyuda: 'Cuando alguien compre uno de tus productos, aparecera aqui el detalle y el enlace de descarga.',
    sinCarrito: 'Tu carrito esta vacio',
    sinCarritoAyuda: 'Agrega productos del catalogo para empezar una compra.',
    sinPagos: 'No hay pagos esperando confirmacion',
    sinPagosAyuda: 'Los pagos por WhatsApp que envien los compradores apareceran aqui para que los confirmes.',
    sinOrdenes: 'No tenes compras todavia',
    sinOrdenesAyuda: 'Tus compras y los enlaces de descarga estaran aqui.',
    sinResultados: 'Ningun producto coincide con esa busqueda',
    sinResultadosAyuda: 'Proba con menos palabras o quita los filtros.',
    sinLiquidaciones: 'No hay liquidaciones pendientes',
    sinLiquidacionesAyuda: 'Cuando se acumule lo que te corresponde, aparecera aqui para cobrar.',
  },

  /* --- Errores. Se distinguen de los estados vacios a proposito. --- */
  error: {
    titulo: 'No pudimos cargar esto',
    conexion:
      'No se pudo contactar con el servidor. Puede ser tu conexion o que el backend todavia no este desplegado.',
    vacio: 'La respuesta del servidor llego vacia.',
    reintentar: 'Reintentar',
    endpoint: 'Endpoint consultado',
  },

  /* --- Reglas de Oro. La promesa comercial del marketplace. --- */
  regla: {
    A: 'Software de terceros',
    B: 'Contenido propio',
    C: 'Artesanias y productos',
    comisionA: '5% para QBASwing, 95% para el autor.',
    comisionB: '0% de comision. El autor se lleva el 100%.',
    comisionC: '0% de comision sobre la venta.',
    titulo: 'Reglas de Oro',
  },

  /* --- Productos --- */
  producto: {
    comprar: 'Comprar',
    agregar: 'Agregar al carrito',
    agregado: 'Agregado',
    precio: 'Precio',
    gratis: 'Gratis',
    vendedor: 'Vendedor',
    categoria: 'Categoria',
    descripcion: 'Descripcion',
    detalles: 'Detalles',
    plataforma: 'Plataforma',
    licencia: 'Licencia',
    archivo: 'Archivo',
    tamano: 'Tamano',
    versiones: 'Versiones',
    desde: 'Desde',
   opiniones: 'Opiniones',
    sinDescripcion: 'El vendedor no agrego descripcion a este producto.',
    filtros: 'Filtros',
    limpiar: 'Limpiar filtros',
    ordenar: 'Ordenar por',
    resultados: 'resultados',
    noEncontrado: 'Ese producto no existe o dejo de estar disponible',
  },

  /* --- Carrito y checkout --- */
  carrito: {
    titulo: 'Carrito',
    vacio: 'Tu carrito esta vacio',
    subtotal: 'Subtotal',
    comision: 'Comision de QBASwing',
    total: 'Total',
    checkout: 'Ir al pago',
    seguir: 'Seguir comprando',
    vaciar: 'Vaciar carrito',
    unidades: 'unidades',
  },

  pago: {
    titulo: 'Elegir como pagar',
    pasarela: 'Pasarela',
    confirmar: 'Confirmar pago',
    procesando: 'Procesando el pago...',
    esperando: 'Esperando confirmacion',
    revisionManual:
      'Este pago lo confirma una persona. Te avisamos por correo en cuanto se procese.',
    rechazado: 'El pago no se pudo completar',
    pendiente: 'Pago pendiente',
    verificado: 'Pago confirmado',
    reembolsado: 'Reembolsado',
    tiempoWebhook: 'Se confirma automaticamente',
    tiempoSondeo: 'Tarda unos minutos',
    tiempoManual: 'Lo confirma una persona',
  },

  /* --- Cuenta --- */
  cuenta: {
    entrar: 'Iniciar sesion',
    registro: 'Crear cuenta',
    salir: 'Cerrar sesion',
    correo: 'Correo electronico',
    contrasena: 'Contrasena',
    nombre: 'Nombre',
    recordar: 'Recordarme',
    sinCuenta: 'No tenes cuenta',
    conCuenta: 'Ya tenes cuenta',
    crear: 'Crear mi cuenta',
    miCuenta: 'Mi cuenta',
    biblioteca: 'Mis compras',
    perfil: 'Mi perfil',
  },

  /* --- Panel del vendedor --- */
  panel: {
    titulo: 'Panel del vendedor',
    productos: 'Productos',
    ventas: 'Ventas',
    espacios: 'Espacios',
    nuevoProducto: 'Publicar producto',
    editarProducto: 'Editar producto',
    slotsUsados: 'Slots usados',
    slotsLibres: 'Slots libres',
    slotsTotales: 'Slots del paquete',
    sinPaquete: 'No tenes un paquete de espacios activo',
    sinPaqueteAyuda: 'Compra un paquete para poder publicar productos.',
    bruto: 'Bruto',
    comision: 'Comision',
    neto: 'Neto',
    porCobrar: 'Por cobrar',
  },

  /* --- Panel de administracion --- */
  owner: {
    titulo: 'Administracion',
    resumen: 'Resumen',
    ingresos: 'Ingresos',
    pagosPendientes: 'Pagos por confirmar',
    liquidaciones: 'Liquidaciones',
    configuracion: 'Configuracion',
    catalogo: 'Catalogo',
    usuarios: 'Usuarios',
    exenciones: 'Exenciones',
    confirmar: 'Confirmar pago',
    rechazar: 'Rechazar',
    evidencia: 'Evidencia',
    evidenciaAyuda:
      'Anota que viste para poder auditarlo despues. Sin esto, el pago no se puede confirmar.',
    confirmarAviso:
      'Confirma solo si viste el comprobante. Esta accion queda registrada con tu nombre.',
    cobrar: 'Marcar como cobrada',
    porVendedor: 'Por vendedor',
    exentoComision: 'Exento de comision',
    slotsIlimitados: 'Slots ilimitados',
    alcance: 'Alcance',
  },

  /* --- Perfil del vendedor --- */
  perfil: {
    misProductos: 'Productos',
    metodosCobro: 'Formas de pago',
    metodosCobroAyuda:
      'Cada vendedor publica las suyas. El comprador te paga directo a ti.',
    redes: 'Redes sociales',
    ubicacion: 'Ubicacion',
    provincia: 'Provincia',
    municipio: 'Municipio',
    direccion: 'Direccion',
    contacto: 'Contacto',
    whatsapp: 'WhatsApp',
    telefono: 'Telefono',
    sitioWeb: 'Sitio web',
    desde: 'Vendedor desde',
    propietario: 'Propietario',
    agregarMetodo: 'Agregar forma de pago',
    redPlataforma: 'Plataforma',
    redUsuario: 'Usuario',
    mostrar: 'Mostrar en mi perfil',
  },

  /* --- Formularios de publicacion --- */
  form: {
    titulo: 'Publicar un producto',
    nombreProducto: 'Nombre del producto',
    tipo: 'Tipo',
    resumen: 'Resumen corto',
    descripcionLarga: 'Descripcion completa',
    precio: 'Precio',
    moneda: 'Moneda',
    categorias: 'Categorias',
    imagenes: 'Imagenes',
    archivo: 'Archivo del producto',
    publicar: 'Publicar',
    guardarBorrador: 'Guardar como borrador',
    obligatorio: 'Este campo es obligatorio',
    demasiadoCorto: 'Es muy corto para ser util',
    precioInvalido: 'El precio tiene que ser mayor que cero',
    rutaEntrega: 'Como se va a entregar',
    rutaKv: 'Se guarda en QBASwing. El comprador lo descarga desde el sitio.',
    rutaFraccionado: 'El archivo es grande. Se entrega completo, dividido por dentro.',
    rutaExterno: 'El archivo es muy grande. Ponas tu propio enlace y lo compartes con el comprador.',
    ventajaRuta: 'Ventaja',
  },

  /* --- Footer --- */
  footer: {
    descripcion:
      'Marketplace de software, plantillas, productos digitales y artesanias de Cuba y el mundo.',
    marketplace: 'Marketplace',
    cuenta: 'Cuenta',
    ayuda: 'Ayuda',
    nosotros: 'Nosotros',
    contacto: 'Contacto',
    faq: 'Preguntas frecuentes',
    terminos: 'Terminos',
    privacidad: 'Privacidad',
    derechos: 'Derechos reservados',
    hechoEn: 'Hecho en Cuba',
  },

  /* --- Accesibilidad y comun --- */
  comun: {
    volver: 'Volver',
    siguiente: 'Siguiente',
    anterior: 'Anterior',
    cerrar: 'Cerrar',
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    confirmar: 'Confirmar',
    cargando: 'Cargando...',
    noDisponible: 'No disponible todavia',
    nuevo: 'Nuevo',
    verTodo: 'Ver todo',
    paginaNoEncontrada: 'Pagina no encontrada',
    paginaNoEncontradaTexto:
      'La direccion que abriste no existe. Puede que el link este mal escrito o que la pagina se haya movido.',
    volverInicio: 'Ir al inicio',
  },
} as const

export type Diccionario = {
  [K in keyof typeof ES]: { [P in keyof (typeof ES)[K]]: string }
}

/* ===========================================================================
 * Diccionario por idioma
 * ======================================================================== */

/**
 * Los idiomas que ya tienen todas las claves.
 *
 * Solo `es` por ahora. Agregar un idioma es agregar UNA entrada aca con un
 * objeto que cumpla `Diccionario`: si le falta una clave, no compila.
 *
 * Lo que NO va a hacer este archivo: guardar traducciones a medias. Un idioma
 * con el 60% traducido es peor que un idioma ausente, porque el visitante ve
 * unos textos en su idioma y otros en espanol y no puede saber cuales son
 * oficiales.
 */
export const DICCIONARIOS: Partial<Record<string, Diccionario>> = {
  es: ES,
}

/** Devuelve el diccionario de un idioma, o el de español si no esta completo. */
export function diccionarioDe(idioma: string): Diccionario {
  return DICCIONARIOS[idioma] ?? ES
}

/**
 * ¿El idioma tiene TODAS las claves?
 *
 * Lo usa el selector de idioma para no ofrecer un idioma a medio traducir. Un
 * idioma incompleto se muestra pero marcado, en vez de llevar al visitante a una
 * pagina donde la mitad esta en otro idioma.
 */
export function idiomaCompleto(idioma: string): boolean {
  return DICCIONARIOS[idioma] !== undefined
}

/** El idioma activo de la peticion actual. */
export function idiomaActual(url: URL): string {
  const primerSegmento = url.pathname.split('/')[1]
  // Sin prefijo es espanol, porque `prefixDefaultLocale: false`.
  if (!primerSegmento || !/^[a-z]{2}(-[A-Za-z]{2})?$/.test(primerSegmento)) return 'es'
  return primerSegmento
}

/**
 * Cambia el idioma de una URL conservando la pagina.
 *
 * `/productos?cat=software` con `pt-BR` tiene que dar `/pt-BR/productos?cat=software`,
 * no `/pt-BR`. Perder la pagina actual es el fallo clasico del selector de
 * idioma, y hace que la gente vuelva a buscar lo que estaba viendo.
 *
 * `/` con `pt-BR` da `/pt-BR/`, no `/pt-BR//`.
 */
export function cambiarIdioma(url: URL, destino: string): string {
  const segmentos = url.pathname.split('/').filter(Boolean)
  const elPrimeroEsIdioma =
    segmentos.length > 0 && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(segmentos[0])

  const resto = elPrimeroEsIdioma ? segmentos.slice(1) : segmentos
  const consulta = url.search

  if (destino === 'es') {
    // El espanol no lleva prefijo: `/productos`, no `/es/productos`.
    return `/${resto.join('/')}${consulta}` || '/'
  }
  return `/${destino}/${resto.join('/')}${consulta}`
}