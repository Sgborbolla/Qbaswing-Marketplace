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

  /* --- Portada (index.astro) --- */
  inicio: {
    lanzamiento: 'LANZAMIENTO OFICIAL 2026',
    comisionFisicos: '{n}% COMISIÓN EN FÍSICOS Y PROPIOS',
    tasaFija: '{n}% TASA FIJA EN DIGITALES EXTERNOS',
    tituloHero: 'El marketplace creativo y tecnológico de Cuba, con reglas de comisión',
    tituloHeroDestacado: 'publicadas',
    heroParrafo:
      'Comercializa o adquiere software, plantillas profesionales, artesanía y productos físicos en Cuba y el mundo. Las tres reglas de comisión están escritas antes que el catálogo, y no cambian sin que el Owner lo decida y quede registrado.',
    explorarCatalogo: 'Explorar el catálogo',
    abrirTienda: 'Abrir mi tienda',
    activacionInmediata: 'Activación inmediata',
    sinTarjetas: 'Sin tarjetas foráneas',
    descargaCompra: 'Descarga solo de lo que compraste',
    economiaClara: 'Economía clara',
    reglasTitulo: 'Las 3 Reglas de Oro de QBASwing',
    reglasIntro:
      'Tres reglas, escritas antes que el catálogo. Cada producto del marketplace pertenece a una de ellas, y de ahí sale su comisión. No hay una cuarta regla ni una comisión que se aplique "según el caso".',
    reglaATitulo: 'Regla A: digitales externos',
    reglaA: 'Regla A',
    paraAutor: '{n}% para el autor',
    reglaANombre: 'Digitales externos',
    reglaALista1: 'El pago pasa por la plataforma',
    reglaALista2: 'Se publica tras aprobación del Owner',
    sinLimite: 'Sin límite de publicaciones',
    reglaBTitulo: 'Regla B: digitales propios',
    reglaB: 'Regla B',
    deComision: 'de comisión',
    reglaBNombre: 'Digitales propios',
    reglaBLista1: 'Publicación directa, sin esperar aprobación',
    reglaCTitulo: 'Regla C: productos físicos',
    reglaC: 'Regla C',
    paraVendedor: '{n}% para el vendedor',
    reglaCNombre: 'Productos físicos',
    reglaCLista1: 'Publicación directa',
    reglaCLista2: 'Paquete de 60 días por categoría',
    reglaCLista3: 'Los espacios se reutilizan al vender',
    paraQuienEs: 'Para quién es',
    quePuedesHacer: 'Qué puedes hacer aquí',
    quePuedesIntro:
      'Seis cosas que el marketplace permite hacer con las reglas que están publicadas. Ninguna es una promesa: es lo que el sistema hace cuando alguien publica, alguien compra y alguien cobra.',
    verFaq: 'Ver las preguntas frecuentes',
    usoSoftwareTitulo: 'Publica tu software y paga el 5%',
    usoSoftware:
      'Plugins, plantillas, UI kits y fuentes de autores externos. Pagas el 5% por transacción procesada y te llevas el 95%. Sin límite de publicaciones y sin pagar un paquete.',
    usoRopaTitulo: 'Vende ropa, calzado y productos físicos',
    usoRopa:
      'Cero comisión por venta. Pagas un paquete de 60 días por categoría, y cuando vendes, el espacio queda libre para subir lo siguiente sin pagar nada más.',
    usoCobroTitulo: 'Cobra en CUP, USD o cripto',
    usoCobro:
      'Cada producto tiene su precio en la moneda que elijas. En la Regla A el pago pasa por la plataforma, que es lo que hace cumplible el 5%.',
    usoEntregaTitulo: 'Entrega digital con enlace de 5 minutos',
    usoEntrega:
      'Quien compró puede volver a bajar su archivo desde su cuenta mientras la licencia siga vigente. El enlace por correo dura 5 minutos: no es una dirección permanente del archivo.',
    usoTiendaTitulo: 'Abre tu tienda sin tarjeta',
    usoTienda:
      'No hace falta tarjeta bancaria de ningún país para registrarte ni para publicar. Ningún paso del alta la pide.',
    usoDescargaTitulo: 'Solo descarga quien compró',
    usoDescarga:
      'La descarga se valida contra tu cuenta, no contra un enlace que se pueda reenviar. Si no compraste, no hay enlace que valga.',
    paquetesLabel: 'Publicar en el catálogo',
    paquetesTitulo: 'Paquetes de espacios físicos',
    paquetesIntro: 'Un paquete no limita cuántas ventas haces: limita cuántos productos tienes',
    paquetesIntroFuerte: 'publicados a la vez',
    /* OJO: empieza con coma porque en el HTML cuelga directamente de
       `</strong>` en la misma linea. */
    paquetesIntroResto:
      ', y dura 60 días. Cada vez que vendes uno, el espacio vuelve a quedar libre y subes otro sin pagar nada más.',
    paquetesError: 'No se pudieron cargar los precios de los paquetes en este momento.',
    paquetesErrorAyuda: 'Vuelve a cargar la página. Si sigue igual, escríbenos por Telegram.',
    espacio: 'espacio',
    espacios: 'espacios',
    dias: 'días',
    verPaquete: 'Ver el paquete',
    cicloTitulo: 'Cómo funciona el ciclo del espacio',
    ciclo1Titulo: 'Publicas tu producto',
    ciclo1Texto: 'Ocupa 1 de tus espacios activos durante los 60 días del paquete.',
    ciclo2Titulo: 'Se vende',
    ciclo2Texto:
      'El comprador paga en la moneda del producto. QBASwing no descuenta comisión en la Regla C.',
    ciclo3Titulo: 'El espacio vuelve a quedar libre',
    ciclo3Texto:
      'Subes lo siguiente de inmediato. No hay que pagar otro paquete mientras el vigente no expire.',
    destacadosLabel: 'Del catálogo',
    verCatalogo: 'Ver todo el catálogo',
    catalogoVacio:
      'El catálogo está vacío porque nadie ha publicado todavía, no porque algo falle. El primer producto que se publique aparecerá aquí.',
    sinDestacados:
      'No hay productos destacados en este momento. El catálogo completo sí tiene.',
    publicarPrimero: 'Publicar el primero',
    explora: 'Explora',
    cierreTitulo: 'Abre tu tienda o',
    cierreDestacado: 'adquiere lo mejor del talento cubano',
    cierreTexto:
      'Las comisiones están publicadas, los espacios se reutilizan y no hace falta ninguna tarjeta extranjera. Lo único que no hay todavía son productos: el catálogo empieza contigo.',
    crearVendedor: 'Crear cuenta de vendedor',
    explorarSinRegistro: 'Explorar sin registrarse',
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

  /* --- Paginas de productos: listado y ficha --- */
  productos: {
    sinProductos: 'Aún no hay productos publicados.',
    totalUno: '{n} producto en total.',
    totalVarios: '{n} productos en total.',
    buscar: 'Buscar',
    placeholderBusqueda: 'Buscar por título o descripción...',
    todas: 'Todas',
    todos: 'Todos',
    digital: 'Digital',
    fisico: 'Físico',
    servicio: 'Servicio',
    ordenar: 'Ordenar',
    masRecientes: 'Más recientes',
    precioMenorAMayor: 'Precio: menor a mayor',
    precioMayorAMenor: 'Precio: mayor a menor',
    filtrar: 'Filtrar',
    errorCatalogo:
      'No se pudo cargar el catálogo en este momento. Inténtalo de nuevo más tarde.',
    vacioAyuda: 'El catálogo está vacío. El primer producto que se publique aparecerá aquí.',
    publicarPrimero: 'Publicar el primero',
    paginasCatalogo: 'Paginas del catalogo',
    /* "Pagina {n} de {m}" se pinta con las palabras sueltas porque los dos
       numeros llevan <span> de resaltado que no se puede tocar. */
    pagina: 'Pagina',
    de: 'de',
  },

  ficha: {
    errorTitulo: 'No se pudo mostrar este producto',
    errorCarga: 'Error al cargar el producto',
    noEncontrado: 'Producto no encontrado',
    noEncontradoTexto: 'El producto que buscaste no existe o no está publicado.',
    faltaIdentificador: 'Falta el identificador del producto.',
    cargaFallida: 'No se pudo cargar el producto.',
    volverCatalogo: 'Volver al catálogo',
    destacado: 'Destacado',
    anadirCarrito: 'Añadir al carrito',
    verVendedor: 'Ver vendedor',
    comoPagar: 'Cómo pagar',
    avisoPago:
      'Los pagos se confirman a mano. Comprueba que has escrito bien el número o la dirección antes de enviar, y guarda el comprobante.',
    publicado: 'Publicado',
    actualizado: 'Actualizado',
  },

  /* --- Como vender (vender.astro) --- */
  vender: {
    metaDescripcion: 'Como vender tus productos en QBASwing Marketplace.',
    titulo: 'Vender aqui',
    subtitulo: 'Que se necesita, en el orden en que se necesita.',
    paso1Titulo: 'Crea tu cuenta',
    paso1Texto:
      'Correo y contrasena. Con eso ya tienes cuenta y un espacio propio para empezar a preparar tu tienda.',
    paso2Titulo: 'Cuenta con el Owner',
    paso2Texto:
      'Se revisa quien eres y que vendes. Es una conversacion, no un formulario automatico. Es el paso unico que no se puede automatizar.',
    paso3Titulo: 'Publicas tus productos',
    paso3Texto:
      'Digitales, fisicos o servicios. Tu tienda tiene su propia pagina y sus ventas se registran solas.',
    paso4Titulo: 'Te llega el dinero',
    paso4Texto:
      'Cuando el comprador recibe lo que compro. El pago pasa por la plataforma y la parte del vendedor se entrega despues de la entrega verificada.',
    espaciosTitulo: 'Espacios para tu tienda',
    espaciosSubtitulo: 'Cada paquete mete tu tienda en mas sitios del marketplace.',
    espaciosError: 'No se pudieron cargar los precios de los paquetes.',
    espaciosVacio:
      'Todavia no hay paquetes de espacios a la venta. Cuando los haya, estan aqui con su precio.',
    espacio: 'espacio',
    espacios: 'espacios',
    durante: 'durante',
    dias: 'dias',
    pesos: 'Pesos',
    dolares: 'Dolares',
    euros: 'Euros',
    sinPrecio: 'Todavia no tiene precio asignado.',
    leerTerminos: 'Leer los terminos',
  },

  /* --- Pagina publica de un vendedor (vendedor.astro) --- */
  vendedor: {
    errorTitulo: 'No se pudo mostrar este vendedor',
    noEncontrado: 'Vendedor no encontrado',
    noEncontradoTexto: 'Este vendedor no existe o no tiene productos visibles.',
    sinDescripcion: 'Este vendedor aún no tiene descripción.',
    producto: 'producto',
    productos: 'productos',
    verificado: 'Verificado',
    sinProductos: 'Este vendedor todavía no tiene productos visibles.',
    faltaIdentificador: 'Falta el identificador del vendedor.',
    cargaFallida: 'No se pudo cargar el vendedor.',
  },

  /* --- Espacios y paquetes (espacios.astro) --- */
  espacios: {
    intro:
      'Un paquete no limita cuántas ventas haces: limita cuántos productos tienes publicados a la vez, dura 60 días y los espacios se reutilizan al vender.',
    errorCarga: 'No se pudieron cargar los paquetes en este momento.',
    vacio: 'Aún no hay paquetes configurados.',
    espacio: 'espacio',
    espacios: 'espacios',
    dias: 'días',
  },

  /* --- Carrito y checkout --- */
  carrito: {
    titulo: 'Carrito',
    vacio: 'Tu carrito está vacío',
    descripcion: 'Lo que has anadido en QBASwing Marketplace.',
    sinBackend:
      'Este sitio todavia no tiene servidor configurado, asi que el carrito no puede funcionar. Intentalo mas tarde.',
    cargando: 'Cargando tu carrito...',
    tituloVacio: 'Tu carrito esta vacio',
    vacioAyuda: 'Puedes anadir productos sin crear cuenta. Se guardan en este navegador.',
    verProductos: 'Ver productos',
    antesDePagar: 'Antes de pagar',
    retiradoUno: '{n} producto ya no disponible. Quitalos para poder pagar.',
    retiradoVarios: '{n} productos ya no disponibles. Quitalos para poder pagar.',
    precioCambiado: 'El precio cambio desde que lo anadiste. Revisa las lineas marcadas.',
    variante: 'Variante: {variante}',
    vendidoPor: 'Vendido por {vendedor}',
    noDisponible: 'Este producto ya no esta disponible.',
    antesAhora: 'Antes {precio}. Ahora ',
    seCobra: '. Se cobra el nuevo.',
    lineaPrecio: '{cantidad} x {precio}',
    quitarUnidad: 'Quitar una unidad de {titulo}',
    anadirUnidad: 'Anadir una unidad de {titulo}',
    quitar: 'Quitar',
    totalUno: '{n} producto en {moneda}',
    totalVarios: '{n} productos en {moneda}',
    comisionPendiente:
      'La comision de la plataforma todavia no se anade: no hay pasarela de pago conectada.',
    irAPagar: 'Ir a pagar',
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

  /* --- Exito al pagar (success.astro) --- */
  exito: {
    titulo: 'Pago recibido',
    descripcion: 'Confirmacion de pago en QBASwing Marketplace.',
    sinBackendTitulo: 'El pago se recibio, pero no se puede confirmar todavia',
    sinBackendTexto:
      'La pasarela de pago todavia no esta conectada a este sitio. Tu pago no se ha perdido: queda registrado en la pasarela y se acreditara cuando la integracion este activa.',
    volverInicio: 'Volver al inicio',
    confirmando: 'Confirmando tu pago',
    compraDisponible: 'Tu compra ya esta disponible en tu biblioteca.',
    espera: 'Esto toma unos segundos. No cierres esta ventana.',
    referencia: 'Referencia: {ref}',
    verificando: 'Verificando el pago con la pasarela',
    biblioteca: 'Ir a mi biblioteca',
  },

  /* --- Pago cancelado (cancel.astro) --- */
  fallo: {
    titulo: 'Pago cancelado',
    descripcion: 'El pago no se completo en QBASwing Marketplace.',
    noSeCompleto: 'El pago no se completó',
    motivoSaldo: 'Tu cuenta en la pasarela no tiene saldo suficiente para completar el pago.',
    motivoRechazo: 'La pasarela rechazó la operación. No se realizó ningún cargo.',
    motivoTimeout: 'La operación tardó demasiado y se canceló para proteger tu dinero.',
    motivoUsuario: 'Cancelaste el pago antes de completarlo.',
    motivoCambio: 'El tipo de cambio no estaba disponible en el momento del intento.',
    sinMotivo: 'El pago no se completó.',
    referencia: 'Referencia: {ref}',
    avisoCarrera:
      'Si ya habías completado el pago en tu banco o en la pasarela y ves esto, puede ser un retraso en la confirmación. Revisá tu cuenta en unos minutos antes de volver a intentar: no se te cobrará dos veces.',
    intentarDeNuevo: 'Intentar de nuevo',
    volverCatalogo: 'Volver al catálogo',
    necesitasAyuda: '¿Necesitás ayuda?',
    escribinos: 'Escribinos',
  },

  /* --- Registro (registro.astro) --- */
  registro: {
    descripcion: 'Crea tu cuenta en QBASwing Marketplace.',
    subtitulo: 'Tu correo y tu contrasena. Nada mas.',
    sinBackend:
      'Este sitio todavia no tiene servidor configurado, asi que no se puede crear una cuenta. Intentalo mas tarde.',
    ayudaContrasena:
      'Al menos 8 caracteres. No puede ser solo espacios ni contener tu correo.',
    creandoCuenta: 'Creando cuenta...',
    rellenaTresCampos: 'Rellena los tres campos.',
    yaTienesCuenta: 'Ya tienes cuenta?',
    entraAqui: 'Entra aqui',
    sinJavaScript:
      'Para crear una cuenta hace falta JavaScript: el sitio es estatico y no tiene servidor donde mandar el formulario. Activalo y vuelve a cargar esta pagina.',
  },

  /* --- Iniciar sesion (iniciar-sesion.astro) --- */
  entrar: {
    titulo: 'Entrar',
    descripcion: 'Entra en tu cuenta de QBASwing Marketplace.',
    subtitulo: 'Con el correo con el que te registraste.',
    sinBackend:
      'Este sitio todavia no tiene servidor configurado, asi que no se puede entrar. Intentalo mas tarde.',
    sinCuentaPregunta: 'No tienes cuenta?',
    crearAqui: 'Crear una aqui',
    escribeCorreoContrasena: 'Escribe tu correo y tu contrasena.',
    entrando: 'Entrando...',
    sinJavaScript:
      'Para entrar hace falta JavaScript: el sitio es estatico y no tiene servidor donde mandar el formulario. Activalo y vuelve a cargar esta pagina.',
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
    descripcion: 'Tu cuenta en QBASwing Marketplace.',
    registrado: 'Lo que tienes aqui, tal cual esta registrado.',
    /* Etiquetas de campos y textos del ojo de "ver contrasena" de las paginas
       de registro y de entrada. Sin tilde: asi estan escritas en las paginas. */
    campoCorreo: 'Correo',
    campoContrasena: 'Contrasena',
    mostrarContrasena: 'Mostrar contrasena',
    ocultarContrasena: 'Ocultar contrasena',
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
    miPanel: 'Mi panel',
    descripcion: 'Tu panel de vendedor en QBASwing Marketplace.',
    resumen: 'Tu tienda, tu porcentaje y tus sesiones.',
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
    administracion: 'Administracion',
    descripcion: 'Administracion de QBASwing Marketplace.',
    permiso: 'Tu cuenta y lo que tienes permiso sobre el sitio.',
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

  /* --- Nosotros (nosotros.astro) --- */
  nosotros: {
    titulo: 'Acerca de nosotros',
    intro:
      'QBASwing Marketplace es una plataforma para comprar y vender productos digitales, físicos y servicios, con las reglas de comisión publicadas antes que el catálogo.',
    mision: 'Misión',
    misionTexto:
      'Ofrecer un espacio donde el autor sabe qué porcentaje retiene la plataforma, dónde se publican las reglas y dónde nada cambia sin quedar registrado.',
    principios: 'Principios',
    principiosTexto:
      'Reglas escritas, no cambiantes. Estados vacíos reales, no ejemplos inventados. La descarga solo para quien compró, con enlace que caduca a los 5 minutos.',
    tresReglas: 'Las tres reglas que guían este proyecto',
    reglasTexto:
      'En la Regla A, los productos digitales de autores externos pasan por la plataforma y QBASwing retiene el 5%, dejando el 95% para el autor. En la Regla B, los productos digitales propios no tienen comisión. En la Regla C, los productos físicos no tienen comisión y utilizan el sistema de paquetes de 60 días, con espacios que se reutilizan al vender.',
    garantias:
      'Este sitio no ofrece garantías que no estén escritas. Todo lo que se publica como promesa está, también, escrito en estas páginas.',
  },

  /* --- Contacto (contacto.astro) --- */
  contacto: {
    titulo: 'Contacto',
    intro:
      'Si tienes una pregunta sobre compras, ventas o sobre cómo funcionan las reglas, puedes escribirnos a través de los canales que aparecen en el pie de página.',
    comoContactar: 'Cómo contactar',
    gestion:
      'Los datos de contacto se gestionan desde el panel del Owner. Mientras no estén configurados, esta sección queda vacía intencionalmente, sin poner datos de ejemplo.',
    verFaq: 'Ver preguntas frecuentes',
    aviso: 'No solicitamos datos bancarios por correo. Nunca pedimos contraseñas.',
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

  /* --- Terminos y condiciones (terminos.astro) --- */
  terminos: {
    titulo: 'Términos y condiciones',
    ultimaActualizacion: 'Última actualización:',
    aceptacion: '1. Aceptación de los términos',
    aceptacionTexto:
      'Al usar QBASwing Marketplace aceptas estos términos. Si no estás de acuerdo, no uses la plataforma.',
    reglasComision: '2. Reglas de comisión',
    reglasComisionTexto:
      'Las tres Reglas de Oro son públicas: Regla A (digitales externos): 5% para QBASwing, 95% para el autor. Regla B (digitales propios): 0% de comisión. Regla C (productos físicos): 0% de comisión, con paquete de 60 días y espacios reutilizables.',
    comprasDescargas: '3. Compras y descargas',
    comprasDescargasTexto:
      'Solo quien ha comprado un producto digital puede descargarlo. El enlace de descarga enviado por correo electrónico caduca a los 5 minutos y no es una dirección pública permanente. Las licencias son las que indica el vendedor para ese producto.',
    publicacionModeracion: '4. Publicación y moderación',
    publicacionModeracionTexto:
      'Los productos sujetos a la Regla A se publican tras aprobación del Owner. Los productos de las Reglas B y C pueden publicarse según el estado de sus espacios. El Owner puede retirar un producto que incumpla lo declarado en su ficha.',
    pagos: '5. Pagos',
    pagosTexto:
      'Los pagos se procesan a través de las pasarelas declaradas. La plataforma no custodia fondos del comprador cuando no es necesario para el reparto. Las liquidaciones a vendedores siguen el ciclo definido en el panel.',
    responsabilidad: '6. Responsabilidad',
    responsabilidadTexto:
      'QBASwing Marketplace no es responsable del contenido publicado por vendedores, pero se reserva el derecho a moderarlo. No se ofrecen garantías implícitas que no estén expresamente escritas aquí.',
  },

  /* --- Politica de privacidad (privacidad.astro) --- */
  privacidad: {
    titulo: 'Política de privacidad',
    ultimaActualizacion: 'Última actualización:',
    queRecopilamos: '1. Datos que recopilamos',
    queRecopilamosTexto:
      'Solo recopilamos lo necesario para el funcionamiento: datos de cuenta (nombre y correo electrónico), información necesaria para procesar compras y los registros mínimos para prevenir abusos.',
    usoDatos: '2. Uso de los datos',
    usoDatosTexto:
      'Usamos tus datos únicamente para prestar el servicio: autenticar, entregar lo que compraste, enviar notificaciones relacionadas con tu compra o con tu cuenta, y cumplir con lo que exigen las pasarelas de pago.',
    cookies: '3. Cookies',
    cookiesTexto:
      'Usamos cookies estrictamente necesarias. La cookie de identidad del Owner está firmada con HMAC y no se guarda información sensible en el navegador.',
    comparticion: '4. Compartición de datos',
    comparticionTexto:
      'No vendemos ni alquilamos tus datos. Solo los compartimos con las pasarelas de pago cuando es necesario para completar una transacción, y siempre con el mínimo necesario.',
    seguridad: '5. Seguridad',
    seguridadTexto:
      'Los enlaces de descarga son opacos, caducan a los 5 minutos y se validan contra tu cuenta. No exponemos rutas públicas para archivos comprados.',
    derechos: '6. Tus derechos',
    derechosTexto:
      'Puedes solicitar acceso, corrección o eliminación de tus datos relacionados con tu cuenta, siempre que no interfieran con registros necesarios para transacciones ya completadas.',
  },

  /* --- Preguntas frecuentes (faq.astro) --- */
  faq: {
    subtitulo: 'Respuestas claras, sin promesas inventadas.',
    error: 'No se pudieron cargar las preguntas frecuentes.',
    sinPreguntas: 'Aún no hay preguntas frecuentes publicadas.',
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
