import type { BlockNode } from '../core'
import type { ProjectFile } from '@/features/documents/types'

/**
 * **Helpers puros de assets del editor** (QA-06, slice 2). Nombres seguros, tipos MIME, data
 * URIs y detección de imágenes usadas. Eran funciones sueltas dentro del God component
 * `MatexWorkspace`; acá viven aisladas y testeadas.
 */

const IMG_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

/** Extensiones de imagen aceptadas por el input de subida. */
export const IMG_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.svg'

/** Tamaño máximo de una imagen subida (20 MB). */
export const MAX_IMAGE_BYTES = 20_000_000

/** MIME por extensión del nombre; `application/octet-stream` si no se reconoce. */
export function mimeOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMG_MIME[ext] ?? 'application/octet-stream'
}

/** `nombre → data URI` para las imágenes (archivos base64) — lo que consumen los backends. */
export function buildDataUrls(files: readonly ProjectFile[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of files) if (f.encoding === 'base64') map[f.path] = `data:${mimeOf(f.path)};base64,${f.content}`
  return map
}

/** Nombre de archivo seguro (sin caracteres raros); `imagen.png` si queda vacío. */
export function safeAssetName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned || 'imagen.png'
}

/** ¿Es un recurso de **texto** (se sube como utf8) y no un binario? */
export function isTextResourceName(name: string): boolean {
  return /\.(tex|bib|cls|sty|dat|csv|txt)$/i.test(name)
}

/**
 * Nombres de imagen **efectivamente usados** por alguna figura del documento. Recorre **todos**
 * los contenedores de bloques (teoremas, listas, callouts, razonamiento, columnas, diapositivas,
 * preguntas de examen, bloques de póster) — antes solo teoremas y listas, así que una imagen
 * dentro de un callout se contaba como "sin usar" y podía marcarse para descarte por error.
 */
export function usedFigureSrcs(blocks: readonly BlockNode[], out: Set<string> = new Set()): Set<string> {
  for (const b of blocks) {
    switch (b.type) {
      case 'figure':
        for (const item of b.items) if (item.kind === 'image' && item.src) out.add(item.src)
        break
      case 'theorem':
      case 'callout':
      case 'slide':
      case 'posterBlock':
        usedFigureSrcs(b.content, out)
        break
      case 'examQuestion':
        usedFigureSrcs(b.content, out)
        if (b.solution) usedFigureSrcs(b.solution, out)
        break
      case 'bulletList':
      case 'orderedList':
        for (const item of b.items) usedFigureSrcs(item.content, out)
        break
      case 'reasoning':
        for (const row of b.rows) {
          usedFigureSrcs(row.left, out)
          usedFigureSrcs(row.right, out)
        }
        break
      case 'columns':
        for (const col of b.columns) usedFigureSrcs(col.content, out)
        break
    }
  }
  return out
}

/** Nombre único respecto de `taken`, agregando `-1`, `-2`… antes de la extensión. */
export function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  for (let i = 1; ; i += 1) {
    const candidate = `${stem}-${i}${ext}`
    if (!taken.has(candidate)) return candidate
  }
}
