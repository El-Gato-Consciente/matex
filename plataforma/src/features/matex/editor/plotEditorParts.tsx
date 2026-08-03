import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import { matexKatexMacros, PLOT_COLORS, substituteParamsInExpr, type PlotParameter } from '../core'
import { evalConst, parsePointsText, type LineStyle } from './plotEditorUtils'

/**
 * **Componentes de hoja** del editor de gráficos (sin estado del padre): inputs y controles
 * reutilizables. Se extrajeron de `MatexWorkspace` para que el panel del gráfico
 * (`PlotEditor`) quede modular. `KatexInline` además lo usa el builder de casos.
 */

const KATEX_MACROS = matexKatexMacros()

/** Renderiza `tex` matemático en línea con KaTeX (readonly); si falla, muestra el crudo. */
export function KatexInline({ tex }: { tex: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    try {
      katex.render(tex, el, { throwOnError: false, displayMode: false, macros: KATEX_MACROS })
    } catch {
      el.textContent = tex
    }
  }, [tex])
  return <span ref={ref} />
}

/**
 * Editor de una **serie de puntos** con textarea de **texto local** (un punto por línea,
 * `x y`). Parsea en vivo a `[x,y][]`. No se resincroniza mientras está enfocado (para no
 * pisar lo que se tipea); sí cuando el valor externo cambia por otra vía (p. ej. undo).
 */
export function PointsInput({ points, onPoints }: { points: [number, number][]; onPoints: (p: [number, number][]) => void }) {
  const serialize = (ps: [number, number][]): string => ps.map(([x, y]) => `${x} ${y}`).join('\n')
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(() => serialize(points))
  useEffect(() => {
    if (document.activeElement === ref.current) return // no pisar mientras se escribe
    const ext = serialize(points)
    setText((t) => (t === ext ? t : ext))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])
  return (
    <textarea
      ref={ref}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onPoints(parsePointsText(e.target.value))
      }}
      rows={3}
      placeholder={'x y (uno por línea)\n0 1\n1 4'}
      aria-label="Puntos de la serie"
      className="w-36 resize-y rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)"
    />
  )
}

/** Selector **compartido** de color + trazo (funciones, datos, paramétricas → homogéneo). */
type LineWidth = 'xthin' | 'thin' | 'normal' | 'thick' | 'xthick'
export function ColorStyleControls({
  color,
  style,
  width,
  onColor,
  onStyle,
  onWidth,
}: {
  color: string | undefined
  style: LineStyle | undefined
  width?: LineWidth | undefined
  onColor: (c: string | undefined) => void
  onStyle: (s: LineStyle | undefined) => void
  onWidth?: (w: LineWidth | undefined) => void
}) {
  return (
    <>
      <div className="flex items-center gap-1">
        <span className="text-(--color-ink-muted)">color</span>
        <button
          type="button"
          onClick={() => onColor(undefined)}
          title="Automático (por índice)"
          className={['rounded border px-1 text-[10px]', !color ? 'border-(--color-primary) text-(--color-primary)' : 'border-(--color-border) text-(--color-ink-muted)'].join(' ')}
        >
          auto
        </button>
        {PLOT_COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => onColor(c.name)}
            title={c.name}
            aria-label={`Color ${c.name}`}
            className={['h-4 w-4 rounded-full border', color === c.name ? 'border-(--color-ink) ring-1 ring-(--color-ink)' : 'border-transparent'].join(' ')}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-(--color-ink-muted)">trazo</span>
        {(['solid', 'dashed', 'dotted'] as const).map((s) => {
          const active = (style ?? 'solid') === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => onStyle(s === 'solid' ? undefined : s)}
              className={['rounded border px-1.5 py-0.5', active ? 'border-(--color-primary) text-(--color-primary)' : 'border-(--color-border) text-(--color-ink-muted)'].join(' ')}
            >
              {s === 'solid' ? '──' : s === 'dashed' ? '– –' : '···'}
            </button>
          )
        })}
      </div>
      {onWidth && (
        <div className="flex items-center gap-1">
          <span className="text-(--color-ink-muted)">grosor</span>
          {(['xthin', 'thin', 'normal', 'thick', 'xthick'] as const).map((wv) => {
            const active = (width ?? 'normal') === wv
            const label = wv === 'xthin' ? 'muy fino' : wv === 'thin' ? 'fino' : wv === 'normal' ? 'normal' : wv === 'thick' ? 'grueso' : 'extra'
            return (
              <button
                key={wv}
                type="button"
                onClick={() => onWidth(wv === 'normal' ? undefined : wv)}
                title={`Grosor ${label}`}
                className={['rounded border px-1.5 py-0.5', active ? 'border-(--color-primary) text-(--color-primary)' : 'border-(--color-border) text-(--color-ink-muted)'].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * Input numérico chico con **texto local** (permite estados intermedios como `-`, `1.`) que
 * confirma `onNum` solo cuando el valor es finito. Acepta **expresiones constantes** (`2*pi`,
 * `pi/2`, `sqrt(2)`) evaluadas por el motor. Se resincroniza si el valor externo cambia por
 * otra vía (comparando por el valor evaluado, para no pisar `2*pi` mientras se escribe).
 */
export function NumInput({ value, onNum, label }: { value: number; onNum: (v: number) => void; label: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (evalConst(text) !== value) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const v = evalConst(e.target.value)
        if (v != null) onNum(v)
      }}
      aria-label={label}
      title="Número o expresión constante (p. ej. 2*pi, pi/2, sqrt(2))"
      className="w-14 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
    />
  )
}

/**
 * Input **unificado de posición** para anotaciones (x₀ de tangente, x/y de punto, límites de área,
 * x/y de líneas): acepta un **número**, una **expresión constante** (`2*pi`, `pi/2`) **o un parámetro**
 * (`a`, `a+1`) — el mismo input, sin campos extra. Si el texto referencia un parámetro definido guarda
 * la **expresión** (dinámica: sigue al slider); si es una constante la evalúa y guarda el **número**.
 * `onChange(num, expr)`: exactamente uno queda definido (el otro `undefined`, limpiando el anterior).
 */
export function ExprPosInput({
  num,
  expr,
  params,
  onChange,
  label,
}: {
  num: number
  expr: string | undefined
  params: readonly PlotParameter[] | undefined
  onChange: (num: number | undefined, expr: string | undefined) => void
  label: string
}) {
  const [text, setText] = useState(expr ?? String(num))
  useEffect(() => {
    setText(expr ?? String(num))
  }, [expr, num])
  const hasParams = (params?.length ?? 0) > 0
  const commit = (raw: string): void => {
    const t = raw.trim()
    if (t === '') return // vacío: no confirmar, se conserva el valor previo
    // ¿referencia un parámetro definido? → guardar como expresión dinámica (sigue al slider).
    if (hasParams && substituteParamsInExpr(t, params) !== t) {
      onChange(undefined, t)
      return
    }
    // constante (número o `2*pi`, `sqrt(2)`…) → evaluar y guardar el número, limpiando la expresión.
    const v = evalConst(t)
    if (v != null) onChange(v, undefined)
  }
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        commit(e.target.value)
      }}
      aria-label={label}
      title={hasParams ? 'Número, expresión (2*pi) o parámetro (a, a+1)' : 'Número o expresión constante (2*pi, pi/2, sqrt(2))'}
      className="w-14 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
    />
  )
}

/**
 * Campo numérico con **estado de texto local** (ME-36): permite tipear estados intermedios (`-`,
 * `1.`) y **se sincroniza** cuando el valor cambia por afuera (al mover el slider). Sin esto, un
 * input controlado revierte lo que tipeás y no deja escribir negativos.
 */
export function ParamNumberField({ value, onChange, className, ariaLabel }: { value: number; onChange: (v: number) => void; className: string; ariaLabel: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const v = Number(e.target.value)
        if (Number.isFinite(v)) onChange(v)
      }}
      inputMode="decimal"
      aria-label={ariaLabel}
      className={className}
    />
  )
}

/** Selector de dónde ubicar el rótulo de un valor calculado (∫/f′): auto · arriba · abajo (ME-34). */
export function LabelPosSelect({ value, onChange }: { value: 'auto' | 'above' | 'below' | undefined; onChange: (v: 'above' | 'below' | undefined) => void }) {
  return (
    <label className="inline-flex items-center gap-0.5" title="Dónde ubicar el rótulo del valor: automático, arriba o abajo (para que no tape la curva).">
      rótulo
      <select
        value={value ?? 'auto'}
        onChange={(e) => onChange(e.target.value === 'above' ? 'above' : e.target.value === 'below' ? 'below' : undefined)}
        aria-label="ubicación del rótulo del valor"
        className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
      >
        <option value="auto">auto</option>
        <option value="above">↑ arriba</option>
        <option value="below">↓ abajo</option>
      </select>
    </label>
  )
}
