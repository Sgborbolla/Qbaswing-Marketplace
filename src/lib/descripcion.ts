/**
 * Descripcion de producto con formato, tipo Amazon.
 *
 * ============================================================================
 *  POR QUE ESTE MODULO Y NO UNA LIBRERIA
 * ============================================================================
 * El vendedor escribe texto en un textarea y la ficha tiene que mostrarlo con
 * titulos, listas y negritas sin abrir una puerta a XSS. Traer `marked` mas un
 * sanitizador son dos dependencias y una capa de configuracion para un
 * subconjunto chico; aqui el texto se escapa PRIMERO y despues solo se insertan
 * etiquetas que genera este archivo, asi que no entra codigo ajeno que ejecute:
 * la seguridad no depende de que una lista de etiquetas permitidas este bien,
 * sino de que no pasa nada de fuera.
 *
 * ============================================================================
 *  QUE SOPORTA
 * ============================================================================
 *   Titulo        TITULO
 *                 ========    (h3)   o  -----  (h4), y tambien # / ## ###
 *   Lista         - item       o  1. item
 *   Negrita       **texto**    o  __texto__
 *   Cursiva       *texto*
 *   Codigo        `texto`
 *   Enlace        [texto](https://...)
 *   Imagen        ![alternativa](https://...)   (solo https, loading="lazy")
 *   Salto         una linea nueva que corta a media frase se une a la
 *                 anterior; si la anterior termina en punto o la siguiente
 *                   empieza en mayuscula, hay salto real. Asi un texto pegado
 *                   con ajuste de 70 caracteres se lee como parrafo, y una
 *                   tabla de precios escrita linea a linea no se funde en una
 *                   sola.
 *
 * Lo que no esta en la lista no se interpreta: el HTML crudo se escapa y se
 * muestra como texto, que es lo correcto para un textarea.
 */

/** Los cinco caracteres que pueden romper el HTML, y solo esos. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** URL apta para un `<a>`: http o https. `null` para `javascript:` y demas. */
function enlaceSeguro(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * URL apta para un `<img>`: solo https.
 *
 * La pagina se sirve por https y una imagen http la bloquea el navegador como
 * contenido inseguro: aceptarla seria prometer algo que no se puede cumplir.
 */
function imagenSegura(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * Un solo patron alternativo para todo lo inline.
 *
 * Va en orden: la imagen antes que el enlace (comparten el corchete inicial),
 * la negrita antes que la cursiva (comparten el asterisco). Al ser UN `replace`,
 * cada parte de la linea se toca una sola vez y lo que se sustituye no vuelve a
 * mirarse: no hace falta ningun centinela intermedio.
 */
const PATRON_INLINE =
  /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*?)\*/g

/** Da formato dentro de una linea. Recibe texto YA escapado. */
function enLinea(escapado: string): string {
  return escapado.replace(PATRON_INLINE, (...args: unknown[]) => {
    const coincide = String(args[0])
    const g = args.slice(1, 9).map((x) => (typeof x === 'string' ? x : undefined))

    // ![alt](url)
    if (g[0] !== undefined) {
      const segura = imagenSegura(g[1] ?? '')
      if (segura) return `<img src="${segura}" alt="${g[0]}" loading="lazy" />`
      return g[0]
    }
    // [texto](url)
    if (g[2] !== undefined) {
      const segura = enlaceSeguro(g[3] ?? '')
      if (segura) return `<a href="${segura}" target="_blank" rel="noopener nofollow">${g[2]}</a>`
      return coincide
    }
    // `codigo`
    if (g[4] !== undefined) return `<code>${g[4]}</code>`
    // **negrita** / __negrita__
    if (g[5] !== undefined) return `<strong>${g[5]}</strong>`
    if (g[6] !== undefined) return `<strong>${g[6]}</strong>`
    // *cursiva*
    if (g[7] !== undefined) return `<em>${g[7]}</em>`
    return coincide
  })
}

/**
 * Como se unen dos lineas consecutivas del mismo bloque: `<br />` o espacio.
 *
 * Salto si la anterior termina una frase (punto, interrogacion, dos puntos...)
 * o si la siguiente empieza en mayuscula o digito: eso separa la tabla de
 * precios escrita linea a linea de un parrafo cortado a media frase, que se
 * une con espacio para que se lea corrido.
 */
function pegarLineas(antes: string, despues: string): string {
  const finDeFrase = /[.!?…:;]/.test(antes.slice(-1))
  const mayuscula = /^[0-9A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00bf\u00a1]/.test(despues)
  return finDeFrase || mayuscula ? '<br />' : ' '
}

/**
 * Texto de descripcion a HTML seguro para la ficha.
 *
 * Se llama en el build (la ficha es HTML estatico), no en el navegador.
 */
export function aHtmlSeguro(texto: string): string {
  if (!texto.trim()) return ''

  const lineas = texto.replace(/\r\n?/g, '\n').split('\n')
  const salida: string[] = []
  let parrafo: Array<{ crudo: string; html: string }> = []
  let lista: 'ul' | 'ol' | null = null
  // La ultima `<li>` abierta: una linea que la continua se le pega a ella,
  // no cierra la lista (mismo criterio de "lazy continuation" que el markdown).
  let ultimoLi: { indice: number; crudo: string } | null = null

  const cerrarParrafo = (): void => {
    if (parrafo.length === 0) return
    let dentro = ''
    for (let i = 0; i < parrafo.length; i++) {
      if (i > 0) dentro += pegarLineas(parrafo[i - 1].crudo, parrafo[i].crudo)
      dentro += parrafo[i].html
    }
    salida.push(`<p>${dentro}</p>`)
    parrafo = []
  }

  const cerrarLista = (): void => {
    if (!lista) return
    salida.push(lista === 'ul' ? '</ul>' : '</ol>')
    lista = null
    ultimoLi = null
  }

  const abrirLista = (tipo: 'ul' | 'ol'): void => {
    if (lista !== tipo) {
      cerrarLista()
      salida.push(tipo === 'ul' ? '<ul>' : '<ol>')
      lista = tipo
    }
  }

  const cerrarTodo = (): void => {
    cerrarParrafo()
    cerrarLista()
  }

  for (let i = 0; i < lineas.length; i++) {
    const t = lineas[i].trim()

    if (t === '') {
      cerrarTodo()
      continue
    }

    // Titulo setext: una linea de texto seguida de ==== o ----.
    const siguiente = (lineas[i + 1] ?? '').trim()
    const esTituloSetext = !/^[-*\u2022]\s/.test(t) && /^(={3,}|-{3,})$/.test(siguiente)
    if (esTituloSetext) {
      cerrarTodo()
      salida.push(
        siguiente.startsWith('=')
          ? `<h3>${enLinea(escapar(t))}</h3>`
          : `<h4>${enLinea(escapar(t))}</h4>`,
      )
      i++
      continue
    }

    // Raya suelta (--- / === con lineas vacias alrededor): separador.
    if (/^(={3,}|-{3,})$/.test(t)) {
      cerrarTodo()
      salida.push('<hr />')
      continue
    }

    const atx = /^(#{1,6})\s+(.+)$/.exec(t)
    if (atx) {
      cerrarTodo()
      const nivel = atx[1].length <= 3 ? 'h3' : 'h4'
      salida.push(`<${nivel}>${enLinea(escapar(atx[2].trim()))}</${nivel}>`)
      continue
    }

    const vineta = /^[-*\u2022]\s+(.+)$/.exec(t)
    if (vineta) {
      cerrarParrafo()
      abrirLista('ul')
      salida.push(`<li>${enLinea(escapar(vineta[1]))}</li>`)
      ultimoLi = { indice: salida.length - 1, crudo: vineta[1] }
      continue
    }

    const numerada = /^\d+[.)]\s+(.+)$/.exec(t)
    if (numerada) {
      cerrarParrafo()
      abrirLista('ol')
      salida.push(`<li>${enLinea(escapar(numerada[1]))}</li>`)
      ultimoLi = { indice: salida.length - 1, crudo: numerada[1] }
      continue
    }

    // Texto plano: si la lista esta abierta, la linea continua el ultimo
    // punto (el texto pegado con ajuste corta las viñetas a media frase).
    if (lista && ultimoLi) {
      const abierto = salida[ultimoLi.indice].replace(/<\/li>$/, '')
      salida[ultimoLi.indice] =
        `${abierto}${pegarLineas(ultimoLi.crudo, t)}${enLinea(escapar(t))}</li>`
      ultimoLi.crudo = t
      continue
    }

    if (lista) cerrarLista()
    parrafo.push({ crudo: t, html: enLinea(escapar(t)) })
  }

  cerrarTodo()
  return salida.join('\n')
}
