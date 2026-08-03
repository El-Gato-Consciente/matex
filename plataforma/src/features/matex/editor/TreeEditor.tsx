import { ChevronDown } from '@/components/icons'
import { useState } from 'react'
import type { TreeSpec } from '../core'

/**
 * **Editor del árbol** (Dominio B, B2), en el inspector derecho. Una **lista de nodos**: cada uno
 * con su etiqueta y un selector de **padre** (la raíz no tiene). Agregar/quitar nodos. Par de
 * edición de `core/graphics/tree.ts` (forest) y `treeSvg.ts` (preview). Ids estables por creación.
 */
const INPUT = 'rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)'

export function TreeEditor({ spec, onChange }: { spec: TreeSpec; onChange: (spec: TreeSpec) => void }) {
  const [open, setOpen] = useState(true)
  const set = (patch: Partial<TreeSpec>): void => onChange({ ...spec, ...patch })
  const nodes = spec.nodes
  const setNode = (i: number, patch: Partial<TreeSpec['nodes'][number]>): void =>
    set({ nodes: nodes.map((n, j) => (j === i ? { ...n, ...patch } : n)) })
  const addNode = (): void => {
    const id = `n${Date.now().toString(36)}${nodes.length}`
    // Por defecto cuelga de la raíz (1er nodo sin padre) si existe.
    const root = nodes.find((n) => !n.parent)
    set({ nodes: [...nodes, { id, label: 'nodo', ...(root ? { parent: root.id } : {}) }] })
  }
  const removeNode = (i: number): void => {
    const removed = nodes[i]!
    // Los hijos del nodo borrado se recuelgan de su abuelo (o quedan raíz).
    set({ nodes: nodes.filter((_, j) => j !== i).map((n) => (n.parent === removed.id ? { ...n, parent: removed.parent } : n)) })
  }

  return (
    <div className="border-b border-(--color-border) bg-(--color-surface-muted) text-xs">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 font-medium text-(--color-ink)">
          <ChevronDown className={['h-3.5 w-3.5 transition-transform', open ? '' : '-rotate-90'].join(' ')} />
          Árbol
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-1.5 px-4 pb-3">
          <p className="text-(--color-ink-muted)">La <strong className="text-(--color-ink)">raíz</strong> es el nodo sin padre. La etiqueta admite <code className="rounded bg-(--color-surface) px-1">$…$</code> para matemática.</p>
          {nodes.map((n, i) => {
            const isRoot = !n.parent
            return (
              <div key={n.id} className="flex flex-wrap items-center gap-1.5">
                <input
                  value={n.label}
                  onChange={(e) => setNode(i, { label: e.target.value })}
                  placeholder="etiqueta"
                  aria-label={`Etiqueta del nodo ${i + 1}`}
                  className={`w-28 ${INPUT}`}
                />
                <span className="text-(--color-ink-muted)">padre</span>
                <select
                  value={n.parent ?? ''}
                  onChange={(e) => setNode(i, { parent: e.target.value || undefined })}
                  aria-label={`Padre del nodo ${n.label || i + 1}`}
                  className={INPUT}
                >
                  <option value="">— (raíz)</option>
                  {nodes
                    .filter((m) => m.id !== n.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label || m.id}
                      </option>
                    ))}
                </select>
                {isRoot && <span className="rounded bg-(--color-primary) px-1 text-[10px] text-(--color-primary-ink)">raíz</span>}
                <button type="button" onClick={() => removeNode(i)} title="Quitar nodo" className="ml-auto rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
              </div>
            )
          })}
          <button type="button" onClick={addNode} className="self-start rounded border border-(--color-border) px-2 py-1 text-(--color-ink) hover:bg-(--color-surface)">
            + nodo
          </button>
          <label className="mt-1 inline-flex items-center gap-1.5 text-(--color-ink-muted)">
            Título
            <input value={spec.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined })} placeholder="(opcional)" className={`w-28 ${INPUT}`} />
          </label>
        </div>
      )}
    </div>
  )
}
