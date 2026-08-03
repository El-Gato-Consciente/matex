import { escapeLatex, itemWidth } from './util'
import { plotToLatex } from './relation'
import { chartToLatex } from './chart'
import { distToLatex } from './distribution'
import { diagramToLatex } from './diagram'
import { treeToLatex } from './tree'
import type { FigureItem, FigureNode } from '../ast'
import type { RefContext } from '../compile'

/**
 * **Layout de figura** (flotante + subfiguras), **agnóstico del tipo de parte**: delega cada
 * parte a su familia (imagen → `\includegraphics`; gráfico A4 → `plotToLatex`; a futuro barras
 * → `comparison`…). Aquí vive solo la composición: float `figure[htbp]`, subfiguras
 * (`subcaption`), caption/label. Ver `graficos-cartografia-semantica.md`.
 */

/** Una parte de figura → LaTeX (imagen o gráfico). `widthOverride` = ancho del contenido
 *  (p. ej. `\linewidth` cuando va dentro de una `subfigure`). */
function figureItemToLatex(item: FigureItem, widthOverride?: string): string {
  // Despacho por **familia** (el patrón para sumar tipos): cada `kind` delega a su módulo.
  if (item.kind === 'image') {
    // Sin `src` no emitimos `\includegraphics` (no rompe el PDF); el float queda vacío.
    return item.src.trim() ? `\\includegraphics[width=${widthOverride ?? itemWidth(item.width, '\\linewidth')}]{${item.src}}` : ''
  }
  if (item.kind === 'chart') return chartToLatex(item.spec, item.width, widthOverride)
  if (item.kind === 'distribution') return distToLatex(item.spec, item.width, widthOverride) // A3 (distribución)
  if (item.kind === 'diagram') return diagramToLatex(item.spec, item.width, widthOverride) // B4 (conmutativo)
  if (item.kind === 'tree') return treeToLatex(item.spec, item.width, widthOverride) // B2 (árbol)
  return plotToLatex(item.spec, item.width, widthOverride) // A4 (relación)
}

/** Una **subfigura** (subcaption + label): parte que llena su caja (`\linewidth`). */
function subfigureToLatex(item: FigureItem, widthFrac: number, ctx: RefContext): string {
  const content = figureItemToLatex(item, '\\linewidth')
  if (!content) return ''
  const key = ctx.labelKey(item)
  // `\subcaption{…}` (aunque vacío) da la letra (a)(b)…; el `\label` lo hace referenciable.
  const sub = `\\subcaption{${item.subcaption ? escapeLatex(item.subcaption) : ''}}${key ? `\\label{${key}}` : ''}`
  return `\\begin{subfigure}[t]{${widthFrac}\\textwidth}\n    \\centering\n    ${content}\n    ${sub}\n  \\end{subfigure}`
}

/**
 * Figura → flotante `figure[htbp]` centrado. **1 parte** = figura simple; **≥2 partes** =
 * subfiguras (`subcaption`) lado a lado, cada una con su `\subcaption` (letra a/b/…) y
 * `\label` referenciable. **Caption abajo** con `\label` pegado (solo con caption).
 */
export function figureToLatex(node: FigureNode, ctx: RefContext): string {
  const labelKey = ctx.labelKey(node)
  // Dentro de una celda de razonamiento (minipage), el float `figure` no cabe → `center` +
  // `\captionof{figure}` (no flotante). `ctx.noFloat` lo indica.
  const captionLine = node.caption
    ? [`${ctx.noFloat ? '\\captionof{figure}' : '\\caption'}{${escapeLatex(node.caption)}}${labelKey ? `\\label{${labelKey}}` : ''}`]
    : []

  let parts: string[]
  if (node.items.length >= 2) {
    // Ancho por parte: el propio si lo tiene, si no repartido en partes iguales (con aire).
    const def = Number((0.95 / node.items.length).toFixed(2))
    parts = node.items
      .map((item) => subfigureToLatex(item, typeof item.width === 'number' && item.width > 0 ? item.width : def, ctx))
      .filter((s) => s.length > 0)
    // `\hfill` entre subfiguras para distribuirlas en la fila.
    parts = parts.length > 0 ? [parts.join('\n  \\hfill\n  ')] : parts
  } else {
    parts = node.items.map((item) => figureItemToLatex(item)).filter((s) => s.length > 0)
  }

  const body = ['\\centering', ...parts, ...captionLine].map((l) => `  ${l}`).join('\n')
  return ctx.noFloat ? `\\begin{center}\n${body}\n\\end{center}` : `\\begin{figure}[htbp]\n${body}\n\\end{figure}`
}
