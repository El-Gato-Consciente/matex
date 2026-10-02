import { singleFileInput, type CompileInput } from '@/features/compiler/types'

/**
 * Preámbulo de los bloques `playground`: una **hoja chica de tamaño fijo** (no A4),
 * para que el PDF se lea al lado del editor sin achicarse. Es `article` + `geometry`
 * y no `standalone` porque el compilador de producción no trae `standalone.cls`.
 */
const PLAYGROUND_PREAMBLE = [
  '\\documentclass[11pt]{article}',
  '\\usepackage[paperwidth=12cm,paperheight=6.75cm,margin=7mm]{geometry}',
  '\\usepackage[T1]{fontenc}',
  '\\usepackage{lmodern}',
  '\\usepackage[spanish,es-noshorthands]{babel}',
  '\\usepackage{microtype}',
  '\\usepackage{amsmath,amssymb}',
  '\\pagestyle{empty}',
].join('\n')

/** Cantidad de líneas antes del cuerpo: para llevar los errores a la línea que ve el alumno. */
export const PLAYGROUND_BODY_OFFSET = PLAYGROUND_PREAMBLE.split('\n').length + 1

/** Documento completo de un playground a partir del cuerpo que edita el alumno. */
export function playgroundSource(body: string): string {
  return `${PLAYGROUND_PREAMBLE}\n\\begin{document}\n${body}\n\\end{document}\n`
}

export function playgroundInput(body: string): CompileInput {
  return singleFileInput(playgroundSource(body))
}
