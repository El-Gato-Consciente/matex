import { ChevronDown } from '@/components/icons'
import { useState } from 'react'
import { PLOT_COLORS } from '../core'
import type { DistForm, DistSpec } from '../core'

/**
 * **Editor del gráfico de distribución** (familia A3), en el inspector derecho. Edita la **forma**
 * (histograma/boxplot) y los **datos crudos** (una o varias muestras) + opciones. Par de edición de
 * `core/graphics/distribution.ts` (LaTeX) y `distributionSvg.ts` (preview). Las muestras se tipean
 * como texto (números separados por coma/espacio/salto). Reemplaza la spec completa vía `onChange`.
 */
const INPUT = 'rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)'

const parseSamples = (s: string): number[] => s.split(/[\s,;]+/).map((t) => Number(t.replace(',', '.'))).filter((v) => Number.isFinite(v))

function ColorPicker({ value, onChange }: { value?: string | undefined; onChange: (c: string | undefined) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        title="Color automático"
        className={['flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[8px] leading-none text-(--color-ink-muted)', value ? 'border-(--color-border)' : 'border-(--color-ink) font-bold'].join(' ')}
      >
        A
      </button>
      {PLOT_COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          onClick={() => onChange(c.name)}
          title={c.name}
          aria-label={`Color ${c.name}`}
          style={{ backgroundColor: c.hex }}
          className={['h-3.5 w-3.5 rounded-sm border', value === c.name ? 'border-(--color-ink) ring-1 ring-(--color-ink)' : 'border-(--color-border)'].join(' ')}
        />
      ))}
    </div>
  )
}

export function DistEditor({ spec, onChange }: { spec: DistSpec; onChange: (spec: DistSpec) => void }) {
  const [open, setOpen] = useState(true)
  const set = (patch: Partial<DistSpec>): void => onChange({ ...spec, ...patch })
  const setSeries = (i: number, patch: Partial<DistSpec['data'][number]>): void =>
    set({ data: spec.data.map((d, j) => (j === i ? { ...d, ...patch } : d)) })
  const isHist = spec.form === 'histogram'

  return (
    <div className="border-b border-(--color-border) bg-(--color-surface-muted) text-xs">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 font-medium text-(--color-ink)">
          <ChevronDown className={['h-3.5 w-3.5 transition-transform', open ? '' : '-rotate-90'].join(' ')} />
          Gráfico de distribución
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-(--color-ink-muted)">
              Forma
              <select value={spec.form} onChange={(e) => set({ form: e.target.value as DistForm })} className={INPUT}>
                <option value="histogram">Histograma</option>
                <option value="boxplot">Caja (boxplot)</option>
              </select>
            </label>
            {isHist && (
              <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Cantidad de barras. Vacío = automático (≈√n).">
                Bins
                <input
                  value={spec.bins ?? ''}
                  onChange={(e) => set({ bins: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined })}
                  inputMode="numeric"
                  placeholder="auto"
                  className={`w-14 ${INPUT}`}
                />
              </label>
            )}
          </div>

          {/* Muestras crudas por serie. */}
          {spec.data.map((d, i) => (
            <div key={i} className="flex flex-col gap-1 rounded border border-(--color-border) bg-(--color-surface) p-2">
              <div className="flex items-center gap-2">
                <input value={d.label ?? ''} onChange={(e) => setSeries(i, { label: e.target.value || undefined })} placeholder={`muestra ${i + 1}`} className={`w-28 ${INPUT}`} />
                <ColorPicker value={d.color} onChange={(c) => setSeries(i, { color: c })} />
                <span className="text-(--color-ink-muted)">{d.samples.length} datos</span>
                {spec.data.length > 1 && (
                  <button type="button" onClick={() => set({ data: spec.data.filter((_, j) => j !== i) })} title="Quitar muestra" className="ml-auto rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
                )}
              </div>
              <textarea
                defaultValue={d.samples.join(', ')}
                onChange={(e) => setSeries(i, { samples: parseSamples(e.target.value) })}
                placeholder="números separados por coma o espacio: 3.1, 4, 4.2, 5, 5.1 …"
                aria-label={`Datos de la muestra ${i + 1}`}
                rows={2}
                className={`w-full resize-y font-mono ${INPUT}`}
              />
            </div>
          ))}
          <button type="button" onClick={() => set({ data: [...spec.data, { label: `muestra ${spec.data.length + 1}`, samples: [] }] })} className="self-start rounded border border-(--color-border) px-2 py-1 text-(--color-ink) hover:bg-(--color-surface)">
            + muestra
          </button>

          {/* Opciones. */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
              Título
              <input value={spec.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined })} placeholder="(opcional)" className={`w-28 ${INPUT}`} />
            </label>
            {isHist && (
              <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
                Eje X
                <input value={spec.xlabel ?? ''} onChange={(e) => set({ xlabel: e.target.value || undefined })} placeholder="(opcional)" className={`w-20 ${INPUT}`} />
              </label>
            )}
            {isHist && (
              <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
                <input type="checkbox" checked={spec.legend ?? false} onChange={(e) => set({ legend: e.target.checked })} />
                Leyenda
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
