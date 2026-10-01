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
 * Las FAQ iniciales.
 *
 * Las respuestas estan escritas para ser ciertas con este proyecto: no hay
 * clientes que paguen todavia, los pagos por WhatsApp los confirma una persona,
 * y la comision es 5% solo en digitales de terceros.
 *
 * Escribirlas aqui y no inventarlas en el footer es la diferencia entre un sitio
 * que informa y uno que promete. Cuando las pasarelas esten listas, la respuesta
 * de QvaPay cambia de "proximamente" a "ya".
 */
export const FAQ_INICIALES: Omit<PreguntaFrecuente, 'id'>[] = [
  {
    pregunta: '¿Como compro en QBASwing?',
    respuesta:
      'Buscas el producto, lo agregas al carrito y eleges como pagar. Cuando el pago se confirma, el archivo queda disponible en tu cuenta para descargar.',
    orden: 1,
    activa: true,
  },
  {
    pregunta: '¿Que pasa con mi dinero si no recibo el producto?',
    respuesta:
      'Los pagos se confirman antes de liberar la descarga. Si un pago queda sin confirmar, no se te descuenta nada y no se habilita ningun enlace.',
    orden: 2,
    activa: true,
  },
  {
    pregunta: '¿Puedo descargar un producto mas de una vez?',
    respuesta:
      'Depende del producto. Los digitales con licencia vitalicia se pueden descargar las veces que quieras; los de licencia por tiempo se descarga mientras la licencia este activa.',
    orden: 3,
    activa: true,
  },
  {
    pregunta: '¿Cuanto cobra QBASwing por vender?',
    respuesta:
      'Si vendes software o contenido de otro autor, QBASwing retiene 5%. Si el producto es tuyo, no hay comision. Los productos fisicos y artesanias tampoco pagan comision.',
    orden: 4,
    activa: true,
  },
  {
    pregunta: '¿Que necesito para publicar un producto?',
    respuesta:
      'Una cuenta y un paquete de espacios. El paquete no limita cuantas ventas hacés: limita cuantos productos podés tener publicados al mismo tiempo.',
    orden: 5,
    activa: true,
  },
  {
    pregunta: '¿Como recibo los pagos de mis ventas?',
    respuesta:
      'Vos publicas tus propias formas de pago —transferencia, Zelle, cripto, lo que uses— y el comprador te paga directamente a vos. QBASwing no retiene tu dinero.',
    orden: 6,
    activa: true,
  },
  {
    pregunta: '¿Puedo cancelar un pago?',
    respuesta:
      'Si el pago se hizo por QvaPay o TropiPay, la plataforma no puedeCancelarlo: la devolucion la hace la pasarela. Si pagaste por WhatsApp, escribenos y lo vemos.',
    orden: 7,
    activa: true,
  },
  {
    pregunta: '¿QBASwing guarda mis datos?',
    respuesta:
      'Guardamos lo necesario para entregarte lo que compro: tu correo, las transacciones y los enlaces de descarga. No vendemos ni cedemos esos datos a terceros.',
    orden: 8,
    activa: true,
  },
  {
    pregunta: '¿El sitio funciona sin conexion?',
    respuesta:
      'No. Es un sitio web y necesita conexion, como cualquier otro. Lo que si garantizamos es que los archivos que compres los puedas volver a bajar desde tu cuenta.',
    orden: 9,
    activa: true,
  },
  {
    pregunta: '¿Como reporto un producto o un vendedor?',
    respuesta:
      'Escribenos desde la pagina de contacto. Cada reporte se revisa y queda registrado.',
    orden: 10,
    activa: true,
  },
]