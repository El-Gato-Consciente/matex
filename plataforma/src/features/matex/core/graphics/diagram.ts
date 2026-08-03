import { itemWidth } from './util'
import type { DiagramEdge, DiagramNode, DiagramSpec, DiagramTip } from '../ast'

/**
 * **Backend LaTeX de diagramas estructurales** (Dominio B, familia conmutativa) → `tikz-cd`.
 * Los nodos viven en una **grilla** (fila×columna) = la matriz de `tikzcd`; cada arista se emite
 * como `\arrow[<dir>, "<label>", <opts>]` **colgada del nodo origen**, con la dirección derivada
 * de la diferencia de posiciones (r/l/u/d repetidas). Las etiquetas (nodo y morfismo) son `tex`
 * en modo matemático (lo que `tikz-cd` hace por defecto), como las leyendas de los gráficos.
 * Ver `graficos-cartografia-semantica.md` (B4).
 */

/** Cómo dibuja `tikz-cd` cada tipo de morfismo (`arrow` = la flecha default, sin opción). */
const TIP_OPT: Record<DiagramTip, string> = { arrow: '', mono: 'hook', epi: 'two heads', mapsto: 'maps to' }

/** Dirección relativa (`dr`, `rr`, `u`…) del nodo `from` al `to` en la grilla de `tikzcd`. */
function dirString(from: DiagramNode, to: DiagramNode): string {
  const dr = to.row - from.row
  const dc = to.col - from.col
  return (dr > 0 ? 'd' : 'u').repeat(Math.abs(dr)) + (dc > 0 ? 'r' : 'l').repeat(Math.abs(dc))
}

/** Opciones de una arista → lista para `\arrow[...]` (dirección primero, luego etiqueta y estilo). */
function edgeOpts(dir: string, e: DiagramEdge): string {
  const opts = [dir]
  if (e.label && e.label.trim()) opts.push(`"${e.label}"`) // etiqueta math (raw tex, como leyendas)
  const tip = e.tip ? TIP_OPT[e.tip] : ''
  if (tip) opts.push(tip)
  if (e.style && e.style !== 'solid') opts.push(e.style)
  if (e.bend) opts.push(`bend ${e.bend}`)
  return opts.join(', ')
}

/**
 * Diagrama → entorno `tikzcd`. `widthOverride` (p. ej. `\linewidth` en una subfigura) escala con
 * `\resizebox` para que entre en la caja; sin él, tamaño natural (la figura lo centra).
 */
export function diagramToLatex(spec: DiagramSpec, width?: number, widthOverride?: string): string {
  const nodes = spec.nodes
  if (nodes.length === 0) return ''
  const nrows = Math.max(...nodes.map((n) => n.row)) + 1
  const ncols = Math.max(...nodes.map((n) => n.col)) + 1
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const at = (r: number, c: number): DiagramNode | undefined => nodes.find((n) => n.row === r && n.col === c)

  const cellTex = (node: DiagramNode): string => {
    let t = node.label.trim() ? node.label : '{}'
    for (const e of spec.edges) {
      if (e.from !== node.id) continue
      const to = byId.get(e.to)
      if (!to || to === node) continue // sin destino o auto-lazo → se omite
      const dir = dirString(node, to)
      if (!dir) continue
      t += ` \\arrow[${edgeOpts(dir, e)}]`
    }
    return t
  }

  const rows: string[] = []
  for (let r = 0; r < nrows; r++) {
    const cells: string[] = []
    for (let c = 0; c < ncols; c++) {
      const n = at(r, c)
      cells.push(n ? cellTex(n) : '{}')
    }
    rows.push(cells.join(' & '))
  }
  const tikzcd = `\\begin{tikzcd}\n  ${rows.join(' \\\\\n  ')}\n\\end{tikzcd}`
  // Escalar solo si hace falta encajar en una caja (subfigura) o si la parte fija un ancho.
  const box = widthOverride ?? (typeof width === 'number' && width > 0 ? itemWidth(width, '\\linewidth') : '')
  return box ? `\\resizebox{${box}}{!}{%\n${tikzcd}\n}` : tikzcd
}
