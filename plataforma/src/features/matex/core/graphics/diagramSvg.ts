import { svgTag } from './svg'
import type { DiagramEdge, DiagramNode, DiagramSpec } from '../ast'

/**
 * **Preview web de diagramas estructurales** (Dominio B) = backend SVG **puro** del mismo
 * `DiagramSpec` que `diagram.ts` compila a `tikz-cd`. Ubica los nodos en la grilla y dibuja las
 * aristas como flechas (con punta, etiqueta, trazo y curvado). Las etiquetas se muestran como
 * **texto plano** (el `tex` fino se ve fiel en el PDF; acá basta la estructura). Sin DOM → vive en
 * `core/`, testeable sin jsdom, y sirve al 2º backend HTML. Par LaTeX: `diagram.ts`.
 */

const CELL_W = 104
const CELL_H = 84
const PAD_X = 40
const PAD_Y = 34
/** Radio del nodo: la flecha arranca/termina a esta distancia del centro (no lo pisa). */
const NODE_R = 22

interface Pt {
  x: number
  y: number
}

/** Limpia el `tex` de una etiqueta para el preview de texto plano (quita `\`, `{}`, `$`). */
function plainLabel(tex: string): string {
  return tex.replace(/\\[a-zA-Z]+|[{}$\\]/g, (m) => (m.startsWith('\\') && m.length > 1 ? m.slice(1) : '')).trim()
}

/** Punta de flecha (triángulo relleno) en `end`, orientada según `dir` (unitario). */
function arrowHead(end: Pt, dir: Pt): string {
  const len = 9
  const hw = 4
  const back = { x: end.x - dir.x * len, y: end.y - dir.y * len }
  const perp = { x: -dir.y, y: dir.x }
  const p1 = { x: back.x + perp.x * hw, y: back.y + perp.y * hw }
  const p2 = { x: back.x - perp.x * hw, y: back.y - perp.y * hw }
  return svgTag('polygon', {
    points: `${end.x.toFixed(1)},${end.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    fill: 'currentColor',
  })
}

function renderEdge(from: DiagramNode, to: DiagramNode, e: DiagramEdge, pos: (n: DiagramNode) => Pt): string[] {
  const a = pos(from)
  const b = pos(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy) || 1
  const u = { x: dx / dist, y: dy / dist }
  const start = { x: a.x + u.x * NODE_R, y: a.y + u.y * NODE_R }
  const end = { x: b.x - u.x * NODE_R, y: b.y - u.y * NODE_R }
  const perp = { x: -u.y, y: u.x }
  const bend = e.bend === 'left' ? -1 : e.bend === 'right' ? 1 : 0
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const ctrl = { x: mid.x + perp.x * bend * 26, y: mid.y + perp.y * bend * 26 }

  const dash = e.style === 'dashed' ? '6 4' : e.style === 'dotted' ? '1.5 3' : undefined
  const d = bend
    ? `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
    : `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  // Tangente en el extremo (para orientar la punta): desde el control (curva) o desde el inicio.
  const tanRef = bend ? ctrl : start
  const tdx = end.x - tanRef.x
  const tdy = end.y - tanRef.y
  const tlen = Math.hypot(tdx, tdy) || 1
  const tip = { x: tdx / tlen, y: tdy / tlen }

  const parts = [
    svgTag('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, ...(dash ? { 'stroke-dasharray': dash } : {}) }),
    arrowHead(end, tip),
  ]
  if (e.label && e.label.trim()) {
    const lp = bend
      ? { x: ctrl.x + perp.x * bend * 8, y: ctrl.y + perp.y * bend * 8 }
      : { x: mid.x + perp.x * 11, y: mid.y + perp.y * 11 }
    parts.push(
      svgTag('text', { x: lp.x.toFixed(1), y: lp.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 12, 'font-style': 'italic', fill: 'currentColor' }, plainLabel(e.label)),
    )
  }
  return parts
}

export function diagramToSvg(spec: DiagramSpec): string {
  const nodes = spec.nodes
  if (nodes.length === 0) return svgTag('svg', { viewBox: '0 0 120 60', width: '100%', height: 'auto' }, [])
  const ncols = Math.max(...nodes.map((n) => n.col)) + 1
  const nrows = Math.max(...nodes.map((n) => n.row)) + 1
  const pos = (n: DiagramNode): Pt => ({ x: PAD_X + n.col * CELL_W, y: PAD_Y + n.row * CELL_H })
  const w = PAD_X * 2 + (ncols - 1) * CELL_W
  const h = PAD_Y * 2 + (nrows - 1) * CELL_H
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const edgeParts: string[] = []
  for (const e of spec.edges) {
    const from = byId.get(e.from)
    const to = byId.get(e.to)
    if (!from || !to || from === to) continue
    edgeParts.push(...renderEdge(from, to, e, pos))
  }
  const nodeParts = nodes.map((n) => {
    const p = pos(n)
    return svgTag('text', { x: p.x.toFixed(1), y: p.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 16, fill: 'currentColor' }, plainLabel(n.label))
  })

  return svgTag('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: 'auto', style: 'max-width:100%;color:inherit' }, [...edgeParts, ...nodeParts])
}
