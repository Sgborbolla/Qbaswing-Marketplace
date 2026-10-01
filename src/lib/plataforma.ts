/**
 * Redes sociales y datos de contacto de la plataforma.
 *
 * ============================================================================
 *  POR QUE ESTA EN LA BASE Y NO EN EL CODIGO
 * ============================================================================
 * El Owner edita esto desde el panel. Es la razon de que el footer sea
 * "empresarial": el que administra el marketplace cambia sus redes, su correo
 * de contacto y su direccion sin que nadie toque una linea de codigo ni
 * redespliegue nada.
 *
 * La alternativa —tenerlo escrito en el .astro— significa que cambiar una URL de
 * Instagram requiere un commit, una revision y un despliegue. Para algo que se
 * cambia cada pocos meses, eso es una barrera que hace que la gente termine no
 * actualizandolo, y un footer con el Instagram equivocado se ve peor que uno
 * sin Instagram.
 *
 * ============================================================================
 *  LO QUE NO SE HACE ACA: INVENTAR USUARIOS
 * ============================================================================
 * No hay ningun `@usuario` de ejemplo. Las redes se guardan vacias hasta que
 * el Owner las complete, y el componente dibuja un icono deshabilitado en vez de
 * un enlace que lleva a la cuenta de otro.
 *
 * Un enlace a un perfil inexistente es peor que no tener enlace: el visitante
 * hace clic, ve que la cuenta no existe, y concluye que el marketplace es falso.
 */

/** Una red social del marketplace. */
export interface RedSocialPlataforma {
  id: string
  /** Nombre visible, editable por el Owner. */
  etiqueta: string
  /** Nombre del icono de Material Symbols. */
  icono: string
  /** Con que clase se construye la URL. `usuario` = base + usuario. */
  tipo: 'usuario' | 'url'
  /** Base de la URL, cuando `tipo` es 'usuario'. */
  base?: string
  /** Donde va el enlace. Vacio = todavia no configurada. */
  valor: string
  activo: boolean
  /**
   * Si aparece cuando el valor esta vacio.
   *
   * Por defecto NO. Un footer lleno de iconos muertos es ruido. Pero hay un
   * caso: si el Owner quiere que se vea que la plataforma tiene esa red aunque
   * todavia no haya puesto el usuario, lo marca aqui.
   */
  mostrarVacia: boolean
  orden: number
}

/**
 * Las redes que el marketplace tiene previstas.
 *
 * Se crean vacias al aplicar el esquema. El Owner las completa desde el panel.
 *
 * La de Discord esta aparte porque es la que mas se usa para soporte en Cuba,
 * donde WhatsApp es el canal principal y Discord casi no. Se incluye porque el
 * Owner la pidio como "otro que recomiendas": es la unica que sirve para
 * comunidad tecnica, que es el publico de los productos digitales.
 */
/**
 * `valor: ''` esta EXPLICITO en cada red, y no se omite con `Omit`.
 *
 * La version anterior era `Omit<RedSocialPlataforma, 'id' | 'valor'>`. Parecia
 * correcta, pero rompia dos cosas:
 *
 *   1. El componente que dibuja el footer lee `red.valor` para decidir si pinta
 *      el icono o lo deja deshabilitado. Con `valor` fuera del tipo, esa
 *      lectura no compila y el footer entero queda sin verificar.
 *   2. Ocultar el campo daba a entender que "no existe todavia", cuando en
 *      realidad SI existe y vale cadena vacia. La fila esta en la base con
 *      `valor = ''`, no con `valor` ausente.
 *
 * Escribir la cadena vacia a mano en las ocho es lo correcto: obliga a que se
 * vea, y si alguien agrega una red nueva tiene que decidir en el momento si la
 * deja vacia o no.
 */
export const REDES_INICIALES: Omit<RedSocialPlataforma, 'id'>[] = [
  {
    etiqueta: 'Facebook',
    icono: 'facebook',
    tipo: 'usuario',
    base: 'https://facebook.com/',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 1,
  },
  {
    etiqueta: 'Instagram',
    icono: 'photo_camera',
    tipo: 'usuario',
    base: 'https://instagram.com/',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 2,
  },
  {
    etiqueta: 'LinkedIn',
    icono: 'work',
    tipo: 'usuario',
    base: 'https://linkedin.com/in/',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 3,
  },
  {
    etiqueta: 'YouTube',
    icono: 'smart_display',
    tipo: 'usuario',
    base: 'https://youtube.com/@',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 4,
  },
  {
    etiqueta: 'GitHub',
    icono: 'code',
    tipo: 'usuario',
    base: 'https://github.com/',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 5,
  },
  {
    etiqueta: 'Discord',
    icono: 'forum',
    tipo: 'url',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 6,
  },
  {
    etiqueta: 'Telegram',
    icono: 'send',
    tipo: 'usuario',
    base: 'https://t.me/',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 7,
  },
  {
    etiqueta: 'WhatsApp',
    icono: 'chat',
    tipo: 'url',
    valor: '',
    activo: true,
    mostrarVacia: false,
    orden: 8,
  },
]

/** Construye el href de una red, o `null` si todavia no esta configurada. */
export function urlDeRed(red: RedSocialPlataforma): string | null {
  const valor = red.valor.trim()
  if (!valor) return null
  if (red.tipo === 'url') {
    return valor.startsWith('http') ? valor : `https://${valor}`
  }
  return `${red.base ?? ''}${valor.replace(/^@/, '')}`
}

/* ===========================================================================
 * Preguntas frecuentes
 * ======================================================================== */

export interface PreguntaFrecuente {
  id: string
  pregunta: string
  respuesta: string
  orden: number
  activa: boolean
}

/**
 * Las FAQ iniciales, y por que son COPIA de la base y no la fuente.
 *
 * ============================================================================
 *  ESTO NO ES LA VERDAD: LA VERDAD ESTA EN `faq`
 * ============================================================================
 * Las veinte respuestas viven en `migrations/0002_datos_plataforma.sql` y las
 * edita el Owner desde el panel. Esta constante es el CONTINGENTE: lo que se
 * usa cuando la API no responde, para que el footer no se rompa.
 *
 * Se sincroniza a mano con la base, y esa es la parte debil. Por eso las
 * preguntas salen de la API en cuanto el Worker esta desplegado, y esta lista
 * solo aparece si la peticion falla. Un sitio caido muestra la copia vieja; uno
 * funcionando muestra lo que el Owner escribio hoy.
 *
 * ============================================================================
 *  POR QUE NO SE ESCRIBEN MAS DE LAS QUE HAY
 * ============================================================================
 * Una FAQ mal respondida es peor que una FAQ ausente. Las respuestas hablan de
 * pagos, de descargas y de comisiones, y las tres cosas las decide el
 * Documento Maestro. Inventar una respuesta que suene razonable es el modo mas
 * barato de romper una promesa: nadie la va a auditar hasta que alguien la
 * lea y la cumpla.
 *
 * Cuando se escriba una respuesta nueva, va primero en la migracion y despues
 * aca, con el mismo texto. Si divergen, manda la base.
 */
export const FAQ_INICIALES: Omit<PreguntaFrecuente, 'id'>[] = [
  {
    orden: 1,
    pregunta: '¿Como compro en QBASwing?',
    respuesta:
      'Buscas el producto, lo agregas al carrito y elegis como pagar. Cuando el pago se confirma, el archivo queda disponible en tu cuenta para descargar. No hace falta crear cuenta para comprar, pero si la necesitas para descargar.',
    activa: true,
  },
  {
    orden: 2,
    pregunta: '¿Que metodos de pago aceptan?',
    respuesta:
      'QBASwing trabaja con QvaPay y TropiPay para pagos con tarjeta, y permite pagar con Gently. Cada vendedor puede publicar sus propias formas de pago —transferencia, Zelle, cripto— y esas aparecen en la ficha del producto.',
    activa: true,
  },
  {
    orden: 3,
    pregunta: '¿Puedo pagar desde Cuba con tarjeta?',
    respuesta:
      'Si, por eso existen QvaPay y TropiPay: son pasarelas que funcionan con las tarjetas y las restricciones de conexion que hay en la isla. La forma exacta depende de lo que tu banco autorice.',
    activa: true,
  },
  {
    orden: 4,
    pregunta: '¿Cuanto tarda en confirmarse un pago?',
    respuesta:
      'Con QvaPay y TropiPay la confirmacion es automatica y llega en segundos. Con Gently, o con pagos directos al vendedor, hay que esperar a que una persona revise el comprobante: puede tardar unas horas.',
    activa: true,
  },
  {
    orden: 5,
    pregunta: '¿Puedo comprar sin conexion?',
    respuesta:
      'No. Es un sitio web y necesita conexion. Lo que si garantizamos es que, una vez que compraste, puedas volver a bajar tus archivos desde tu cuenta tantas veces como quieras.',
    activa: true,
  },
  {
    orden: 6,
    pregunta: '¿Que pasa con mi dinero si no recibo el producto?',
    respuesta:
      'Los pagos se confirman antes de liberar cualquier descarga. Si un pago queda sin confirmar, no se te descuenta nada y no se habilita ningun enlace.',
    activa: true,
  },
  {
    orden: 7,
    pregunta: '¿Puedo cancelar un pago?',
    respuesta:
      'Los pagos hechos con QvaPay o TropiPay los cancela la propia pasarela, no la plataforma. Si pagaste por otro medio, escribinos y lo vemos caso por caso.',
    activa: true,
  },
  {
    orden: 8,
    pregunta: '¿QBASwing guarda mis datos?',
    respuesta:
      'Guardamos lo necesario para entregarte lo que compro: tu correo, las transacciones y los enlaces de descarga. No vendemos ni cedemos esos datos a terceros.',
    activa: true,
  },
  {
    orden: 9,
    pregunta: '¿Como sé que los archivos que subo estan seguros?',
    respuesta:
      'QBASwing no ejecuta ni abre lo que los vendedores publican. Se guarda cifrado y se sirve como descarga directa, nunca como pagina. Los ejecutables de tipo .exe, .dll, .scr y .bat no se admiten.',
    activa: true,
  },
  {
    orden: 10,
    pregunta: '¿Que pasa si un vendedor no responde un reporte?',
    respuesta:
      'Cada reporte queda registrado con fecha y se revisa. Si un producto o un vendedor incumple las reglas, se puede ocultar el producto o suspender la cuenta, y queda constancia de la decision.',
    activa: true,
  },
  {
    orden: 11,
    pregunta: '¿Cuanto cobra QBASwing por vender?',
    respuesta:
      'Depende de que vendes. Si vendes software, plantillas o contenido de otro autor, QBASwing retiene 5%. Si el producto es tuyo, no hay comision. Los productos fisicos y artesanias tampoco pagan comision.',
    activa: true,
  },
  {
    orden: 12,
    pregunta: '¿Que necesito para empezar a vender?',
    respuesta:
      'Una cuenta con correo verificado y un paquete de espacios. El paquete no limita cuantas ventas podes hacer: limita cuantos productos podes tener publicados al mismo tiempo.',
    activa: true,
  },
  {
    orden: 13,
    pregunta: '¿Como recibo el dinero de mis ventas?',
    respuesta:
      'Vos publicas tus propias formas de pago y el comprador te paga directamente a vos. QBASwing no te retiene el dinero en una cuenta intermedia ni te pide datos bancarios.',
    activa: true,
  },
  {
    orden: 14,
    pregunta: '¿Los espacios del paquete se renuevan si no los uso?',
    respuesta:
      'No. Un paquete dura 60 dias naturales desde que se activa. Si no usas los espacios, se pierden. Publica lo que tengas antes de que venza, o renueva antes.',
    activa: true,
  },
  {
    orden: 15,
    pregunta: '¿Puedo vender algo que es de otro?',
    respuesta:
      'Si sos el autor o tenes permiso, si. Publicar el trabajo de otra persona sin permiso es la unica forma de que te suspendamos la cuenta, y no hay segunda oportunidad para eso.',
    activa: true,
  },
  {
    orden: 16,
    pregunta: '¿Como funciona el enlace de descarga?',
    respuesta:
      'Cuando tu pago se confirma, se genera un enlace que caduca en 5 minutos. Es un permiso temporal, no una URL permanente: por eso el archivo no queda expuesto en un link que alguien pueda copiar y reenviar.',
    activa: true,
  },
  {
    orden: 17,
    pregunta: '¿Puedo descargar un producto mas de una vez?',
    respuesta:
      'Depende del producto. Los digitales con licencia vitalicia se pueden descargar las veces que quieras; los de licencia por tiempo, mientras la licencia este activa.',
    activa: true,
  },
  {
    orden: 18,
    pregunta: '¿El marketplace esta disponible en otros idiomas?',
    respuesta:
      'Si. El sitio tiene 22 idiomas y podes cambiarlo desde el icono de arriba a la derecha. El idioma que elijas se mantiene al navegar y no te saca de la pagina que estabas viendo.',
    activa: true,
  },
  {
    orden: 19,
    pregunta: '¿Como reporto un producto o un vendedor?',
    respuesta:
      'Escribinos desde la pagina de contacto. Cada reporte se revisa y queda registrado con fecha.',
    activa: true,
  },
  {
    orden: 20,
    pregunta: '¿Puedo pedir que borren mis datos?',
    respuesta:
      'Si. Escribinos desde contacto indicando tu correo. Borramos tu cuenta y los datos que ya no sean necesarios para entregarte algo que aun no entregamos.',
    activa: true,
  },
]