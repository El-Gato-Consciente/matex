import { svgTag } from './svg'
import type { TreeNode, TreeSpec } from '../ast'

/**
 * **Preview web de árboles** (Dominio B, B2) = backend SVG **puro** del mismo `TreeSpec` que
 * `tree.ts` compila a `forest`. Layout simple (tipo Reingold–Tilford acotado): las **hojas** se
 * equiespacian en orden y cada nodo **interno** se centra sobre sus hijos; `y` = profundidad. Las
 * etiquetas van como texto plano (`$…$` se ve fiel en el PDF). Sin DOM. Par LaTeX: `tree.ts`.
 */

const LEVEL_H = 64
const SLOT_W = 72
const PAD_X = 24
const PAD_Y = 22
const NODE_PAD_Y = 12 // separación vertical entre el nodo y las aristas

interface Placed {
  node: TreeNode
  x: number
  depth: number
}

/** Limpia una etiqueta para el preview de texto plano (quita `$`, comandos LaTeX simples). */
function plainLabel(s: string): string {
  return s.replace(/\$/g, '').replace(/\\[a-zA-Z]+/g, (m) => m.slice(1)).replace(/[{}]/g, '').trim()
}

export function treeToSvg(spec: TreeSpec): string {
  const nodes = spec.nodes
  if (nodes.length === 0) return svgTag('svg', { viewBox: '0 0 120 60', width: '100%', height: 'auto' }, [])
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const childrenOf = new Map<string, TreeNode[]>()
  let root: TreeNode | undefined
  for (const n of nodes) {
    if (n.parent && byId.has(n.parent) && n.parent !== n.id) {
      const arr = childrenOf.get(n.parent) ?? []
      arr.push(n)
      childrenOf.set(n.parent, arr)
    } else if (!root) {
      root = n
    }
  }
  if (!root) return svgTag('svg', { viewBox: '0 0 120 60', width: '100%', height: 'auto' }, [])

  // Layout: post-orden; las hojas toman slots consecutivos, los internos el promedio de sus hijos.
  const placed = new Map<string, Placed>()
  let leaf = 0
  let maxDepth = 0
  const seen = new Set<string>()
  const layout = (node: TreeNode, depth: number): number => {
    if (seen.has(node.id)) return leaf * SLOT_W // corta ciclos
    seen.add(node.id)
    maxDepth = Math.max(maxDepth, depth)
    const kids = childrenOf.get(node.id) ?? []
    let x: number
    if (kids.length === 0) {
      x = leaf * SLOT_W
      leaf += 1
    } else {
      const xs = kids.map((k) => layout(k, depth + 1))
      x = (Math.min(...xs) + Math.max(...xs)) / 2
    }
    placed.set(node.id, { node, x, depth })
    return x
  }
  layout(root, 0)

  const w = PAD_X * 2 + Math.max(SLOT_W, (leaf - 1) * SLOT_W)
  const h = PAD_Y * 2 + maxDepth * LEVEL_H
  const px = (p: Placed): number => PAD_X + p.x
  const py = (p: Placed): number => PAD_Y + p.depth * LEVEL_H

  const parts: string[] = []
  // Aristas primero (para que los nodos queden encima).
  for (const p of placed.values()) {
    const parent = p.node.parent ? placed.get(p.node.parent) : undefined
    if (!parent) continue
    parts.push(
      svgTag('line', {
        x1: px(parent).toFixed(1),
        y1: (py(parent) + NODE_PAD_Y).toFixed(1),
        x2: px(p).toFixed(1),
        y2: (py(p) - NODE_PAD_Y).toFixed(1),
        stroke: 'currentColor',
        'stroke-width': 1,
        opacity: 0.6,
      }),
    )
  }
  for (const p of placed.values()) {
    parts.push(svgTag('text', { x: px(p).toFixed(1), y: py(p).toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 14, fill: 'currentColor' }, plainLabel(p.node.label)))
  }
  return svgTag('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: 'auto', style: 'max-width:100%;color:inherit' }, parts)
}
