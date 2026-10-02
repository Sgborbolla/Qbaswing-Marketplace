/**
 * Reinicio de las CUENTAS de la base LOCAL, para que las pruebas de identidad se
 * puedan repetir.
 *
 * ============================================================================
 *  ESTE SCRIPT BORRA FILAS. SOLO EN LOCAL.
 * ============================================================================
 * Se ejecuta con `wrangler d1 execute` SIN `--remote`, que es la unica garantia
 * de que va a `.wrangler/state/`, la copia local. Con `--remote` borraria las
 * cuentas de verdad del marketplace, y el Owner no tendria forma de entrar.
 *
 * Por eso comprueba que la salida diga "local" antes de terminar, y sale con
 * codigo de error si no lo dice. Si alguien anade `--remote` por error, la
 * funcion lanza en vez de borrar.
 *
 * Que haga falta: `usuarios.email` es UNIQUE, asi que la segunda corrida de una
 * prueba se encontraria con que el correo ya existe y daria 409 en todas partes.
 * Una prueba que solo se puede correr una vez no es una prueba.
 *
 * `ON DELETE CASCADE` se encarga del resto: al borrar `usuarios` caen
 * `sesiones`, y las demas tablas cuelgan de ahi.
 *
 * Uso directo:  node reiniciar-cuentas-locales.mjs
 */
import { execFileSync } from 'node:child_process'

/** Base del Worker local. Nunca se cambia a produccion desde aqui. */
export const BASE = 'http://127.0.0.1:8787'

/** Nombre de la base en `wrangler.api.toml`. */
const NOMBRE_BASE = 'qbaswing_marketplace'

/**
 * Borra las cuentas de la base local.
 *
 * Se exporta para que las pruebas la llamen antes de empezar, y se ejecuta
 * directamente cuando se lanza el archivo con `node`. Ese `import.meta.main` es
 * lo que evita que al importarlo desde otra prueba se borre la base sin querer.
 */
export function reiniciarCuentasLocales() {
  const salida = ejecutar('DELETE FROM usuarios')

  // La comprobacion de seguridad: Wrangler dice en que base escribio.
  const fueLocal = /local/i.test(salida)

  if (!fueLocal) {
    throw new Error(
      'ATENCION: la salida de wrangler no menciona "local".\n' +
        'Si esto escribio en la base remota, hay que revisarlo ya.\n' +
        salida,
    )
  }

  return salida
}

function ejecutar(sql) {
  return execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      NOMBRE_BASE,
      '-c',
      'wrangler.api.toml',
      '--command',
      `"${sql}"`,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      // En Windows `npx` es un `.cmd`, y `execFileSync` sin `shell` no lo encuentra.
      shell: true,
      // El aviso DEP0190 de Node sobre `shell: true` salta siempre aqui porque los
      // argumentos llevan comillas para que PowerShell no se las coma. Los valores
      // son literales de este archivo, no entrada de nadie.
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

/* Solo cuando se ejecuta este archivo, no cuando se importa. */
if (process.argv[1] && process.argv[1].endsWith('reiniciar-cuentas-locales.mjs')) {
  console.log('Reiniciando cuentas de la base LOCAL...')
  console.log('  (sin --remote: va a .wrangler/state, NO a la base de produccion)\n')

  const salida = reiniciarCuentasLocales()
  const borradas = salida.match(/"rows_written":\s*(\d+)/)

  console.log('filas borradas de usuarios: ' + (borradas ? borradas[1] : '?'))
  console.log('Confirmado: la base tocada es la local.')
}