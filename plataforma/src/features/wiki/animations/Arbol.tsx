import type { CSSProperties } from 'react'
import type { WikiAnimationProps } from './types'

/** Bloques del documento ↔ nodos del árbol, en el mismo orden (se iluminan juntos). */
const ITEMS = [
  { node: 'heading', line: <span className="text-lg font-semibold">Funciones continuas</span> },
  {
    node: 'paragraph',
    line: (
      <span>
        Sea <span className="wiki-serif italic">f</span> continua en <span className="wiki-serif italic">[a, b]</span>.
      </span>
    ),
  },
  { node: 'mathDisplay', line: <span className="wiki-serif block text-center italic">f(c) ≥ f(x)  ∀x ∈ [a, b]</span> },
  {
    node: 'theorem',
    line: (
      <span>
        <span className="font-semibold text-indigo-300">Teorema 1.</span> Existe un máximo.
      </span>
    ),
  },
  {
    node: 'proof',
    line: (
      <span>
        <span className="italic text-(--color-ink-muted)">Demostración.</span> Por compacidad… ∎
      </span>
    ),
  },
] as const

const NODE_X = [44, 122, 200, 278, 356]
/** Hijos de cada nodo (el árbol no es plano: un párrafo contiene texto y fórmulas). */
const CHILDREN: Record<number, readonly string[]> = { 1: ['text', 'mathInline'], 3: ['paragraph'], 4: ['paragraph'] }

/**
 * «El documento es un árbol»: un cursor recorre los bloques y se ilumina el nodo
 * del AST que les corresponde. Cada par comparte animación y `--i` (ver `.wiki-tree-*`).
 */
export function Arbol(_: WikiAnimationProps) {
  return (
    <div className="grid items-center gap-5 p-5 md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) p-3">
        {ITEMS.map((item, index) => (
          <div key={item.node} className="wiki-tree-line rounded-md px-3 py-1.5 text-[14px]" style={{ '--i': index } as CSSProperties}>
            {item.line}
          </div>
        ))}
      </div>

      <svg viewBox="0 0 400 236" className="block w-full" role="img" aria-label="El árbol del documento: un nodo doc con heading, paragraph, mathDisplay, theorem y proof">
        {NODE_X.map((x) => (
          <path key={`e${x}`} d={`M200 40 C 200 70, ${x} 70, ${x} 100`} className="wiki-svg-wire" />
        ))}
        {Object.entries(CHILDREN).flatMap(([parent, kids]) =>
          kids.map((kid, k) => {
            const px = NODE_X[Number(parent)]!
            const cx = px + (k - (kids.length - 1) / 2) * 72
            return (
              <g key={`${parent}-${kid}`}>
                <path d={`M${px} 122 C ${px} 150, ${cx} 150, ${cx} 178`} className="wiki-svg-wire" />
                <g className="wiki-tree-node wiki-tree-node--leaf" style={{ '--i': Number(parent) } as CSSProperties}>
                  <rect x={cx - 34} y={178} width={68} height={22} rx={6} />
                  <text x={cx} y={193} textAnchor="middle">{kid}</text>
                </g>
              </g>
            )
          }),
        )}

        <g className="wiki-tree-root">
          <rect x={170} y={14} width={60} height={26} rx={8} />
          <text x={200} y={31} textAnchor="middle">doc</text>
        </g>
        {ITEMS.map((item, index) => (
          <g key={item.node} className="wiki-tree-node" style={{ '--i': index } as CSSProperties}>
            <rect x={NODE_X[index]! - 37} y={100} width={74} height={22} rx={6} />
            <text x={NODE_X[index]} y={115} textAnchor="middle">{item.node}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
