/**
 * Codemod Fase 2: inyecta el PISO del canon en los preámbulos de los documentos
 * completos del corpus (example/solution/starter/source). Idempotente y scoped:
 *  - solo actúa sobre un elemento `'\\documentclass...'` que tenga un
 *    `'\\begin{document}'` pocas líneas después (así no toca prosa/commands/code);
 *  - inyecta solo las líneas de PISO que falten, justo después de la clase;
 *  - corrige `[spanish]{babel}` → `[spanish,es-noshorthands]{babel}` SOLO dentro
 *    del preámbulo;
 *  - saltea lecciones de "primer contacto" (allowlist).
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ALLOW_MINIMAL = new Set(['l0-bienvenida', 'l0-primer-documento'])
const LOOKAHEAD = 90

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('uso: node codemod-piso.mjs <archivo.ts> ...')
  process.exit(1)
}

const isDocClassEl = (line) => /^\s*'\\\\documentclass/.test(line)
const isBeginDocEl = (line) => /^\s*'\\\\begin\{document\}/.test(line)
const idOf = (line) => {
  const m = line.match(/\bid:\s*'([^']+)'/)
  return m ? m[1] : null
}

let totalInserted = 0
let totalBabelFixed = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const out = []
  let currentId = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const maybeId = idOf(line)
    if (maybeId) currentId = maybeId

    if (!isDocClassEl(line)) {
      out.push(line)
      continue
    }

    // ¿Hay un begin{document} cerca? Si no, es un snippet/prosa: no tocar.
    let endRegion = -1
    for (let j = i + 1; j < Math.min(lines.length, i + LOOKAHEAD); j++) {
      if (isBeginDocEl(lines[j])) {
        endRegion = j
        break
      }
      // Si aparece otra documentclass antes, cortar (regiones distintas).
      if (isDocClassEl(lines[j])) break
    }
    const skip = endRegion === -1 || (currentId && ALLOW_MINIMAL.has(currentId))

    // Estilo del elemento: indentación de la línea de la clase.
    const indent = line.match(/^(\s*)/)[1]
    const mk = (latex) => `${indent}'${latex}',`

    // Región del preámbulo (de la clase, exclusivo, a begin{document}).
    const region = skip ? [] : lines.slice(i, endRegion)
    const regionText = region.join('\n')
    const has = {
      fontenc: /\[T1\]\{fontenc\}/.test(regionText),
      lmodern: /\{lmodern\}/.test(regionText),
      babel: /\{babel\}/.test(regionText),
      esno: /es-noshorthands/.test(regionText),
      microtype: /\{microtype\}/.test(regionText),
    }

    // Corregir babel sin es-noshorthands dentro de la región (solo en el rango).
    let babelFixedHere = false
    if (!skip && has.babel && !has.esno) {
      for (let j = i; j < endRegion; j++) {
        if (/\[spanish\]\{babel\}/.test(lines[j])) {
          lines[j] = lines[j].replace(/\[spanish\]\{babel\}/, '[spanish,es-noshorthands]{babel}')
          babelFixedHere = true
        }
      }
      if (babelFixedHere) {
        totalBabelFixed++
        has.esno = true
      }
    }

    out.push(line) // la línea de \documentclass

    if (!skip) {
      const inject = []
      if (!has.fontenc) inject.push(mk('\\\\usepackage[T1]{fontenc}'))
      if (!has.lmodern) inject.push(mk('\\\\usepackage{lmodern}'))
      if (!has.babel) inject.push(mk('\\\\usepackage[spanish,es-noshorthands]{babel}'))
      if (!has.microtype) inject.push(mk('\\\\usepackage{microtype}'))
      if (inject.length > 0) {
        out.push(...inject)
        totalInserted += inject.length
      }
    }
  }

  const result = out.join('\n')
  if (result !== src) {
    writeFileSync(file, result)
    console.log(`✎ ${file.split(/[\\/]/).pop()}`)
  }
}

console.log(`\nPISO insertadas: ${totalInserted} · babel corregidos: ${totalBabelFixed}`)
