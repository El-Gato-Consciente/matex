import { ChevronDown } from '@/components/icons'
import { useState } from 'react'
import { PLOT_COLORS } from '../core'
import type { ChartForm, ChartSpec } from '../core'

/** Selector compacto de color de la paleta (o «A» = automático por índice). */
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

/**
 * **Editor del gráfico categórico** (familia A1/A2), en el inspector derecho. Edita la
 * **forma** (barras/torta) y los **datos** (tabla categorías × series) + opciones. Es el par
 * de edición de `core/graphics/chart.ts` (LaTeX) y `chartSvg.ts` (preview). Recibe la `spec`
 * y un `onChange` que reemplaza la spec completa (los cambios son estructurales).
 */

const INPUT = 'rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)'

const num = (s: string): number => {
  const v = Number(s.replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

export function ChartEditor({ spec, onChange }: { spec: ChartSpec; onChange: (spec: ChartSpec) => void }) {
  const [open, setOpen] = useState(true)
  const set = (patch: Partial<ChartSpec>): void => onChange({ ...spec, ...patch })
  const isPie = spec.form === 'pie'

  const setValue = (si: number, ci: number, v: number): void =>
    set({ series: spec.series.map((s, j) => (j === si ? { ...s, values: s.values.map((x, k) => (k === ci ? v : x)) } : s)) })
  const setCategory = (ci: number, name: string): void =>
    set({ categories: spec.categories.map((c, k) => (k === ci ? name : c)) })
  const addCategory = (): void =>
    set({ categories: [...spec.categories, `Cat ${spec.categories.length + 1}`], series: spec.series.map((s) => ({ ...s, values: [...s.values, 0] })) })
  const removeCategory = (ci: number): void =>
    set({ categories: spec.categories.filter((_, k) => k !== ci), series: spec.series.map((s) => ({ ...s, values: s.values.filter((_, k) => k !== ci) })) })
  const setSeriesLabel = (si: number, label: string): void =>
    set({ series: spec.series.map((s, j) => (j === si ? { ...s, label: label || undefined } : s)) })
  const setSeriesColor = (si: number, color: string | undefined): void =>
    set({ series: spec.series.map((s, j) => (j === si ? { ...s, color } : s)) })
  const addSeries = (): void =>
    set({ series: [...spec.series, { label: `Serie ${spec.series.length + 1}`, values: spec.categories.map(() => 0) }] })
  const removeSeries = (si: number): void => set({ series: spec.series.filter((_, j) => j !== si) })

  // Barras: todas las series; torta: solo la 1ª (las demás no aplican).
  const shownSeries = isPie ? spec.series.slice(0, 1) : spec.series

  return (
    <div className="border-b border-(--color-border) bg-(--color-surface-muted) text-xs">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 font-medium text-(--color-ink)">
          <ChevronDown className={['h-3.5 w-3.5 transition-transform', open ? '' : '-rotate-90'].join(' ')} />
          Gráfico de datos
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-3">
          {/* Forma = intención (comparar / repartir / tendencia…). */}
          <label className="flex items-center gap-2 text-(--color-ink-muted)">
            Forma
            <select value={spec.form} onChange={(e) => set({ form: e.target.value as ChartForm })} className={INPUT}>
              <option value="bar">Barras (comparar)</option>
              <option value="stackedBar">Barras apiladas</option>
              <option value="hbar">Barras horizontales</option>
              <option value="line">Línea (tendencia)</option>
              <option value="pie">Torta (repartir)</option>
            </select>
          </label>

          {/* Tabla categorías × series. */}
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left font-normal text-(--color-ink-muted)">Categoría</th>
                  {shownSeries.map((s, si) => (
                    <th key={si} className="font-normal">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <input value={s.label ?? ''} onChange={(e) => setSeriesLabel(si, e.target.value)} placeholder={`Serie ${si + 1}`} className={`w-20 ${INPUT}`} />
                          {!isPie && spec.series.length > 1 && (
                            <button type="button" onClick={() => removeSeries(si)} title="Quitar serie" className="rounded px-1 text-(--color-ink-muted) hover:bg-(--color-surface)">✕</button>
                          )}
                        </div>
                        {!isPie && <ColorPicker value={s.color} onChange={(c) => setSeriesColor(si, c)} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {spec.categories.map((cat, ci) => (
                  <tr key={ci}>
                    <td>
                      <div className="flex items-center gap-1">
                        <input value={cat} onChange={(e) => setCategory(ci, e.target.value)} className={`w-24 ${INPUT}`} />
                        {spec.categories.length > 1 && (
                          <button type="button" onClick={() => removeCategory(ci)} title="Quitar categoría" className="rounded px-1 text-(--color-ink-muted) hover:bg-(--color-surface)">✕</button>
                        )}
                      </div>
                    </td>
                    {shownSeries.map((s, si) => (
                      <td key={si}>
                        <input value={String(s.values[ci] ?? 0)} onChange={(e) => setValue(si, ci, num(e.target.value))} inputMode="decimal" className={`w-16 ${INPUT}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addCategory} className="rounded border border-(--color-border) px-2 py-1 text-(--color-ink) hover:bg-(--color-surface)">+ categoría</button>
            {!isPie && <button type="button" onClick={addSeries} className="rounded border border-(--color-border) px-2 py-1 text-(--color-ink) hover:bg-(--color-surface)">+ serie</button>}
            {isPie && spec.series.length > 1 && <span className="text-(--color-ink-muted)">La torta usa la 1ª serie.</span>}
          </div>

          {/* Opciones. */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
              Título
              <input value={spec.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined })} placeholder="(opcional)" className={`w-32 ${INPUT}`} />
            </label>
            {!isPie && (
              <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
                Eje Y
                <input value={spec.ylabel ?? ''} onChange={(e) => set({ ylabel: e.target.value || undefined })} placeholder="(opcional)" className={`w-24 ${INPUT}`} />
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
              <input type="checkbox" checked={spec.legend ?? false} onChange={(e) => set({ legend: e.target.checked })} />
              Leyenda
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
