import { compileToHtml, serializeMatexDoc, type MatexDoc } from '../core'
import { downloadBlob, downloadFile } from '@/lib/files'
import { packMatexBundle, packTexBundle } from '../bundle'
import type { ProjectFile } from '@/features/documents/types'

/**
 * **Acciones de descarga del editor** (QA-06, slice 3). Cada una arma un artefacto (.mtex,
 * .html, .zip, .tex) y dispara la descarga. Extraídas del God component para agrupar el concern;
 * la lógica con decisión (nombre base, y zip-vs-tex según haya recursos) está aislada y testeada.
 */

/** Nombre base del documento para los archivos descargados (nunca vacío). */
export function documentBaseName(name: string): string {
  // Trim **antes** del fallback: un nombre de solo espacios daba `''` (archivo sin nombre).
  return name.trim() || 'documento'
}

/**
 * ¿La descarga de LaTeX debe ser un **.zip** (main.tex + recursos) o un **.tex** pelado? Es zip
 * cuando el proyecto tiene recursos que acompañar (imágenes, `refs.bib`, `.tex` incluidos).
 */
export function latexNeedsBundle(compiledFiles: readonly ProjectFile[]): boolean {
  return compiledFiles.length > 0
}

/** Sufijo de los archivos de la versión «con soluciones» de un examen. */
export const SOLUTIONS_SUFFIX = ' (soluciones)'

/** `.mtex` pelado (solo el AST): comparte la estructura sin imágenes. */
export function downloadAst(name: string, ast: MatexDoc): void {
  downloadFile(`${documentBaseName(name)}.mtex`, serializeMatexDoc(ast))
}

/** Página web autocontenida (LE-03): `.html` con MathML + SVG + CSS inline; tema `auto`. */
export function downloadHtml(name: string, ast: MatexDoc, images: Record<string, string>, showSolutions = false): void {
  const out = compileToHtml(ast, { images, theme: 'auto', showSolutions })
  const suffix = showSolutions ? SOLUTIONS_SUFFIX : ''
  downloadBlob(new Blob([out], { type: 'text/html;charset=utf-8' }), `${documentBaseName(name)}${suffix}.html`)
}

/** Bundle portable del proyecto: `.mtex` + imágenes (todo viaja junto). */
export async function downloadBundle(name: string, ast: MatexDoc, imageFiles: readonly ProjectFile[], textFiles: readonly ProjectFile[]): Promise<void> {
  const base = documentBaseName(name)
  downloadBlob(await packMatexBundle(base, ast, imageFiles, textFiles), `${base}.zip`)
}

/** LaTeX: `.zip` (main.tex + recursos) si hay recursos; si no, un `.tex` pelado. */
export async function downloadTex(name: string, latex: string, compiledFiles: readonly ProjectFile[]): Promise<void> {
  const base = documentBaseName(name)
  if (latexNeedsBundle(compiledFiles)) {
    downloadBlob(await packTexBundle(latex, compiledFiles), `${base}.zip`)
  } else {
    downloadFile(`${base}.tex`, latex)
  }
}
