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
 *  POR QUE TODAS LAS TRADUCCIONES ESTAN EN ESTE MISMO ARCHIVO
 * ============================================================================
 * `scripts/validar-alfabetos.mjs` busca caracteres de otros alfabetos que se
 * cuelen donde no deben —fue un defecto real, varias veces— y admite una lista
 * blanca POR ARCHIVO. Este archivo ya esta en esa lista blanca por un motivo
 * escrito ahi: las traducciones van con la misma regla que `idiomas.ts`.
 *
 * Si las traducciones se repartieran en `i18n/traducciones/fr.ts` y demas, cada
 * archivo nuevo tendria que anadirse a la lista blanca, y ampliar una lista
 * blanca sin pensar es exactamente lo que el script quiere impedir. Mantenerlo
 * todo aqui es lo que permite comprobar de una sola vez que en el proyecto no
 * hay ni un caracter sospechoso fuera de los idiomas que de verdad se hablan.
 *
 * ============================================================================
 *  `es` ES EL DICCIONARIO DE REFERENCIA
 * ============================================================================
 * `es` define la forma del tipo. Todos los demas deben cumplirlo. Por eso sus
 * valores son `string` y no un tipo literal: si fueran literales, cada traduccion
 * tendria que repetir exactamente el mismo texto y no habria forma de traducir.
 *
 * ============================================================================
 *  COMO SE ESCRIBE EL ESPANOL DE REFERENCIA
 * ============================================================================
 *  - Con tildes y enye. El diccionario se escribio al principio sin ellas por
 *    prudencia ante el miedo a los caracteres corruptos, y nadie lo noto porque
 *    nadie lo usaba. En cuanto se pinta en pantalla, un "Descripcion" sin tilde
 *    al lado de un "Descripción" de la pagina se lee como un fallo de
 *    codificacion, que es justo el fallo que el validador de alfabetos vigila.
 *  - Con TUTEO, no con voseo. El mercado es Cuba: "tienes", "agrega", "prueba",
 *    "quita". El texto que habia decia "tenes" y "Agrega" en la misma lista, que
 *    no es ningun acento del mundo. Las variantes argentinas (`es-AR`) son el
 *    sitio donde un dia entra el voseo; hasta entonces comparten este.
 *  - Sin datos inventados: los estados vacios dicen lo que hay.
 *
 * ============================================================================
 *  EL ORDEN DE LAS FASES
 * ============================================================================
 * El sitio tenia TODO el texto de las paginas escrito a mano en cada `.astro`,
 * de modo que elegir idioma cambiaba la URL y nada mas. La traduccion entra por
 * fases, y la primera —la que ya hizo visible el cambio en las 18 paginas— es el
 * CROMO: cabecera, pie, selector de idioma, dialogo de salida y los textos
 * accesibles. Son los que estan en TODA pagina, asi que son los que hacen que el
 * idioma se note en cuanto se cambia.
 *
 * Las secciones de paginas concretas (`vacio`, `panel`, `owner`, `form`...) ya
 * estan escritas y ya estan traducidas: cuando se cable una pagina, el texto ya
 * esta ahi. Lo que falta en cada fase es enchufar, no traducir.
 *
 * ============================================================================
 *  QUE NO SE TRADUCE (Y POR QUE)
 * ============================================================================
 * - Slugs de URL (`/productos/nova-saas-engine`): son identificadores. Traducirlos
 *   rompe los enlaces guardados y el SEO. El titulo visible si se traduce.
 * - Codigos de moneda (CUP, USD, EUR) y de pais.
 * - Nombres propios: QBASwing, Stripe, Cloudflare, TropiPay, Telegram.
 * - Datos que vienen de la API: los titulos y descripciones de producto los
 *   traduce quien los publica, no esta tabla.
 */

/* ===========================================================================
 * Forma del diccionario
 * ======================================================================== */

export const ES = {
  /* --- Navegacion: cabecera, la parte visible en las 18 paginas --- */
  nav: {
    productos: 'Productos',
    espacios: 'Espacios',
    vender: 'Vender',
    carrito: 'Carrito',
    cuenta: 'Mi cuenta',
    panel: 'Panel del vendedor',
    owner: 'Administración',
    buscar: 'Buscar productos',
    menu: 'Menú',
    cerrar: 'Cerrar',
    /* aria-labels. Un lector de pantalla lee lo que hay en `aria-label`, no el
       texto visible, asi que estos tambien son texto de interfaz. */
    irInicio: 'QBASwing Marketplace, ir al inicio',
    principal: 'Navegación principal',
    entrar: 'Entrar en mi cuenta',
    carritoCompras: 'Carrito de compras',
  },

  /* --- Estados vacios. La diferencia con un error importa. --- */
  vacio: {
    sinProductos: 'Todavía no hay productos publicados',
    sinProductosAyuda:
      'Apenas los vendedores publiquen, sus productos aparecerán aquí. Varios de ellos ya están preparando su catálogo.',
    sinVentas: 'Aún no tienes ventas',
    sinVentasAyuda:
      'Cuando alguien compre uno de tus productos, aparecerá aquí el detalle y el enlace de descarga.',
    sinCarrito: 'Tu carrito está vacío',
    sinCarritoAyuda: 'Agrega productos del catálogo para empezar una compra.',
    sinPagos: 'No hay pagos esperando confirmación',
    sinPagosAyuda:
      'Los pagos por WhatsApp que envíen los compradores aparecerán aquí para que los confirmes.',
    sinOrdenes: 'No tienes compras todavía',
    sinOrdenesAyuda: 'Tus compras y los enlaces de descarga estarán aquí.',
    sinResultados: 'Ningún producto coincide con esa búsqueda',
    sinResultadosAyuda: 'Prueba con menos palabras o quita los filtros.',
    sinLiquidaciones: 'No hay liquidaciones pendientes',
    sinLiquidacionesAyuda:
      'Cuando se acumule lo que te corresponde, aparecerá aquí para cobrar.',
  },

  /* --- Errores. Se distinguen de los estados vacios a proposito. --- */
  error: {
    titulo: 'No pudimos cargar esto',
    conexion:
      'No se pudo contactar con el servidor. Puede ser tu conexión o que el backend todavía no esté desplegado.',
    vacio: 'La respuesta del servidor llegó vacía.',
    reintentar: 'Reintentar',
    endpoint: 'Endpoint consultado',
  },

  /* --- Reglas de Oro. La promesa comercial del marketplace. --- */
  regla: {
    A: 'Software de terceros',
    B: 'Contenido propio',
    C: 'Artesanías y productos',
    comisionA: '5% para QBASwing, 95% para el autor.',
    comisionB: '0% de comisión. El autor se lleva el 100%.',
    comisionC: '0% de comisión sobre la venta.',
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
    categoria: 'Categoría',
    descripcion: 'Descripción',
    detalles: 'Detalles',
    plataforma: 'Plataforma',
    licencia: 'Licencia',
    archivo: 'Archivo',
    tamano: 'Tamaño',
    versiones: 'Versiones',
    desde: 'Desde',
    opiniones: 'Opiniones',
    sinDescripcion: 'El vendedor no agregó descripción a este producto.',
    filtros: 'Filtros',
    limpiar: 'Limpiar filtros',
    ordenar: 'Ordenar por',
    resultados: 'resultados',
    noEncontrado: 'Ese producto no existe o dejó de estar disponible',
  },

  /* --- Carrito y checkout --- */
  carrito: {
    titulo: 'Carrito',
    vacio: 'Tu carrito está vacío',
    subtotal: 'Subtotal',
    comision: 'Comisión de QBASwing',
    total: 'Total',
    checkout: 'Ir al pago',
    seguir: 'Seguir comprando',
    vaciar: 'Vaciar carrito',
    unidades: 'unidades',
  },

  pago: {
    titulo: 'Elegir cómo pagar',
    pasarela: 'Pasarela',
    confirmar: 'Confirmar pago',
    procesando: 'Procesando el pago...',
    esperando: 'Esperando confirmación',
    revisionManual:
      'Este pago lo confirma una persona. Te avisamos por correo en cuanto se procese.',
    rechazado: 'El pago no se pudo completar',
    pendiente: 'Pago pendiente',
    verificado: 'Pago confirmado',
    reembolsado: 'Reembolsado',
    tiempoWebhook: 'Se confirma automáticamente',
    tiempoSondeo: 'Tarda unos minutos',
    tiempoManual: 'Lo confirma una persona',
  },

  /* --- Cuenta --- */
  cuenta: {
    entrar: 'Iniciar sesión',
    registro: 'Crear cuenta',
    salir: 'Cerrar sesión',
    correo: 'Correo electrónico',
    contrasena: 'Contraseña',
    nombre: 'Nombre',
    recordar: 'Recordarme',
    sinCuenta: 'No tienes cuenta',
    conCuenta: 'Ya tienes cuenta',
    crear: 'Crear mi cuenta',
    miCuenta: 'Mi cuenta',
    biblioteca: 'Mis compras',
    perfil: 'Mi perfil',
    /* Dialogo de salida, que es el sitio donde el Owner pidio que salir solo
       se pueda hacer con dos opciones a la vista. */
    salirTitulo: 'Salir de tu cuenta',
    salirTexto:
      'Vas a tener que entrar otra vez con tu correo y tu contraseña. Esta sesión se cierra aquí, no en los otros dispositivos donde tengas la cuenta abierta.',
    mantenerSesion: 'Mantener sesión',
    /* Corto, para los dos botones. "Cerrar sesión" cabe mal en la cabecera de
       un movil y en el dialogo es redundante con el titulo de arriba. */
    salirCorto: 'Salir',
    saliendo: 'Saliendo...',
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
    sinPaquete: 'No tienes un paquete de espacios activo',
    sinPaqueteAyuda: 'Compra un paquete para poder publicar productos.',
    bruto: 'Bruto',
    comision: 'Comisión',
    neto: 'Neto',
    porCobrar: 'Por cobrar',
  },

  /* --- Panel de administracion --- */
  owner: {
    titulo: 'Administración',
    resumen: 'Resumen',
    ingresos: 'Ingresos',
    pagosPendientes: 'Pagos por confirmar',
    liquidaciones: 'Liquidaciones',
    configuracion: 'Configuración',
    catalogo: 'Catálogo',
    usuarios: 'Usuarios',
    exenciones: 'Exenciones',
    confirmar: 'Confirmar pago',
    rechazar: 'Rechazar',
    evidencia: 'Evidencia',
    evidenciaAyuda:
      'Anota qué viste para poder auditarlo después. Sin esto, el pago no se puede confirmar.',
    confirmarAviso:
      'Confirma solo si viste el comprobante. Esta acción queda registrada con tu nombre.',
    cobrar: 'Marcar como cobrada',
    porVendedor: 'Por vendedor',
    exentoComision: 'Exento de comisión',
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
    ubicacion: 'Ubicación',
    provincia: 'Provincia',
    municipio: 'Municipio',
    direccion: 'Dirección',
    contacto: 'Contacto',
    whatsapp: 'WhatsApp',
    telefono: 'Teléfono',
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
    descripcionLarga: 'Descripción completa',
    precio: 'Precio',
    moneda: 'Moneda',
    categorias: 'Categorías',
    imagenes: 'Imágenes',
    archivo: 'Archivo del producto',
    publicar: 'Publicar',
    guardarBorrador: 'Guardar como borrador',
    obligatorio: 'Este campo es obligatorio',
    demasiadoCorto: 'Es muy corto para ser útil',
    precioInvalido: 'El precio tiene que ser mayor que cero',
    rutaEntrega: 'Cómo se va a entregar',
    rutaKv: 'Se guarda en QBASwing. El comprador lo descarga desde el sitio.',
    rutaFraccionado: 'El archivo es grande. Se entrega completo, dividido por dentro.',
    rutaExterno:
      'El archivo es muy grande. Pones tu propio enlace y lo compartes con el comprador.',
    ventajaRuta: 'Ventaja',
  },

  /* --- Pie de pagina. Las cuatro columnas, tal como estan en Footer.astro. --- */
  footer: {
    descripcion:
      'Marketplace de software, plantillas, productos digitales y artesanías de Cuba y el mundo.',
    /* Titulos de columna */
    colMarketplace: 'Marketplace',
    colComprar: 'Comprar',
    colVender: 'Vender',
    colPlataforma: 'Plataforma',
    /* Enlaces */
    enProductos: 'Productos',
    enDestacados: 'Destacados',
    enEspacios: 'Espacios y paquetes',
    enCarrito: 'Carrito',
    enPagar: 'Pasar por caja',
    enDescargas: 'Mis descargas',
    enFaq: 'Preguntas frecuentes',
    enPanel: 'Panel del vendedor',
    enSubir: 'Subir producto',
    enOwner: 'Consola del Owner',
    enCrearCuenta: 'Crear cuenta',
    enContacto: 'Contacto',
    enNosotros: 'Nosotros',
    enTerminos: 'Términos',
    enPrivacidad: 'Privacidad',
    /* Reglas de oro del pie: el rotulo y los dos formatos con porcentaje.
       `{n}` se rellena con `rellenar()` porque el orden de la frase cambia de
       idioma a idioma: en ingles va "5% commission", en arabe el numero no
       empieza la frase. Dejar el numero fuera del texto obligaria a que todos
       los idiomas tengan la misma sintaxis, que es lo contrario de traducir. */
    regla: 'Regla',
    comisionA: '{n}% para QBASwing',
    comisionBC: '{n}% de comisión',
    sinContacto:
      'El Owner aún no publicó datos de contacto. Escribe por Telegram o WhatsApp desde los botones de arriba.',
    patrocinadoPor: 'Patrocinado por',
    disenadoPor: 'Diseñado por',
    derechos: 'Todos los derechos reservados',
    descargo:
      'QBASwing Marketplace no es una institución financiera y no custodia fondos. En la Regla A el pago pasa por la pasarela y la plataforma retiene el 5% que fija la regla; en las Reglas B y C el pago va directo al autor y la plataforma no interviene. Los enlaces de descarga de productos digitales duran 5 minutos y solo funcionan para quien compró. Los productos digitales de autores externos se publican después de que el Owner los apruebe.',
  },

  /* --- Selector de idioma --- */
  idioma: {
    titulo: 'Idioma',
    actual: 'Idioma actual',
    cambiar: 'Cambiar idioma',
    conservaPagina: 'Conserva la página actual',
    guardado: 'Guardamos tu preferencia para la próxima visita.',
    sinTraducir: 'Aún sin traducir',
  },

  /* --- Accesibilidad y comun --- */
  comun: {
    saltarContenido: 'Saltar al contenido',
    volver: 'Volver',
    siguiente: 'Siguiente',
    anterior: 'Anterior',
    cerrar: 'Cerrar',
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    confirmar: 'Confirmar',
    cargando: 'Cargando...',
    noDisponible: 'No disponible todavía',
    nuevo: 'Nuevo',
    verTodo: 'Ver todo',
    paginaNoEncontrada: 'Página no encontrada',
    paginaNoEncontradaTexto:
      'La dirección que abriste no existe. Puede que el link esté mal escrito o que la página se haya movido.',
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
 * Agregar un idioma es agregar UNA entrada aca con un objeto que cumpla
 * `Diccionario`: si le falta una clave, no compila. No hay forma de que este
 * archivo compile con un idioma al 60%.
 *
 * De las variantes regionales (`pt-BR`, `en-GB`, `es-MX`...) se ocupa
 * `VARIANTES`, un poco mas abajo.
 *
 * Lo que NO va a hacer este archivo: guardar traducciones a medias. Un idioma
 * con el 60% traducido es peor que un idioma ausente, porque el visitante ve
 * unos textos en su idioma y otros en espanol y no puede saber cuales son
 * oficiales.
 */
export const DICCIONARIOS: Partial<Record<string, Diccionario>> = {
  es: ES,
}

/**
 * Las variantes que comparten diccionario con su idioma base.
 *
 * `en-GB` no tiene texto propio: es el mismo idioma que `en`, y el texto es
 * correcto en las dos regiones. Sin este mapa, `/pt-BR/` pediria
 * `DICCIONARIOS['pt-BR']`, que no existe, y caeria al espanol aunque `pt`
 * este completo.
 *
 * La localizacion de verdad —`colour` frente a `color`, el voseo argentino,
 * el `você` brasileño— entra creando la variante con sus propias claves. Esa
 * entrada gana a la base: la comprobacion es primero la clave exacta y luego
 * el mapa de abajo.
 */
const VARIANTES: Record<string, string> = {
  'en-GB': 'en',
  'en-US': 'en',
  'pt-BR': 'pt',
  'fr-CA': 'fr',
  'es-MX': 'es',
  'es-AR': 'es',
  'es-CO': 'es',
}

/**
 * El diccionario completo de un idioma, o `undefined` si no lo hay.
 *
 * Primero la clave tal cual (`en-GB` con texto propio), despues la base de la
 * variante (`pt-BR` -> `pt`). Asi una variante se puede traducir sola mas
 * adelante sin tocar ni el mapa ni a las demas.
 */
function entradaCompleta(idioma: string): Diccionario | undefined {
  const base = VARIANTES[idioma]
  return DICCIONARIOS[idioma] ?? (base ? DICCIONARIOS[base] : undefined)
}

/** Devuelve el diccionario de un idioma, o el de español si no esta completo. */
export function diccionarioDe(idioma: string): Diccionario {
  return entradaCompleta(idioma) ?? ES
}

/**
 * ¿El idioma tiene TODAS las claves?
 *
 * Lo usa el selector de idioma para no ofrecer un idioma a medio traducir. Un
 * idioma incompleto se muestra pero marcado, en vez de llevar al visitante a una
 * pagina donde la mitad esta en otro idioma.
 */
export function idiomaCompleto(idioma: string): boolean {
  return entradaCompleta(idioma) !== undefined
}

/**
 * Rellena los huecos `{n}`, `{texto}` de una cadena del diccionario.
 *
 * El orden de una frase cambia de idioma a idioma, asi que el numero y el
 * nombre van DENTRO de la cadena y se sustituyen aqui. Con dos parametros se
 * hace en un bucle: no hace falta una funcion por clave.
 *
 * Un hueco sin valor no se toca: sale `{n}` en pantalla, que es visible y por
 * eso se arregla, en vez de salir un cero inventado.
 */
export function rellenar(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (hueco, clave) =>
    Object.hasOwn(valores, clave) ? String(valores[clave]) : hueco,
  )
}

/**
 * El idioma activo de la peticion actual.
 *
 * OJO CON ESTA FUNCION: Astro.url.pathname viene YA SIN el prefijo de idioma en
 * las rutas con `fallbackType: 'rewrite'`. En `/fr/productos`, `Astro.url` es
 * `/productos`, asi que esto devuelve `es` para una pagina francesa. Por eso en
 * los `.astro` se usa `Astro.currentLocale`, que si sabe de la peticion
 * original. Esta funcion se queda para los casos donde la URL que se tiene a
 * mano SI es la completa —como al construir enlaces desde el cliente—.
 */
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
 *
 * Se le pasa `Astro.url`, que en las rutas con fallback viene sin prefijo, y
 * por eso la funcion solo tiene que ANADIR el del idioma destino.
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
