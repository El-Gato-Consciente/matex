import JSZip from 'jszip'
import type { ProjectFile } from '@/features/documents/types'
import { parseMatexDoc, serializeMatexDoc, type MatexDoc } from './core'

/**
 * **Bundle de proyecto Matex** (`.zip`): el `.mtex` (AST puro, la fuente de verdad) +
 * las imágenes bajo `images/`. Es el paquete **portable** — todo viaja junto. Se eligió
 * un zip con estructura de carpetas (no un `.mtex` autocontenido) porque escala mejor con
 * muchas imágenes y con futuros `.mtex` que se integren de forma modular.
 *
 * Las imágenes se guardan bajo `images/` pero en el proyecto viven con **nombre base**
 * (así el AST y `\includegraphics{fig.png}` usan el nombre pelado); al leer se re-mapean.
 */

const IMAGES_DIR = 'images/'

/**
 * Empaqueta el AST + imágenes (bajo `images/`) + recursos de texto (`.tex`/`.bib`/datos, en la raíz)
 * en un `.zip` portable. Los recursos de texto van al nivel del `.mtex` con su ruta tal cual (así un
 * `\input{figuras/x.tex}` sigue resolviendo dentro del bundle).
 */
export async function packMatexBundle(
  name: string,
  ast: MatexDoc,
  images: readonly ProjectFile[],
  textFiles: readonly ProjectFile[] = [],
): Promise<Blob> {
  const zip = new JSZip()
  zip.file(`${name}.mtex`, serializeMatexDoc(ast))
  for (const img of images) {
    zip.file(`${IMAGES_DIR}${img.path}`, img.content, { base64: img.encoding === 'base64' })
  }
  for (const f of textFiles) {
    zip.file(f.path, f.content, { base64: f.encoding === 'base64' })
  }
  return zip.generateAsync({ type: 'blob' })
}

export interface MatexBundle {
  ast: MatexDoc
  /** Imágenes con **nombre base** (sin el prefijo `images/`), listas para `project.files`. */
  images: ProjectFile[]
  /** Recursos de texto (`.tex`/`.bib`/datos) con su ruta, listos para `project.files`. */
  textFiles: ProjectFile[]
}

/**
 * Lee un `.zip`: si contiene un `.mtex`, lo interpreta como bundle Matex (AST + imágenes)
 * y devuelve ambos; si **no** hay `.mtex`, devuelve `null` (no es un bundle Matex — el
 * caller puede tratarlo como proyecto LaTeX). Valida el AST con `parseMatexDoc`.
 */
export async function readMatexBundle(file: Blob): Promise<MatexBundle | null> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const entries = Object.values(zip.files).filter((e) => !e.dir)
  const mtex = entries.find((e) => e.name.toLowerCase().endsWith('.mtex'))
  if (!mtex) return null
  const ast = parseMatexDoc(JSON.parse(await mtex.async('string')))
  const images: ProjectFile[] = []
  const textFiles: ProjectFile[] = []
  for (const entry of entries) {
    if (entry === mtex) continue
    if (entry.name.startsWith(IMAGES_DIR)) {
      const base = entry.name.slice(IMAGES_DIR.length)
      if (base) images.push({ path: base, content: await entry.async('base64'), encoding: 'base64' })
    } else {
      // Recurso de texto (`.tex`/`.bib`/datos): conserva su ruta relativa dentro del bundle.
      textFiles.push({ path: entry.name, content: await entry.async('string'), encoding: 'utf8' })
    }
  }
  return { ast, images, textFiles }
}

/**
 * **Bundle LaTeX** (`.zip`): `main.tex` + las imágenes **al lado** (nombre pelado, como
 * las referencia `\includegraphics`), para que compile en cualquier lado.
 */
export async function packTexBundle(latex: string, images: readonly ProjectFile[]): Promise<Blob> {
  const zip = new JSZip()
  zip.file('main.tex', latex)
  for (const img of images) {
    zip.file(img.path, img.content, { base64: img.encoding === 'base64' })
  }
  return zip.generateAsync({ type: 'blob' })
}
