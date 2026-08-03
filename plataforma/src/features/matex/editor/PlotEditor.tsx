import { useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from '@/components/icons'
import { resolvePlotFunctions, resolvePlotParameters, type AreaPattern, type PlotSpec } from '../core'
import { ExprPosInput, LabelPosSelect, NumInput, ParamNumberField } from './plotEditorParts'
import { fnValueAt, PLOT_TOKEN_GROUPS } from './plotEditorUtils'
import { ARR_KEY, curveCount, CURVE_LABEL, curveOptions, curveRefKey, parseCurveRefKey, type CurveType } from './plotCurves'
import { addPatch, changeTypePatch, removalPatch, syntaxPatch } from './plotPatch'
import { ConicRow, DataRow, FunctionRow, ImplicitRow, ParametricRow, PolarRow } from './plotRows'

/**
 * **Editor visual del gráfico de funciones.** Autocontenido: recibe la `spec` del plot y un
 * `onPatch` que mezcla un parche en ella (= la `updatePlotSpec` del workspace). Todo el estado
 * efímero de UI (pestaña activa, panel abierto, popovers `⋯`, foco de la botonera) vive acá.
 *
 * **Una sola pestaña "Curvas"** reúne los cinco tipos que conviven sobre el mismo eje cartesiano
 * (explícita `y=f(x)`, datos/scatter, paramétrica, polar, implícita `F(x,y)=0`) en **una lista
 * con selector de tipo por fila** (estilo Desmos): cada tipo es un `*Row` reusable y la botonera de
 * tokens se comparte entre todos los inputs de expresión. Es **UI**: el modelo mantiene sus arrays
 * separados (`functions`/`data`/`parametrics`/`polars`/`implicits`, todos familia A4). `Ejes` y
 * `Anotaciones` quedan como pestañas de configuración.
 */

/** Mezcla un parche en la `spec` del gráfico (la parte activa de la figura). */
type PlotPatch = (patch: Record<string, unknown>) => void
interface TabProps {
  spec: PlotSpec
  onPatch: PlotPatch
}

type PlotTab = 'curvas' | 'ejes' | 'anotaciones'

/** Input de expresión enfocado + cómo escribir su nuevo valor (para que la botonera sea genérica). */
type ExprFocus = { el: HTMLInputElement; set: (value: string) => void }

export function PlotEditor({ spec, onPatch }: TabProps) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<PlotTab>('curvas')

  const nCurves =
    spec.functions.length + (spec.data?.length ?? 0) + (spec.parametrics?.length ?? 0) +
    (spec.polars?.length ?? 0) + (spec.implicits?.length ?? 0)
  const nAnn =
    (spec.areas?.length ?? 0) + (spec.points?.length ?? 0) + (spec.vlines?.length ?? 0) +
    (spec.hlines?.length ?? 0) + (spec.tangents?.length ?? 0) + (spec.texts?.length ?? 0) +
    (spec.intersections?.length ?? 0)
  const tabs: [PlotTab, string, number][] = [
    ['curvas', 'Curvas', nCurves],
    ['ejes', 'Ejes', 0],
    ['anotaciones', 'Anotaciones', nAnn],
  ]

  return (
    <div className="border-b border-(--color-border) bg-(--color-surface-muted) text-xs">
      {/* Encabezado colapsable del panel entero (para recuperar lienzo). */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 font-medium text-(--color-ink)"
        >
          <ChevronDown className={['h-3.5 w-3.5 transition-transform', open ? '' : '-rotate-90'].join(' ')} />
          Gráfico de funciones
        </button>
        {!open && <span className="text-(--color-ink-muted)">{nCurves} curva(s) · editá abajo al expandir</span>}
      </div>
      {open && (
        <>
          {/* Pestañas: Curvas (los 5 tipos) + configuración (Ejes / Anotaciones). */}
          <div className="flex flex-wrap items-center gap-1 border-b border-(--color-border) px-4 py-1.5 text-xs">
            {tabs.map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={['rounded px-2 py-1', tab === id ? 'bg-(--color-primary) text-(--color-primary-ink)' : 'text-(--color-ink-muted) hover:bg-(--color-surface)'].join(' ')}
              >
                {label}
                {id !== 'ejes' && n > 0 && <span className="ml-1 opacity-70">({n})</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4 py-2">
            {tab === 'curvas' && <CurvesTab spec={spec} onPatch={onPatch} />}
            {tab === 'ejes' && <AxesTab spec={spec} onPatch={onPatch} />}
            {tab === 'anotaciones' && <AnnotationsTab spec={spec} onPatch={onPatch} />}
          </div>
        </>
      )}
    </div>
  )
}

// ── Curvas (los 5 tipos en una lista) ─────────────────────────────────────────

function CurvesTab({ spec, onPatch }: TabProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Input de expresión enfocado para la botonera (función/rama/paramétrica/polar/implícita).
  const focusRef = useRef<ExprFocus | null>(null)
  const plotSyntax: 'ascii' | 'latex' = spec.syntax ?? 'ascii'

  const funcs = spec.functions
  const data = spec.data ?? []
  const params = spec.parametrics ?? []
  const polars = spec.polars ?? []
  const implicits = spec.implicits ?? []
  const conics = spec.conics ?? []
  const arrayFor = (t: CurveType): unknown[] =>
    t === 'function' ? funcs : t === 'data' ? data : t === 'parametric' ? params : t === 'polar' ? polars : t === 'implicit' ? implicits : conics

  // Exprs con parámetros y referencias `f1(x)` resueltos (para validar/previsualizar; la edición
  // usa el texto crudo). Sustituir parámetros primero evita marcar `a x^2` como inválida.
  const resolved = resolvePlotFunctions(resolvePlotParameters(spec).functions, 'x')

  // Lista unificada, en el **orden de trazado** (= orden de color): funciones, datos, paramétricas,
  // polares, implícitas. Cada fila lleva su índice global de color.
  type Row = { type: CurveType; i: number; colorIndex: number }
  const rows: Row[] = [
    ...funcs.map((_, i): Row => ({ type: 'function', i, colorIndex: i })),
    ...data.map((_, i): Row => ({ type: 'data', i, colorIndex: funcs.length + i })),
    ...params.map((_, i): Row => ({ type: 'parametric', i, colorIndex: funcs.length + data.length + i })),
    ...polars.map((_, i): Row => ({ type: 'polar', i, colorIndex: funcs.length + data.length + params.length + i })),
    ...implicits.map((_, i): Row => ({ type: 'implicit', i, colorIndex: funcs.length + data.length + params.length + polars.length + i })),
    ...conics.map((_, i): Row => ({ type: 'conic', i, colorIndex: funcs.length + data.length + params.length + polars.length + implicits.length + i })),
  ]

  /** Mezcla un parche en el ítem `i` del array del tipo `t`. */
  function patchAt(t: CurveType, i: number, patch: Record<string, unknown>): void {
    onPatch({ [ARR_KEY[t]]: (arrayFor(t) as Record<string, unknown>[]).map((q, j) => (j === i ? { ...q, ...patch } : q)) })
  }
  const registerFocus = (el: HTMLInputElement, set: (v: string) => void): void => {
    focusRef.current = { el, set }
  }
  /** Inserta un token en el input de expresión enfocado, respetando el cursor. */
  function insertToken(snippet: string): void {
    const f = focusRef.current
    if (!f) return
    const el = f.el
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    const hole = snippet.search(/\(\)|\{\}/) // cursor dentro del primer ()/{} vacío
    const caret = hole >= 0 ? start + hole + 1 : start + snippet.length
    f.set(el.value.slice(0, start) + snippet + el.value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  /** Cambia el modo del campo (ASCII↔LaTeX) **convirtiendo** el texto de cada serie con expresión. */
  function setSyntax(mode: 'ascii' | 'latex'): void {
    const patch = syntaxPatch(spec, mode)
    if (patch) onPatch(patch)
  }

  function addCurve(t: CurveType): void {
    onPatch(addPatch(spec, t, {}))
    setAddOpen(false)
  }
  function removeCurve(t: CurveType, i: number): void {
    onPatch(removalPatch(spec, t, i))
  }
  /** Convierte una fila a otro tipo, **preservando** leyenda/color/trazo/oculto. */
  function changeType(from: CurveType, i: number, to: CurveType): void {
    const patch = changeTypePatch(spec, from, i, to)
    if (patch) onPatch(patch)
  }

  // ── Parámetros (ME-36, fase A): variables con nombre usables en las fórmulas ──
  const plotParams = spec.parameters ?? []
  const setParam = (i: number, patch: Record<string, unknown>): void =>
    onPatch({ parameters: plotParams.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const addParam = (): void => {
    const used = new Set(plotParams.map((p) => p.name))
    const name = ['a', 'b', 'c', 'k', 'm', 'n', 'p', 'q'].find((n) => !used.has(n)) ?? `p${plotParams.length + 1}`
    onPatch({ parameters: [...plotParams, { name, value: 1 }] })
  }
  const removeParam = (i: number): void => onPatch({ parameters: plotParams.filter((_, j) => j !== i) })
  const paramNum = (raw: string): number | undefined => {
    const v = Number(raw)
    return Number.isFinite(v) ? v : undefined
  }

  // Las cónicas son primitivas geométricas (no basadas en expresión): no se convierten a/desde
  // los otros tipos → llevan un rótulo fijo y se excluyen como destino de conversión.
  const typeSelect = (row: Row): ReactNode =>
    row.type === 'conic' ? (
      <span className="shrink-0 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink-muted)" title="Cónica (primitiva geométrica)">
        cónica
      </span>
    ) : (
      <select
        value={row.type}
        onChange={(e) => changeType(row.type, row.i, e.target.value as CurveType)}
        aria-label="Tipo de curva"
        title="Tipo de curva (convierte preservando color/leyenda)"
        className="shrink-0 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink-muted) outline-none"
      >
        {(Object.keys(CURVE_LABEL) as CurveType[])
          .filter((t) => t !== 'conic')
          .map((t) => (
            <option key={t} value={t}>
              {CURVE_LABEL[t]}
            </option>
          ))}
      </select>
    )

  return (
    <section className="flex flex-col gap-1.5">
      {/* Botonera compartida: toggle de sintaxis + tokens, aplican a todo input de expresión. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-(--color-ink)">Curvas</span>
          <div className="inline-flex shrink-0 overflow-hidden rounded border border-(--color-border)" role="group" aria-label="Sintaxis del campo de expresión">
            {(['ascii', 'latex'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSyntax(mode)}
                title={
                  mode === 'ascii'
                    ? 'ASCII: se escribe como en una calculadora (x^2, sqrt(x), sin(x)).'
                    : 'LaTeX: se escribe con comandos matemáticos (x^{2}, \\sqrt{x}, \\sin(x)).'
                }
                aria-pressed={plotSyntax === mode}
                className={['px-2 py-0.5 font-medium', plotSyntax === mode ? 'bg-(--color-primary) text-white' : 'text-(--color-ink-muted) hover:bg-(--color-surface)'].join(' ')}
              >
                {mode === 'ascii' ? 'ASCII' : 'LaTeX'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          {PLOT_TOKEN_GROUPS.map((group, g) => (
            <div key={g} className="flex items-center gap-0.5">
              {g > 0 && <span className="mx-1 h-4 w-px bg-(--color-border)" />}
              {group.map((tok) => (
                <button
                  key={tok.label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault() // no robar el foco del input antes de insertar
                    insertToken(plotSyntax === 'latex' ? tok.latex : tok.ascii)
                  }}
                  title={`${tok.title} — inserta ${plotSyntax === 'latex' ? tok.latex : tok.ascii}`}
                  className="min-w-6 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) hover:border-(--color-primary) hover:text-(--color-primary)"
                >
                  {tok.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {rows.map((row) => {
        const key = `${row.type}:${row.i}`
        const shared = {
          leading: typeSelect(row),
          colorIndex: row.colorIndex,
          plotSyntax,
          open: openKey === key,
          onToggle: () => setOpenKey((k) => (k === key ? null : key)),
          onRemove: () => removeCurve(row.type, row.i),
          registerFocus,
          patch: (p: Record<string, unknown>) => patchAt(row.type, row.i, p),
          parameters: spec.parameters,
        }
        return (
          <div key={key}>
            {row.type === 'function' && (
              <FunctionRow {...shared} spec={spec} i={row.i} fn={funcs[row.i]!} resolvedExpr={resolved[row.i]?.expr ?? funcs[row.i]!.expr} />
            )}
            {row.type === 'data' &&
              (() => {
                const FUNCTIONAL_ORDER = ['spline', 'monotone', 'polynomial', 'linear', 'step', 'regression', 'reg-exp', 'reg-log', 'reg-power'] as const
                const dataFuncs = funcs.map((fn, fi) => ({ fn, fi })).filter((e) => e.fn.fromData?.series === row.i).map((e) => ({ index: e.fi, method: e.fn.fromData!.method }))
                const used = new Set(dataFuncs.map((d) => d.method))
                const ser = data[row.i]!
                const pref = ser.interpolate && ser.interpolate !== 'polyline' && ser.interpolate !== 'smooth' ? ser.interpolate : null
                const nextMethod = pref && !used.has(pref) ? pref : FUNCTIONAL_ORDER.find((m) => !used.has(m))
                return (
                  <DataRow
                    {...shared}
                    s={ser}
                    dataFuncs={dataFuncs}
                    canAdd={nextMethod != null}
                    onAddFunction={() => nextMethod && onPatch({ functions: [...funcs, { expr: '', fromData: { series: row.i, method: nextMethod } }] })}
                  />
                )
              })()}
            {row.type === 'parametric' && <ParametricRow {...shared} p={params[row.i]!} index={row.i} />}
            {row.type === 'polar' && <PolarRow {...shared} p={polars[row.i]!} index={row.i} />}
            {row.type === 'implicit' && <ImplicitRow {...shared} im={implicits[row.i]!} index={row.i} equalAxes={spec.equalAxes === true} onEqualAxes={() => onPatch({ equalAxes: true })} />}
            {row.type === 'conic' && <ConicRow {...shared} c={conics[row.i]!} index={row.i} equalAxes={spec.equalAxes === true} onEqualAxes={() => onPatch({ equalAxes: true })} />}
          </div>
        )
      })}

      {/* Agregar: un botón con menú de tipo (por intención). */}
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          aria-expanded={addOpen}
          className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)"
        >
          + agregar curva
        </button>
        {addOpen && (
          <div className="absolute top-6 left-0 z-10 flex flex-col rounded border border-(--color-border) bg-(--color-surface) py-1 shadow-md">
            {(Object.keys(CURVE_LABEL) as CurveType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addCurve(t)}
                className="px-3 py-1 text-left text-(--color-ink) hover:bg-(--color-surface-muted)"
              >
                {CURVE_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {funcs.length > 1 && (
        <span className="text-[11px] text-(--color-ink-muted)" title="Referenciá otra función por su número: f1, f2… (con argumento: f1(x-2)).">
          Podés usar <code className="rounded bg-(--color-surface) px-1">f1</code>, <code className="rounded bg-(--color-surface) px-1">f2</code>… en una fórmula (transformar/componer): p. ej. <code className="rounded bg-(--color-surface) px-1">f1(x)+1</code> o <code className="rounded bg-(--color-surface) px-1">f2(f1(x))</code>.
        </span>
      )}

      {/* Parámetros: variables con nombre usables en las fórmulas (a x^2 + b). El valor se
          sustituye en todos los backends; min/max preparan el slider (ME-36 fase B). */}
      <div className="mt-1 flex flex-col gap-1.5 border-t border-(--color-border) pt-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-(--color-ink)">Parámetros</span>
          <span className="text-[11px] text-(--color-ink-muted)">
            variables usables en las fórmulas: p. ej. <code className="rounded bg-(--color-surface) px-1">a x^2 + b</code>
          </span>
        </div>
        {plotParams.map((p, i) => {
          const hasRange = p.min != null && p.max != null && p.min < p.max
          const step = p.step && p.step > 0 ? p.step : hasRange ? Number(((p.max! - p.min!) / 100).toPrecision(2)) : 0.1
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  value={p.name}
                  onChange={(e) => setParam(i, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                  aria-label={`Nombre del parámetro ${i + 1}`}
                  className="w-12 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-center text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
                <span className="text-(--color-ink-muted)">=</span>
                <ParamNumberField value={p.value} onChange={(v) => setParam(i, { value: v })} ariaLabel={`Valor del parámetro ${p.name}`} className="w-16 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)" />
                <span className="ml-1 text-[11px] text-(--color-ink-muted)">rango</span>
                <input
                  defaultValue={p.min != null ? String(p.min) : ''}
                  onChange={(e) => setParam(i, { min: paramNum(e.target.value) })}
                  placeholder="min"
                  inputMode="decimal"
                  aria-label={`Mínimo de ${p.name}`}
                  className="w-14 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
                <input
                  defaultValue={p.max != null ? String(p.max) : ''}
                  onChange={(e) => setParam(i, { max: paramNum(e.target.value) })}
                  placeholder="max"
                  inputMode="decimal"
                  aria-label={`Máximo de ${p.name}`}
                  className="w-14 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
                <button
                  type="button"
                  onClick={() => removeParam(i)}
                  title="Quitar parámetro"
                  className="ml-auto rounded px-1 text-(--color-ink-muted) hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              {/* Slider (aparece con min<max): mover = el gráfico cambia en vivo (ME-36 fase B1). */}
              {hasRange && (
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={step}
                  value={p.value}
                  onChange={(e) => setParam(i, { value: Number(e.target.value) })}
                  aria-label={`Deslizador de ${p.name}`}
                  className="w-full accent-(--color-primary)"
                />
              )}
            </div>
          )
        })}
        <button type="button" onClick={addParam} className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)">
          + parámetro
        </button>
      </div>
    </section>
  )
}

// ── Ejes ─────────────────────────────────────────────────────────────────────

function AxesTab({ spec, onPatch }: TabProps) {
  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <span className="font-medium text-(--color-ink)">Ejes</span>
      <label className="inline-flex items-center gap-1 text-(--color-ink-muted)" title="Título sobre el gráfico (distinto del epígrafe de la figura).">
        título
        <input
          value={spec.title ?? ''}
          onChange={(e) => onPatch({ title: e.target.value || undefined })}
          placeholder="(sin título)"
          aria-label="título del gráfico"
          className="w-32 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none"
        />
      </label>
      <label className="inline-flex items-center gap-1 text-(--color-ink-muted)" title="Puntos de muestreo por curva (más = más suave, compila más lento). Default 100.">
        muestreo
        <NumInput value={spec.samples ?? 100} onNum={(v) => onPatch({ samples: Math.max(2, Math.min(1000, Math.round(v))) })} label="muestreo" />
      </label>
      <label className="inline-flex items-center gap-1 text-(--color-ink-muted)">
        dominio
        <NumInput value={spec.domain[0]} onNum={(v) => onPatch({ domain: [v, spec.domain[1]] })} label="x mínimo" />
        a
        <NumInput value={spec.domain[1]} onNum={(v) => onPatch({ domain: [spec.domain[0], v] })} label="x máximo" />
      </label>
      <label className="inline-flex items-center gap-1 text-(--color-ink-muted)">
        <input type="checkbox" checked={!spec.range} onChange={(e) => onPatch({ range: e.target.checked ? undefined : [-10, 10] })} />
        rango auto
        {spec.range && (
          <>
            <NumInput value={spec.range[0]} onNum={(v) => spec.range && onPatch({ range: [v, spec.range[1]] })} label="y mínimo" />
            a
            <NumInput value={spec.range[1]} onNum={(v) => spec.range && onPatch({ range: [spec.range[0], v] })} label="y máximo" />
          </>
        )}
      </label>
      <label className="inline-flex items-center gap-1 text-(--color-ink-muted)">
        rótulos
        <input
          value={spec.xlabel ?? ''}
          onChange={(e) => onPatch({ xlabel: e.target.value || undefined })}
          placeholder="x"
          aria-label="etiqueta eje x"
          className="w-14 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
        />
        <input
          value={spec.ylabel ?? ''}
          onChange={(e) => onPatch({ ylabel: e.target.value || undefined })}
          placeholder="y"
          aria-label="etiqueta eje y"
          className="w-14 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
        />
      </label>
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
        <input type="checkbox" checked={spec.grid === true} onChange={(e) => onPatch({ grid: e.target.checked })} />
        grilla
      </label>
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
        <input type="checkbox" checked={spec.legend === true} onChange={(e) => onPatch({ legend: e.target.checked })} />
        leyenda
      </label>
      {spec.legend && (
        <select
          value={spec.legendPos ?? 'top-left'}
          onChange={(e) => onPatch({ legendPos: e.target.value === 'top-left' ? undefined : e.target.value })}
          aria-label="posición de la leyenda"
          title="Posición de la leyenda"
          className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
        >
          <option value="top-left">arriba izq.</option>
          <option value="top-right">arriba der.</option>
          <option value="bottom-left">abajo izq.</option>
          <option value="bottom-right">abajo der.</option>
          <option value="outside-right">afuera der.</option>
        </select>
      )}
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Panel que lista los rasgos auto-detectados (raíces, extremos, asíntotas) con sus coordenadas.">
        <input type="checkbox" checked={spec.featureLegend === true} onChange={(e) => onPatch({ featureLegend: e.target.checked ? true : undefined })} />
        leyenda de rasgos
      </label>
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Misma escala en x e y (aspecto 1:1): círculos redondos, ángulos fieles.">
        <input type="checkbox" checked={spec.equalAxes === true} onChange={(e) => onPatch({ equalAxes: e.target.checked })} />
        ejes iguales
      </label>
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Marcar el eje x en múltiplos de π/2 (para funciones trigonométricas).">
        <input type="checkbox" checked={spec.piTicks === true} onChange={(e) => onPatch({ piTicks: e.target.checked })} />
        ticks π
      </label>
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Mostrar los números en las escalas de los ejes (igual que el PDF).">
        <input type="checkbox" checked={spec.hideTicks !== true} onChange={(e) => onPatch({ hideTicks: e.target.checked ? undefined : true })} />
        números en ejes
      </label>
    </section>
  )
}

// ── Anotaciones ──────────────────────────────────────────────────────────────

function AnnotationsTab({ spec, onPatch }: TabProps) {
  const areas = spec.areas ?? []
  const points = spec.points ?? []
  const vlines = spec.vlines ?? []
  const hlines = spec.hlines ?? []
  const tangents = spec.tangents ?? []
  const texts = spec.texts ?? []
  return (
    <section>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-(--color-ink-muted)" title="Sombrea el área bajo una función sobre un intervalo (integral definida).">
            Áreas <span className="text-(--color-ink-muted)">(∫)</span>
          </span>
          {areas.map((area, i) => (
            <div key={i} className="flex items-center gap-1 text-(--color-ink-muted)">
              {spec.functions.length > 1 && (
                <select
                  value={area.fn}
                  onChange={(e) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, fn: Number(e.target.value) } : a)) })}
                  aria-label="función del área"
                  className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                >
                  {spec.functions.map((_, j) => (
                    <option key={j} value={j}>
                      f{j + 1}{spec.functions[j]?.fromData ? ' (datos)' : ''}
                    </option>
                  ))}
                </select>
              )}
              de
              <ExprPosInput
                num={area.from}
                expr={area.fromExpr}
                params={spec.parameters}
                onChange={(n, x) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, from: n ?? a.from, fromExpr: x } : a)) })}
                label="desde"
              />
              a
              <ExprPosInput
                num={area.to}
                expr={area.toExpr}
                params={spec.parameters}
                onChange={(n, x) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, to: n ?? a.to, toExpr: x } : a)) })}
                label="hasta"
              />
              {spec.functions.length > 1 && (
                <label className="inline-flex items-center gap-1" title="Borde superior del área: el eje (integral) o entre dos curvas.">
                  hasta
                  <select
                    value={area.toFn ?? 'axis'}
                    onChange={(e) =>
                      onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, toFn: e.target.value === 'axis' ? undefined : Number(e.target.value) } : a)) })
                    }
                    aria-label="borde superior del área"
                    className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                  >
                    <option value="axis">el eje</option>
                    {spec.functions.map((_, j) =>
                      j === area.fn ? null : (
                        <option key={j} value={j}>
                          f{j + 1}{spec.functions[j]?.fromData ? ' (datos)' : ''}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <select
                value={area.pattern ?? 'solid'}
                onChange={(e) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, pattern: e.target.value === 'solid' ? undefined : (e.target.value as AreaPattern) } : a)) })}
                aria-label="textura del área"
                title="Textura del relleno (para distinguir áreas superpuestas)."
                className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
              >
                <option value="solid">sólido</option>
                <option value="lines">líneas ╱</option>
                <option value="lines-alt">líneas ╲</option>
                <option value="crosshatch">cruzado</option>
                <option value="dots">puntos</option>
                <option value="grid">grilla</option>
                <option value="horizontal">horizontales</option>
                <option value="vertical">verticales</option>
              </select>
              <label className="inline-flex items-center gap-1" title="Anotar el valor de la integral ∫ (o la suma Σ si hay Riemann).">
                <input type="checkbox" checked={area.showValue === true} onChange={(e) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, showValue: e.target.checked ? true : undefined } : a)) })} />
                ∫
              </label>
              <label className="inline-flex items-center gap-1" title="Aproximar la integral con rectángulos (suma de Riemann) o trapecios — recurso didáctico.">
                <select
                  value={area.riemann ?? 'off'}
                  onChange={(e) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, riemann: e.target.value === 'off' ? undefined : (e.target.value as NonNullable<typeof a.riemann>) } : a)) })}
                  aria-label="suma de Riemann"
                  className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                >
                  <option value="off">sin Riemann</option>
                  <option value="left">Riemann izq.</option>
                  <option value="right">Riemann der.</option>
                  <option value="mid">Riemann medio</option>
                  <option value="trapezoid">trapecios</option>
                </select>
                {area.riemann && (
                  <span className="inline-flex items-center gap-0.5" title="Cantidad de subintervalos (rectángulos/trapecios).">
                    n
                    <NumInput value={area.riemannN ?? 8} onNum={(v) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, riemannN: Math.max(1, Math.min(200, Math.round(v))) } : a)) })} label="cantidad de subintervalos" />
                  </span>
                )}
              </label>
              {area.showValue && <LabelPosSelect value={area.labelPos} onChange={(v) => onPatch({ areas: areas.map((a, j) => (j === i ? { ...a, labelPos: v } : a)) })} />}
              <button type="button" onClick={() => onPatch({ areas: areas.filter((_, j) => j !== i) })} title="Quitar área" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onPatch({ areas: [...areas, { fn: 0, from: 0, to: 1 }] })} className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)">
            + área
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-(--color-ink-muted)" title="Marca puntos (x, y) con rótulo: raíces, extremos, intersecciones.">Puntos</span>
          {points.map((pt, i) => {
            const updatePt = (patch: Record<string, unknown>) => onPatch({ points: points.map((q, j) => (j === i ? { ...q, ...patch } : q)) })
            const anchored = pt.fn != null
            const computedY = anchored ? fnValueAt(spec, pt.fn!, pt.x) : null
            return (
              <div key={i} className="flex items-center gap-1 text-(--color-ink-muted)">
                (
                <ExprPosInput
                  num={pt.x}
                  expr={pt.xExpr}
                  params={spec.parameters}
                  onChange={(n, x) => {
                    if (n != null) {
                      // Constante: si está anclado, mover x recalcula y = f(x).
                      const yy = anchored ? fnValueAt(spec, pt.fn!, n) : null
                      updatePt({ x: n, xExpr: undefined, ...(yy != null ? { y: yy } : {}) })
                    } else {
                      // Expresión con parámetro: el punto recorre la curva con el slider (resuelto al render).
                      updatePt({ xExpr: x })
                    }
                  }}
                  label="x"
                />
                ,
                {anchored ? (
                  <span className="w-12 text-center font-mono text-(--color-ink)" title="y = f(x), calculado (anclado a la función)">
                    {computedY != null ? computedY.toFixed(2) : '—'}
                  </span>
                ) : (
                  <ExprPosInput
                    num={pt.y}
                    expr={pt.yExpr}
                    params={spec.parameters}
                    onChange={(n, y) => updatePt(n != null ? { y: n, yExpr: undefined } : { yExpr: y })}
                    label="y"
                  />
                )}
                )
                {spec.functions.length >= 1 && (
                  <label className="inline-flex items-center gap-1" title="Anclar el punto a una función: y = f(x) se calcula sola y sigue la curva.">
                    sobre
                    <select
                      value={pt.fn ?? 'none'}
                      onChange={(e) => {
                        const fn = e.target.value === 'none' ? undefined : Number(e.target.value)
                        const yy = fn != null ? fnValueAt(spec, fn, pt.x) : null
                        updatePt({ fn, ...(yy != null ? { y: yy } : {}) })
                      }}
                      aria-label="función sobre la que vive el punto"
                      className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                    >
                      <option value="none">—</option>
                      {spec.functions.map((_, j) => (
                        <option key={j} value={j}>
                          f{j + 1}{spec.functions[j]?.fromData ? ' (datos)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <input
                  value={pt.label ?? ''}
                  onChange={(e) => updatePt({ label: e.target.value || undefined })}
                  placeholder="rótulo"
                  aria-label="rótulo del punto"
                  className="w-16 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                />
                <label className="inline-flex items-center gap-1" title="Punto hueco: valor no incluido (extremo abierto de un intervalo).">
                  <input type="checkbox" checked={pt.open === true} onChange={(e) => updatePt({ open: e.target.checked ? true : undefined })} />
                  hueco
                </label>
                <button type="button" onClick={() => onPatch({ points: points.filter((_, j) => j !== i) })} title="Quitar punto" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
              </div>
            )
          })}
          <button type="button" onClick={() => onPatch({ points: [...points, { x: 0, y: 0 }] })} className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)">+ punto</button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-(--color-ink-muted)" title="Líneas verticales x=a (asíntotas, valores destacados).">Verticales</span>
          {vlines.map((vl, i) => (
            <div key={i} className="flex items-center gap-1 text-(--color-ink-muted)">
              x=
              <ExprPosInput
                num={vl.x}
                expr={vl.xExpr}
                params={spec.parameters}
                onChange={(n, x) => onPatch({ vlines: vlines.map((w, j) => (j === i ? { ...w, x: n ?? w.x, xExpr: x } : w)) })}
                label="x"
              />
              <input
                value={vl.label ?? ''}
                onChange={(e) => onPatch({ vlines: vlines.map((w, j) => (j === i ? { ...w, label: e.target.value || undefined } : w)) })}
                placeholder="rótulo"
                aria-label="rótulo de la vertical"
                className="w-16 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
              />
              <button type="button" onClick={() => onPatch({ vlines: vlines.filter((_, j) => j !== i) })} title="Quitar vertical" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => onPatch({ vlines: [...vlines, { x: 0 }] })} className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)">+ vertical</button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-(--color-ink-muted)" title="Líneas horizontales y=b (asíntotas horizontales, valores destacados).">Horizontales</span>
          {hlines.map((hl, i) => (
            <div key={i} className="flex items-center gap-1 text-(--color-ink-muted)">
              y=
              <ExprPosInput
                num={hl.y}
                expr={hl.yExpr}
                params={spec.parameters}
                onChange={(n, y) => onPatch({ hlines: hlines.map((w, j) => (j === i ? { ...w, y: n ?? w.y, yExpr: y } : w)) })}
                label="y"
              />
              <input
                value={hl.label ?? ''}
                onChange={(e) => onPatch({ hlines: hlines.map((w, j) => (j === i ? { ...w, label: e.target.value || undefined } : w)) })}
                placeholder="rótulo"
                aria-label="rótulo de la horizontal"
                className="w-16 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
              />
              <button type="button" onClick={() => onPatch({ hlines: hlines.filter((_, j) => j !== i) })} title="Quitar horizontal" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => onPatch({ hlines: [...hlines, { y: 0 }] })} className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)">+ horizontal</button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-(--color-ink-muted)" title="Recta tangente a una función en un punto (visualiza la derivada f'(x₀)).">Tangentes</span>
          {tangents.map((tg, i) => (
            <div key={i} className="flex items-center gap-1 text-(--color-ink-muted)">
              {spec.functions.length > 1 && (
                <select
                  value={tg.fn}
                  onChange={(e) => onPatch({ tangents: tangents.map((a, j) => (j === i ? { ...a, fn: Number(e.target.value) } : a)) })}
                  aria-label="función de la tangente"
                  className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                >
                  {spec.functions.map((_, j) => (
                    <option key={j} value={j}>
                      f{j + 1}{spec.functions[j]?.fromData ? ' (datos)' : ''}
                    </option>
                  ))}
                </select>
              )}
              en x=
              <ExprPosInput
                num={tg.at}
                expr={tg.atExpr}
                params={spec.parameters}
                onChange={(n, x) => onPatch({ tangents: tangents.map((a, j) => (j === i ? { ...a, at: n ?? a.at, atExpr: x } : a)) })}
                label="punto x₀"
              />
              <input
                value={tg.label ?? ''}
                onChange={(e) => onPatch({ tangents: tangents.map((a, j) => (j === i ? { ...a, label: e.target.value || undefined } : a)) })}
                placeholder="rótulo"
                aria-label="rótulo de la tangente"
                className="w-16 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
              />
              <label className="inline-flex items-center gap-1" title="Anotar la pendiente f'(x₀) (el valor de la derivada).">
                <input type="checkbox" checked={tg.showValue === true} onChange={(e) => onPatch({ tangents: tangents.map((a, j) => (j === i ? { ...a, showValue: e.target.checked ? true : undefined } : a)) })} />
                f′
              </label>
              {(tg.showValue || tg.label) && <LabelPosSelect value={tg.labelPos} onChange={(v) => onPatch({ tangents: tangents.map((a, j) => (j === i ? { ...a, labelPos: v } : a)) })} />}
              <button type="button" onClick={() => onPatch({ tangents: tangents.filter((_, j) => j !== i) })} title="Quitar tangente" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => onPatch({ tangents: [...tangents, { fn: 0, at: 0 }] })} className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)">+ tangente</button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-(--color-ink-muted)" title="Texto libre en una posición (x, y) del gráfico.">Textos</span>
          {texts.map((tx, i) => (
            <div key={i} className="flex items-center gap-1 text-(--color-ink-muted)">
              <input
                value={tx.text}
                onChange={(e) => onPatch({ texts: texts.map((q, j) => (j === i ? { ...q, text: e.target.value } : q)) })}
                placeholder="texto"
                aria-label="texto libre"
                className="w-24 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
              />
              en (
              <NumInput value={tx.x} onNum={(v) => onPatch({ texts: texts.map((q, j) => (j === i ? { ...q, x: v } : q)) })} label="x" />
              ,
              <NumInput value={tx.y} onNum={(v) => onPatch({ texts: texts.map((q, j) => (j === i ? { ...q, y: v } : q)) })} label="y" />
              )
              <button type="button" onClick={() => onPatch({ texts: texts.filter((_, j) => j !== i) })} title="Quitar texto" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => onPatch({ texts: [...texts, { x: 0, y: 0, text: '' }] })} className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)">+ texto</button>
        </div>

        {(() => {
          const opts = curveOptions(spec)
          const inters = spec.intersections ?? []
          if (curveCount(spec) < 1) return null // hacen falta curvas reales (los ejes solos no aportan)
          return (
            <div className="flex flex-col gap-1">
              <span className="text-(--color-ink-muted)" title="Marca los puntos donde dos curvas se cruzan (se calculan en JS). Incluí los ejes: ∩ eje x = raíces, ∩ eje y = ordenada al origen.">
                Intersecciones <span className="text-(--color-ink-muted)">(∩)</span>
              </span>
              {inters.map((it, i) => {
                const patchIt = (patch: Record<string, unknown>) => onPatch({ intersections: inters.map((q, j) => (j === i ? { ...q, ...patch } : q)) })
                return (
                  <div key={i} className="flex items-center gap-1 text-(--color-ink-muted)">
                    <select
                      value={curveRefKey(it.a)}
                      onChange={(e) => {
                        const r = parseCurveRefKey(e.target.value)
                        if (r) patchIt({ a: r })
                      }}
                      aria-label="primera curva"
                      className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                    >
                      {opts.map((o) => (
                        <option key={curveRefKey(o.ref)} value={curveRefKey(o.ref)}>{o.label}</option>
                      ))}
                    </select>
                    ∩
                    <select
                      value={curveRefKey(it.b)}
                      onChange={(e) => {
                        const r = parseCurveRefKey(e.target.value)
                        if (r) patchIt({ b: r })
                      }}
                      aria-label="segunda curva"
                      className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                    >
                      {opts.map((o) => (
                        <option key={curveRefKey(o.ref)} value={curveRefKey(o.ref)}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      value={it.label ?? ''}
                      onChange={(e) => patchIt({ label: e.target.value || undefined })}
                      placeholder="rótulo"
                      aria-label="rótulo de la intersección"
                      className="w-16 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                    />
                    <label className="inline-flex items-center gap-1" title="Anotar cada punto con sus coordenadas (x, y).">
                      <input type="checkbox" checked={it.showCoords === true} onChange={(e) => patchIt({ showCoords: e.target.checked ? true : undefined })} />
                      coords
                    </label>
                    <button type="button" onClick={() => onPatch({ intersections: inters.filter((_, j) => j !== i) })} title="Quitar intersección" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => onPatch({ intersections: [...inters, { a: opts[0]!.ref, b: { kind: 'xaxis' as const, i: 0 } }] })}
                className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)"
              >
                + intersección
              </button>
            </div>
          )
        })()}
      </div>
    </section>
  )
}
