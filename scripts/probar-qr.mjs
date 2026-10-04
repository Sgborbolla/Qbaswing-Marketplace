/**
 * Prueba de los QR de cuenta bancaria.
 *
 * ============================================================================
 *  POR QUE HAY QUE DECODIFICAR Y NO SOLO GENERAR
 * ============================================================================
 * Un QR mal hecho es peor que no tener QR: se ve perfecto, es un cuadrado
 * negro con tres rincones, y no lo lee nadie. No da error, no salta nada, y el
 * unico sintoma es que el cliente no puede pagar y no sabe por que.
 *
 * Y aqui no hay forma de "mirarlo". Generar el QR es facil; comprobar que
 * alguien lo lee requiere un lector. Sin lector, la unica prueba posible seria
 * decir "ya esta" y suponer.
 *
 * Asi que se hace un viaje de ida y vuelta: se codifica el numero, se convierte
 * la matriz en pixeles como los veria una camara, y se decodifica esa imagen.
 * Si lo que sale de vuelta es exactamente lo que entro, el QR es legible por un
 * lector de verdad, porque `jsqr` es un lector independiente del generador.
 *
 * Que sean dos librerias distintas y no dos funciones del mismo paquete es lo que
 * da valor a la prueba. Con un solo paquete, un error de UTF-8 o un relleno mal
 * puesto searia coherente en las dos mitades y la prueba pasaria.
 *
 * ============================================================================
 *  LO QUE NO SE COMPRUEBA
 * ============================================================================
 * Que la aplicacion del banco lea este QR. El formato de QR de pago bancario es
 * una especificacion del banco, y aqui no hay forma de saber cual es: un QR con
 * el numero en texto plano lo lee la camara de cualquier telefono, pero si la
 * app espera otro formato, no.
 *
 * Lo que si se prueba es lo que depende de este codigo: que el numero completo
 * cabe, que se lee entero y que no se ha cortado ni un digito. El recorte es el
 * fallo tipico, porque las versiones de QR tienen un tamano maximo en bytes y un
 * numero con la referencia se acerca al limite sin avisar.
 */

import QRCode from 'qrcode'
import jsQR from 'jsqr'

/** Cuentas del Owner que van a llevar QR. */
const CUENTAS = [
  { clave: 'bpa', numero: '9204129979925122', color: '#00A650' },
  { clave: 'bandec', numero: '9224069992059523', color: '#D40000' },
]

/**
 * Convierte la matriz del QR en pixeles, como los veria una camara.
 *
 * `escala` es el numero de pixeles por modulo. Un QR de 1 pixel por modulo es
 * pequeno pero correcto; se agranda para que la lectura sea comoda.
 *
 * `margen` es la zona en blanco de alrededor. NO es decoracion: sin ella, el
 * lector no encuentra los tres codigos de esquina y falla o falla a veces
 * segun la camara. Es el fallo mas comun al montar un QR a mano.
 */
function aPixeles(matriz, escala, margen) {
  const lado = (matriz.size + margen * 2) * escala
  const pixeles = new Uint8ClampedArray(lado * lado * 4)

  // Rellenar de blanco. Se deja en 255 el alfa tambien, porque un alfa a cero
  // hace el pixel transparente y el lector lo ve como ruido.
  for (let i = 0; i < pixeles.length; i += 4) {
    pixeles[i] = 255
    pixeles[i + 1] = 255
    pixeles[i + 2] = 255
    pixeles[i + 3] = 255
  }

  for (let fila = 0; fila < matriz.size; fila++) {
    for (let col = 0; col < matriz.size; col++) {
      // `data` es un array plano: el valor de la posicion es el indice.
      if (!matriz.data[fila * matriz.size + col]) continue

      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const x = (col + margen) * escala + dx
          const y = (fila + margen) * escala + dy
          const p = (y * lado + x) * 4
          pixeles[p] = 0
          pixeles[p + 1] = 0
          pixeles[p + 2] = 0
        }
      }
    }
  }

  return { pixeles, lado }
}

/** Codifica, vuelve a pixeles y decodifica. Devuelve lo que el lector leyo. */
function leerConUnLector(texto) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' })
  const { pixeles, lado } = aPixeles(qr.modules, 6, 4)
  const leido = jsQR(pixeles, lado, lado)
  return { leido: leido?.data ?? null, modulos: qr.modules.size, version: qr.version }
}

let pruebas = 0
let fallos = 0

function comprobar(descripcion, condicion, detalle = '') {
  pruebas++
  if (condicion) {
    console.log(`  ok   ${descripcion}`)
  } else {
    fallos++
    console.log(`  FALLA ${descripcion}${detalle ? '  ->  ' + detalle : ''}`)
  }
}

console.log('\nQR de las cuentas del Owner\n')

for (const cuenta of CUENTAS) {
  console.log(`${cuenta.clave}  ${cuenta.numero.match(/.{1,4}/g).join(' ')}`)

  // El numero tal cual, que es lo que se codifica.
  const { leido, modulos, version } = leerConUnLector(cuenta.numero)

  comprobar('se lee y devuelve el numero entero', leido === cuenta.numero,
    `leido: ${JSON.stringify(leido)}`)

  // El fallo que de verdad duele: que el lector de UN digito menos y el
  // cliente no sepa que se ha equivocado. Por eso la comparacion es exacta.
  comprobar('no le falta ni le sobra un digito',
    leido !== null && leido.length === cuenta.numero.length)

  // Un QR que se lee tiene que caber en una version reasonably pequena. A partir
  // de la version 40 el modulo es tan pequeno que la camara de un telefono viejo
  // empieza a fallar, y el margen de error se lo lleva el cliente.
  comprobar('cabe en una version legible por camara de telefono', version <= 10,
    `version ${version}`)

  console.log(`       version ${version}, matriz de ${modulos}x${modulos}\n`)
}

console.log('\nQR con la referencia del pedido pegada al numero\n')

// Esto es lo que vera el cliente de verdad: el numero y, al lado, la referencia
// del pedido. Un QR que solo lleva el numero obliga a leer 16 digitos a mano en
// el formulario del banco; con la referencia dentro, el cliente no escribe nada.
for (const cuenta of CUENTAS) {
  const texto = `${cuenta.numero}\nRef: QBASWING-2026-0001`
  const { leido, version } = leerConUnLector(texto)

  comprobar(`${cuenta.clave}: numero y referencia se leen los dos`, leido === texto,
    `leido: ${JSON.stringify(leido)}`)
  comprobar(`${cuenta.clave}: sigue cabiendo en una version legible`, version <= 10,
    `version ${version}`)
}

console.log(`\n${pruebas - fallos}/${pruebas} correctas`)
if (fallos > 0) {
  console.log('\nUn QR que no se lee es peor que no tener QR: se ve bien y no lee.')
  process.exit(1)
}
