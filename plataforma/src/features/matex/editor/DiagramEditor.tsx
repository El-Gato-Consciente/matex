import { ChevronDown } from '@/components/icons'
import { useState } from 'react'
import type { DiagramEdge, DiagramEdgeStyle, DiagramNode, DiagramSpec, DiagramTip } from '../core'

/**
 * **Editor del diagrama conmutativo** (Dominio B), en el inspector derecho. Dos partes: una
 * **grilla** de celdas (escribir la etiqueta de un nodo lo crea/borra en esa fila×columna) y una
 * **lista de aristas** (origen→destino entre nodos existentes, con etiqueta, punta, trazo y
 * curvado). Par de edición de `core/graphics/diagram.ts` (tikz-cd) y `diagramSvg.ts` (preview).
 * Los ids de nodo son estables por posición (`n<r>_<c>`) → mover/editar no rompe las aristas.
 */
const INPUT = 'rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)'

const nodeId = (r: number, c: number): string => `n${r}_${c}`

export function DiagramEditor({ spec, onChange }: { spec: DiagramSpec; onChange: (spec: DiagramSpec) => void }) {
  const [open, setOpen] = useState(true)
  const set = (patch: Partial<DiagramSpec>): void => onChange({ ...spec, ...patch })

  // Dimensiones de la grilla: al menos 2×2, o lo que ocupen los nodos (+ botones para crecer).
  const nodeRows = spec.nodes.length > 0 ? Math.max(...spec.nodes.map((n) => n.row)) + 1 : 0
  const nodeCols = spec.nodes.length > 0 ? Math.max(...spec.nodes.map((n) => n.col)) + 1 : 0
  const [rows, setRows] = useState(Math.max(2, nodeRows))
  const [cols, setCols] = useState(Math.max(2, nodeCols))

  const labelAt = (r: number, c: number): string => spec.nodes.find((n) => n.row === r && n.col === c)?.label ?? ''
  const setCell = (r: number, c: number, value: string): void => {
    const rest = spec.nodes.filter((n) => !(n.row === r && n.col === c))
    const nodes: DiagramNode[] = value.trim() ? [...rest, { id: nodeId(r, c), label: value, row: r, col: c }] : rest
    set({ nodes })
  }

  const nodeOptions = spec.nodes.map((n) => ({ id: n.id, label: n.label || n.id }))
  const setEdge = (i: number, patch: Partial<DiagramEdge>): void =>
    set({ edges: spec.edges.map((e, j) => (j === i ? { ...e, ...patch } : e)) })

  return (
    <div className="border-b border-(--color-border) bg-(--color-surface-muted) text-xs">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 font-medium text-(--color-ink)">
          <ChevronDown className={['h-3.5 w-3.5 transition-transform', open ? '' : '-rotate-90'].join(' ')} />
          Diagrama conmutativo
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-3">
          <p className="text-(--color-ink-muted)">Escribí la etiqueta (matemática) de cada nodo en la grilla; dejar vacío = sin nodo.</p>

          {/* Grilla de nodos. */}
          <div className="flex flex-col gap-1">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex gap-1">
                {Array.from({ length: cols }, (_, c) => (
                  <input
                    key={c}
                    value={labelAt(r, c)}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    aria-label={`Nodo fila ${r + 1}, columna ${c + 1}`}
                    placeholder="·"
                    className={`w-16 text-center ${INPUT}`}
                  />
                ))}
              </div>
            ))}
            <div className="flex gap-2 pt-0.5">
              <button type="button" onClick={() => setRows((n) => n + 1)} className="rounded border border-(--color-border) px-1.5 py-0.5 text-(--color-ink) hover:bg-(--color-surface)">+ fila</button>
              <button type="button" onClick={() => setCols((n) => n + 1)} className="rounded border border-(--color-border) px-1.5 py-0.5 text-(--color-ink) hover:bg-(--color-surface)">+ columna</button>
              {rows > 2 && <button type="button" onClick={() => setRows((n) => n - 1)} className="rounded border border-(--color-border) px-1.5 py-0.5 text-(--color-ink-muted) hover:bg-(--color-surface)">− fila</button>}
              {cols > 2 && <button type="button" onClick={() => setCols((n) => n - 1)} className="rounded border border-(--color-border) px-1.5 py-0.5 text-(--color-ink-muted) hover:bg-(--color-surface)">− columna</button>}
            </div>
          </div>

          {/* Aristas (morfismos). */}
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-(--color-ink)">Flechas (morfismos)</span>
            {spec.edges.map((e, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1 rounded border border-(--color-border) bg-(--color-surface) p-1.5">
                <select value={e.from} onChange={(ev) => setEdge(i, { from: ev.target.value })} aria-label="Origen" className={INPUT}>
                  <option value="">·</option>
                  {nodeOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
                <span className="text-(--color-ink-muted)">→</span>
                <select value={e.to} onChange={(ev) => setEdge(i, { to: ev.target.value })} aria-label="Destino" className={INPUT}>
                  <option value="">·</option>
                  {nodeOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
                <input value={e.label ?? ''} onChange={(ev) => setEdge(i, { label: ev.target.value || undefined })} placeholder="etiqueta" aria-label="Etiqueta del morfismo" className={`w-20 ${INPUT}`} />
                <select value={e.tip ?? 'arrow'} onChange={(ev) => setEdge(i, { tip: ev.target.value === 'arrow' ? undefined : (ev.target.value as DiagramTip) })} aria-label="Punta" className={INPUT}>
                  <option value="arrow">→</option>
                  <option value="mono">↪ mono (inyectivo)</option>
                  <option value="epi">↠ epi (sobreyectivo)</option>
                  <option value="mapsto">↦ mapsto</option>
                </select>
                <select value={e.style ?? 'solid'} onChange={(ev) => setEdge(i, { style: ev.target.value === 'solid' ? undefined : (ev.target.value as DiagramEdgeStyle) })} aria-label="Trazo" className={INPUT}>
                  <option value="solid">continua</option>
                  <option value="dashed">guiones</option>
                  <option value="dotted">puntos</option>
                </select>
                <select value={e.bend ?? 'none'} onChange={(ev) => setEdge(i, { bend: ev.target.value === 'none' ? undefined : (ev.target.value as 'left' | 'right') })} aria-label="Curvado" className={INPUT}>
                  <option value="none">recta</option>
                  <option value="left">curva ↖</option>
                  <option value="right">curva ↘</option>
                </select>
                <button type="button" onClick={() => set({ edges: spec.edges.filter((_, j) => j !== i) })} title="Quitar flecha" className="ml-auto rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const first = spec.nodes[0]?.id ?? ''
                const second = spec.nodes[1]?.id ?? first
                set({ edges: [...spec.edges, { from: first, to: second }] })
              }}
              className="self-start rounded border border-(--color-border) px-2 py-1 text-(--color-ink) hover:bg-(--color-surface)"
            >
              + flecha
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
            Título
            <input value={spec.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined })} placeholder="(opcional)" className={`w-28 ${INPUT}`} />
          </label>
        </div>
      )}
    </div>
  )
}
