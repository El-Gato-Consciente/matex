import { itemWidth } from './util'
import type { TreeNode, TreeSpec } from '../ast'

/**
 * **Backend LaTeX de árboles** (Dominio B, B2) → `forest`. La jerarquía (nodos con `parent`) se
 * emite como la sintaxis de corchetes anidados de `forest`: `[raíz [hijo1 [nieto]] [hijo2]]`. La
 * etiqueta va entre `{}` (agrupa comas/espacios; admite `$…$` para matemática). Ver B2.
 */

/** Hijos de cada nodo (en orden de aparición) + la raíz (nodo sin padre válido). */
function buildForest(nodes: readonly TreeNode[]): { childrenOf: Map<string, TreeNode[]>; root: TreeNode | undefined } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const childrenOf = new Map<string, TreeNode[]>()
  let root: TreeNode | undefined
  for (const n of nodes) {
    if (n.parent && byId.has(n.parent) && n.parent !== n.id) {
      const arr = childrenOf.get(n.parent) ?? []
      arr.push(n)
      childrenOf.set(n.parent, arr)
    } else if (!root) {
      root = n // el 1er nodo sin padre válido = raíz
    }
  }
  return { childrenOf, root }
}

export function treeToLatex(spec: TreeSpec, width?: number, widthOverride?: string): string {
  const { childrenOf, root } = buildForest(spec.nodes)
  if (!root) return ''
  const seen = new Set<string>()
  const emit = (node: TreeNode): string => {
    if (seen.has(node.id)) return '' // corta ciclos accidentales
    seen.add(node.id)
    const kids = (childrenOf.get(node.id) ?? []).map(emit).filter((s) => s).join(' ')
    const label = node.label.trim() || '~'
    return `[{${label}}${kids ? ` ${kids}` : ''}]`
  }
  const forest = `\\begin{forest}\n  ${emit(root)}\n\\end{forest}`
  const box = widthOverride ?? (typeof width === 'number' && width > 0 ? itemWidth(width, '\\linewidth') : '')
  return box ? `\\resizebox{${box}}{!}{%\n${forest}\n}` : forest
}
