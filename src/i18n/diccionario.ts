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

const EN: Diccionario = {
  nav: {
    productos: 'Products',
    espacios: 'Spaces',
    vender: 'Sell',
    carrito: 'Cart',
    cuenta: 'My account',
    panel: 'Seller panel',
    owner: 'Administration',
    buscar: 'Search products',
    menu: 'Menu',
    cerrar: 'Close',
    irInicio: 'QBASwing Marketplace, go to home',
    principal: 'Main navigation',
    entrar: 'Sign in to my account',
    carritoCompras: 'Shopping cart',
  },
  vacio: {
    sinProductos: 'No products published yet',
    sinProductosAyuda:
      'As soon as sellers publish, their products will appear here. Several of them are already preparing their catalog.',
    sinVentas: 'You have no sales yet',
    sinVentasAyuda:
      'When someone buys one of your products, the details and the download link will appear here.',
    sinCarrito: 'Your cart is empty',
    sinCarritoAyuda: 'Add products from the catalog to start a purchase.',
    sinPagos: 'No payments waiting for confirmation',
    sinPagosAyuda:
      'WhatsApp payments sent by buyers will appear here for you to confirm.',
    sinOrdenes: 'You have no purchases yet',
    sinOrdenesAyuda: 'Your purchases and download links will be here.',
    sinResultados: 'No product matches that search',
    sinResultadosAyuda: 'Try fewer words or remove the filters.',
    sinLiquidaciones: 'No pending payouts',
    sinLiquidacionesAyuda:
      'When what is owed to you accumulates, it will appear here to collect.',
  },
  error: {
    titulo: 'We could not load this',
    conexion:
      'Could not reach the server. It may be your connection or the backend may not be deployed yet.',
    vacio: 'The server response came back empty.',
    reintentar: 'Retry',
    endpoint: 'Endpoint queried',
  },
  regla: {
    A: 'Third-party software',
    B: 'Own content',
    C: 'Crafts and products',
    comisionA: '5% for QBASwing, 95% for the author.',
    comisionB: '0% commission. The author keeps 100%.',
    comisionC: '0% commission on the sale.',
    titulo: 'Golden Rules',
  },
  inicio: {
    lanzamiento: 'OFFICIAL LAUNCH 2026',
    comisionFisicos: '{n}% COMMISSION ON PHYSICAL AND OWN PRODUCTS',
    tasaFija: '{n}% FLAT RATE ON EXTERNAL DIGITAL GOODS',
    tituloHero: 'The creative and technological marketplace of Cuba, with commission rules',
    tituloHeroDestacado: 'published',
    heroParrafo:
      'Sell or buy software, professional templates, crafts and physical products in Cuba and the world. The three commission rules are written before the catalog, and they do not change unless the Owner decides so and it is recorded.',
    explorarCatalogo: 'Explore the catalog',
    abrirTienda: 'Open my store',
    activacionInmediata: 'Immediate activation',
    sinTarjetas: 'No foreign cards',
    descargaCompra: 'Download only what you bought',
    economiaClara: 'Clear economy',
    reglasTitulo: 'The 3 Golden Rules of QBASwing',
    reglasIntro:
      'Three rules, written before the catalog. Every product in the marketplace belongs to one of them, and its commission comes from there. There is no fourth rule nor a commission applied "depending on the case".',
    reglaATitulo: 'Rule A: external digital goods',
    reglaA: 'Rule A',
    paraAutor: '{n}% for the author',
    reglaANombre: 'External digital goods',
    reglaALista1: 'The payment goes through the platform',
    reglaALista2: 'Published after Owner approval',
    sinLimite: 'No limit on publications',
    reglaBTitulo: 'Rule B: own digital goods',
    reglaB: 'Rule B',
    deComision: 'commission',
    reglaBNombre: 'Own digital goods',
    reglaBLista1: 'Direct publishing, no waiting for approval',
    reglaCTitulo: 'Rule C: physical products',
    reglaC: 'Rule C',
    paraVendedor: '{n}% for the seller',
    reglaCNombre: 'Physical products',
    reglaCLista1: 'Direct publishing',
    reglaCLista2: '60-day package per category',
    reglaCLista3: 'Spaces are reused when you sell',
    paraQuienEs: 'Who it is for',
    quePuedesHacer: 'What you can do here',
    quePuedesIntro:
      'Six things the marketplace lets you do with the published rules. None is a promise: it is what the system does when someone publishes, someone buys and someone gets paid.',
    verFaq: 'See the frequently asked questions',
    usoSoftwareTitulo: 'Publish your software and pay 5%',
    usoSoftware:
      'Plugins, templates, UI kits and fonts from external authors. You pay 5% per processed transaction and keep 95%. No limit on publications and no package to pay.',
    usoRopaTitulo: 'Sell clothing, footwear and physical products',
    usoRopa:
      'Zero commission per sale. You pay a 60-day package per category, and when you sell, the space is freed to upload the next one without paying anything more.',
    usoCobroTitulo: 'Get paid in CUP, USD or crypto',
    usoCobro:
      'Each product has its price in the currency you choose. In Rule A the payment goes through the platform, which is what makes the 5% enforceable.',
    usoEntregaTitulo: 'Digital delivery with a 5-minute link',
    usoEntrega:
      'Whoever bought can download their file again from their account while the license is valid. The email link lasts 5 minutes: it is not a permanent address of the file.',
    usoTiendaTitulo: 'Open your store without a card',
    usoTienda:
      'No bank card from any country is needed to register or to publish. No step of the sign-up asks for one.',
    usoDescargaTitulo: 'Only the buyer can download',
    usoDescarga:
      'The download is validated against your account, not against a link that can be forwarded. If you did not buy, no link will work.',
    paquetesLabel: 'Publish in the catalog',
    paquetesTitulo: 'Physical space packages',
    paquetesIntro:
      'A package does not limit how many sales you make: it limits how many products you have',
    paquetesIntroFuerte: 'published at the same time',
    paquetesIntroResto:
      ', and it lasts 60 days. Every time you sell one, the space becomes free again and you upload another without paying anything more.',
    paquetesError: 'The package prices could not be loaded right now.',
    paquetesErrorAyuda: 'Reload the page. If it stays the same, write to us on Telegram.',
    espacio: 'space',
    espacios: 'spaces',
    dias: 'days',
    verPaquete: 'See the package',
    cicloTitulo: 'How the space cycle works',
    ciclo1Titulo: 'You publish your product',
    ciclo1Texto: 'It takes 1 of your active spaces during the 60 days of the package.',
    ciclo2Titulo: 'It sells',
    ciclo2Texto:
      'The buyer pays in the product currency. QBASwing does not deduct commission in Rule C.',
    ciclo3Titulo: 'The space becomes free again',
    ciclo3Texto:
      'You upload the next one immediately. You do not need to pay another package while the current one has not expired.',
    destacadosLabel: 'From the catalog',
    verCatalogo: 'See the whole catalog',
    catalogoVacio:
      'The catalog is empty because nobody has published yet, not because something is failing. The first product published will appear here.',
    sinDestacados: 'There are no featured products right now. The full catalog does have.',
    publicarPrimero: 'Publish the first one',
    explora: 'Explore',
    cierreTitulo: 'Open your store or',
    cierreDestacado: 'acquire the best of Cuban talent',
    cierreTexto:
      'The commissions are published, spaces are reused and no foreign card is needed. The only thing missing is products: the catalog starts with you.',
    crearVendedor: 'Create a seller account',
    explorarSinRegistro: 'Explore without registering',
  },
  producto: {
    comprar: 'Buy',
    agregar: 'Add to cart',
    agregado: 'Added',
    precio: 'Price',
    gratis: 'Free',
    vendedor: 'Seller',
    categoria: 'Category',
    descripcion: 'Description',
    detalles: 'Details',
    plataforma: 'Platform',
    licencia: 'License',
    archivo: 'File',
    tamano: 'Size',
    versiones: 'Versions',
    desde: 'From',
    opiniones: 'Reviews',
    sinDescripcion: 'The seller did not add a description to this product.',
    filtros: 'Filters',
    limpiar: 'Clear filters',
    ordenar: 'Sort by',
    resultados: 'results',
    noEncontrado: 'That product does not exist or is no longer available',
  },
  productos: {
    sinProductos: 'No products published yet.',
    totalUno: '{n} product in total.',
    totalVarios: '{n} products in total.',
    buscar: 'Search',
    placeholderBusqueda: 'Search by title or description...',
    todas: 'All',
    todos: 'All',
    digital: 'Digital',
    fisico: 'Physical',
    servicio: 'Service',
    ordenar: 'Sort',
    masRecientes: 'Most recent',
    precioMenorAMayor: 'Price: low to high',
    precioMayorAMenor: 'Price: high to low',
    filtrar: 'Filter',
    errorCatalogo: 'The catalog could not be loaded right now. Try again later.',
    vacioAyuda: 'The catalog is empty. The first product published will appear here.',
    publicarPrimero: 'Publish the first one',
    paginasCatalogo: 'Catalog pages',
    pagina: 'Page',
    de: 'of',
  },
  ficha: {
    errorTitulo: 'This product could not be shown',
    errorCarga: 'Error loading the product',
    noEncontrado: 'Product not found',
    noEncontradoTexto: 'The product you searched for does not exist or is not published.',
    faltaIdentificador: 'The product identifier is missing.',
    cargaFallida: 'The product could not be loaded.',
    volverCatalogo: 'Back to the catalog',
    destacado: 'Featured',
    anadirCarrito: 'Add to cart',
    verVendedor: 'See seller',
    comoPagar: 'How to pay',
    avisoPago:
      'Payments are confirmed by hand. Check that you wrote the number or address correctly before sending, and keep the receipt.',
    publicado: 'Published',
    actualizado: 'Updated',
  },
  vender: {
    metaDescripcion: 'How to sell your products on QBASwing Marketplace.',
    titulo: 'Sell here',
    subtitulo: 'What is needed, in the order it is needed.',
    paso1Titulo: 'Create your account',
    paso1Texto:
      'Email and password. With that you already have an account and your own space to start preparing your store.',
    paso2Titulo: 'Talk with the Owner',
    paso2Texto:
      'It is reviewed who you are and what you sell. It is a conversation, not an automatic form. It is the only step that cannot be automated.',
    paso3Titulo: 'You publish your products',
    paso3Texto:
      'Digital, physical or services. Your store has its own page and its sales are recorded on their own.',
    paso4Titulo: 'The money reaches you',
    paso4Texto:
      'When the buyer receives what they bought. The payment goes through the platform and the seller share is delivered after verified delivery.',
    espaciosTitulo: 'Spaces for your store',
    espaciosSubtitulo: 'Each package puts your store in more places of the marketplace.',
    espaciosError: 'The package prices could not be loaded.',
    espaciosVacio:
      'There are no space packages for sale yet. When there are, they are here with their price.',
    espacio: 'space',
    espacios: 'spaces',
    durante: 'for',
    dias: 'days',
    pesos: 'Pesos',
    dolares: 'Dollars',
    euros: 'Euros',
    sinPrecio: 'It has no price assigned yet.',
    leerTerminos: 'Read the terms',
  },
  vendedor: {
    errorTitulo: 'This seller could not be shown',
    noEncontrado: 'Seller not found',
    noEncontradoTexto: 'This seller does not exist or has no visible products.',
    sinDescripcion: 'This seller has no description yet.',
    producto: 'product',
    productos: 'products',
    verificado: 'Verified',
    sinProductos: 'This seller has no visible products yet.',
    faltaIdentificador: 'The seller identifier is missing.',
    cargaFallida: 'The seller could not be loaded.',
  },
  espacios: {
    intro:
      'A package does not limit how many sales you make: it limits how many products you have published at the same time, lasts 60 days and the spaces are reused when you sell.',
    errorCarga: 'The packages could not be loaded right now.',
    vacio: 'No packages configured yet.',
    espacio: 'space',
    espacios: 'spaces',
    dias: 'days',
  },
  carrito: {
    titulo: 'Cart',
    vacio: 'Your cart is empty',
    descripcion: 'What you added on QBASwing Marketplace.',
    sinBackend:
      'This site does not have a server configured yet, so the cart cannot work. Try again later.',
    cargando: 'Loading your cart...',
    tituloVacio: 'Your cart is empty',
    vacioAyuda: 'You can add products without creating an account. They are saved in this browser.',
    verProductos: 'See products',
    antesDePagar: 'Before paying',
    retiradoUno: '{n} product is no longer available. Remove them to be able to pay.',
    retiradoVarios: '{n} products are no longer available. Remove them to be able to pay.',
    precioCambiado: 'The price changed since you added it. Check the marked lines.',
    variante: 'Variant: {variante}',
    vendidoPor: 'Sold by {vendedor}',
    noDisponible: 'This product is no longer available.',
    antesAhora: 'Before {precio}. Now ',
    seCobra: '. The new one is charged.',
    lineaPrecio: '{cantidad} x {precio}',
    quitarUnidad: 'Remove one unit of {titulo}',
    anadirUnidad: 'Add one unit of {titulo}',
    quitar: 'Remove',
    totalUno: '{n} product in {moneda}',
    totalVarios: '{n} products in {moneda}',
    comisionPendiente:
      'The platform commission is not added yet: there is no payment gateway connected.',
    irAPagar: 'Go to pay',
    subtotal: 'Subtotal',
    comision: 'QBASwing commission',
    total: 'Total',
    checkout: 'Go to payment',
    seguir: 'Keep shopping',
    vaciar: 'Empty cart',
    unidades: 'units',
  },
  pago: {
    titulo: 'Choose how to pay',
    pasarela: 'Gateway',
    confirmar: 'Confirm payment',
    procesando: 'Processing the payment...',
    esperando: 'Waiting for confirmation',
    revisionManual:
      'This payment is confirmed by a person. We will notify you by email as soon as it is processed.',
    rechazado: 'The payment could not be completed',
    pendiente: 'Payment pending',
    verificado: 'Payment confirmed',
    reembolsado: 'Refunded',
    tiempoWebhook: 'Confirmed automatically',
    tiempoSondeo: 'Takes a few minutes',
    tiempoManual: 'Confirmed by a person',
  },
  exito: {
    titulo: 'Payment received',
    descripcion: 'Payment confirmation on QBASwing Marketplace.',
    sinBackendTitulo: 'The payment was received, but it cannot be confirmed yet',
    sinBackendTexto:
      'The payment gateway is not connected to this site yet. Your payment is not lost: it is recorded in the gateway and will be credited when the integration is active.',
    volverInicio: 'Back to home',
    confirmando: 'Confirming your payment',
    compraDisponible: 'Your purchase is now available in your library.',
    espera: 'This takes a few seconds. Do not close this window.',
    referencia: 'Reference: {ref}',
    verificando: 'Verifying the payment with the gateway',
    biblioteca: 'Go to my library',
  },
  fallo: {
    titulo: 'Payment cancelled',
    descripcion: 'The payment was not completed on QBASwing Marketplace.',
    noSeCompleto: 'The payment was not completed',
    motivoSaldo: 'Your account on the gateway does not have enough balance to complete the payment.',
    motivoRechazo: 'The gateway rejected the operation. No charge was made.',
    motivoTimeout: 'The operation took too long and was cancelled to protect your money.',
    motivoUsuario: 'You cancelled the payment before completing it.',
    motivoCambio: 'The exchange rate was not available at the time of the attempt.',
    sinMotivo: 'The payment was not completed.',
    referencia: 'Reference: {ref}',
    avisoCarrera:
      'If you had already completed the payment at your bank or on the gateway and you see this, it may be a confirmation delay. Check your account in a few minutes before trying again: you will not be charged twice.',
    intentarDeNuevo: 'Try again',
    volverCatalogo: 'Back to the catalog',
    necesitasAyuda: 'Need help?',
    escribinos: 'Write to us',
  },
  registro: {
    descripcion: 'Create your account on QBASwing Marketplace.',
    subtitulo: 'Your email and your password. Nothing else.',
    sinBackend:
      'This site does not have a server configured yet, so an account cannot be created. Try again later.',
    ayudaContrasena: 'At least 8 characters. It cannot be only spaces or contain your email.',
    creandoCuenta: 'Creating account...',
    rellenaTresCampos: 'Fill in the three fields.',
    yaTienesCuenta: 'Already have an account?',
    entraAqui: 'Sign in here',
    sinJavaScript:
      'Creating an account requires JavaScript: the site is static and has no server to send the form to. Enable it and reload this page.',
  },
  entrar: {
    titulo: 'Sign in',
    descripcion: 'Sign in to your QBASwing Marketplace account.',
    subtitulo: 'With the email you registered with.',
    sinBackend:
      'This site does not have a server configured yet, so you cannot sign in. Try again later.',
    sinCuentaPregunta: 'No account?',
    crearAqui: 'Create one here',
    escribeCorreoContrasena: 'Write your email and your password.',
    entrando: 'Signing in...',
    sinJavaScript:
      'Signing in requires JavaScript: the site is static and has no server to send the form to. Enable it and reload this page.',
  },
  cuenta: {
    entrar: 'Sign in',
    registro: 'Create account',
    salir: 'Sign out',
    correo: 'Email',
    contrasena: 'Password',
    nombre: 'Name',
    recordar: 'Remember me',
    sinCuenta: 'No account',
    conCuenta: 'Already have an account',
    crear: 'Create my account',
    miCuenta: 'My account',
    biblioteca: 'My purchases',
    perfil: 'My profile',
    descripcion: 'Your account on QBASwing Marketplace.',
    registrado: 'What you have here, exactly as it is recorded.',
    campoCorreo: 'Email',
    campoContrasena: 'Password',
    mostrarContrasena: 'Show password',
    ocultarContrasena: 'Hide password',
    salirTitulo: 'Sign out of your account',
    salirTexto:
      'You will have to sign in again with your email and password. This session closes here, not on the other devices where you have the account open.',
    mantenerSesion: 'Keep session',
    salirCorto: 'Sign out',
    saliendo: 'Signing out...',
  },
  panel: {
    titulo: 'Seller panel',
    miPanel: 'My panel',
    descripcion: 'Your seller panel on QBASwing Marketplace.',
    resumen: 'Your store, your percentage and your sessions.',
    productos: 'Products',
    ventas: 'Sales',
    espacios: 'Spaces',
    nuevoProducto: 'Publish product',
    editarProducto: 'Edit product',
    slotsUsados: 'Used slots',
    slotsLibres: 'Free slots',
    slotsTotales: 'Package slots',
    sinPaquete: 'You do not have an active space package',
    sinPaqueteAyuda: 'Buy a package to be able to publish products.',
    bruto: 'Gross',
    comision: 'Commission',
    neto: 'Net',
    porCobrar: 'To collect',
  },
  owner: {
    titulo: 'Administration',
    administracion: 'Administration',
    descripcion: 'Administration of QBASwing Marketplace.',
    permiso: 'Your account and what you have permission over on the site.',
    resumen: 'Summary',
    ingresos: 'Revenue',
    pagosPendientes: 'Payments to confirm',
    liquidaciones: 'Payouts',
    configuracion: 'Settings',
    catalogo: 'Catalog',
    usuarios: 'Users',
    exenciones: 'Exemptions',
    confirmar: 'Confirm payment',
    rechazar: 'Reject',
    evidencia: 'Evidence',
    evidenciaAyuda:
      'Note what you saw so it can be audited later. Without this, the payment cannot be confirmed.',
    confirmarAviso:
      'Confirm only if you saw the receipt. This action is recorded with your name.',
    cobrar: 'Mark as collected',
    porVendedor: 'By seller',
    exentoComision: 'Commission exempt',
    slotsIlimitados: 'Unlimited slots',
    alcance: 'Scope',
  },
  perfil: {
    misProductos: 'Products',
    metodosCobro: 'Payment methods',
    metodosCobroAyuda: 'Each seller publishes their own. The buyer pays you directly.',
    redes: 'Social networks',
    ubicacion: 'Location',
    provincia: 'Province',
    municipio: 'Municipality',
    direccion: 'Address',
    contacto: 'Contact',
    whatsapp: 'WhatsApp',
    telefono: 'Phone',
    sitioWeb: 'Website',
    desde: 'Seller since',
    propietario: 'Owner',
    agregarMetodo: 'Add payment method',
    redPlataforma: 'Platform',
    redUsuario: 'User',
    mostrar: 'Show on my profile',
  },
  nosotros: {
    titulo: 'About us',
    intro:
      'QBASwing Marketplace is a platform to buy and sell digital, physical products and services, with the commission rules published before the catalog.',
    mision: 'Mission',
    misionTexto:
      'To offer a space where the author knows what percentage the platform keeps, where the rules are published and where nothing changes without being recorded.',
    principios: 'Principles',
    principiosTexto:
      'Written rules, not changing ones. Real empty states, not invented examples. Download only for the buyer, with a link that expires after 5 minutes.',
    tresReglas: 'The three rules that guide this project',
    reglasTexto:
      'In Rule A, digital products from external authors go through the platform and QBASwing keeps 5%, leaving 95% for the author. In Rule B, own digital products have no commission. In Rule C, physical products have no commission and use the 60-day package system, with spaces that are reused when you sell.',
    garantias:
      'This site does not offer guarantees that are not written. Everything published as a promise is also written on these pages.',
  },
  contacto: {
    titulo: 'Contact',
    intro:
      'If you have a question about purchases, sales or how the rules work, you can write to us through the channels that appear in the footer.',
    comoContactar: 'How to contact',
    gestion:
      'Contact details are managed from the Owner panel. While they are not configured, this section stays empty on purpose, without putting sample data.',
    verFaq: 'See frequently asked questions',
    aviso: 'We do not request bank details by email. We never ask for passwords.',
  },
  form: {
    titulo: 'Publish a product',
    nombreProducto: 'Product name',
    tipo: 'Type',
    resumen: 'Short summary',
    descripcionLarga: 'Full description',
    precio: 'Price',
    moneda: 'Currency',
    categorias: 'Categories',
    imagenes: 'Images',
    archivo: 'Product file',
    publicar: 'Publish',
    guardarBorrador: 'Save as draft',
    obligatorio: 'This field is required',
    demasiadoCorto: 'It is too short to be useful',
    precioInvalido: 'The price must be greater than zero',
    rutaEntrega: 'How it will be delivered',
    rutaKv: 'It is stored in QBASwing. The buyer downloads it from the site.',
    rutaFraccionado: 'The file is large. It is delivered whole, split inside.',
    rutaExterno:
      'The file is very large. You put your own link and share it with the buyer.',
    ventajaRuta: 'Advantage',
  },
  footer: {
    descripcion:
      'Marketplace of software, templates, digital products and crafts from Cuba and the world.',
    colMarketplace: 'Marketplace',
    colComprar: 'Buy',
    colVender: 'Sell',
    colPlataforma: 'Platform',
    enProductos: 'Products',
    enDestacados: 'Featured',
    enEspacios: 'Spaces and packages',
    enCarrito: 'Cart',
    enPagar: 'Checkout',
    enDescargas: 'My downloads',
    enFaq: 'Frequently asked questions',
    enPanel: 'Seller panel',
    enSubir: 'Upload product',
    enOwner: 'Owner console',
    enCrearCuenta: 'Create account',
    enContacto: 'Contact',
    enNosotros: 'About us',
    enTerminos: 'Terms',
    enPrivacidad: 'Privacy',
    regla: 'Rule',
    comisionA: '{n}% for QBASwing',
    comisionBC: '{n}% commission',
    sinContacto:
      'The Owner has not published contact details yet. Write via Telegram or WhatsApp from the buttons above.',
    patrocinadoPor: 'Sponsored by',
    disenadoPor: 'Designed by',
    derechos: 'All rights reserved',
    descargo:
      'QBASwing Marketplace is not a financial institution and does not hold funds. In Rule A the payment goes through the gateway and the platform keeps the 5% set by the rule; in Rules B and C the payment goes directly to the author and the platform does not intervene. Digital product download links last 5 minutes and only work for the buyer. Digital products from external authors are published after the Owner approves them.',
  },
  terminos: {
    titulo: 'Terms and conditions',
    ultimaActualizacion: 'Last updated:',
    aceptacion: '1. Acceptance of the terms',
    aceptacionTexto:
      'By using QBASwing Marketplace you accept these terms. If you do not agree, do not use the platform.',
    reglasComision: '2. Commission rules',
    reglasComisionTexto:
      'The three Golden Rules are public: Rule A (external digital): 5% for QBASwing, 95% for the author. Rule B (own digital): 0% commission. Rule C (physical products): 0% commission, with a 60-day package and reusable spaces.',
    comprasDescargas: '3. Purchases and downloads',
    comprasDescargasTexto:
      'Only whoever has bought a digital product can download it. The download link sent by email expires after 5 minutes and is not a permanent public address. The licenses are the ones the seller indicates for that product.',
    publicacionModeracion: '4. Publishing and moderation',
    publicacionModeracionTexto:
      'Products subject to Rule A are published after Owner approval. Products of Rules B and C can be published according to the state of their spaces. The Owner can withdraw a product that breaches what was declared on its page.',
    pagos: '5. Payments',
    pagosTexto:
      'Payments are processed through the declared gateways. The platform does not hold buyer funds when it is not necessary for the distribution. Payouts to sellers follow the cycle defined in the panel.',
    responsabilidad: '6. Liability',
    responsabilidadTexto:
      'QBASwing Marketplace is not responsible for the content published by sellers, but reserves the right to moderate it. No implicit guarantees are offered that are not expressly written here.',
  },
  privacidad: {
    titulo: 'Privacy policy',
    ultimaActualizacion: 'Last updated:',
    queRecopilamos: '1. Data we collect',
    queRecopilamosTexto:
      'We only collect what is necessary for operation: account data (name and email), information needed to process purchases and the minimum records to prevent abuse.',
    usoDatos: '2. Use of the data',
    usoDatosTexto:
      'We use your data only to provide the service: authenticate, deliver what you bought, send notifications related to your purchase or your account, and comply with what the payment gateways require.',
    cookies: '3. Cookies',
    cookiesTexto:
      'We use strictly necessary cookies. The Owner identity cookie is signed with HMAC and no sensitive information is stored in the browser.',
    comparticion: '4. Data sharing',
    comparticionTexto:
      'We do not sell or rent your data. We only share it with the payment gateways when it is necessary to complete a transaction, and always with the bare minimum.',
    seguridad: '5. Security',
    seguridadTexto:
      'Download links are opaque, expire after 5 minutes and are validated against your account. We do not expose public paths for purchased files.',
    derechos: '6. Your rights',
    derechosTexto:
      'You can request access, correction or deletion of your data related to your account, as long as they do not interfere with records needed for already completed transactions.',
  },
  faq: {
    subtitulo: 'Clear answers, no invented promises.',
    error: 'The frequently asked questions could not be loaded.',
    sinPreguntas: 'There are no published frequently asked questions yet.',
  },
  idioma: {
    titulo: 'Language',
    actual: 'Current language',
    cambiar: 'Change language',
    conservaPagina: 'Keeps the current page',
    guardado: 'We save your preference for the next visit.',
    sinTraducir: 'Not translated yet',
  },
  comun: {
    saltarContenido: 'Skip to content',
    volver: 'Back',
    siguiente: 'Next',
    anterior: 'Previous',
    cerrar: 'Close',
    guardar: 'Save',
    cancelar: 'Cancel',
    confirmar: 'Confirm',
    cargando: 'Loading...',
    noDisponible: 'Not available yet',
    nuevo: 'New',
    verTodo: 'See all',
    paginaNoEncontrada: 'Page not found',
    paginaNoEncontradaTexto:
      'The address you opened does not exist. The link may be misspelled or the page may have moved.',
    volverInicio: 'Go to home',
  },
}

const PT: Diccionario = {
  nav: {
    productos: 'Produtos',
    espacios: 'Espaços',
    vender: 'Vender',
    carrito: 'Carrinho',
    cuenta: 'Minha conta',
    panel: 'Painel do vendedor',
    owner: 'Administração',
    buscar: 'Buscar produtos',
    menu: 'Menu',
    cerrar: 'Fechar',
    irInicio: 'QBASwing Marketplace, ir para o início',
    principal: 'Navegação principal',
    entrar: 'Entrar na minha conta',
    carritoCompras: 'Carrinho de compras',
  },
  vacio: {
    sinProductos: 'Ainda não há produtos publicados',
    sinProductosAyuda:
      'Assim que os vendedores publicarem, seus produtos aparecerão aqui. Vários deles já estão preparando seu catálogo.',
    sinVentas: 'Você ainda não tem vendas',
    sinVentasAyuda:
      'Quando alguém comprar um dos seus produtos, aparecerão aqui os detalhes e o link de download.',
    sinCarrito: 'Seu carrinho está vazio',
    sinCarritoAyuda: 'Adicione produtos do catálogo para iniciar uma compra.',
    sinPagos: 'Nenhum pagamento aguardando confirmação',
    sinPagosAyuda:
      'Os pagamentos por WhatsApp enviados pelos compradores aparecerão aqui para você confirmar.',
    sinOrdenes: 'Você ainda não tem compras',
    sinOrdenesAyuda: 'Suas compras e os links de download estarão aqui.',
    sinResultados: 'Nenhum produto corresponde a essa busca',
    sinResultadosAyuda: 'Tente com menos palavras ou remova os filtros.',
    sinLiquidaciones: 'Não há repasses pendentes',
    sinLiquidacionesAyuda:
      'Quando se acumular o que é seu, aparecerá aqui para receber.',
  },
  error: {
    titulo: 'Não conseguimos carregar isto',
    conexion:
      'Não foi possível contatar o servidor. Pode ser sua conexão ou que o backend ainda não esteja implantado.',
    vacio: 'A resposta do servidor chegou vazia.',
    reintentar: 'Tentar novamente',
    endpoint: 'Endpoint consultado',
  },
  regla: {
    A: 'Software de terceiros',
    B: 'Conteúdo próprio',
    C: 'Artesanato e produtos',
    comisionA: '5% para o QBASwing, 95% para o autor.',
    comisionB: '0% de comissão. O autor fica com 100%.',
    comisionC: '0% de comissão sobre a venda.',
    titulo: 'Regras de Ouro',
  },
  inicio: {
    lanzamiento: 'LANÇAMENTO OFICIAL 2026',
    comisionFisicos: '{n}% DE COMISSÃO EM FÍSICOS E PRÓPRIOS',
    tasaFija: '{n}% DE TAXA FIXA EM DIGITAIS EXTERNOS',
    tituloHero: 'O marketplace criativo e tecnológico de Cuba, com regras de comissão',
    tituloHeroDestacado: 'publicadas',
    heroParrafo:
      'Comercialize ou adquira software, templates profissionais, artesanato e produtos físicos em Cuba e no mundo. As três regras de comissão estão escritas antes do catálogo, e não mudam sem que o Owner decida e fique registrado.',
    explorarCatalogo: 'Explorar o catálogo',
    abrirTienda: 'Abrir minha loja',
    activacionInmediata: 'Ativação imediata',
    sinTarjetas: 'Sem cartões estrangeiros',
    descargaCompra: 'Download apenas do que você comprou',
    economiaClara: 'Economia clara',
    reglasTitulo: 'As 3 Regras de Ouro do QBASwing',
    reglasIntro:
      'Três regras, escritas antes do catálogo. Cada produto do marketplace pertence a uma delas, e daí vem a sua comissão. Não há uma quarta regra nem uma comissão aplicada "conforme o caso".',
    reglaATitulo: 'Regra A: digitais externos',
    reglaA: 'Regra A',
    paraAutor: '{n}% para o autor',
    reglaANombre: 'Digitais externos',
    reglaALista1: 'O pagamento passa pela plataforma',
    reglaALista2: 'Publicado após aprovação do Owner',
    sinLimite: 'Sem limite de publicações',
    reglaBTitulo: 'Regra B: digitais próprios',
    reglaB: 'Regra B',
    deComision: 'de comissão',
    reglaBNombre: 'Digitais próprios',
    reglaBLista1: 'Publicação direta, sem esperar aprovação',
    reglaCTitulo: 'Regra C: produtos físicos',
    reglaC: 'Regra C',
    paraVendedor: '{n}% para o vendedor',
    reglaCNombre: 'Produtos físicos',
    reglaCLista1: 'Publicação direta',
    reglaCLista2: 'Pacote de 60 dias por categoria',
    reglaCLista3: 'Os espaços são reutilizados ao vender',
    paraQuienEs: 'Para quem é',
    quePuedesHacer: 'O que você pode fazer aqui',
    quePuedesIntro:
      'Seis coisas que o marketplace permite fazer com as regras publicadas. Nenhuma é uma promessa: é o que o sistema faz quando alguém publica, alguém compra e alguém recebe.',
    verFaq: 'Ver as perguntas frequentes',
    usoSoftwareTitulo: 'Publique seu software e pague 5%',
    usoSoftware:
      'Plugins, templates, UI kits e fontes de autores externos. Você paga 5% por transação processada e fica com 95%. Sem limite de publicações e sem pagar pacote.',
    usoRopaTitulo: 'Venda roupas, calçados e produtos físicos',
    usoRopa:
      'Zero comissão por venda. Você paga um pacote de 60 dias por categoria, e quando vende, o espaço fica livre para subir o próximo sem pagar nada a mais.',
    usoCobroTitulo: 'Receba em CUP, USD ou cripto',
    usoCobro:
      'Cada produto tem seu preço na moeda que você escolher. Na Regra A o pagamento passa pela plataforma, que é o que torna os 5% exigíveis.',
    usoEntregaTitulo: 'Entrega digital com link de 5 minutos',
    usoEntrega:
      'Quem comprou pode baixar o arquivo novamente pela sua conta enquanto a licença estiver válida. O link por e-mail dura 5 minutos: não é um endereço permanente do arquivo.',
    usoTiendaTitulo: 'Abra sua loja sem cartão',
    usoTienda:
      'Não é preciso cartão bancário de nenhum país para se registrar nem para publicar. Nenhum passo do cadastro pede um.',
    usoDescargaTitulo: 'Só baixa quem comprou',
    usoDescarga:
      'O download é validado contra a sua conta, não contra um link que possa ser reenviado. Se você não comprou, nenhum link funciona.',
    paquetesLabel: 'Publicar no catálogo',
    paquetesTitulo: 'Pacotes de espaços físicos',
    paquetesIntro:
      'Um pacote não limita quantas vendas você faz: limita quantos produtos você tem',
    paquetesIntroFuerte: 'publicados ao mesmo tempo',
    paquetesIntroResto:
      ', e dura 60 dias. Cada vez que você vende um, o espaço fica livre novamente e você sobe outro sem pagar nada a mais.',
    paquetesError: 'Não foi possível carregar os preços dos pacotes no momento.',
    paquetesErrorAyuda: 'Recarregue a página. Se continuar igual, escreva para nós no Telegram.',
    espacio: 'espaço',
    espacios: 'espaços',
    dias: 'dias',
    verPaquete: 'Ver o pacote',
    cicloTitulo: 'Como funciona o ciclo do espaço',
    ciclo1Titulo: 'Você publica seu produto',
    ciclo1Texto: 'Ocupa 1 dos seus espaços ativos durante os 60 dias do pacote.',
    ciclo2Titulo: 'Ele vende',
    ciclo2Texto:
      'O comprador paga na moeda do produto. O QBASwing não desconta comissão na Regra C.',
    ciclo3Titulo: 'O espaço fica livre novamente',
    ciclo3Texto:
      'Você sobe o próximo imediatamente. Não é preciso pagar outro pacote enquanto o atual não expirar.',
    destacadosLabel: 'Do catálogo',
    verCatalogo: 'Ver todo o catálogo',
    catalogoVacio:
      'O catálogo está vazio porque ninguém publicou ainda, não porque algo falhou. O primeiro produto publicado aparecerá aqui.',
    sinDestacados: 'Não há produtos em destaque no momento. O catálogo completo tem.',
    publicarPrimero: 'Publicar o primeiro',
    explora: 'Explore',
    cierreTitulo: 'Abra sua loja ou',
    cierreDestacado: 'adquira o melhor do talento cubano',
    cierreTexto:
      'As comissões estão publicadas, os espaços são reutilizados e não é preciso nenhum cartão estrangeiro. A única coisa que ainda falta são produtos: o catálogo começa com você.',
    crearVendedor: 'Criar conta de vendedor',
    explorarSinRegistro: 'Explorar sem se registrar',
  },
  producto: {
    comprar: 'Comprar',
    agregar: 'Adicionar ao carrinho',
    agregado: 'Adicionado',
    precio: 'Preço',
    gratis: 'Grátis',
    vendedor: 'Vendedor',
    categoria: 'Categoria',
    descripcion: 'Descrição',
    detalles: 'Detalhes',
    plataforma: 'Plataforma',
    licencia: 'Licença',
    archivo: 'Arquivo',
    tamano: 'Tamanho',
    versiones: 'Versões',
    desde: 'Desde',
    opiniones: 'Avaliações',
    sinDescripcion: 'O vendedor não adicionou descrição a este produto.',
    filtros: 'Filtros',
    limpiar: 'Limpar filtros',
    ordenar: 'Ordenar por',
    resultados: 'resultados',
    noEncontrado: 'Esse produto não existe ou deixou de estar disponível',
  },
  productos: {
    sinProductos: 'Ainda não há produtos publicados.',
    totalUno: '{n} produto no total.',
    totalVarios: '{n} produtos no total.',
    buscar: 'Buscar',
    placeholderBusqueda: 'Buscar por título ou descrição...',
    todas: 'Todas',
    todos: 'Todos',
    digital: 'Digital',
    fisico: 'Físico',
    servicio: 'Serviço',
    ordenar: 'Ordenar',
    masRecientes: 'Mais recentes',
    precioMenorAMayor: 'Preço: menor para maior',
    precioMayorAMenor: 'Preço: maior para menor',
    filtrar: 'Filtrar',
    errorCatalogo: 'Não foi possível carregar o catálogo no momento. Tente novamente mais tarde.',
    vacioAyuda: 'O catálogo está vazio. O primeiro produto publicado aparecerá aqui.',
    publicarPrimero: 'Publicar o primeiro',
    paginasCatalogo: 'Páginas do catálogo',
    pagina: 'Página',
    de: 'de',
  },
  ficha: {
    errorTitulo: 'Não foi possível mostrar este produto',
    errorCarga: 'Erro ao carregar o produto',
    noEncontrado: 'Produto não encontrado',
    noEncontradoTexto: 'O produto que você buscou não existe ou não está publicado.',
    faltaIdentificador: 'Falta o identificador do produto.',
    cargaFallida: 'Não foi possível carregar o produto.',
    volverCatalogo: 'Voltar ao catálogo',
    destacado: 'Destaque',
    anadirCarrito: 'Adicionar ao carrinho',
    verVendedor: 'Ver vendedor',
    comoPagar: 'Como pagar',
    avisoPago:
      'Os pagamentos são confirmados manualmente. Verifique se escreveu corretamente o número ou o endereço antes de enviar, e guarde o comprovante.',
    publicado: 'Publicado',
    actualizado: 'Atualizado',
  },
  vender: {
    metaDescripcion: 'Como vender seus produtos no QBASwing Marketplace.',
    titulo: 'Vender aqui',
    subtitulo: 'O que é necessário, na ordem em que é necessário.',
    paso1Titulo: 'Crie sua conta',
    paso1Texto:
      'E-mail e senha. Com isso você já tem conta e um espaço próprio para começar a preparar sua loja.',
    paso2Titulo: 'Fale com o Owner',
    paso2Texto:
      'Revisa-se quem você é e o que vende. É uma conversa, não um formulário automático. É o único passo que não pode ser automatizado.',
    paso3Titulo: 'Você publica seus produtos',
    paso3Texto:
      'Digitais, físicos ou serviços. Sua loja tem sua própria página e suas vendas são registradas sozinhas.',
    paso4Titulo: 'O dinheiro chega para você',
    paso4Texto:
      'Quando o comprador recebe o que comprou. O pagamento passa pela plataforma e a parte do vendedor é entregue após a entrega verificada.',
    espaciosTitulo: 'Espaços para sua loja',
    espaciosSubtitulo: 'Cada pacote coloca sua loja em mais lugares do marketplace.',
    espaciosError: 'Não foi possível carregar os preços dos pacotes.',
    espaciosVacio:
      'Ainda não há pacotes de espaços à venda. Quando houver, estarão aqui com seu preço.',
    espacio: 'espaço',
    espacios: 'espaços',
    durante: 'durante',
    dias: 'dias',
    pesos: 'Pesos',
    dolares: 'Dólares',
    euros: 'Euros',
    sinPrecio: 'Ainda não tem preço atribuído.',
    leerTerminos: 'Ler os termos',
  },
  vendedor: {
    errorTitulo: 'Não foi possível mostrar este vendedor',
    noEncontrado: 'Vendedor não encontrado',
    noEncontradoTexto: 'Este vendedor não existe ou não tem produtos visíveis.',
    sinDescripcion: 'Este vendedor ainda não tem descrição.',
    producto: 'produto',
    productos: 'produtos',
    verificado: 'Verificado',
    sinProductos: 'Este vendedor ainda não tem produtos visíveis.',
    faltaIdentificador: 'Falta o identificador do vendedor.',
    cargaFallida: 'Não foi possível carregar o vendedor.',
  },
  espacios: {
    intro:
      'Um pacote não limita quantas vendas você faz: limita quantos produtos você tem publicados ao mesmo tempo, dura 60 dias e os espaços são reutilizados ao vender.',
    errorCarga: 'Não foi possível carregar os pacotes no momento.',
    vacio: 'Ainda não há pacotes configurados.',
    espacio: 'espaço',
    espacios: 'espaços',
    dias: 'dias',
  },
  carrito: {
    titulo: 'Carrinho',
    vacio: 'Seu carrinho está vazio',
    descripcion: 'O que você adicionou no QBASwing Marketplace.',
    sinBackend:
      'Este site ainda não tem servidor configurado, então o carrinho não pode funcionar. Tente mais tarde.',
    cargando: 'Carregando seu carrinho...',
    tituloVacio: 'Seu carrinho está vazio',
    vacioAyuda: 'Você pode adicionar produtos sem criar conta. Eles são salvos neste navegador.',
    verProductos: 'Ver produtos',
    antesDePagar: 'Antes de pagar',
    retiradoUno: '{n} produto não está mais disponível. Remova-o para poder pagar.',
    retiradoVarios: '{n} produtos não estão mais disponíveis. Remova-os para poder pagar.',
    precioCambiado: 'O preço mudou desde que você o adicionou. Verifique as linhas marcadas.',
    variante: 'Variante: {variante}',
    vendidoPor: 'Vendido por {vendedor}',
    noDisponible: 'Este produto não está mais disponível.',
    antesAhora: 'Antes {precio}. Agora ',
    seCobra: '. Cobra-se o novo.',
    lineaPrecio: '{cantidad} x {precio}',
    quitarUnidad: 'Remover uma unidade de {titulo}',
    anadirUnidad: 'Adicionar uma unidade de {titulo}',
    quitar: 'Remover',
    totalUno: '{n} produto em {moneda}',
    totalVarios: '{n} produtos em {moneda}',
    comisionPendiente:
      'A comissão da plataforma ainda não é adicionada: não há gateway de pagamento conectado.',
    irAPagar: 'Ir para pagar',
    subtotal: 'Subtotal',
    comision: 'Comissão do QBASwing',
    total: 'Total',
    checkout: 'Ir para o pagamento',
    seguir: 'Continuar comprando',
    vaciar: 'Esvaziar carrinho',
    unidades: 'unidades',
  },
  pago: {
    titulo: 'Escolher como pagar',
    pasarela: 'Gateway',
    confirmar: 'Confirmar pagamento',
    procesando: 'Processando o pagamento...',
    esperando: 'Aguardando confirmação',
    revisionManual:
      'Este pagamento é confirmado por uma pessoa. Avisaremos por e-mail assim que for processado.',
    rechazado: 'Não foi possível concluir o pagamento',
    pendiente: 'Pagamento pendente',
    verificado: 'Pagamento confirmado',
    reembolsado: 'Reembolsado',
    tiempoWebhook: 'Confirmado automaticamente',
    tiempoSondeo: 'Leva alguns minutos',
    tiempoManual: 'Confirmado por uma pessoa',
  },
  exito: {
    titulo: 'Pagamento recebido',
    descripcion: 'Confirmação de pagamento no QBASwing Marketplace.',
    sinBackendTitulo: 'O pagamento foi recebido, mas ainda não pode ser confirmado',
    sinBackendTexto:
      'O gateway de pagamento ainda não está conectado a este site. Seu pagamento não foi perdido: fica registrado no gateway e será creditado quando a integração estiver ativa.',
    volverInicio: 'Voltar ao início',
    confirmando: 'Confirmando seu pagamento',
    compraDisponible: 'Sua compra já está disponível na sua biblioteca.',
    espera: 'Isto leva alguns segundos. Não feche esta janela.',
    referencia: 'Referência: {ref}',
    verificando: 'Verificando o pagamento com o gateway',
    biblioteca: 'Ir para minha biblioteca',
  },
  fallo: {
    titulo: 'Pagamento cancelado',
    descripcion: 'O pagamento não foi concluído no QBASwing Marketplace.',
    noSeCompleto: 'O pagamento não foi concluído',
    motivoSaldo: 'Sua conta no gateway não tem saldo suficiente para concluir o pagamento.',
    motivoRechazo: 'O gateway recusou a operação. Nenhuma cobrança foi feita.',
    motivoTimeout: 'A operação demorou demais e foi cancelada para proteger seu dinheiro.',
    motivoUsuario: 'Você cancelou o pagamento antes de concluí-lo.',
    motivoCambio: 'A taxa de câmbio não estava disponível no momento da tentativa.',
    sinMotivo: 'O pagamento não foi concluído.',
    referencia: 'Referência: {ref}',
    avisoCarrera:
      'Se você já tinha concluído o pagamento no seu banco ou no gateway e vê isto, pode ser um atraso na confirmação. Verifique sua conta em alguns minutos antes de tentar novamente: não será cobrado duas vezes.',
    intentarDeNuevo: 'Tentar novamente',
    volverCatalogo: 'Voltar ao catálogo',
    necesitasAyuda: 'Precisa de ajuda?',
    escribinos: 'Escreva para nós',
  },
  registro: {
    descripcion: 'Crie sua conta no QBASwing Marketplace.',
    subtitulo: 'Seu e-mail e sua senha. Nada mais.',
    sinBackend:
      'Este site ainda não tem servidor configurado, então não é possível criar uma conta. Tente mais tarde.',
    ayudaContrasena: 'Pelo menos 8 caracteres. Não pode ser só espaços nem conter seu e-mail.',
    creandoCuenta: 'Criando conta...',
    rellenaTresCampos: 'Preencha os três campos.',
    yaTienesCuenta: 'Já tem conta?',
    entraAqui: 'Entre aqui',
    sinJavaScript:
      'Para criar uma conta é preciso JavaScript: o site é estático e não tem servidor para enviar o formulário. Ative-o e recarregue esta página.',
  },
  entrar: {
    titulo: 'Entrar',
    descripcion: 'Entre na sua conta do QBASwing Marketplace.',
    subtitulo: 'Com o e-mail com o qual você se registrou.',
    sinBackend:
      'Este site ainda não tem servidor configurado, então não é possível entrar. Tente mais tarde.',
    sinCuentaPregunta: 'Não tem conta?',
    crearAqui: 'Crie uma aqui',
    escribeCorreoContrasena: 'Escreva seu e-mail e sua senha.',
    entrando: 'Entrando...',
    sinJavaScript:
      'Para entrar é preciso JavaScript: o site é estático e não tem servidor para enviar o formulário. Ative-o e recarregue esta página.',
  },
  cuenta: {
    entrar: 'Entrar',
    registro: 'Criar conta',
    salir: 'Sair',
    correo: 'E-mail',
    contrasena: 'Senha',
    nombre: 'Nome',
    recordar: 'Lembrar de mim',
    sinCuenta: 'Não tem conta',
    conCuenta: 'Já tem conta',
    crear: 'Criar minha conta',
    miCuenta: 'Minha conta',
    biblioteca: 'Minhas compras',
    perfil: 'Meu perfil',
    descripcion: 'Sua conta no QBASwing Marketplace.',
    registrado: 'O que você tem aqui, exatamente como está registrado.',
    campoCorreo: 'E-mail',
    campoContrasena: 'Senha',
    mostrarContrasena: 'Mostrar senha',
    ocultarContrasena: 'Ocultar senha',
    salirTitulo: 'Sair da sua conta',
    salirTexto:
      'Você terá que entrar de novo com seu e-mail e sua senha. Esta sessão é encerrada aqui, não nos outros dispositivos onde você tem a conta aberta.',
    mantenerSesion: 'Manter sessão',
    salirCorto: 'Sair',
    saliendo: 'Saindo...',
  },
  panel: {
    titulo: 'Painel do vendedor',
    miPanel: 'Meu painel',
    descripcion: 'Seu painel de vendedor no QBASwing Marketplace.',
    resumen: 'Sua loja, sua porcentagem e suas sessões.',
    productos: 'Produtos',
    ventas: 'Vendas',
    espacios: 'Espaços',
    nuevoProducto: 'Publicar produto',
    editarProducto: 'Editar produto',
    slotsUsados: 'Slots usados',
    slotsLibres: 'Slots livres',
    slotsTotales: 'Slots do pacote',
    sinPaquete: 'Você não tem um pacote de espaços ativo',
    sinPaqueteAyuda: 'Compre um pacote para poder publicar produtos.',
    bruto: 'Bruto',
    comision: 'Comissão',
    neto: 'Líquido',
    porCobrar: 'A receber',
  },
  owner: {
    titulo: 'Administração',
    administracion: 'Administração',
    descripcion: 'Administração do QBASwing Marketplace.',
    permiso: 'Sua conta e o que você tem permissão sobre o site.',
    resumen: 'Resumo',
    ingresos: 'Receitas',
    pagosPendientes: 'Pagamentos a confirmar',
    liquidaciones: 'Repasses',
    configuracion: 'Configuração',
    catalogo: 'Catálogo',
    usuarios: 'Usuários',
    exenciones: 'Isenções',
    confirmar: 'Confirmar pagamento',
    rechazar: 'Recusar',
    evidencia: 'Evidência',
    evidenciaAyuda:
      'Anote o que você viu para poder auditá-lo depois. Sem isto, o pagamento não pode ser confirmado.',
    confirmarAviso:
      'Confirme apenas se você viu o comprovante. Esta ação fica registrada com o seu nome.',
    cobrar: 'Marcar como recebida',
    porVendedor: 'Por vendedor',
    exentoComision: 'Isento de comissão',
    slotsIlimitados: 'Slots ilimitados',
    alcance: 'Alcance',
  },
  perfil: {
    misProductos: 'Produtos',
    metodosCobro: 'Formas de pagamento',
    metodosCobroAyuda: 'Cada vendedor publica as suas. O comprador paga você diretamente.',
    redes: 'Redes sociais',
    ubicacion: 'Localização',
    provincia: 'Província',
    municipio: 'Município',
    direccion: 'Endereço',
    contacto: 'Contato',
    whatsapp: 'WhatsApp',
    telefono: 'Telefone',
    sitioWeb: 'Site',
    desde: 'Vendedor desde',
    propietario: 'Proprietário',
    agregarMetodo: 'Adicionar forma de pagamento',
    redPlataforma: 'Plataforma',
    redUsuario: 'Usuário',
    mostrar: 'Mostrar no meu perfil',
  },
  nosotros: {
    titulo: 'Sobre nós',
    intro:
      'O QBASwing Marketplace é uma plataforma para comprar e vender produtos digitais, físicos e serviços, com as regras de comissão publicadas antes do catálogo.',
    mision: 'Missão',
    misionTexto:
      'Oferecer um espaço onde o autor sabe qual porcentagem a plataforma retém, onde as regras são publicadas e onde nada muda sem ficar registrado.',
    principios: 'Princípios',
    principiosTexto:
      'Regras escritas, não mutáveis. Estados vazios reais, não exemplos inventados. O download só para quem comprou, com link que expira em 5 minutos.',
    tresReglas: 'As três regras que guiam este projeto',
    reglasTexto:
      'Na Regra A, os produtos digitais de autores externos passam pela plataforma e o QBASwing retém 5%, deixando 95% para o autor. Na Regra B, os produtos digitais próprios não têm comissão. Na Regra C, os produtos físicos não têm comissão e usam o sistema de pacotes de 60 dias, com espaços que são reutilizados ao vender.',
    garantias:
      'Este site não oferece garantias que não estejam escritas. Tudo o que é publicado como promessa está, também, escrito nestas páginas.',
  },
  contacto: {
    titulo: 'Contato',
    intro:
      'Se você tem uma dúvida sobre compras, vendas ou sobre como funcionam as regras, pode escrever para nós através dos canais que aparecem no rodapé.',
    comoContactar: 'Como entrar em contato',
    gestion:
      'Os dados de contato são gerenciados a partir do painel do Owner. Enquanto não estiverem configurados, esta seção fica vazia de propósito, sem colocar dados de exemplo.',
    verFaq: 'Ver perguntas frequentes',
    aviso: 'Não solicitamos dados bancários por e-mail. Nunca pedimos senhas.',
  },
  form: {
    titulo: 'Publicar um produto',
    nombreProducto: 'Nome do produto',
    tipo: 'Tipo',
    resumen: 'Resumo curto',
    descripcionLarga: 'Descrição completa',
    precio: 'Preço',
    moneda: 'Moeda',
    categorias: 'Categorias',
    imagenes: 'Imagens',
    archivo: 'Arquivo do produto',
    publicar: 'Publicar',
    guardarBorrador: 'Salvar como rascunho',
    obligatorio: 'Este campo é obrigatório',
    demasiadoCorto: 'É curto demais para ser útil',
    precioInvalido: 'O preço tem que ser maior que zero',
    rutaEntrega: 'Como será entregue',
    rutaKv: 'Fica guardado no QBASwing. O comprador baixa do site.',
    rutaFraccionado: 'O arquivo é grande. É entregue completo, dividido por dentro.',
    rutaExterno:
      'O arquivo é muito grande. Você coloca seu próprio link e o compartilha com o comprador.',
    ventajaRuta: 'Vantagem',
  },
  footer: {
    descripcion:
      'Marketplace de software, templates, produtos digitais e artesanato de Cuba e do mundo.',
    colMarketplace: 'Marketplace',
    colComprar: 'Comprar',
    colVender: 'Vender',
    colPlataforma: 'Plataforma',
    enProductos: 'Produtos',
    enDestacados: 'Destaques',
    enEspacios: 'Espaços e pacotes',
    enCarrito: 'Carrinho',
    enPagar: 'Ir ao caixa',
    enDescargas: 'Meus downloads',
    enFaq: 'Perguntas frequentes',
    enPanel: 'Painel do vendedor',
    enSubir: 'Subir produto',
    enOwner: 'Console do Owner',
    enCrearCuenta: 'Criar conta',
    enContacto: 'Contato',
    enNosotros: 'Sobre nós',
    enTerminos: 'Termos',
    enPrivacidad: 'Privacidade',
    regla: 'Regra',
    comisionA: '{n}% para o QBASwing',
    comisionBC: '{n}% de comissão',
    sinContacto:
      'O Owner ainda não publicou dados de contato. Escreva pelo Telegram ou WhatsApp nos botões acima.',
    patrocinadoPor: 'Patrocinado por',
    disenadoPor: 'Desenhado por',
    derechos: 'Todos os direitos reservados',
    descargo:
      'O QBASwing Marketplace não é uma instituição financeira e não custodia fundos. Na Regra A o pagamento passa pelo gateway e a plataforma retém os 5% que a regra fixa; nas Regras B e C o pagamento vai direto ao autor e a plataforma não intervém. Os links de download dos produtos digitais duram 5 minutos e só funcionam para quem comprou. Os produtos digitais de autores externos são publicados depois que o Owner os aprova.',
  },
  terminos: {
    titulo: 'Termos e condições',
    ultimaActualizacion: 'Última atualização:',
    aceptacion: '1. Aceitação dos termos',
    aceptacionTexto:
      'Ao usar o QBASwing Marketplace você aceita estes termos. Se não concorda, não use a plataforma.',
    reglasComision: '2. Regras de comissão',
    reglasComisionTexto:
      'As três Regras de Ouro são públicas: Regra A (digitais externos): 5% para o QBASwing, 95% para o autor. Regra B (digitais próprios): 0% de comissão. Regra C (produtos físicos): 0% de comissão, com pacote de 60 dias e espaços reutilizáveis.',
    comprasDescargas: '3. Compras e downloads',
    comprasDescargasTexto:
      'Só quem comprou um produto digital pode baixá-lo. O link de download enviado por e-mail expira em 5 minutos e não é um endereço público permanente. As licenças são as que o vendedor indica para esse produto.',
    publicacionModeracion: '4. Publicação e moderação',
    publicacionModeracionTexto:
      'Os produtos sujeitos à Regra A são publicados após aprovação do Owner. Os produtos das Regras B e C podem ser publicados conforme o estado dos seus espaços. O Owner pode retirar um produto que descumpra o que foi declarado na sua página.',
    pagos: '5. Pagamentos',
    pagosTexto:
      'Os pagamentos são processados através dos gateways declarados. A plataforma não custodia fundos do comprador quando não é necessário para a distribuição. Os repasses aos vendedores seguem o ciclo definido no painel.',
    responsabilidad: '6. Responsabilidade',
    responsabilidadTexto:
      'O QBASwing Marketplace não é responsável pelo conteúdo publicado pelos vendedores, mas reserva-se o direito de moderá-lo. Não se oferecem garantias implícitas que não estejam expressamente escritas aqui.',
  },
  privacidad: {
    titulo: 'Política de privacidade',
    ultimaActualizacion: 'Última atualização:',
    queRecopilamos: '1. Dados que coletamos',
    queRecopilamosTexto:
      'Coletamos apenas o necessário para o funcionamento: dados de conta (nome e e-mail), informações necessárias para processar compras e os registros mínimos para prevenir abusos.',
    usoDatos: '2. Uso dos dados',
    usoDatosTexto:
      'Usamos seus dados apenas para prestar o serviço: autenticar, entregar o que você comprou, enviar notificações relacionadas à sua compra ou à sua conta, e cumprir o que os gateways de pagamento exigem.',
    cookies: '3. Cookies',
    cookiesTexto:
      'Usamos cookies estritamente necessários. O cookie de identidade do Owner é assinado com HMAC e nenhuma informação sensível é guardada no navegador.',
    comparticion: '4. Compartilhamento de dados',
    comparticionTexto:
      'Não vendemos nem alugamos seus dados. Só os compartilhamos com os gateways de pagamento quando é necessário para concluir uma transação, e sempre com o mínimo necessário.',
    seguridad: '5. Segurança',
    seguridadTexto:
      'Os links de download são opacos, expiram em 5 minutos e são validados contra a sua conta. Não expomos caminhos públicos para arquivos comprados.',
    derechos: '6. Seus direitos',
    derechosTexto:
      'Você pode solicitar acesso, correção ou exclusão dos seus dados relacionados à sua conta, desde que não interfiram com registros necessários para transações já concluídas.',
  },
  faq: {
    subtitulo: 'Respostas claras, sem promessas inventadas.',
    error: 'Não foi possível carregar as perguntas frequentes.',
    sinPreguntas: 'Ainda não há perguntas frequentes publicadas.',
  },
  idioma: {
    titulo: 'Idioma',
    actual: 'Idioma atual',
    cambiar: 'Mudar idioma',
    conservaPagina: 'Mantém a página atual',
    guardado: 'Guardamos sua preferência para a próxima visita.',
    sinTraducir: 'Ainda sem tradução',
  },
  comun: {
    saltarContenido: 'Ir para o conteúdo',
    volver: 'Voltar',
    siguiente: 'Próximo',
    anterior: 'Anterior',
    cerrar: 'Fechar',
    guardar: 'Salvar',
    cancelar: 'Cancelar',
    confirmar: 'Confirmar',
    cargando: 'Carregando...',
    noDisponible: 'Ainda não disponível',
    nuevo: 'Novo',
    verTodo: 'Ver tudo',
    paginaNoEncontrada: 'Página não encontrada',
    paginaNoEncontradaTexto:
      'O endereço que você abriu não existe. O link pode estar escrito errado ou a página pode ter sido movida.',
    volverInicio: 'Ir para o início',
  },
}

const FR: Diccionario = {
  nav: {
    productos: 'Produits',
    espacios: 'Espaces',
    vender: 'Vendre',
    carrito: 'Panier',
    cuenta: 'Mon compte',
    panel: 'Espace vendeur',
    owner: 'Administration',
    buscar: 'Rechercher des produits',
    menu: 'Menu',
    cerrar: 'Fermer',
    irInicio: "QBASwing Marketplace, aller à l'accueil",
    principal: 'Navigation principale',
    entrar: 'Se connecter à mon compte',
    carritoCompras: "Panier d'achat",
  },
  vacio: {
    sinProductos: 'Aucun produit publié pour le moment',
    sinProductosAyuda:
      "Dès que les vendeurs publieront, leurs produits apparaîtront ici. Plusieurs d'entre eux préparent déjà leur catalogue.",
    sinVentas: "Vous n'avez pas encore de ventes",
    sinVentasAyuda:
      "Quand quelqu'un achètera l'un de vos produits, le détail et le lien de téléchargement apparaîtront ici.",
    sinCarrito: 'Votre panier est vide',
    sinCarritoAyuda: 'Ajoutez des produits du catalogue pour commencer un achat.',
    sinPagos: 'Aucun paiement en attente de confirmation',
    sinPagosAyuda:
      'Les paiements par WhatsApp envoyés par les acheteurs apparaîtront ici pour que vous les confirmiez.',
    sinOrdenes: "Vous n'avez pas encore d'achats",
    sinOrdenesAyuda: 'Vos achats et les liens de téléchargement seront ici.',
    sinResultados: 'Aucun produit ne correspond à cette recherche',
    sinResultadosAyuda: 'Essayez avec moins de mots ou retirez les filtres.',
    sinLiquidaciones: 'Aucun versement en attente',
    sinLiquidacionesAyuda:
      "Quand ce qui vous revient s'accumulera, cela apparaîtra ici pour être encaissé.",
  },
  error: {
    titulo: "Nous n'avons pas pu charger ceci",
    conexion:
      "Impossible de contacter le serveur. Cela peut venir de votre connexion ou du fait que le backend n'est pas encore déployé.",
    vacio: 'La réponse du serveur est arrivée vide.',
    reintentar: 'Réessayer',
    endpoint: 'Endpoint consulté',
  },
  regla: {
    A: 'Logiciels tiers',
    B: 'Contenu propre',
    C: 'Artisanat et produits',
    comisionA: "5% pour QBASwing, 95% pour l'auteur.",
    comisionB: "0% de commission. L'auteur garde 100%.",
    comisionC: '0% de commission sur la vente.',
    titulo: "Règles d'Or",
  },
  inicio: {
    lanzamiento: 'LANCEMENT OFFICIEL 2026',
    comisionFisicos: '{n}% DE COMMISSION SUR LES PHYSIQUES ET PROPRES',
    tasaFija: '{n}% DE TAUX FIXE SUR LES NUMÉRIQUES EXTERNES',
    tituloHero: 'Le marché créatif et technologique de Cuba, avec des règles de commission',
    tituloHeroDestacado: 'publiées',
    heroParrafo:
      "Vendez ou achetez des logiciels, des modèles professionnels, de l'artisanat et des produits physiques à Cuba et dans le monde. Les trois règles de commission sont écrites avant le catalogue, et elles ne changent pas sans que le Owner le décide et que cela soit enregistré.",
    explorarCatalogo: 'Explorer le catalogue',
    abrirTienda: 'Ouvrir ma boutique',
    activacionInmediata: 'Activation immédiate',
    sinTarjetas: 'Sans cartes étrangères',
    descargaCompra: 'Téléchargez seulement ce que vous avez acheté',
    economiaClara: 'Économie claire',
    reglasTitulo: "Les 3 Règles d'Or de QBASwing",
    reglasIntro:
      "Trois règles, écrites avant le catalogue. Chaque produit du marché appartient à l'une d'elles, et sa commission en découle. Il n'y a pas de quatrième règle ni de commission appliquée « selon le cas ».",
    reglaATitulo: 'Règle A : numériques externes',
    reglaA: 'Règle A',
    paraAutor: "{n}% pour l'auteur",
    reglaANombre: 'Numériques externes',
    reglaALista1: 'Le paiement passe par la plateforme',
    reglaALista2: 'Publié après approbation du Owner',
    sinLimite: 'Sans limite de publications',
    reglaBTitulo: 'Règle B : numériques propres',
    reglaB: 'Règle B',
    deComision: 'de commission',
    reglaBNombre: 'Numériques propres',
    reglaBLista1: "Publication directe, sans attendre d'approbation",
    reglaCTitulo: 'Règle C : produits physiques',
    reglaC: 'Règle C',
    paraVendedor: '{n}% pour le vendeur',
    reglaCNombre: 'Produits physiques',
    reglaCLista1: 'Publication directe',
    reglaCLista2: 'Forfait de 60 jours par catégorie',
    reglaCLista3: 'Les espaces sont réutilisés lors de la vente',
    paraQuienEs: "Pour qui c'est",
    quePuedesHacer: 'Ce que vous pouvez faire ici',
    quePuedesIntro:
      "Six choses que le marché permet de faire avec les règles publiées. Aucune n'est une promesse : c'est ce que le système fait quand quelqu'un publie, quelqu'un achète et quelqu'un encaisse.",
    verFaq: 'Voir les questions fréquentes',
    usoSoftwareTitulo: 'Publiez votre logiciel et payez 5%',
    usoSoftware:
      "Plugins, modèles, UI kits et polices d'auteurs externes. Vous payez 5% par transaction traitée et vous gardez 95%. Sans limite de publications et sans payer de forfait.",
    usoRopaTitulo: 'Vendez des vêtements, des chaussures et des produits physiques',
    usoRopa:
      "Zéro commission par vente. Vous payez un forfait de 60 jours par catégorie, et quand vous vendez, l'espace se libère pour publier le suivant sans rien payer de plus.",
    usoCobroTitulo: 'Encaissez en CUP, USD ou crypto',
    usoCobro:
      'Chaque produit a son prix dans la devise que vous choisissez. Dans la Règle A, le paiement passe par la plateforme, ce qui rend les 5% applicables.',
    usoEntregaTitulo: 'Livraison numérique avec un lien de 5 minutes',
    usoEntrega:
      "Celui qui a acheté peut retélécharger son fichier depuis son compte tant que la licence est valide. Le lien par e-mail dure 5 minutes : ce n'est pas une adresse permanente du fichier.",
    usoTiendaTitulo: 'Ouvrez votre boutique sans carte',
    usoTienda:
      "Aucune carte bancaire d'aucun pays n'est nécessaire pour s'inscrire ni pour publier. Aucune étape de l'inscription n'en demande.",
    usoDescargaTitulo: "Seul l'acheteur peut télécharger",
    usoDescarga:
      "Le téléchargement est validé contre votre compte, pas contre un lien qui peut être transféré. Si vous n'avez pas acheté, aucun lien ne fonctionne.",
    paquetesLabel: 'Publier dans le catalogue',
    paquetesTitulo: "Forfaits d'espaces physiques",
    paquetesIntro:
      'Un forfait ne limite pas le nombre de ventes : il limite le nombre de produits que vous avez',
    paquetesIntroFuerte: 'publiés en même temps',
    paquetesIntroResto:
      ", et il dure 60 jours. Chaque fois que vous en vendez un, l'espace se libère à nouveau et vous publiez un autre sans rien payer de plus.",
    paquetesError: "Les prix des forfaits n'ont pas pu être chargés pour le moment.",
    paquetesErrorAyuda: 'Rechargez la page. Si cela persiste, écrivez-nous sur Telegram.',
    espacio: 'espace',
    espacios: 'espaces',
    dias: 'jours',
    verPaquete: 'Voir le forfait',
    cicloTitulo: "Comment fonctionne le cycle de l'espace",
    ciclo1Titulo: 'Vous publiez votre produit',
    ciclo1Texto: "Il occupe 1 de vos espaces actifs pendant les 60 jours du forfait.",
    ciclo2Titulo: 'Il se vend',
    ciclo2Texto:
      "L'acheteur paie dans la devise du produit. QBASwing ne retient aucune commission dans la Règle C.",
    ciclo3Titulo: "L'espace se libère à nouveau",
    ciclo3Texto:
      "Vous publiez le suivant immédiatement. Vous n'avez pas à payer un autre forfait tant que le forfait en cours n'a pas expiré.",
    destacadosLabel: 'Du catalogue',
    verCatalogo: 'Voir tout le catalogue',
    catalogoVacio:
      "Le catalogue est vide parce que personne n'a encore publié, pas parce que quelque chose ne fonctionne pas. Le premier produit publié apparaîtra ici.",
    sinDestacados:
      "Il n'y a pas de produits en vedette pour le moment. Le catalogue complet, oui.",
    publicarPrimero: 'Publier le premier',
    explora: 'Explorez',
    cierreTitulo: 'Ouvrez votre boutique ou',
    cierreDestacado: 'acquérez le meilleur du talent cubain',
    cierreTexto:
      "Les commissions sont publiées, les espaces sont réutilisés et aucune carte étrangère n'est nécessaire. La seule chose qui manque encore, ce sont des produits : le catalogue commence avec vous.",
    crearVendedor: 'Créer un compte vendeur',
    explorarSinRegistro: "Explorer sans s'inscrire",
  },
  producto: {
    comprar: 'Acheter',
    agregar: 'Ajouter au panier',
    agregado: 'Ajouté',
    precio: 'Prix',
    gratis: 'Gratuit',
    vendedor: 'Vendeur',
    categoria: 'Catégorie',
    descripcion: 'Description',
    detalles: 'Détails',
    plataforma: 'Plateforme',
    licencia: 'Licence',
    archivo: 'Fichier',
    tamano: 'Taille',
    versiones: 'Versions',
    desde: 'Depuis',
    opiniones: 'Avis',
    sinDescripcion: "Le vendeur n'a pas ajouté de description à ce produit.",
    filtros: 'Filtres',
    limpiar: 'Effacer les filtres',
    ordenar: 'Trier par',
    resultados: 'résultats',
    noEncontrado: "Ce produit n'existe pas ou n'est plus disponible",
  },
  productos: {
    sinProductos: 'Aucun produit publié pour le moment.',
    totalUno: '{n} produit au total.',
    totalVarios: '{n} produits au total.',
    buscar: 'Rechercher',
    placeholderBusqueda: 'Rechercher par titre ou description...',
    todas: 'Toutes',
    todos: 'Tous',
    digital: 'Numérique',
    fisico: 'Physique',
    servicio: 'Service',
    ordenar: 'Trier',
    masRecientes: 'Plus récents',
    precioMenorAMayor: 'Prix : croissant',
    precioMayorAMenor: 'Prix : décroissant',
    filtrar: 'Filtrer',
    errorCatalogo: "Le catalogue n'a pas pu être chargé pour le moment. Réessayez plus tard.",
    vacioAyuda: 'Le catalogue est vide. Le premier produit publié apparaîtra ici.',
    publicarPrimero: 'Publier le premier',
    paginasCatalogo: 'Pages du catalogue',
    pagina: 'Page',
    de: 'sur',
  },
  ficha: {
    errorTitulo: "Ce produit n'a pas pu être affiché",
    errorCarga: 'Erreur lors du chargement du produit',
    noEncontrado: 'Produit introuvable',
    noEncontradoTexto: "Le produit que vous avez cherché n'existe pas ou n'est pas publié.",
    faltaIdentificador: "L'identifiant du produit est manquant.",
    cargaFallida: "Le produit n'a pas pu être chargé.",
    volverCatalogo: 'Retour au catalogue',
    destacado: 'En vedette',
    anadirCarrito: 'Ajouter au panier',
    verVendedor: 'Voir le vendeur',
    comoPagar: 'Comment payer',
    avisoPago:
      "Les paiements sont confirmés manuellement. Vérifiez que vous avez bien écrit le numéro ou l'adresse avant d'envoyer, et conservez le reçu.",
    publicado: 'Publié',
    actualizado: 'Mis à jour',
  },
  vender: {
    metaDescripcion: 'Comment vendre vos produits sur QBASwing Marketplace.',
    titulo: 'Vendre ici',
    subtitulo: "Ce qu'il faut, dans l'ordre où il faut.",
    paso1Titulo: 'Créez votre compte',
    paso1Texto:
      'E-mail et mot de passe. Avec cela, vous avez déjà un compte et un espace à vous pour commencer à préparer votre boutique.',
    paso2Titulo: 'Parlez avec le Owner',
    paso2Texto:
      "On vérifie qui vous êtes et ce que vous vendez. C'est une conversation, pas un formulaire automatique. C'est la seule étape qui ne peut pas être automatisée.",
    paso3Titulo: 'Vous publiez vos produits',
    paso3Texto:
      'Numériques, physiques ou services. Votre boutique a sa propre page et ses ventes s\'enregistrent seules.',
    paso4Titulo: "L'argent vous parvient",
    paso4Texto:
      "Quand l'acheteur reçoit ce qu'il a acheté. Le paiement passe par la plateforme et la part du vendeur est versée après la livraison vérifiée.",
    espaciosTitulo: 'Espaces pour votre boutique',
    espaciosSubtitulo:
      "Chaque forfait place votre boutique dans plus d'endroits du marché.",
    espaciosError: "Les prix des forfaits n'ont pas pu être chargés.",
    espaciosVacio:
      "Il n'y a pas encore de forfaits d'espaces en vente. Quand il y en aura, ils seront ici avec leur prix.",
    espacio: 'espace',
    espacios: 'espaces',
    durante: 'pendant',
    dias: 'jours',
    pesos: 'Pesos',
    dolares: 'Dollars',
    euros: 'Euros',
    sinPrecio: "Il n'a pas encore de prix attribué.",
    leerTerminos: 'Lire les conditions',
  },
  vendedor: {
    errorTitulo: "Ce vendeur n'a pas pu être affiché",
    noEncontrado: 'Vendeur introuvable',
    noEncontradoTexto: "Ce vendeur n'existe pas ou n'a pas de produits visibles.",
    sinDescripcion: "Ce vendeur n'a pas encore de description.",
    producto: 'produit',
    productos: 'produits',
    verificado: 'Vérifié',
    sinProductos: "Ce vendeur n'a pas encore de produits visibles.",
    faltaIdentificador: "L'identifiant du vendeur est manquant.",
    cargaFallida: "Le vendeur n'a pas pu être chargé.",
  },
  espacios: {
    intro:
      'Un forfait ne limite pas le nombre de ventes : il limite le nombre de produits que vous avez publiés en même temps, dure 60 jours et les espaces sont réutilisés lors de la vente.',
    errorCarga: "Les forfaits n'ont pas pu être chargés pour le moment.",
    vacio: 'Aucun forfait configuré pour le moment.',
    espacio: 'espace',
    espacios: 'espaces',
    dias: 'jours',
  },
  carrito: {
    titulo: 'Panier',
    vacio: 'Votre panier est vide',
    descripcion: 'Ce que vous avez ajouté sur QBASwing Marketplace.',
    sinBackend:
      "Ce site n'a pas encore de serveur configuré, donc le panier ne peut pas fonctionner. Réessayez plus tard.",
    cargando: 'Chargement de votre panier...',
    tituloVacio: 'Votre panier est vide',
    vacioAyuda:
      'Vous pouvez ajouter des produits sans créer de compte. Ils sont enregistrés dans ce navigateur.',
    verProductos: 'Voir les produits',
    antesDePagar: 'Avant de payer',
    retiradoUno: "{n} produit n'est plus disponible. Retirez-le pour pouvoir payer.",
    retiradoVarios: "{n} produits ne sont plus disponibles. Retirez-les pour pouvoir payer.",
    precioCambiado:
      "Le prix a changé depuis que vous l'avez ajouté. Vérifiez les lignes marquées.",
    variante: 'Variante : {variante}',
    vendidoPor: 'Vendu par {vendedor}',
    noDisponible: "Ce produit n'est plus disponible.",
    antesAhora: 'Avant {precio}. Maintenant ',
    seCobra: '. Le nouveau est facturé.',
    lineaPrecio: '{cantidad} x {precio}',
    quitarUnidad: 'Retirer une unité de {titulo}',
    anadirUnidad: 'Ajouter une unité de {titulo}',
    quitar: 'Retirer',
    totalUno: '{n} produit en {moneda}',
    totalVarios: '{n} produits en {moneda}',
    comisionPendiente:
      "La commission de la plateforme n'est pas encore ajoutée : aucune passerelle de paiement n'est connectée.",
    irAPagar: 'Aller payer',
    subtotal: 'Sous-total',
    comision: 'Commission QBASwing',
    total: 'Total',
    checkout: 'Aller au paiement',
    seguir: 'Continuer les achats',
    vaciar: 'Vider le panier',
    unidades: 'unités',
  },
  pago: {
    titulo: 'Choisir comment payer',
    pasarela: 'Passerelle',
    confirmar: 'Confirmer le paiement',
    procesando: 'Traitement du paiement...',
    esperando: 'En attente de confirmation',
    revisionManual:
      "Ce paiement est confirmé par une personne. Nous vous préviendrons par e-mail dès qu'il sera traité.",
    rechazado: "Le paiement n'a pas pu être finalisé",
    pendiente: 'Paiement en attente',
    verificado: 'Paiement confirmé',
    reembolsado: 'Remboursé',
    tiempoWebhook: 'Confirmé automatiquement',
    tiempoSondeo: 'Prend quelques minutes',
    tiempoManual: 'Confirmé par une personne',
  },
  exito: {
    titulo: 'Paiement reçu',
    descripcion: 'Confirmation de paiement sur QBASwing Marketplace.',
    sinBackendTitulo: 'Le paiement a été reçu, mais il ne peut pas encore être confirmé',
    sinBackendTexto:
      "La passerelle de paiement n'est pas encore connectée à ce site. Votre paiement n'est pas perdu : il est enregistré dans la passerelle et sera crédité lorsque l'intégration sera active.",
    volverInicio: "Retour à l'accueil",
    confirmando: 'Confirmation de votre paiement',
    compraDisponible: 'Votre achat est maintenant disponible dans votre bibliothèque.',
    espera: 'Cela prend quelques secondes. Ne fermez pas cette fenêtre.',
    referencia: 'Référence : {ref}',
    verificando: 'Vérification du paiement auprès de la passerelle',
    biblioteca: 'Aller à ma bibliothèque',
  },
  fallo: {
    titulo: 'Paiement annulé',
    descripcion: "Le paiement n'a pas été finalisé sur QBASwing Marketplace.",
    noSeCompleto: "Le paiement n'a pas été finalisé",
    motivoSaldo:
      "Votre compte sur la passerelle n'a pas un solde suffisant pour finaliser le paiement.",
    motivoRechazo: "La passerelle a refusé l'opération. Aucun débit n'a été effectué.",
    motivoTimeout:
      "L'opération a pris trop de temps et a été annulée pour protéger votre argent.",
    motivoUsuario: 'Vous avez annulé le paiement avant de le finaliser.',
    motivoCambio: "Le taux de change n'était pas disponible au moment de la tentative.",
    sinMotivo: "Le paiement n'a pas été finalisé.",
    referencia: 'Référence : {ref}',
    avisoCarrera:
      "Si vous aviez déjà finalisé le paiement dans votre banque ou sur la passerelle et que vous voyez ceci, il peut s'agir d'un retard de confirmation. Vérifiez votre compte dans quelques minutes avant de réessayer : vous ne serez pas débité deux fois.",
    intentarDeNuevo: 'Réessayer',
    volverCatalogo: 'Retour au catalogue',
    necesitasAyuda: "Besoin d'aide ?",
    escribinos: 'Écrivez-nous',
  },
  registro: {
    descripcion: 'Créez votre compte sur QBASwing Marketplace.',
    subtitulo: 'Votre e-mail et votre mot de passe. Rien de plus.',
    sinBackend:
      "Ce site n'a pas encore de serveur configuré, donc un compte ne peut pas être créé. Réessayez plus tard.",
    ayudaContrasena:
      "Au moins 8 caractères. Il ne peut pas être composé uniquement d'espaces ni contenir votre e-mail.",
    creandoCuenta: 'Création du compte...',
    rellenaTresCampos: 'Remplissez les trois champs.',
    yaTienesCuenta: 'Vous avez déjà un compte ?',
    entraAqui: 'Connectez-vous ici',
    sinJavaScript:
      "Pour créer un compte, JavaScript est nécessaire : le site est statique et n'a pas de serveur où envoyer le formulaire. Activez-le et rechargez cette page.",
  },
  entrar: {
    titulo: 'Se connecter',
    descripcion: 'Connectez-vous à votre compte QBASwing Marketplace.',
    subtitulo: "Avec l'e-mail avec lequel vous vous êtes inscrit.",
    sinBackend:
      "Ce site n'a pas encore de serveur configuré, donc vous ne pouvez pas vous connecter. Réessayez plus tard.",
    sinCuentaPregunta: 'Pas de compte ?',
    crearAqui: 'Créez-en un ici',
    escribeCorreoContrasena: 'Écrivez votre e-mail et votre mot de passe.',
    entrando: 'Connexion...',
    sinJavaScript:
      "Pour vous connecter, JavaScript est nécessaire : le site est statique et n'a pas de serveur où envoyer le formulaire. Activez-le et rechargez cette page.",
  },
  cuenta: {
    entrar: 'Se connecter',
    registro: 'Créer un compte',
    salir: 'Se déconnecter',
    correo: 'E-mail',
    contrasena: 'Mot de passe',
    nombre: 'Nom',
    recordar: 'Se souvenir de moi',
    sinCuenta: 'Pas de compte',
    conCuenta: 'Vous avez déjà un compte',
    crear: 'Créer mon compte',
    miCuenta: 'Mon compte',
    biblioteca: 'Mes achats',
    perfil: 'Mon profil',
    descripcion: 'Votre compte sur QBASwing Marketplace.',
    registrado: 'Ce que vous avez ici, tel quel est enregistré.',
    campoCorreo: 'E-mail',
    campoContrasena: 'Mot de passe',
    mostrarContrasena: 'Afficher le mot de passe',
    ocultarContrasena: 'Masquer le mot de passe',
    salirTitulo: 'Se déconnecter de votre compte',
    salirTexto:
      "Vous devrez vous reconnecter avec votre e-mail et votre mot de passe. Cette session se ferme ici, pas sur les autres appareils où vous avez le compte ouvert.",
    mantenerSesion: 'Garder la session',
    salirCorto: 'Quitter',
    saliendo: 'Déconnexion...',
  },
  panel: {
    titulo: 'Espace vendeur',
    miPanel: 'Mon espace',
    descripcion: 'Votre espace vendeur sur QBASwing Marketplace.',
    resumen: 'Votre boutique, votre pourcentage et vos sessions.',
    productos: 'Produits',
    ventas: 'Ventes',
    espacios: 'Espaces',
    nuevoProducto: 'Publier un produit',
    editarProducto: 'Modifier le produit',
    slotsUsados: 'Emplacements utilisés',
    slotsLibres: 'Emplacements libres',
    slotsTotales: 'Emplacements du forfait',
    sinPaquete: "Vous n'avez pas de forfait d'espaces actif",
    sinPaqueteAyuda: 'Achetez un forfait pour pouvoir publier des produits.',
    bruto: 'Brut',
    comision: 'Commission',
    neto: 'Net',
    porCobrar: 'À encaisser',
  },
  owner: {
    titulo: 'Administration',
    administracion: 'Administration',
    descripcion: 'Administration de QBASwing Marketplace.',
    permiso: 'Votre compte et ce sur quoi vous avez des permissions sur le site.',
    resumen: 'Résumé',
    ingresos: 'Revenus',
    pagosPendientes: 'Paiements à confirmer',
    liquidaciones: 'Versements',
    configuracion: 'Configuration',
    catalogo: 'Catalogue',
    usuarios: 'Utilisateurs',
    exenciones: 'Exonérations',
    confirmar: 'Confirmer le paiement',
    rechazar: 'Refuser',
    evidencia: 'Preuve',
    evidenciaAyuda:
      "Notez ce que vous avez vu pour pouvoir l'auditer ensuite. Sans cela, le paiement ne peut pas être confirmé.",
    confirmarAviso:
      'Confirmez seulement si vous avez vu le reçu. Cette action est enregistrée avec votre nom.',
    cobrar: 'Marquer comme encaissé',
    porVendedor: 'Par vendeur',
    exentoComision: 'Exonéré de commission',
    slotsIlimitados: 'Emplacements illimités',
    alcance: 'Portée',
  },
  perfil: {
    misProductos: 'Produits',
    metodosCobro: 'Modes de paiement',
    metodosCobroAyuda: "Chaque vendeur publie les siens. L'acheteur vous paie directement.",
    redes: 'Réseaux sociaux',
    ubicacion: 'Localisation',
    provincia: 'Province',
    municipio: 'Municipalité',
    direccion: 'Adresse',
    contacto: 'Contact',
    whatsapp: 'WhatsApp',
    telefono: 'Téléphone',
    sitioWeb: 'Site web',
    desde: 'Vendeur depuis',
    propietario: 'Propriétaire',
    agregarMetodo: 'Ajouter un mode de paiement',
    redPlataforma: 'Plateforme',
    redUsuario: 'Utilisateur',
    mostrar: 'Afficher sur mon profil',
  },
  nosotros: {
    titulo: 'À propos de nous',
    intro:
      'QBASwing Marketplace est une plateforme pour acheter et vendre des produits numériques, physiques et des services, avec les règles de commission publiées avant le catalogue.',
    mision: 'Mission',
    misionTexto:
      "Offrir un espace où l'auteur sait quel pourcentage la plateforme retient, où les règles sont publiées et où rien ne change sans être enregistré.",
    principios: 'Principes',
    principiosTexto:
      "Des règles écrites, qui ne changent pas. De vrais états vides, pas des exemples inventés. Le téléchargement uniquement pour l'acheteur, avec un lien qui expire au bout de 5 minutes.",
    tresReglas: 'Les trois règles qui guident ce projet',
    reglasTexto:
      "Dans la Règle A, les produits numériques d'auteurs externes passent par la plateforme et QBASwing retient 5%, laissant 95% pour l'auteur. Dans la Règle B, les produits numériques propres n'ont pas de commission. Dans la Règle C, les produits physiques n'ont pas de commission et utilisent le système de forfaits de 60 jours, avec des espaces réutilisés lors de la vente.",
    garantias:
      "Ce site n'offre pas de garanties qui ne soient pas écrites. Tout ce qui est publié comme promesse est, aussi, écrit sur ces pages.",
  },
  contacto: {
    titulo: 'Contact',
    intro:
      'Si vous avez une question sur les achats, les ventes ou sur le fonctionnement des règles, vous pouvez nous écrire via les canaux qui apparaissent dans le pied de page.',
    comoContactar: 'Comment nous contacter',
    gestion:
      "Les coordonnées de contact sont gérées depuis l'espace du Owner. Tant qu'elles ne sont pas configurées, cette section reste vide volontairement, sans mettre de données d'exemple.",
    verFaq: 'Voir les questions fréquentes',
    aviso:
      "Nous ne demandons pas de coordonnées bancaires par e-mail. Nous ne demandons jamais de mots de passe.",
  },
  form: {
    titulo: 'Publier un produit',
    nombreProducto: 'Nom du produit',
    tipo: 'Type',
    resumen: 'Résumé court',
    descripcionLarga: 'Description complète',
    precio: 'Prix',
    moneda: 'Devise',
    categorias: 'Catégories',
    imagenes: 'Images',
    archivo: 'Fichier du produit',
    publicar: 'Publier',
    guardarBorrador: 'Enregistrer comme brouillon',
    obligatorio: 'Ce champ est obligatoire',
    demasiadoCorto: "C'est trop court pour être utile",
    precioInvalido: 'Le prix doit être supérieur à zéro',
    rutaEntrega: 'Comment il sera livré',
    rutaKv: "Il est stocké dans QBASwing. L'acheteur le télécharge depuis le site.",
    rutaFraccionado: "Le fichier est volumineux. Il est livré entier, découpé à l'intérieur.",
    rutaExterno:
      "Le fichier est très volumineux. Vous mettez votre propre lien et le partagez avec l'acheteur.",
    ventajaRuta: 'Avantage',
  },
  footer: {
    descripcion:
      'Marché de logiciels, modèles, produits numériques et artisanat de Cuba et du monde.',
    colMarketplace: 'Marketplace',
    colComprar: 'Acheter',
    colVender: 'Vendre',
    colPlataforma: 'Plateforme',
    enProductos: 'Produits',
    enDestacados: 'En vedette',
    enEspacios: 'Espaces et forfaits',
    enCarrito: 'Panier',
    enPagar: 'Passer à la caisse',
    enDescargas: 'Mes téléchargements',
    enFaq: 'Questions fréquentes',
    enPanel: 'Espace vendeur',
    enSubir: 'Publier un produit',
    enOwner: 'Console du Owner',
    enCrearCuenta: 'Créer un compte',
    enContacto: 'Contact',
    enNosotros: 'À propos',
    enTerminos: 'Conditions',
    enPrivacidad: 'Confidentialité',
    regla: 'Règle',
    comisionA: '{n}% pour QBASwing',
    comisionBC: '{n}% de commission',
    sinContacto:
      "Le Owner n'a pas encore publié de coordonnées. Écrivez via Telegram ou WhatsApp depuis les boutons ci-dessus.",
    patrocinadoPor: 'Sponsorisé par',
    disenadoPor: 'Conçu par',
    derechos: 'Tous droits réservés',
    descargo:
      "QBASwing Marketplace n'est pas une institution financière et ne conserve pas de fonds. Dans la Règle A, le paiement passe par la passerelle et la plateforme retient les 5% fixés par la règle ; dans les Règles B et C, le paiement va directement à l'auteur et la plateforme n'intervient pas. Les liens de téléchargement des produits numériques durent 5 minutes et ne fonctionnent que pour l'acheteur. Les produits numériques d'auteurs externes sont publiés après approbation du Owner.",
  },
  terminos: {
    titulo: 'Conditions générales',
    ultimaActualizacion: 'Dernière mise à jour :',
    aceptacion: '1. Acceptation des conditions',
    aceptacionTexto:
      "En utilisant QBASwing Marketplace, vous acceptez ces conditions. Si vous n'êtes pas d'accord, n'utilisez pas la plateforme.",
    reglasComision: '2. Règles de commission',
    reglasComisionTexto:
      "Les trois Règles d'Or sont publiques : Règle A (numériques externes) : 5% pour QBASwing, 95% pour l'auteur. Règle B (numériques propres) : 0% de commission. Règle C (produits physiques) : 0% de commission, avec un forfait de 60 jours et des espaces réutilisables.",
    comprasDescargas: '3. Achats et téléchargements',
    comprasDescargasTexto:
      "Seule la personne qui a acheté un produit numérique peut le télécharger. Le lien de téléchargement envoyé par e-mail expire au bout de 5 minutes et n'est pas une adresse publique permanente. Les licences sont celles que le vendeur indique pour ce produit.",
    publicacionModeracion: '4. Publication et modération',
    publicacionModeracionTexto:
      "Les produits soumis à la Règle A sont publiés après approbation du Owner. Les produits des Règles B et C peuvent être publiés selon l'état de leurs espaces. Le Owner peut retirer un produit qui ne respecte pas ce qui est déclaré sur sa fiche.",
    pagos: '5. Paiements',
    pagosTexto:
      "Les paiements sont traités via les passerelles déclarées. La plateforme ne conserve pas les fonds de l'acheteur lorsqu'ils ne sont pas nécessaires à la répartition. Les versements aux vendeurs suivent le cycle défini dans l'espace.",
    responsabilidad: '6. Responsabilité',
    responsabilidadTexto:
      "QBASwing Marketplace n'est pas responsable du contenu publié par les vendeurs, mais se réserve le droit de le modérer. Aucune garantie implicite n'est offerte qui ne soit pas expressément écrite ici.",
  },
  privacidad: {
    titulo: 'Politique de confidentialité',
    ultimaActualizacion: 'Dernière mise à jour :',
    queRecopilamos: '1. Données que nous collectons',
    queRecopilamosTexto:
      'Nous ne collectons que ce qui est nécessaire au fonctionnement : les données de compte (nom et e-mail), les informations nécessaires pour traiter les achats et les enregistrements minimaux pour prévenir les abus.',
    usoDatos: '2. Utilisation des données',
    usoDatosTexto:
      "Nous utilisons vos données uniquement pour fournir le service : authentifier, livrer ce que vous avez acheté, envoyer des notifications liées à votre achat ou à votre compte, et respecter ce qu'exigent les passerelles de paiement.",
    cookies: '3. Cookies',
    cookiesTexto:
      "Nous utilisons des cookies strictement nécessaires. Le cookie d'identité du Owner est signé avec HMAC et aucune information sensible n'est stockée dans le navigateur.",
    comparticion: '4. Partage des données',
    comparticionTexto:
      "Nous ne vendons ni ne louons vos données. Nous les partageons uniquement avec les passerelles de paiement lorsque c'est nécessaire pour finaliser une transaction, et toujours avec le minimum nécessaire.",
    seguridad: '5. Sécurité',
    seguridadTexto:
      "Les liens de téléchargement sont opaques, expirent au bout de 5 minutes et sont validés contre votre compte. Nous n'exposons pas de chemins publics pour les fichiers achetés.",
    derechos: '6. Vos droits',
    derechosTexto:
      "Vous pouvez demander l'accès, la correction ou la suppression de vos données liées à votre compte, tant qu'elles n'interfèrent pas avec les enregistrements nécessaires aux transactions déjà finalisées.",
  },
  faq: {
    subtitulo: 'Des réponses claires, sans promesses inventées.',
    error: "Les questions fréquentes n'ont pas pu être chargées.",
    sinPreguntas: 'Aucune question fréquente publiée pour le moment.',
  },
  idioma: {
    titulo: 'Langue',
    actual: 'Langue actuelle',
    cambiar: 'Changer de langue',
    conservaPagina: 'Conserve la page actuelle',
    guardado: 'Nous enregistrons votre préférence pour la prochaine visite.',
    sinTraducir: 'Pas encore traduit',
  },
  comun: {
    saltarContenido: 'Aller au contenu',
    volver: 'Retour',
    siguiente: 'Suivant',
    anterior: 'Précédent',
    cerrar: 'Fermer',
    guardar: 'Enregistrer',
    cancelar: 'Annuler',
    confirmar: 'Confirmer',
    cargando: 'Chargement...',
    noDisponible: 'Pas encore disponible',
    nuevo: 'Nouveau',
    verTodo: 'Voir tout',
    paginaNoEncontrada: 'Page introuvable',
    paginaNoEncontradaTexto:
      "L'adresse que vous avez ouverte n'existe pas. Le lien est peut-être mal écrit ou la page a peut-être été déplacée.",
    volverInicio: "Aller à l'accueil",
  },
}

const DE: Diccionario = {
  nav: {
    productos: 'Produkte',
    espacios: 'Plätze',
    vender: 'Verkaufen',
    carrito: 'Warenkorb',
    cuenta: 'Mein Konto',
    panel: 'Verkäuferbereich',
    owner: 'Verwaltung',
    buscar: 'Produkte suchen',
    menu: 'Menü',
    cerrar: 'Schließen',
    irInicio: 'QBASwing Marketplace, zum Anfang',
    principal: 'Hauptnavigation',
    entrar: 'In mein Konto anmelden',
    carritoCompras: 'Einkaufswagen',
  },
  vacio: {
    sinProductos: 'Noch keine Produkte veröffentlicht',
    sinProductosAyuda:
      'Sobald Verkäufer veröffentlichen, erscheinen ihre Produkte hier. Mehrere von ihnen bereiten bereits ihren Katalog vor.',
    sinVentas: 'Du hast noch keine Verkäufe',
    sinVentasAyuda:
      'Wenn jemand eines deiner Produkte kauft, erscheinen hier die Details und der Download-Link.',
    sinCarrito: 'Dein Warenkorb ist leer',
    sinCarritoAyuda: 'Füge Produkte aus dem Katalog hinzu, um einen Kauf zu starten.',
    sinPagos: 'Keine Zahlungen warten auf Bestätigung',
    sinPagosAyuda:
      'WhatsApp-Zahlungen, die Käufer senden, erscheinen hier zur Bestätigung.',
    sinOrdenes: 'Du hast noch keine Käufe',
    sinOrdenesAyuda: 'Deine Käufe und die Download-Links sind hier.',
    sinResultados: 'Kein Produkt passt zu dieser Suche',
    sinResultadosAyuda: 'Versuche es mit weniger Wörtern oder entferne die Filter.',
    sinLiquidaciones: 'Keine ausstehenden Auszahlungen',
    sinLiquidacionesAyuda:
      'Wenn sich sammelt, was dir zusteht, erscheint es hier zum Abholen.',
  },
  error: {
    titulo: 'Wir konnten das nicht laden',
    conexion:
      'Der Server war nicht erreichbar. Es kann an deiner Verbindung liegen oder daran, dass das Backend noch nicht bereitgestellt ist.',
    vacio: 'Die Antwort des Servers kam leer an.',
    reintentar: 'Erneut versuchen',
    endpoint: 'Abgefragter Endpunkt',
  },
  regla: {
    A: 'Software von Drittanbietern',
    B: 'Eigene Inhalte',
    C: 'Handwerk und Produkte',
    comisionA: '5% für QBASwing, 95% für den Autor.',
    comisionB: '0% Provision. Der Autor behält 100%.',
    comisionC: '0% Provision auf den Verkauf.',
    titulo: 'Goldene Regeln',
  },
  inicio: {
    lanzamiento: 'OFFIZIELLER START 2026',
    comisionFisicos: '{n}% PROVISION AUF PHYSISCHES UND EIGENES',
    tasaFija: '{n}% FESTER SATZ AUF EXTERNE DIGITALE GÜTER',
    tituloHero: 'Der kreative und technologische Marktplatz Kubas, mit veröffentlichten Provisionsregeln',
    tituloHeroDestacado: 'veröffentlichten',
    heroParrafo:
      'Verkaufe oder erwirb Software, professionelle Vorlagen, Handwerk und physische Produkte in Kuba und der Welt. Die drei Provisionsregeln stehen vor dem Katalog geschrieben, und sie ändern sich nicht, ohne dass der Owner es entscheidet und es festgehalten wird.',
    explorarCatalogo: 'Den Katalog erkunden',
    abrirTienda: 'Meinen Shop eröffnen',
    activacionInmediata: 'Sofortige Aktivierung',
    sinTarjetas: 'Ohne ausländische Karten',
    descargaCompra: 'Lade nur herunter, was du gekauft hast',
    economiaClara: 'Klare Wirtschaft',
    reglasTitulo: 'Die 3 Goldenen Regeln von QBASwing',
    reglasIntro:
      'Drei Regeln, vor dem Katalog geschrieben. Jedes Produkt des Marktplatzes gehört zu einer von ihnen, und daraus ergibt sich seine Provision. Es gibt keine vierte Regel und keine Provision, die "je nach Fall" gilt.',
    reglaATitulo: 'Regel A: externe digitale Güter',
    reglaA: 'Regel A',
    paraAutor: '{n}% für den Autor',
    reglaANombre: 'Externe digitale Güter',
    reglaALista1: 'Die Zahlung läuft über die Plattform',
    reglaALista2: 'Veröffentlichung nach Freigabe des Owner',
    sinLimite: 'Keine Begrenzung der Veröffentlichungen',
    reglaBTitulo: 'Regel B: eigene digitale Güter',
    reglaB: 'Regel B',
    deComision: 'Provision',
    reglaBNombre: 'Eigene digitale Güter',
    reglaBLista1: 'Direkte Veröffentlichung, ohne auf Freigabe zu warten',
    reglaCTitulo: 'Regel C: physische Produkte',
    reglaC: 'Regel C',
    paraVendedor: '{n}% für den Verkäufer',
    reglaCNombre: 'Physische Produkte',
    reglaCLista1: 'Direkte Veröffentlichung',
    reglaCLista2: '60-Tage-Paket pro Kategorie',
    reglaCLista3: 'Die Plätze werden beim Verkauf wiederverwendet',
    paraQuienEs: 'Für wen es ist',
    quePuedesHacer: 'Was du hier tun kannst',
    quePuedesIntro:
      'Sechs Dinge, die der Marktplatz mit den veröffentlichten Regeln erlaubt. Keine ist ein Versprechen: es ist das, was das System tut, wenn jemand veröffentlicht, jemand kauft und jemand kassiert.',
    verFaq: 'Die häufig gestellten Fragen ansehen',
    usoSoftwareTitulo: 'Veröffentliche deine Software und zahle 5%',
    usoSoftware:
      'Plugins, Vorlagen, UI-Kits und Schriften externer Autoren. Du zahlst 5% pro abgewickelter Transaktion und behältst 95%. Keine Begrenzung der Veröffentlichungen und kein Paket zu zahlen.',
    usoRopaTitulo: 'Verkaufe Kleidung, Schuhe und physische Produkte',
    usoRopa:
      'Null Provision pro Verkauf. Du zahlst ein 60-Tage-Paket pro Kategorie, und wenn du verkaufst, wird der Platz frei, um das nächste hochzuladen, ohne etwas weiteres zu zahlen.',
    usoCobroTitulo: 'Kassiere in CUP, USD oder Krypto',
    usoCobro:
      'Jedes Produkt hat seinen Preis in der Währung, die du wählst. In Regel A läuft die Zahlung über die Plattform, was die 5% durchsetzbar macht.',
    usoEntregaTitulo: 'Digitale Lieferung mit 5-Minuten-Link',
    usoEntrega:
      'Wer gekauft hat, kann seine Datei erneut aus seinem Konto herunterladen, solange die Lizenz gilt. Der Link per E-Mail dauert 5 Minuten: er ist keine dauerhafte Adresse der Datei.',
    usoTiendaTitulo: 'Eröffne deinen Shop ohne Karte',
    usoTienda:
      'Es wird keine Bankkarte aus irgendeinem Land benötigt, um sich zu registrieren oder zu veröffentlichen. Kein Schritt der Anmeldung verlangt eine.',
    usoDescargaTitulo: 'Nur der Käufer lädt herunter',
    usoDescarga:
      'Der Download wird gegen dein Konto geprüft, nicht gegen einen Link, der weitergeleitet werden kann. Wenn du nicht gekauft hast, funktioniert kein Link.',
    paquetesLabel: 'Im Katalog veröffentlichen',
    paquetesTitulo: 'Pakete für physische Plätze',
    paquetesIntro:
      'Ein Paket begrenzt nicht, wie viele Verkäufe du machst: es begrenzt, wie viele Produkte du hast',
    paquetesIntroFuerte: 'gleichzeitig veröffentlicht',
    paquetesIntroResto:
      ', und es dauert 60 Tage. Jedes Mal, wenn du eines verkaufst, wird der Platz wieder frei und du lädst ein weiteres hoch, ohne etwas weiteres zu zahlen.',
    paquetesError: 'Die Paketpreise konnten gerade nicht geladen werden.',
    paquetesErrorAyuda: 'Lade die Seite neu. Wenn es gleich bleibt, schreib uns auf Telegram.',
    espacio: 'Platz',
    espacios: 'Plätze',
    dias: 'Tage',
    verPaquete: 'Das Paket ansehen',
    cicloTitulo: 'Wie der Platz-Zyklus funktioniert',
    ciclo1Titulo: 'Du veröffentlichst dein Produkt',
    ciclo1Texto: 'Es belegt 1 deiner aktiven Plätze während der 60 Tage des Pakets.',
    ciclo2Titulo: 'Es wird verkauft',
    ciclo2Texto:
      'Der Käufer zahlt in der Währung des Produkts. QBASwing zieht in Regel C keine Provision ab.',
    ciclo3Titulo: 'Der Platz wird wieder frei',
    ciclo3Texto:
      'Du lädst das nächste sofort hoch. Du musst kein weiteres Paket zahlen, solange das aktuelle nicht abgelaufen ist.',
    destacadosLabel: 'Aus dem Katalog',
    verCatalogo: 'Den ganzen Katalog ansehen',
    catalogoVacio:
      'Der Katalog ist leer, weil noch niemand veröffentlicht hat, nicht weil etwas fehlschlägt. Das erste veröffentlichte Produkt erscheint hier.',
    sinDestacados: 'Es gibt gerade keine hervorgehobenen Produkte. Der vollständige Katalog schon.',
    publicarPrimero: 'Das erste veröffentlichen',
    explora: 'Erkunde',
    cierreTitulo: 'Eröffne deinen Shop oder',
    cierreDestacado: 'sichere dir das Beste des kubanischen Talents',
    cierreTexto:
      'Die Provisionen sind veröffentlicht, die Plätze werden wiederverwendet und es wird keine ausländische Karte benötigt. Das Einzige, was noch fehlt, sind Produkte: der Katalog beginnt mit dir.',
    crearVendedor: 'Verkäuferkonto erstellen',
    explorarSinRegistro: 'Ohne Registrierung erkunden',
  },
  producto: {
    comprar: 'Kaufen',
    agregar: 'In den Warenkorb',
    agregado: 'Hinzugefügt',
    precio: 'Preis',
    gratis: 'Gratis',
    vendedor: 'Verkäufer',
    categoria: 'Kategorie',
    descripcion: 'Beschreibung',
    detalles: 'Details',
    plataforma: 'Plattform',
    licencia: 'Lizenz',
    archivo: 'Datei',
    tamano: 'Größe',
    versiones: 'Versionen',
    desde: 'Ab',
    opiniones: 'Bewertungen',
    sinDescripcion: 'Der Verkäufer hat diesem Produkt keine Beschreibung hinzugefügt.',
    filtros: 'Filter',
    limpiar: 'Filter löschen',
    ordenar: 'Sortieren nach',
    resultados: 'Ergebnisse',
    noEncontrado: 'Dieses Produkt existiert nicht oder ist nicht mehr verfügbar',
  },
  productos: {
    sinProductos: 'Noch keine Produkte veröffentlicht.',
    totalUno: '{n} Produkt insgesamt.',
    totalVarios: '{n} Produkte insgesamt.',
    buscar: 'Suchen',
    placeholderBusqueda: 'Nach Titel oder Beschreibung suchen...',
    todas: 'Alle',
    todos: 'Alle',
    digital: 'Digital',
    fisico: 'Physisch',
    servicio: 'Dienstleistung',
    ordenar: 'Sortieren',
    masRecientes: 'Neueste',
    precioMenorAMayor: 'Preis: aufsteigend',
    precioMayorAMenor: 'Preis: absteigend',
    filtrar: 'Filtern',
    errorCatalogo:
      'Der Katalog konnte gerade nicht geladen werden. Versuche es später erneut.',
    vacioAyuda: 'Der Katalog ist leer. Das erste veröffentlichte Produkt erscheint hier.',
    publicarPrimero: 'Das erste veröffentlichen',
    paginasCatalogo: 'Katalogseiten',
    pagina: 'Seite',
    de: 'von',
  },
  ficha: {
    errorTitulo: 'Dieses Produkt konnte nicht angezeigt werden',
    errorCarga: 'Fehler beim Laden des Produkts',
    noEncontrado: 'Produkt nicht gefunden',
    noEncontradoTexto: 'Das gesuchte Produkt existiert nicht oder ist nicht veröffentlicht.',
    faltaIdentificador: 'Die Produktkennung fehlt.',
    cargaFallida: 'Das Produkt konnte nicht geladen werden.',
    volverCatalogo: 'Zurück zum Katalog',
    destacado: 'Hervorgehoben',
    anadirCarrito: 'In den Warenkorb',
    verVendedor: 'Verkäufer ansehen',
    comoPagar: 'Wie bezahlen',
    avisoPago:
      'Die Zahlungen werden manuell bestätigt. Prüfe, dass du die Nummer oder Adresse richtig geschrieben hast, bevor du sendest, und bewahre den Beleg auf.',
    publicado: 'Veröffentlicht',
    actualizado: 'Aktualisiert',
  },
  vender: {
    metaDescripcion: 'Wie du deine Produkte auf QBASwing Marketplace verkaufst.',
    titulo: 'Hier verkaufen',
    subtitulo: 'Was nötig ist, in der Reihenfolge, in der es nötig ist.',
    paso1Titulo: 'Erstelle dein Konto',
    paso1Texto:
      'E-Mail und Passwort. Damit hast du schon ein Konto und einen eigenen Platz, um deinen Shop vorzubereiten.',
    paso2Titulo: 'Sprich mit dem Owner',
    paso2Texto:
      'Es wird geprüft, wer du bist und was du verkaufst. Es ist ein Gespräch, kein automatisches Formular. Es ist der einzige Schritt, der nicht automatisiert werden kann.',
    paso3Titulo: 'Du veröffentlichst deine Produkte',
    paso3Texto:
      'Digital, physisch oder Dienstleistungen. Dein Shop hat seine eigene Seite und seine Verkäufe werden von selbst erfasst.',
    paso4Titulo: 'Das Geld erreicht dich',
    paso4Texto:
      'Wenn der Käufer erhält, was er gekauft hat. Die Zahlung läuft über die Plattform und der Anteil des Verkäufers wird nach verifizierter Lieferung ausgezahlt.',
    espaciosTitulo: 'Plätze für deinen Shop',
    espaciosSubtitulo: 'Jedes Paket bringt deinen Shop an mehr Orte des Marktplatzes.',
    espaciosError: 'Die Paketpreise konnten nicht geladen werden.',
    espaciosVacio:
      'Es gibt noch keine Platzpakete zum Verkauf. Wenn es sie gibt, stehen sie hier mit ihrem Preis.',
    espacio: 'Platz',
    espacios: 'Plätze',
    durante: 'für',
    dias: 'Tage',
    pesos: 'Pesos',
    dolares: 'Dollar',
    euros: 'Euro',
    sinPrecio: 'Es hat noch keinen zugewiesenen Preis.',
    leerTerminos: 'Die Bedingungen lesen',
  },
  vendedor: {
    errorTitulo: 'Dieser Verkäufer konnte nicht angezeigt werden',
    noEncontrado: 'Verkäufer nicht gefunden',
    noEncontradoTexto: 'Dieser Verkäufer existiert nicht oder hat keine sichtbaren Produkte.',
    sinDescripcion: 'Dieser Verkäufer hat noch keine Beschreibung.',
    producto: 'Produkt',
    productos: 'Produkte',
    verificado: 'Verifiziert',
    sinProductos: 'Dieser Verkäufer hat noch keine sichtbaren Produkte.',
    faltaIdentificador: 'Die Verkäuferkennung fehlt.',
    cargaFallida: 'Der Verkäufer konnte nicht geladen werden.',
  },
  espacios: {
    intro:
      'Ein Paket begrenzt nicht, wie viele Verkäufe du machst: es begrenzt, wie viele Produkte du gleichzeitig veröffentlicht hast, dauert 60 Tage und die Plätze werden beim Verkauf wiederverwendet.',
    errorCarga: 'Die Pakete konnten gerade nicht geladen werden.',
    vacio: 'Noch keine Pakete konfiguriert.',
    espacio: 'Platz',
    espacios: 'Plätze',
    dias: 'Tage',
  },
  carrito: {
    titulo: 'Warenkorb',
    vacio: 'Dein Warenkorb ist leer',
    descripcion: 'Was du auf QBASwing Marketplace hinzugefügt hast.',
    sinBackend:
      'Diese Seite hat noch keinen konfigurierten Server, daher kann der Warenkorb nicht funktionieren. Versuche es später erneut.',
    cargando: 'Dein Warenkorb wird geladen...',
    tituloVacio: 'Dein Warenkorb ist leer',
    vacioAyuda:
      'Du kannst Produkte hinzufügen, ohne ein Konto zu erstellen. Sie werden in diesem Browser gespeichert.',
    verProductos: 'Produkte ansehen',
    antesDePagar: 'Vor dem Bezahlen',
    retiradoUno: '{n} Produkt ist nicht mehr verfügbar. Entferne es, um bezahlen zu können.',
    retiradoVarios:
      '{n} Produkte sind nicht mehr verfügbar. Entferne sie, um bezahlen zu können.',
    precioCambiado: 'Der Preis hat sich seit dem Hinzufügen geändert. Prüfe die markierten Zeilen.',
    variante: 'Variante: {variante}',
    vendidoPor: 'Verkauft von {vendedor}',
    noDisponible: 'Dieses Produkt ist nicht mehr verfügbar.',
    antesAhora: 'Vorher {precio}. Jetzt ',
    seCobra: '. Es wird der neue berechnet.',
    lineaPrecio: '{cantidad} x {precio}',
    quitarUnidad: 'Eine Einheit von {titulo} entfernen',
    anadirUnidad: 'Eine Einheit von {titulo} hinzufügen',
    quitar: 'Entfernen',
    totalUno: '{n} Produkt in {moneda}',
    totalVarios: '{n} Produkte in {moneda}',
    comisionPendiente:
      'Die Provision der Plattform wird noch nicht hinzugefügt: es ist kein Zahlungsgateway verbunden.',
    irAPagar: 'Zum Bezahlen',
    subtotal: 'Zwischensumme',
    comision: 'QBASwing-Provision',
    total: 'Gesamt',
    checkout: 'Zur Zahlung',
    seguir: 'Weiter einkaufen',
    vaciar: 'Warenkorb leeren',
    unidades: 'Einheiten',
  },
  pago: {
    titulo: 'Wählen, wie bezahlt wird',
    pasarela: 'Gateway',
    confirmar: 'Zahlung bestätigen',
    procesando: 'Die Zahlung wird verarbeitet...',
    esperando: 'Warten auf Bestätigung',
    revisionManual:
      'Diese Zahlung wird von einer Person bestätigt. Wir benachrichtigen dich per E-Mail, sobald sie verarbeitet ist.',
    rechazado: 'Die Zahlung konnte nicht abgeschlossen werden',
    pendiente: 'Zahlung ausstehend',
    verificado: 'Zahlung bestätigt',
    reembolsado: 'Erstattet',
    tiempoWebhook: 'Wird automatisch bestätigt',
    tiempoSondeo: 'Dauert einige Minuten',
    tiempoManual: 'Wird von einer Person bestätigt',
  },
  exito: {
    titulo: 'Zahlung erhalten',
    descripcion: 'Zahlungsbestätigung auf QBASwing Marketplace.',
    sinBackendTitulo: 'Die Zahlung ist eingegangen, kann aber noch nicht bestätigt werden',
    sinBackendTexto:
      'Das Zahlungsgateway ist noch nicht mit dieser Seite verbunden. Deine Zahlung ist nicht verloren: sie wird im Gateway erfasst und gutgeschrieben, sobald die Integration aktiv ist.',
    volverInicio: 'Zurück zum Anfang',
    confirmando: 'Deine Zahlung wird bestätigt',
    compraDisponible: 'Dein Kauf ist jetzt in deiner Bibliothek verfügbar.',
    espera: 'Das dauert einige Sekunden. Schließe dieses Fenster nicht.',
    referencia: 'Referenz: {ref}',
    verificando: 'Die Zahlung wird beim Gateway geprüft',
    biblioteca: 'Zu meiner Bibliothek',
  },
  fallo: {
    titulo: 'Zahlung abgebrochen',
    descripcion: 'Die Zahlung wurde auf QBASwing Marketplace nicht abgeschlossen.',
    noSeCompleto: 'Die Zahlung wurde nicht abgeschlossen',
    motivoSaldo:
      'Dein Konto beim Gateway hat nicht genug Guthaben, um die Zahlung abzuschließen.',
    motivoRechazo: 'Das Gateway hat den Vorgang abgelehnt. Es wurde keine Belastung vorgenommen.',
    motivoTimeout:
      'Der Vorgang dauerte zu lange und wurde abgebrochen, um dein Geld zu schützen.',
    motivoUsuario: 'Du hast die Zahlung abgebrochen, bevor du sie abgeschlossen hast.',
    motivoCambio: 'Der Wechselkurs war zum Zeitpunkt des Versuchs nicht verfügbar.',
    sinMotivo: 'Die Zahlung wurde nicht abgeschlossen.',
    referencia: 'Referenz: {ref}',
    avisoCarrera:
      'Wenn du die Zahlung bereits bei deiner Bank oder im Gateway abgeschlossen hast und dies siehst, kann es eine Verzögerung bei der Bestätigung sein. Prüfe dein Konto in einigen Minuten, bevor du es erneut versuchst: es wird dir nicht doppelt berechnet.',
    intentarDeNuevo: 'Erneut versuchen',
    volverCatalogo: 'Zurück zum Katalog',
    necesitasAyuda: 'Brauchst du Hilfe?',
    escribinos: 'Schreib uns',
  },
  registro: {
    descripcion: 'Erstelle dein Konto auf QBASwing Marketplace.',
    subtitulo: 'Deine E-Mail und dein Passwort. Nichts weiter.',
    sinBackend:
      'Diese Seite hat noch keinen konfigurierten Server, daher kann kein Konto erstellt werden. Versuche es später erneut.',
    ayudaContrasena:
      'Mindestens 8 Zeichen. Es darf nicht nur aus Leerzeichen bestehen noch deine E-Mail enthalten.',
    creandoCuenta: 'Konto wird erstellt...',
    rellenaTresCampos: 'Fülle die drei Felder aus.',
    yaTienesCuenta: 'Hast du schon ein Konto?',
    entraAqui: 'Hier anmelden',
    sinJavaScript:
      'Zum Erstellen eines Kontos ist JavaScript nötig: die Seite ist statisch und hat keinen Server, an den das Formular gesendet werden kann. Aktiviere es und lade diese Seite neu.',
  },
  entrar: {
    titulo: 'Anmelden',
    descripcion: 'Melde dich in deinem QBASwing Marketplace-Konto an.',
    subtitulo: 'Mit der E-Mail, mit der du dich registriert hast.',
    sinBackend:
      'Diese Seite hat noch keinen konfigurierten Server, daher kannst du dich nicht anmelden. Versuche es später erneut.',
    sinCuentaPregunta: 'Kein Konto?',
    crearAqui: 'Erstelle eines hier',
    escribeCorreoContrasena: 'Schreibe deine E-Mail und dein Passwort.',
    entrando: 'Anmeldung...',
    sinJavaScript:
      'Zum Anmelden ist JavaScript nötig: die Seite ist statisch und hat keinen Server, an den das Formular gesendet werden kann. Aktiviere es und lade diese Seite neu.',
  },
  cuenta: {
    entrar: 'Anmelden',
    registro: 'Konto erstellen',
    salir: 'Abmelden',
    correo: 'E-Mail',
    contrasena: 'Passwort',
    nombre: 'Name',
    recordar: 'Angemeldet bleiben',
    sinCuenta: 'Kein Konto',
    conCuenta: 'Hast du schon ein Konto',
    crear: 'Mein Konto erstellen',
    miCuenta: 'Mein Konto',
    biblioteca: 'Meine Käufe',
    perfil: 'Mein Profil',
    descripcion: 'Dein Konto auf QBASwing Marketplace.',
    registrado: 'Was du hier hast, genau wie es erfasst ist.',
    campoCorreo: 'E-Mail',
    campoContrasena: 'Passwort',
    mostrarContrasena: 'Passwort anzeigen',
    ocultarContrasena: 'Passwort verbergen',
    salirTitulo: 'Von deinem Konto abmelden',
    salirTexto:
      'Du musst dich erneut mit deiner E-Mail und deinem Passwort anmelden. Diese Sitzung endet hier, nicht auf den anderen Geräten, auf denen du das Konto geöffnet hast.',
    mantenerSesion: 'Sitzung behalten',
    salirCorto: 'Abmelden',
    saliendo: 'Abmeldung...',
  },
  panel: {
    titulo: 'Verkäuferbereich',
    miPanel: 'Mein Bereich',
    descripcion: 'Dein Verkäuferbereich auf QBASwing Marketplace.',
    resumen: 'Dein Shop, dein Prozentsatz und deine Sitzungen.',
    productos: 'Produkte',
    ventas: 'Verkäufe',
    espacios: 'Plätze',
    nuevoProducto: 'Produkt veröffentlichen',
    editarProducto: 'Produkt bearbeiten',
    slotsUsados: 'Belegte Plätze',
    slotsLibres: 'Freie Plätze',
    slotsTotales: 'Paketplätze',
    sinPaquete: 'Du hast kein aktives Platzpaket',
    sinPaqueteAyuda: 'Kaufe ein Paket, um Produkte veröffentlichen zu können.',
    bruto: 'Brutto',
    comision: 'Provision',
    neto: 'Netto',
    porCobrar: 'Zu kassieren',
  },
  owner: {
    titulo: 'Verwaltung',
    administracion: 'Verwaltung',
    descripcion: 'Verwaltung von QBASwing Marketplace.',
    permiso: 'Dein Konto und worüber du auf der Seite Berechtigungen hast.',
    resumen: 'Übersicht',
    ingresos: 'Einnahmen',
    pagosPendientes: 'Zu bestätigende Zahlungen',
    liquidaciones: 'Auszahlungen',
    configuracion: 'Konfiguration',
    catalogo: 'Katalog',
    usuarios: 'Benutzer',
    exenciones: 'Befreiungen',
    confirmar: 'Zahlung bestätigen',
    rechazar: 'Ablehnen',
    evidencia: 'Nachweis',
    evidenciaAyuda:
      'Notiere, was du gesehen hast, um es später prüfen zu können. Ohne dies kann die Zahlung nicht bestätigt werden.',
    confirmarAviso:
      'Bestätige nur, wenn du den Beleg gesehen hast. Diese Aktion wird mit deinem Namen erfasst.',
    cobrar: 'Als kassiert markieren',
    porVendedor: 'Nach Verkäufer',
    exentoComision: 'Von Provision befreit',
    slotsIlimitados: 'Unbegrenzte Plätze',
    alcance: 'Umfang',
  },
  perfil: {
    misProductos: 'Produkte',
    metodosCobro: 'Zahlungsarten',
    metodosCobroAyuda: 'Jeder Verkäufer veröffentlicht seine eigenen. Der Käufer zahlt dir direkt.',
    redes: 'Soziale Netzwerke',
    ubicacion: 'Standort',
    provincia: 'Provinz',
    municipio: 'Gemeinde',
    direccion: 'Adresse',
    contacto: 'Kontakt',
    whatsapp: 'WhatsApp',
    telefono: 'Telefon',
    sitioWeb: 'Website',
    desde: 'Verkäufer seit',
    propietario: 'Eigentümer',
    agregarMetodo: 'Zahlungsart hinzufügen',
    redPlataforma: 'Plattform',
    redUsuario: 'Benutzer',
    mostrar: 'In meinem Profil anzeigen',
  },
  nosotros: {
    titulo: 'Über uns',
    intro:
      'QBASwing Marketplace ist eine Plattform zum Kaufen und Verkaufen digitaler und physischer Produkte und Dienstleistungen, mit den Provisionsregeln, die vor dem Katalog veröffentlicht werden.',
    mision: 'Mission',
    misionTexto:
      'Einen Raum bieten, in dem der Autor weiß, welchen Prozentsatz die Plattform behält, wo die Regeln veröffentlicht werden und wo nichts geändert wird, ohne festgehalten zu werden.',
    principios: 'Grundsätze',
    principiosTexto:
      'Geschriebene Regeln, die sich nicht ändern. Echte leere Zustände, keine erfundenen Beispiele. Der Download nur für den Käufer, mit einem Link, der nach 5 Minuten abläuft.',
    tresReglas: 'Die drei Regeln, die dieses Projekt leiten',
    reglasTexto:
      'In Regel A laufen die digitalen Produkte externer Autoren über die Plattform und QBASwing behält 5%, sodass 95% für den Autor bleiben. In Regel B haben eigene digitale Produkte keine Provision. In Regel C haben physische Produkte keine Provision und nutzen das 60-Tage-Paketsystem, mit Plätzen, die beim Verkauf wiederverwendet werden.',
    garantias:
      'Diese Seite bietet keine Garantien, die nicht geschrieben sind. Alles, was als Versprechen veröffentlicht wird, steht auch auf diesen Seiten geschrieben.',
  },
  contacto: {
    titulo: 'Kontakt',
    intro:
      'Wenn du eine Frage zu Käufen, Verkäufen oder zur Funktionsweise der Regeln hast, kannst du uns über die Kanäle schreiben, die im Fußbereich erscheinen.',
    comoContactar: 'Wie man uns kontaktiert',
    gestion:
      'Die Kontaktdaten werden vom Owner-Bereich aus verwaltet. Solange sie nicht konfiguriert sind, bleibt dieser Abschnitt absichtlich leer, ohne Beispieldaten einzutragen.',
    verFaq: 'Häufig gestellte Fragen ansehen',
    aviso: 'Wir fordern keine Bankdaten per E-Mail an. Wir fragen niemals nach Passwörtern.',
  },
  form: {
    titulo: 'Ein Produkt veröffentlichen',
    nombreProducto: 'Produktname',
    tipo: 'Typ',
    resumen: 'Kurze Zusammenfassung',
    descripcionLarga: 'Vollständige Beschreibung',
    precio: 'Preis',
    moneda: 'Währung',
    categorias: 'Kategorien',
    imagenes: 'Bilder',
    archivo: 'Produktdatei',
    publicar: 'Veröffentlichen',
    guardarBorrador: 'Als Entwurf speichern',
    obligatorio: 'Dieses Feld ist erforderlich',
    demasiadoCorto: 'Es ist zu kurz, um nützlich zu sein',
    precioInvalido: 'Der Preis muss größer als null sein',
    rutaEntrega: 'Wie es geliefert wird',
    rutaKv: 'Es wird in QBASwing gespeichert. Der Käufer lädt es von der Seite herunter.',
    rutaFraccionado: 'Die Datei ist groß. Sie wird vollständig geliefert, innen aufgeteilt.',
    rutaExterno:
      'Die Datei ist sehr groß. Du gibst deinen eigenen Link an und teilst ihn mit dem Käufer.',
    ventajaRuta: 'Vorteil',
  },
  footer: {
    descripcion:
      'Marktplatz für Software, Vorlagen, digitale Produkte und Handwerk aus Kuba und der Welt.',
    colMarketplace: 'Marktplatz',
    colComprar: 'Kaufen',
    colVender: 'Verkaufen',
    colPlataforma: 'Plattform',
    enProductos: 'Produkte',
    enDestacados: 'Hervorgehoben',
    enEspacios: 'Plätze und Pakete',
    enCarrito: 'Warenkorb',
    enPagar: 'Zur Kasse',
    enDescargas: 'Meine Downloads',
    enFaq: 'Häufig gestellte Fragen',
    enPanel: 'Verkäuferbereich',
    enSubir: 'Produkt hochladen',
    enOwner: 'Owner-Konsole',
    enCrearCuenta: 'Konto erstellen',
    enContacto: 'Kontakt',
    enNosotros: 'Über uns',
    enTerminos: 'Bedingungen',
    enPrivacidad: 'Datenschutz',
    regla: 'Regel',
    comisionA: '{n}% für QBASwing',
    comisionBC: '{n}% Provision',
    sinContacto:
      'Der Owner hat noch keine Kontaktdaten veröffentlicht. Schreib über Telegram oder WhatsApp über die Schaltflächen oben.',
    patrocinadoPor: 'Gesponsert von',
    disenadoPor: 'Entworfen von',
    derechos: 'Alle Rechte vorbehalten',
    descargo:
      'QBASwing Marketplace ist keine Finanzinstitution und verwahrt keine Gelder. In Regel A läuft die Zahlung über das Gateway und die Plattform behält die 5%, die die Regel festlegt; in den Regeln B und C geht die Zahlung direkt an den Autor und die Plattform greift nicht ein. Die Download-Links digitaler Produkte dauern 5 Minuten und funktionieren nur für den Käufer. Digitale Produkte externer Autoren werden veröffentlicht, nachdem der Owner sie freigegeben hat.',
  },
  terminos: {
    titulo: 'Allgemeine Geschäftsbedingungen',
    ultimaActualizacion: 'Letzte Aktualisierung:',
    aceptacion: '1. Annahme der Bedingungen',
    aceptacionTexto:
      'Mit der Nutzung von QBASwing Marketplace akzeptierst du diese Bedingungen. Wenn du nicht einverstanden bist, nutze die Plattform nicht.',
    reglasComision: '2. Provisionsregeln',
    reglasComisionTexto:
      'Die drei Goldenen Regeln sind öffentlich: Regel A (externe digitale Güter): 5% für QBASwing, 95% für den Autor. Regel B (eigene digitale Güter): 0% Provision. Regel C (physische Produkte): 0% Provision, mit 60-Tage-Paket und wiederverwendbaren Plätzen.',
    comprasDescargas: '3. Käufe und Downloads',
    comprasDescargasTexto:
      'Nur wer ein digitales Produkt gekauft hat, kann es herunterladen. Der per E-Mail gesendete Download-Link läuft nach 5 Minuten ab und ist keine dauerhafte öffentliche Adresse. Die Lizenzen sind die, die der Verkäufer für dieses Produkt angibt.',
    publicacionModeracion: '4. Veröffentlichung und Moderation',
    publicacionModeracionTexto:
      'Produkte, die Regel A unterliegen, werden nach Freigabe des Owner veröffentlicht. Produkte der Regeln B und C können je nach Zustand ihrer Plätze veröffentlicht werden. Der Owner kann ein Produkt zurückziehen, das nicht dem entspricht, was auf seiner Seite erklärt wurde.',
    pagos: '5. Zahlungen',
    pagosTexto:
      'Die Zahlungen werden über die erklärten Gateways abgewickelt. Die Plattform verwahrt keine Gelder des Käufers, wenn es für die Verteilung nicht nötig ist. Die Auszahlungen an Verkäufer folgen dem im Bereich festgelegten Zyklus.',
    responsabilidad: '6. Haftung',
    responsabilidadTexto:
      'QBASwing Marketplace ist nicht verantwortlich für die von Verkäufern veröffentlichten Inhalte, behält sich aber das Recht vor, sie zu moderieren. Es werden keine stillschweigenden Garantien geboten, die nicht ausdrücklich hier geschrieben sind.',
  },
  privacidad: {
    titulo: 'Datenschutzrichtlinie',
    ultimaActualizacion: 'Letzte Aktualisierung:',
    queRecopilamos: '1. Daten, die wir erheben',
    queRecopilamosTexto:
      'Wir erheben nur, was für den Betrieb nötig ist: Kontodaten (Name und E-Mail), Informationen, die zur Abwicklung von Käufen nötig sind, und die minimalen Aufzeichnungen zur Missbrauchsprävention.',
    usoDatos: '2. Verwendung der Daten',
    usoDatosTexto:
      'Wir nutzen deine Daten nur, um den Dienst zu erbringen: authentifizieren, liefern, was du gekauft hast, Benachrichtigungen zu deinem Kauf oder deinem Konto senden und erfüllen, was die Zahlungsgateways verlangen.',
    cookies: '3. Cookies',
    cookiesTexto:
      'Wir verwenden unbedingt erforderliche Cookies. Das Identitäts-Cookie des Owner ist mit HMAC signiert und es werden keine sensiblen Informationen im Browser gespeichert.',
    comparticion: '4. Weitergabe von Daten',
    comparticionTexto:
      'Wir verkaufen oder vermieten deine Daten nicht. Wir teilen sie nur mit den Zahlungsgateways, wenn es nötig ist, um eine Transaktion abzuschließen, und immer mit dem Nötigsten.',
    seguridad: '5. Sicherheit',
    seguridadTexto:
      'Die Download-Links sind undurchsichtig, laufen nach 5 Minuten ab und werden gegen dein Konto geprüft. Wir legen keine öffentlichen Pfade für gekaufte Dateien offen.',
    derechos: '6. Deine Rechte',
    derechosTexto:
      'Du kannst Zugang, Berichtigung oder Löschung deiner Daten zu deinem Konto verlangen, solange sie keine Aufzeichnungen beeinträchtigen, die für bereits abgeschlossene Transaktionen nötig sind.',
  },
  faq: {
    subtitulo: 'Klare Antworten, keine erfundenen Versprechen.',
    error: 'Die häufig gestellten Fragen konnten nicht geladen werden.',
    sinPreguntas: 'Es sind noch keine häufig gestellten Fragen veröffentlicht.',
  },
  idioma: {
    titulo: 'Sprache',
    actual: 'Aktuelle Sprache',
    cambiar: 'Sprache ändern',
    conservaPagina: 'Behält die aktuelle Seite bei',
    guardado: 'Wir speichern deine Einstellung für den nächsten Besuch.',
    sinTraducir: 'Noch nicht übersetzt',
  },
  comun: {
    saltarContenido: 'Zum Inhalt springen',
    volver: 'Zurück',
    siguiente: 'Weiter',
    anterior: 'Vorherige',
    cerrar: 'Schließen',
    guardar: 'Speichern',
    cancelar: 'Abbrechen',
    confirmar: 'Bestätigen',
    cargando: 'Wird geladen...',
    noDisponible: 'Noch nicht verfügbar',
    nuevo: 'Neu',
    verTodo: 'Alle ansehen',
    paginaNoEncontrada: 'Seite nicht gefunden',
    paginaNoEncontradaTexto:
      'Die von dir geöffnete Adresse existiert nicht. Möglicherweise ist der Link falsch geschrieben oder die Seite wurde verschoben.',
    volverInicio: 'Zum Anfang',
  },
}

const IT: Diccionario = {
  nav: {
    productos: 'Prodotti',
    espacios: 'Spazi',
    vender: 'Vendere',
    carrito: 'Carrello',
    cuenta: 'Il mio account',
    panel: 'Pannello del venditore',
    owner: 'Amministrazione',
    buscar: 'Cerca prodotti',
    menu: 'Menu',
    cerrar: 'Chiudi',
    irInicio: 'QBASwing Marketplace, vai alla home',
    principal: 'Navigazione principale',
    entrar: 'Accedi al mio account',
    carritoCompras: 'Carrello',
  },
  vacio: {
    sinProductos: 'Non ci sono ancora prodotti pubblicati',
    sinProductosAyuda:
      'Appena i venditori pubblicheranno, i loro prodotti appariranno qui. Alcuni stanno già preparando il catalogo.',
    sinVentas: 'Non hai ancora vendite',
    sinVentasAyuda:
      'Quando qualcuno acquisterà uno dei tuoi prodotti, qui appariranno i dettagli e il link per il download.',
    sinCarrito: 'Il tuo carrello è vuoto',
    sinCarritoAyuda: 'Aggiungi prodotti dal catalogo per iniziare un acquisto.',
    sinPagos: 'Nessun pagamento in attesa di conferma',
    sinPagosAyuda:
      'I pagamenti via WhatsApp inviati dagli acquirenti appariranno qui perché tu li confermi.',
    sinOrdenes: 'Non hai ancora acquisti',
    sinOrdenesAyuda: 'I tuoi acquisti e i link per il download saranno qui.',
    sinResultados: 'Nessun prodotto corrisponde a questa ricerca',
    sinResultadosAyuda: 'Prova con meno parole o rimuovi i filtri.',
    sinLiquidaciones: 'Nessun pagamento in sospeso',
    sinLiquidacionesAyuda:
      'Quando si accumulerà quanto ti spetta, apparirà qui da incassare.',
  },
  error: {
    titulo: 'Non siamo riusciti a caricarlo',
    conexion:
      'Non è stato possibile contattare il server. Può essere la tua connessione o che il backend non sia ancora distribuito.',
    vacio: 'La risposta del server è arrivata vuota.',
    reintentar: 'Riprova',
    endpoint: 'Endpoint consultato',
  },
  regla: {
    A: 'Software di terze parti',
    B: 'Contenuto proprio',
    C: 'Artigianato e prodotti',
    comisionA: "5% per QBASwing, 95% per l'autore.",
    comisionB: "0% di commissione. L'autore prende il 100%.",
    comisionC: '0% di commissione sulla vendita.',
    titulo: "Regole d'Oro",
  },
  inicio: {
    lanzamiento: 'LANCIO UFFICIALE 2026',
    comisionFisicos: '{n}% DI COMMISSIONE SU FISICI E PROPRI',
    tasaFija: '{n}% TASSO FISSO SUI DIGITALI ESTERNI',
    tituloHero: 'Il marketplace creativo e tecnologico di Cuba, con regole di commissione',
    tituloHeroDestacado: 'pubblicate',
    heroParrafo:
      'Vendi o acquista software, modelli professionali, artigianato e prodotti fisici a Cuba e nel mondo. Le tre regole di commissione sono scritte prima del catalogo, e non cambiano senza che il Owner lo decida e resti registrato.',
    explorarCatalogo: 'Esplora il catalogo',
    abrirTienda: 'Apri il mio negozio',
    activacionInmediata: 'Attivazione immediata',
    sinTarjetas: 'Nessuna carta estera',
    descargaCompra: 'Scarica solo ciò che hai acquistato',
    economiaClara: 'Economia chiara',
    reglasTitulo: "Le 3 Regole d'Oro di QBASwing",
    reglasIntro:
      'Tre regole, scritte prima del catalogo. Ogni prodotto del marketplace appartiene a una di esse, e da lì deriva la sua commissione. Non c\'è una quarta regola né una commissione che si applichi "secondo il caso".',
    reglaATitulo: 'Regola A: digitali esterni',
    reglaA: 'Regola A',
    paraAutor: "{n}% per l'autore",
    reglaANombre: 'Digitali esterni',
    reglaALista1: 'Il pagamento passa dalla piattaforma',
    reglaALista2: "Si pubblica dopo l'approvazione del Owner",
    sinLimite: 'Nessun limite di pubblicazioni',
    reglaBTitulo: 'Regola B: digitali propri',
    reglaB: 'Regola B',
    deComision: 'di commissione',
    reglaBNombre: 'Digitali propri',
    reglaBLista1: "Pubblicazione diretta, senza attendere l'approvazione",
    reglaCTitulo: 'Regola C: prodotti fisici',
    reglaC: 'Regola C',
    paraVendedor: '{n}% per il venditore',
    reglaCNombre: 'Prodotti fisici',
    reglaCLista1: 'Pubblicazione diretta',
    reglaCLista2: 'Pacchetto di 60 giorni per categoria',
    reglaCLista3: 'Gli spazi si riutilizzano quando vendi',
    paraQuienEs: 'Per chi è',
    quePuedesHacer: 'Cosa puoi fare qui',
    quePuedesIntro:
      'Sei cose che il marketplace permette di fare con le regole che sono pubblicate. Nessuna è una promessa: è ciò che il sistema fa quando qualcuno pubblica, qualcuno compra e qualcuno incassa.',
    verFaq: 'Vedi le domande frequenti',
    usoSoftwareTitulo: 'Pubblica il tuo software e paga il 5%',
    usoSoftware:
      'Plugin, modelli, UI kit e font di autori esterni. Paghi il 5% per transazione elaborata e tieni il 95%. Senza limite di pubblicazioni e senza pagare un pacchetto.',
    usoRopaTitulo: 'Vendi abbigliamento, calzature e prodotti fisici',
    usoRopa:
      'Zero commissioni per vendita. Paghi un pacchetto di 60 giorni per categoria, e quando vendi lo spazio si libera per caricare il successivo senza pagare altro.',
    usoCobroTitulo: 'Incassa in CUP, USD o cripto',
    usoCobro:
      'Ogni prodotto ha il suo prezzo nella valuta che scegli. Nella Regola A il pagamento passa dalla piattaforma, che è ciò che rende esigibile il 5%.',
    usoEntregaTitulo: 'Consegna digitale con link di 5 minuti',
    usoEntrega:
      'Chi ha acquistato può riscaricare il suo file dal proprio account finché la licenza è valida. Il link via email dura 5 minuti: non è un indirizzo permanente del file.',
    usoTiendaTitulo: 'Apri il tuo negozio senza carta',
    usoTienda:
      'Non serve una carta bancaria di nessun paese per registrarti né per pubblicare. Nessun passaggio della registrazione la richiede.',
    usoDescargaTitulo: 'Scarica solo chi ha acquistato',
    usoDescarga:
      'Il download viene convalidato rispetto al tuo account, non rispetto a un link che si possa inoltrare. Se non hai acquistato, non esiste link valido.',
    paquetesLabel: 'Pubblica nel catalogo',
    paquetesTitulo: 'Pacchetti di spazi fisici',
    paquetesIntro: 'Un pacchetto non limita quante vendite fai: limita quanti prodotti hai',
    paquetesIntroFuerte: 'pubblicati allo stesso tempo',
    paquetesIntroResto:
      ', e dura 60 giorni. Ogni volta che ne vendi uno, lo spazio torna libero e ne carichi un altro senza pagare altro.',
    paquetesError: 'Non è stato possibile caricare i prezzi dei pacchetti in questo momento.',
    paquetesErrorAyuda: 'Ricarica la pagina. Se rimane così, scrivici su Telegram.',
    espacio: 'spazio',
    espacios: 'spazi',
    dias: 'giorni',
    verPaquete: 'Vedi il pacchetto',
    cicloTitulo: 'Come funziona il ciclo dello spazio',
    ciclo1Titulo: 'Pubblichi il tuo prodotto',
    ciclo1Texto: 'Occupa 1 dei tuoi spazi attivi durante i 60 giorni del pacchetto.',
    ciclo2Titulo: 'Si vende',
    ciclo2Texto:
      "L'acquirente paga nella valuta del prodotto. QBASwing non applica commissioni nella Regola C.",
    ciclo3Titulo: 'Lo spazio torna libero',
    ciclo3Texto:
      'Carichi subito il successivo. Non devi pagare un altro pacchetto finché quello attivo non scade.',
    destacadosLabel: 'Dal catalogo',
    verCatalogo: 'Vedi tutto il catalogo',
    catalogoVacio:
      'Il catalogo è vuoto perché nessuno ha ancora pubblicato, non perché qualcosa non funzioni. Il primo prodotto pubblicato apparirà qui.',
    sinDestacados:
      'Non ci sono prodotti in evidenza in questo momento. Il catalogo completo sì.',
    publicarPrimero: 'Pubblica il primo',
    explora: 'Esplora',
    cierreTitulo: 'Apri il tuo negozio o',
    cierreDestacado: 'acquista il meglio del talento cubano',
    cierreTexto:
      "Le commissioni sono pubblicate, gli spazi si riutilizzano e non serve nessuna carta straniera. L'unica cosa che manca ancora sono i prodotti: il catalogo inizia con te.",
    crearVendedor: 'Crea un account venditore',
    explorarSinRegistro: 'Esplora senza registrarti',
  },
  producto: {
    comprar: 'Acquista',
    agregar: 'Aggiungi al carrello',
    agregado: 'Aggiunto',
    precio: 'Prezzo',
    gratis: 'Gratis',
    vendedor: 'Venditore',
    categoria: 'Categoria',
    descripcion: 'Descrizione',
    detalles: 'Dettagli',
    plataforma: 'Piattaforma',
    licencia: 'Licenza',
    archivo: 'File',
    tamano: 'Dimensione',
    versiones: 'Versioni',
    desde: 'Da',
    opiniones: 'Recensioni',
    sinDescripcion: 'Il venditore non ha aggiunto una descrizione a questo prodotto.',
    filtros: 'Filtri',
    limpiar: 'Rimuovi filtri',
    ordenar: 'Ordina per',
    resultados: 'risultati',
    noEncontrado: 'Questo prodotto non esiste o non è più disponibile',
  },
  productos: {
    sinProductos: 'Non ci sono ancora prodotti pubblicati.',
    totalUno: '{n} prodotto in totale.',
    totalVarios: '{n} prodotti in totale.',
    buscar: 'Cerca',
    placeholderBusqueda: 'Cerca per titolo o descrizione...',
    todas: 'Tutte',
    todos: 'Tutti',
    digital: 'Digitale',
    fisico: 'Fisico',
    servicio: 'Servizio',
    ordenar: 'Ordina',
    masRecientes: 'Più recenti',
    precioMenorAMayor: 'Prezzo: dal più basso al più alto',
    precioMayorAMenor: 'Prezzo: dal più alto al più basso',
    filtrar: 'Filtra',
    errorCatalogo:
      'Non è stato possibile caricare il catalogo in questo momento. Riprova più tardi.',
    vacioAyuda: 'Il catalogo è vuoto. Il primo prodotto pubblicato apparirà qui.',
    publicarPrimero: 'Pubblica il primo',
    paginasCatalogo: 'Pagine del catalogo',
    pagina: 'Pagina',
    de: 'di',
  },
  ficha: {
    errorTitulo: 'Non è stato possibile mostrare questo prodotto',
    errorCarga: 'Errore durante il caricamento del prodotto',
    noEncontrado: 'Prodotto non trovato',
    noEncontradoTexto: 'Il prodotto che hai cercato non esiste o non è pubblicato.',
    faltaIdentificador: "Manca l'identificativo del prodotto.",
    cargaFallida: 'Non è stato possibile caricare il prodotto.',
    volverCatalogo: 'Torna al catalogo',
    destacado: 'In evidenza',
    anadirCarrito: 'Aggiungi al carrello',
    verVendedor: 'Vedi venditore',
    comoPagar: 'Come pagare',
    avisoPago:
      "I pagamenti si confermano a mano. Controlla di aver scritto bene il numero o l'indirizzo prima di inviare, e conserva la ricevuta.",
    publicado: 'Pubblicato',
    actualizado: 'Aggiornato',
  },
  vender: {
    metaDescripcion: 'Come vendere i tuoi prodotti su QBASwing Marketplace.',
    titulo: 'Vendere qui',
    subtitulo: "Cosa serve, nell'ordine in cui serve.",
    paso1Titulo: 'Crea il tuo account',
    paso1Texto:
      'Email e password. Con questo hai già un account e uno spazio tuo per iniziare a preparare il negozio.',
    paso2Titulo: 'Parla con il Owner',
    paso2Texto:
      "Si verifica chi sei e cosa vendi. È una conversazione, non un modulo automatico. È l'unico passaggio che non si può automatizzare.",
    paso3Titulo: 'Pubblichi i tuoi prodotti',
    paso3Texto:
      'Digitali, fisici o servizi. Il tuo negozio ha la sua pagina e le vendite si registrano da sole.',
    paso4Titulo: 'Ti arrivano i soldi',
    paso4Texto:
      "Quando l'acquirente riceve ciò che ha comprato. Il pagamento passa dalla piattaforma e la parte del venditore viene consegnata dopo la consegna verificata.",
    espaciosTitulo: 'Spazi per il tuo negozio',
    espaciosSubtitulo: 'Ogni pacchetto mette il tuo negozio in più punti del marketplace.',
    espaciosError: 'Non è stato possibile caricare i prezzi dei pacchetti.',
    espaciosVacio:
      'Non ci sono ancora pacchetti di spazi in vendita. Quando ci saranno, saranno qui con il loro prezzo.',
    espacio: 'spazio',
    espacios: 'spazi',
    durante: 'per',
    dias: 'giorni',
    pesos: 'Pesos',
    dolares: 'Dollari',
    euros: 'Euro',
    sinPrecio: 'Non ha ancora un prezzo assegnato.',
    leerTerminos: 'Leggi i termini',
  },
  vendedor: {
    errorTitulo: 'Non è stato possibile mostrare questo venditore',
    noEncontrado: 'Venditore non trovato',
    noEncontradoTexto: 'Questo venditore non esiste o non ha prodotti visibili.',
    sinDescripcion: 'Questo venditore non ha ancora una descrizione.',
    producto: 'prodotto',
    productos: 'prodotti',
    verificado: 'Verificato',
    sinProductos: 'Questo venditore non ha ancora prodotti visibili.',
    faltaIdentificador: "Manca l'identificativo del venditore.",
    cargaFallida: 'Non è stato possibile caricare il venditore.',
  },
  espacios: {
    intro:
      'Un pacchetto non limita quante vendite fai: limita quanti prodotti hai pubblicati allo stesso tempo, dura 60 giorni e gli spazi si riutilizzano quando vendi.',
    errorCarga: 'Non è stato possibile caricare i pacchetti in questo momento.',
    vacio: 'Non ci sono ancora pacchetti configurati.',
    espacio: 'spazio',
    espacios: 'spazi',
    dias: 'giorni',
  },
  carrito: {
    titulo: 'Carrello',
    vacio: 'Il tuo carrello è vuoto',
    descripcion: 'Ciò che hai aggiunto su QBASwing Marketplace.',
    sinBackend:
      'Questo sito non ha ancora un server configurato, quindi il carrello non può funzionare. Riprova più tardi.',
    cargando: 'Caricamento del carrello...',
    tituloVacio: 'Il tuo carrello è vuoto',
    vacioAyuda: 'Puoi aggiungere prodotti senza creare un account. Si salvano in questo browser.',
    verProductos: 'Vedi prodotti',
    antesDePagar: 'Prima di pagare',
    retiradoUno: '{n} prodotto non più disponibile. Rimuovilo per poter pagare.',
    retiradoVarios: '{n} prodotti non più disponibili. Rimuovili per poter pagare.',
    precioCambiado:
      "Il prezzo è cambiato da quando l'hai aggiunto. Controlla le righe contrassegnate.",
    variante: 'Variante: {variante}',
    vendidoPor: 'Venduto da {vendedor}',
    noDisponible: 'Questo prodotto non è più disponibile.',
    antesAhora: 'Prima {precio}. Ora ',
    seCobra: '. Si applica il nuovo.',
    lineaPrecio: '{cantidad} x {precio}',
    quitarUnidad: "Rimuovi un'unità di {titulo}",
    anadirUnidad: "Aggiungi un'unità di {titulo}",
    quitar: 'Rimuovi',
    totalUno: '{n} prodotto in {moneda}',
    totalVarios: '{n} prodotti in {moneda}',
    comisionPendiente:
      "La commissione della piattaforma non è ancora aggiunta: non c'è nessun gateway di pagamento collegato.",
    irAPagar: 'Vai a pagare',
    subtotal: 'Subtotale',
    comision: 'Commissione di QBASwing',
    total: 'Totale',
    checkout: 'Vai al pagamento',
    seguir: 'Continua a comprare',
    vaciar: 'Svuota carrello',
    unidades: 'unità',
  },
  pago: {
    titulo: 'Scegli come pagare',
    pasarela: 'Gateway',
    confirmar: 'Conferma pagamento',
    procesando: 'Elaborazione del pagamento...',
    esperando: 'In attesa di conferma',
    revisionManual:
      'Questo pagamento lo conferma una persona. Ti avvisiamo via email non appena viene elaborato.',
    rechazado: 'Non è stato possibile completare il pagamento',
    pendiente: 'Pagamento in sospeso',
    verificado: 'Pagamento confermato',
    reembolsado: 'Rimborsato',
    tiempoWebhook: 'Si conferma automaticamente',
    tiempoSondeo: 'Ci vogliono alcuni minuti',
    tiempoManual: 'Lo conferma una persona',
  },
  exito: {
    titulo: 'Pagamento ricevuto',
    descripcion: 'Conferma del pagamento su QBASwing Marketplace.',
    sinBackendTitulo: 'Il pagamento è stato ricevuto, ma non è ancora confermabile',
    sinBackendTexto:
      "Il gateway di pagamento non è ancora collegato a questo sito. Il tuo pagamento non è andato perso: resta registrato nel gateway e sarà accreditato quando l'integrazione sarà attiva.",
    volverInicio: 'Torna alla home',
    confirmando: 'Conferma del pagamento',
    compraDisponible: 'Il tuo acquisto è già disponibile nella tua libreria.',
    espera: 'Ci vuole qualche secondo. Non chiudere questa finestra.',
    referencia: 'Riferimento: {ref}',
    verificando: 'Verifica del pagamento con il gateway',
    biblioteca: 'Vai alla mia libreria',
  },
  fallo: {
    titulo: 'Pagamento annullato',
    descripcion: 'Il pagamento non è stato completato su QBASwing Marketplace.',
    noSeCompleto: 'Il pagamento non è stato completato',
    motivoSaldo: 'Il tuo account sul gateway non ha saldo sufficiente per completare il pagamento.',
    motivoRechazo: "Il gateway ha rifiutato l'operazione. Non è stato effettuato alcun addebito.",
    motivoTimeout:
      "L'operazione ha impiegato troppo tempo ed è stata annullata per proteggere il tuo denaro.",
    motivoUsuario: 'Hai annullato il pagamento prima di completarlo.',
    motivoCambio: 'Il tasso di cambio non era disponibile al momento del tentativo.',
    sinMotivo: 'Il pagamento non è stato completato.',
    referencia: 'Riferimento: {ref}',
    avisoCarrera:
      'Se avevi già completato il pagamento in banca o sul gateway e vedi questo, può trattarsi di un ritardo nella conferma. Controlla il tuo account tra qualche minuto prima di riprovare: non ti verrà addebitato due volte.',
    intentarDeNuevo: 'Riprova',
    volverCatalogo: 'Torna al catalogo',
    necesitasAyuda: 'Hai bisogno di aiuto?',
    escribinos: 'Scrivici',
  },
  registro: {
    descripcion: 'Crea il tuo account su QBASwing Marketplace.',
    subtitulo: "La tua email e la tua password. Nient'altro.",
    sinBackend:
      'Questo sito non ha ancora un server configurato, quindi non si può creare un account. Riprova più tardi.',
    ayudaContrasena:
      'Almeno 8 caratteri. Non può essere solo spazi né contenere la tua email.',
    creandoCuenta: "Creazione dell'account...",
    rellenaTresCampos: 'Compila i tre campi.',
    yaTienesCuenta: 'Hai già un account?',
    entraAqui: 'Accedi qui',
    sinJavaScript:
      'Per creare un account serve JavaScript: il sito è statico e non ha un server dove inviare il modulo. Attivalo e ricarica questa pagina.',
  },
  entrar: {
    titulo: 'Accedi',
    descripcion: 'Accedi al tuo account QBASwing Marketplace.',
    subtitulo: "Con l'email con cui ti sei registrato.",
    sinBackend:
      'Questo sito non ha ancora un server configurato, quindi non si può accedere. Riprova più tardi.',
    sinCuentaPregunta: 'Non hai un account?',
    crearAqui: 'Creane uno qui',
    escribeCorreoContrasena: 'Scrivi la tua email e la tua password.',
    entrando: 'Accesso...',
    sinJavaScript:
      'Per accedere serve JavaScript: il sito è statico e non ha un server dove inviare il modulo. Attivalo e ricarica questa pagina.',
  },
  cuenta: {
    entrar: 'Accedi',
    registro: 'Crea account',
    salir: 'Esci',
    correo: 'Email',
    contrasena: 'Password',
    nombre: 'Nome',
    recordar: 'Ricordami',
    sinCuenta: 'Non hai un account',
    conCuenta: 'Hai già un account',
    crear: 'Crea il mio account',
    miCuenta: 'Il mio account',
    biblioteca: 'I miei acquisti',
    perfil: 'Il mio profilo',
    descripcion: 'Il tuo account su QBASwing Marketplace.',
    registrado: 'Ciò che hai qui, così come è registrato.',
    campoCorreo: 'Email',
    campoContrasena: 'Password',
    mostrarContrasena: 'Mostra password',
    ocultarContrasena: 'Nascondi password',
    salirTitulo: 'Esci dal tuo account',
    salirTexto:
      "Dovrai accedere di nuovo con la tua email e la tua password. Questa sessione si chiude qui, non sugli altri dispositivi dove hai l'account aperto.",
    mantenerSesion: 'Mantieni sessione',
    salirCorto: 'Esci',
    saliendo: 'Uscita...',
  },
  panel: {
    titulo: 'Pannello del venditore',
    miPanel: 'Il mio pannello',
    descripcion: 'Il tuo pannello venditore su QBASwing Marketplace.',
    resumen: 'Il tuo negozio, la tua percentuale e le tue sessioni.',
    productos: 'Prodotti',
    ventas: 'Vendite',
    espacios: 'Spazi',
    nuevoProducto: 'Pubblica prodotto',
    editarProducto: 'Modifica prodotto',
    slotsUsados: 'Slot usati',
    slotsLibres: 'Slot liberi',
    slotsTotales: 'Slot del pacchetto',
    sinPaquete: 'Non hai un pacchetto di spazi attivo',
    sinPaqueteAyuda: 'Acquista un pacchetto per poter pubblicare prodotti.',
    bruto: 'Lordo',
    comision: 'Commissione',
    neto: 'Netto',
    porCobrar: 'Da incassare',
  },
  owner: {
    titulo: 'Amministrazione',
    administracion: 'Amministrazione',
    descripcion: 'Amministrazione di QBASwing Marketplace.',
    permiso: 'Il tuo account e ciò su cui hai permesso nel sito.',
    resumen: 'Riepilogo',
    ingresos: 'Entrate',
    pagosPendientes: 'Pagamenti da confermare',
    liquidaciones: 'Liquidazioni',
    configuracion: 'Configurazione',
    catalogo: 'Catalogo',
    usuarios: 'Utenti',
    exenciones: 'Esenzioni',
    confirmar: 'Conferma pagamento',
    rechazar: 'Rifiuta',
    evidencia: 'Prova',
    evidenciaAyuda:
      'Annota cosa hai visto per poterlo verificare dopo. Senza questo, il pagamento non può essere confermato.',
    confirmarAviso:
      'Conferma solo se hai visto la ricevuta. Questa azione resta registrata con il tuo nome.',
    cobrar: 'Segna come incassata',
    porVendedor: 'Per venditore',
    exentoComision: 'Esente da commissione',
    slotsIlimitados: 'Slot illimitati',
    alcance: 'Portata',
  },
  perfil: {
    misProductos: 'Prodotti',
    metodosCobro: 'Metodi di pagamento',
    metodosCobroAyuda:
      "Ogni venditore pubblica i suoi. L'acquirente ti paga direttamente a te.",
    redes: 'Social',
    ubicacion: 'Posizione',
    provincia: 'Provincia',
    municipio: 'Comune',
    direccion: 'Indirizzo',
    contacto: 'Contatto',
    whatsapp: 'WhatsApp',
    telefono: 'Telefono',
    sitioWeb: 'Sito web',
    desde: 'Venditore da',
    propietario: 'Proprietario',
    agregarMetodo: 'Aggiungi metodo di pagamento',
    redPlataforma: 'Piattaforma',
    redUsuario: 'Utente',
    mostrar: 'Mostra sul mio profilo',
  },
  nosotros: {
    titulo: 'Chi siamo',
    intro:
      'QBASwing Marketplace è una piattaforma per comprare e vendere prodotti digitali, fisici e servizi, con le regole di commissione pubblicate prima del catalogo.',
    mision: 'Missione',
    misionTexto:
      "Offrire uno spazio dove l'autore sa quale percentuale trattiene la piattaforma, dove si pubblicano le regole e dove nulla cambia senza restare registrato.",
    principios: 'Principi',
    principiosTexto:
      'Regole scritte, non mutevoli. Stati vuoti reali, non esempi inventati. Il download solo per chi ha acquistato, con link che scade dopo 5 minuti.',
    tresReglas: 'Le tre regole che guidano questo progetto',
    reglasTexto:
      "Nella Regola A, i prodotti digitali di autori esterni passano dalla piattaforma e QBASwing trattiene il 5%, lasciando il 95% all'autore. Nella Regola B, i prodotti digitali propri non hanno commissioni. Nella Regola C, i prodotti fisici non hanno commissioni e utilizzano il sistema di pacchetti di 60 giorni, con spazi che si riutilizzano quando vendi.",
    garantias:
      'Questo sito non offre garanzie che non siano scritte. Tutto ciò che viene pubblicato come promessa è, inoltre, scritto in queste pagine.',
  },
  contacto: {
    titulo: 'Contatto',
    intro:
      'Se hai una domanda su acquisti, vendite o su come funzionano le regole, puoi scriverci attraverso i canali che appaiono nel piè di pagina.',
    comoContactar: 'Come contattare',
    gestion:
      'I dati di contatto si gestiscono dal pannello del Owner. Finché non sono configurati, questa sezione resta vuota intenzionalmente, senza inserire dati di esempio.',
    verFaq: 'Vedi domande frequenti',
    aviso: 'Non chiediamo dati bancari via email. Non chiediamo mai le password.',
  },
  form: {
    titulo: 'Pubblica un prodotto',
    nombreProducto: 'Nome del prodotto',
    tipo: 'Tipo',
    resumen: 'Breve riepilogo',
    descripcionLarga: 'Descrizione completa',
    precio: 'Prezzo',
    moneda: 'Valuta',
    categorias: 'Categorie',
    imagenes: 'Immagini',
    archivo: 'File del prodotto',
    publicar: 'Pubblica',
    guardarBorrador: 'Salva come bozza',
    obligatorio: 'Questo campo è obbligatorio',
    demasiadoCorto: 'È troppo corto per essere utile',
    precioInvalido: 'Il prezzo deve essere maggiore di zero',
    rutaEntrega: 'Come verrà consegnato',
    rutaKv: "Si salva in QBASwing. L'acquirente lo scarica dal sito.",
    rutaFraccionado: "Il file è grande. Viene consegnato completo, suddiviso all'interno.",
    rutaExterno:
      "Il file è troppo grande. Inserisci il tuo link e lo condividi con l'acquirente.",
    ventajaRuta: 'Vantaggio',
  },
  footer: {
    descripcion:
      'Marketplace di software, modelli, prodotti digitali e artigianato di Cuba e del mondo.',
    colMarketplace: 'Marketplace',
    colComprar: 'Comprare',
    colVender: 'Vendere',
    colPlataforma: 'Piattaforma',
    enProductos: 'Prodotti',
    enDestacados: 'In evidenza',
    enEspacios: 'Spazi e pacchetti',
    enCarrito: 'Carrello',
    enPagar: 'Vai alla cassa',
    enDescargas: 'I miei download',
    enFaq: 'Domande frequenti',
    enPanel: 'Pannello del venditore',
    enSubir: 'Carica prodotto',
    enOwner: 'Console del Owner',
    enCrearCuenta: 'Crea account',
    enContacto: 'Contatto',
    enNosotros: 'Chi siamo',
    enTerminos: 'Termini',
    enPrivacidad: 'Privacy',
    regla: 'Regola',
    comisionA: '{n}% per QBASwing',
    comisionBC: '{n}% di commissione',
    sinContacto:
      'Il Owner non ha ancora pubblicato dati di contatto. Scrivi su Telegram o WhatsApp dai pulsanti qui sopra.',
    patrocinadoPor: 'Sponsorizzato da',
    disenadoPor: 'Progettato da',
    derechos: 'Tutti i diritti riservati',
    descargo:
      "QBASwing Marketplace non è un'istituzione finanziaria e non custodisce fondi. Nella Regola A il pagamento passa dal gateway e la piattaforma trattiene il 5% fissato dalla regola; nelle Regole B e C il pagamento va direttamente all'autore e la piattaforma non interviene. I link di download dei prodotti digitali durano 5 minuti e funzionano solo per chi ha acquistato. I prodotti digitali di autori esterni si pubblicano dopo che il Owner li approva.",
  },
  terminos: {
    titulo: 'Termini e condizioni',
    ultimaActualizacion: 'Ultimo aggiornamento:',
    aceptacion: '1. Accettazione dei termini',
    aceptacionTexto:
      "Usando QBASwing Marketplace accetti questi termini. Se non sei d'accordo, non usare la piattaforma.",
    reglasComision: '2. Regole di commissione',
    reglasComisionTexto:
      "Le tre Regole d'Oro sono pubbliche: Regola A (digitali esterni): 5% per QBASwing, 95% per l'autore. Regola B (digitali propri): 0% di commissione. Regola C (prodotti fisici): 0% di commissione, con pacchetto di 60 giorni e spazi riutilizzabili.",
    comprasDescargas: '3. Acquisti e download',
    comprasDescargasTexto:
      'Solo chi ha acquistato un prodotto digitale può scaricarlo. Il link di download inviato via email scade dopo 5 minuti e non è un indirizzo pubblico permanente. Le licenze sono quelle indicate dal venditore per quel prodotto.',
    publicacionModeracion: '4. Pubblicazione e moderazione',
    publicacionModeracionTexto:
      "I prodotti soggetti alla Regola A si pubblicano dopo l'approvazione del Owner. I prodotti delle Regole B e C possono essere pubblicati secondo lo stato dei loro spazi. Il Owner può ritirare un prodotto che non rispetti quanto dichiarato nella sua scheda.",
    pagos: '5. Pagamenti',
    pagosTexto:
      "I pagamenti vengono elaborati attraverso i gateway dichiarati. La piattaforma non custodisce fondi dell'acquirente quando non è necessario per la ripartizione. Le liquidazioni ai venditori seguono il ciclo definito nel pannello.",
    responsabilidad: '6. Responsabilità',
    responsabilidadTexto:
      'QBASwing Marketplace non è responsabile del contenuto pubblicato dai venditori, ma si riserva il diritto di moderarlo. Non si offrono garanzie implicite che non siano espressamente scritte qui.',
  },
  privacidad: {
    titulo: 'Informativa sulla privacy',
    ultimaActualizacion: 'Ultimo aggiornamento:',
    queRecopilamos: '1. Dati che raccogliamo',
    queRecopilamosTexto:
      "Raccogliamo solo il necessario per il funzionamento: dati dell'account (nome ed email), informazioni necessarie per elaborare gli acquisti e i registri minimi per prevenire abusi.",
    usoDatos: '2. Uso dei dati',
    usoDatosTexto:
      'Usiamo i tuoi dati unicamente per fornire il servizio: autenticare, consegnare ciò che hai acquistato, inviare notifiche relative al tuo acquisto o al tuo account, e rispettare ciò che richiedono i gateway di pagamento.',
    cookies: '3. Cookie',
    cookiesTexto:
      'Usiamo cookie strettamente necessari. Il cookie di identità del Owner è firmato con HMAC e non si salvano informazioni sensibili nel browser.',
    comparticion: '4. Condivisione dei dati',
    comparticionTexto:
      'Non vendiamo né affittiamo i tuoi dati. Li condividiamo solo con i gateway di pagamento quando è necessario per completare una transazione, e sempre con il minimo necessario.',
    seguridad: '5. Sicurezza',
    seguridadTexto:
      'I link di download sono opachi, scadono dopo 5 minuti e vengono convalidati rispetto al tuo account. Non esponiamo percorsi pubblici per i file acquistati.',
    derechos: '6. I tuoi diritti',
    derechosTexto:
      "Puoi richiedere l'accesso, la correzione o la cancellazione dei tuoi dati relativi al tuo account, purché non interferiscano con registri necessari per transazioni già completate.",
  },
  faq: {
    subtitulo: 'Risposte chiare, senza promesse inventate.',
    error: 'Non è stato possibile caricare le domande frequenti.',
    sinPreguntas: 'Non ci sono ancora domande frequenti pubblicate.',
  },
  idioma: {
    titulo: 'Lingua',
    actual: 'Lingua attuale',
    cambiar: 'Cambia lingua',
    conservaPagina: 'Mantiene la pagina attuale',
    guardado: 'Salviamo la tua preferenza per la prossima visita.',
    sinTraducir: 'Non ancora tradotto',
  },
  comun: {
    saltarContenido: 'Vai al contenuto',
    volver: 'Indietro',
    siguiente: 'Avanti',
    anterior: 'Precedente',
    cerrar: 'Chiudi',
    guardar: 'Salva',
    cancelar: 'Annulla',
    confirmar: 'Conferma',
    cargando: 'Caricamento...',
    noDisponible: 'Non ancora disponibile',
    nuevo: 'Nuovo',
    verTodo: 'Vedi tutto',
    paginaNoEncontrada: 'Pagina non trovata',
    paginaNoEncontradaTexto:
      "L'indirizzo che hai aperto non esiste. Forse il link è scritto male o la pagina è stata spostata.",
    volverInicio: 'Vai alla home',
  },
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
  en: EN,
  pt: PT,
  fr: FR,
  de: DE,
  it: IT,
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
