#!/usr/bin/env node
/**
 * Comprueba que una imagen publica se sirve igual DOS veces seguidas.
 *
 * ============================================================================
 *  POR QUE EXISTE
 * ============================================================================
 * Este script nace de un fallo real que no se veia en la primera peticion:
 *
 *   - la PRIMERA vez, la imagen venia del KV y se servia con 200;
 *   - a partir de la SEGUNDA, venia de la Cache API y daba 500.
 *
 * La causa era que una `Response` sacada de `cache.match()` tiene las cabeceras
 * congeladas, y el despacho del Worker hace `headers.set` para anadir CORS: `set`
 * sobre cabeceras congeladas lanza `TypeError`. Y no se notaba porque el
 * navegador, con `Cache-Control: immutable`, no vuelve a pedir la misma imagen:
 * el fallo solo lo veia quien la pedia sin cache propia, como un bot o curl.
 *
 * De ahi la forma del script: pide la MISMA url dos veces y exige 200 en las dos.
 * Comprobar solo la primera no prueba nada.
 *
 * Uso:
 *   node scripts/probar-imagenes.mjs
 *   node scripts/probar-imagenes.mjs https://.../api/imagenes/img/2/4/xxx.png
 */

const API = process.env.QBASWING_API ?? 'https://qbaswing-api.sgborbolla.workers.dev'

const CABECERAS = {
  // Un User-Agent de navegador: la API no filtra por uno, pero asi la prueba se
  // parece a lo que hace de verdad quien entra al sitio.
  'User-Agent': 'Mozilla/5.0 (compatible; probar-imagenes/1.0)',
}

/** La primera imagen del catalogo, para no tener que pasar una url a mano. */
async function urlDeEjemplo() {
  const respuesta = await fetch(`${API}/api/productos?por_pagina=1`, { headers: CABECERAS })
  const cuerpo = await respuesta.json()
  const primera = cuerpo?.productos?.[0]?.imagen
  if (!primera) throw new Error('No hay ningun producto con imagen en el catalogo.')
  return primera
}

async function pedir(url) {
  const respuesta = await fetch(url, { headers: CABECERAS })
  // Se lee el cuerpo entero: un cuerpo que no se consume no prueba que la
  // respuesta completa viaje bien.
  const bytes = (await respuesta.arrayBuffer()).byteLength
  return { estado: respuesta.status, tipo: respuesta.headers.get('content-type'), bytes }
}

async function principal() {
  const url = process.argv[2] ?? (await urlDeEjemplo())
  console.log('=== probar imagenes ===')
  console.log(`url: ${url}`)
  console.log('')

  let fallos = 0

  for (const intento of [1, 2]) {
    const r = await pedir(url)
    const bien = r.estado === 200 && r.bytes > 0
    if (!bien) fallos += 1
    console.log(
      `  peticion ${intento}: ${bien ? 'OK' : 'MAL'}  ${r.estado}  ${r.tipo ?? '-'}  ${r.bytes} bytes`,
    )
  }

  console.log('')

  if (fallos > 0) {
    console.error(
      'FALLO: la misma imagen tiene que contestar 200 las dos veces. Si la primera va bien y la segunda no, sospecha de la cache: la respuesta cacheada tiene las cabeceras congeladas.',
    )
    process.exit(1)
  }

  console.log('Las dos peticiones han contestado 200. La imagen se sirve igual con cache y sin ella.')
}

principal().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
