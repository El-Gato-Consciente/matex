import { type ReactNode } from 'react'
import {
  compileExprToLatex, INTERP_GROUP_LABEL, INTERP_METHODS, interpolateSeries, parseExpr, parseImplicit,
  PLOT_ROLE_LABEL, PLOT_ROLES, resolvePlotColor, resolvePlotStyle, substituteParamsInExpr, type PlotRole, type PlotSpec,
} from '../core'
import { ColorStyleControls, KatexInline, NumInput, ParamNumberField, PointsInput } from './plotEditorParts'
import { subDigits } from './plotCurves'

/**
 * **Filas de curva** del editor de gráficos (QA-09, slice 4). Cada tipo (explícita, datos,
 * paramétrica, polar, implícita, cónica) es un componente que renderiza su fila en la lista
 * unificada de `CurvesTab`. Se movieron acá desde `PlotEditor.tsx` para que ese archivo quede
 * en orquestación + tabs. Son **UI pura**: reciben el ítem y un `patch` que mezcla en él; la
 * lógica de parche vive en `plotPatch.ts` y la de evaluación en `plotEditorUtils.ts`.
 */

/** Campo de leyenda (vive en el panel ⋯ de cada fila para no ensanchar la fila principal). */
function LegendField({ value, onChange, auto }: { value: string | undefined; onChange: (v: string | undefined) => void; auto?: boolean }) {
  return (
    <label className="flex items-center gap-1 text-(--color-ink-muted)" title="Vacío = leyenda automática. Escribí para reemplazar el texto.">
      leyenda
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={auto ? 'auto (usa la fórmula)' : 'texto'}
        aria-label="Leyenda de la curva"
        className="w-44 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none"
      />
    </label>
  )
}

/** Props comunes a todas las filas de curva. */
export interface RowProps {
  leading: ReactNode
  colorIndex: number
  plotSyntax: 'ascii' | 'latex'
  open: boolean
  onToggle: () => void
  onRemove: () => void
  registerFocus: (el: HTMLInputElement, set: (v: string) => void) => void
  patch: (patch: Record<string, unknown>) => void
  /** Parámetros del gráfico (para validar/previsualizar exprs que los usan sin marcarlas inválidas). */
  parameters?: PlotSpec['parameters']
}

export function FunctionRow({
  leading, colorIndex, plotSyntax, open, onToggle, onRemove, registerFocus, patch: patchFn, spec, i, fn, resolvedExpr,
}: RowProps & { spec: PlotSpec; i: number; fn: NonNullable<PlotSpec['functions']>[number]; resolvedExpr: string }) {
  const off = fn.disabled === true
  const pieces = fn.pieces && fn.pieces.length > 0 ? fn.pieces : null
  const parsed = parseExpr(resolvedExpr, plotSyntax)
  const invalid = !pieces && fn.expr.trim() !== '' && !parsed.ok
  const tex = pieces || fn.expr.trim() === '' ? null : compileExprToLatex(resolvedExpr, plotSyntax)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {leading}
        <button
          type="button"
          onClick={() => patchFn({ disabled: off ? undefined : true })}
          title={off ? 'Función oculta — mostrar' : 'Ocultar función (sin borrarla)'}
          aria-label={off ? 'Mostrar función' : 'Ocultar función'}
          className="text-sm leading-none"
          style={{ color: resolvePlotStyle({ color: fn.color, role: fn.role, index: colorIndex }).color.hex }}
        >
          {off ? '○' : '●'}
        </button>
        <span className={off ? 'text-(--color-ink-muted) opacity-50' : 'text-(--color-ink-muted)'} title={`Referenciable como f${i + 1} en otra fórmula`}>f{subDigits(i + 1)}(x)=</span>
        {pieces ? (
          <button
            type="button"
            onClick={onToggle}
            className={['rounded border border-dashed border-(--color-border) px-2 py-0.5 text-(--color-ink-muted) hover:border-(--color-primary)', off ? 'opacity-50' : ''].join(' ')}
            title="Función partida — editá las ramas en ⋯"
          >
            partida · {pieces.length} {pieces.length === 1 ? 'rama' : 'ramas'}
          </button>
        ) : fn.fromData ? (
          <span className="flex items-center gap-1.5 text-(--color-ink-muted)" title="Función = interpolación de una serie de datos (se crea/edita desde la serie de datos). Acepta tangente/área/raíces.">
            <span className="italic">interpolación de «{spec.data?.[fn.fromData.series]?.legend?.trim() || `datos ${fn.fromData.series + 1}`}»</span>
            <select
              value={fn.fromData.method}
              onChange={(e) => patchFn({ fromData: { ...fn.fromData!, method: e.target.value as NonNullable<PlotSpec['functions'][number]['fromData']>['method'] } })}
              aria-label="método de interpolación"
              title="Método con que la serie se vuelve función (spline, monótona, regresión…)."
              className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
            >
              {INTERP_METHODS.filter((m) => m.group !== 'path').map((m) => (
                <option key={m.method} value={m.method}>
                  {m.label}
                  {m.group === 'fit' ? ' (ajuste)' : ''}
                </option>
              ))}
            </select>
            {fn.fromData.method === 'regression' && (
              <input
                type="number"
                min={1}
                max={6}
                value={fn.fromData.degree ?? 1}
                onChange={(e) => patchFn({ fromData: { ...fn.fromData!, degree: Math.max(1, Math.min(6, Math.round(Number(e.target.value) || 1))) } })}
                aria-label="grado"
                className="w-12 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
              />
            )}
          </span>
        ) : (
          <>
            <input
              value={fn.expr}
              onFocus={(e) => registerFocus(e.currentTarget, (v) => patchFn({ expr: v }))}
              onChange={(e) => patchFn({ expr: e.target.value })}
              placeholder={plotSyntax === 'latex' ? 'x^{2}' : 'x^2'}
              aria-label={`Función ${i + 1}`}
              className={[
                'w-48 rounded border bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)',
                invalid ? 'border-red-500' : 'border-(--color-border)',
                off ? 'opacity-50' : '',
              ].join(' ')}
            />
            <span className={['w-40 shrink-0 overflow-x-auto whitespace-nowrap text-(--color-ink-muted)', off ? 'opacity-50' : ''].join(' ')} aria-hidden>
              {invalid ? <span className="text-red-500">expresión inválida</span> : tex ? <KatexInline tex={`y = ${tex}`} /> : null}
            </span>
          </>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={open} title="Leyenda, color, trazo y dominio" className={['rounded px-1 hover:bg-(--color-surface)', open ? 'text-(--color-primary)' : 'text-(--color-ink-muted)'].join(' ')}>
            ⋯
          </button>
          <button type="button" onClick={onRemove} title="Quitar curva" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
        </span>
      </div>

      {open && (
        <div className="ml-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5">
          <LegendField value={fn.legend} onChange={(v) => patchFn({ legend: v })} auto />
          {fn.fromData && <span className="text-[11px] text-(--color-ink-muted)">Se crea/quita desde la serie de datos («usar como función»). Podés ponerle tangente/área o marcar raíces/extremos como a cualquier función.</span>}
          {!pieces && !fn.fromData && (
            <span className="flex items-center gap-2 text-(--color-ink-muted)">
              <label className="flex items-center gap-1" title="Dibujar también la función inversa (reflejo sobre y = x).">
                <input type="checkbox" checked={fn.inverse === true} onChange={(e) => patchFn({ inverse: e.target.checked ? true : undefined })} />
                inversa
              </label>
              <label className="flex items-center gap-1" title="Etiqueta flotante con la fórmula al final del trazo (estilo Desmos).">
                <input type="checkbox" checked={fn.endLabel === true} onChange={(e) => patchFn({ endLabel: e.target.checked ? true : undefined })} />
                etiqueta al final
              </label>
              <label className="flex items-center gap-1" title="Sombrear la región de la inecuación respecto de la curva.">
                sombrear
                <select
                  value={fn.shade ?? ''}
                  onChange={(e) => patchFn({ shade: e.target.value ? (e.target.value as 'above' | 'below') : undefined })}
                  aria-label="sombrear región"
                  className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
                >
                  <option value="">no</option>
                  <option value="above">y &gt; f(x)</option>
                  <option value="below">y &lt; f(x)</option>
                </select>
              </label>
            </span>
          )}
          <label className="flex items-center gap-1 text-(--color-ink-muted)" title="Rol semántico: el tema resuelve color/grosor/guion según qué representa la curva. El color/estilo de al lado lo pisa.">
            rol
            <select
              value={fn.role ?? ''}
              onChange={(e) => patchFn({ role: e.target.value ? (e.target.value as PlotRole) : undefined })}
              aria-label="rol semántico de la función"
              className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
            >
              <option value="">— (sin rol)</option>
              {PLOT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {PLOT_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <ColorStyleControls color={fn.color} style={fn.style} width={fn.width} onColor={(c) => patchFn({ color: c })} onStyle={(s) => patchFn({ style: s })} onWidth={(w) => patchFn({ width: w })} />
          {!pieces && (
            <span className="flex items-center gap-2 text-(--color-ink-muted)" title="Marcar automáticamente rasgos notables (calculados numéricamente).">
              marcar:
              <label className="flex items-center gap-1" title="Raíces / ceros (cruces con el eje x).">
                <input type="checkbox" checked={fn.markRoots === true} onChange={(e) => patchFn({ markRoots: e.target.checked ? true : undefined })} />
                raíces
              </label>
              <label className="flex items-center gap-1" title="Extremos locales (máximos y mínimos, por f′=0).">
                <input type="checkbox" checked={fn.markExtrema === true} onChange={(e) => patchFn({ markExtrema: e.target.checked ? true : undefined })} />
                extremos
              </label>
              <label className="flex items-center gap-1" title="Puntos de inflexión (f″=0).">
                <input type="checkbox" checked={fn.markInflections === true} onChange={(e) => patchFn({ markInflections: e.target.checked ? true : undefined })} />
                inflexiones
              </label>
              <label className="flex items-center gap-1" title="Asíntotas: verticales (polos), horizontales y oblicuas (límites en ±∞).">
                <input type="checkbox" checked={fn.markAsymptotes === true} onChange={(e) => patchFn({ markAsymptotes: e.target.checked ? true : undefined })} />
                asíntotas
              </label>
              <label className="flex items-center gap-1" title="Ordenada al origen: el punto (0, f(0)) donde la curva corta el eje y.">
                <input type="checkbox" checked={fn.markYIntercept === true} onChange={(e) => patchFn({ markYIntercept: e.target.checked ? true : undefined })} />
                ord. origen
              </label>
              <label className="flex items-center gap-1" title="Mostrar las coordenadas / ecuación de cada rasgo marcado.">
                <input type="checkbox" checked={fn.featureCoords === true} onChange={(e) => patchFn({ featureCoords: e.target.checked ? true : undefined })} />
                coordenadas
              </label>
            </span>
          )}
          {!pieces && (
            <label className="flex items-center gap-1 text-(--color-ink-muted)" title="Dibujar esta curva solo en [a, b] (funciones a trozos).">
              <input type="checkbox" checked={!!fn.domain} onChange={(e) => patchFn({ domain: e.target.checked ? [spec.domain[0], spec.domain[1]] : undefined })} />
              dominio propio
              {fn.domain && (
                <>
                  <NumInput value={fn.domain[0]} onNum={(v) => fn.domain && patchFn({ domain: [v, fn.domain[1]] })} label="desde" />
                  a
                  <NumInput value={fn.domain[1]} onNum={(v) => fn.domain && patchFn({ domain: [fn.domain[0], v] })} label="hasta" />
                </>
              )}
            </label>
          )}
          <label className="flex items-center gap-1 text-(--color-ink-muted)" title="Definir la función por ramas; la leyenda es un \begin{cases}.">
            <input
              type="checkbox"
              checked={!!pieces}
              onChange={(e) => {
                if (e.target.checked) {
                  const [d0, d1] = spec.domain
                  const mid = Number(((d0 + d1) / 2).toFixed(2))
                  patchFn({ pieces: [{ expr: fn.expr.trim() || 'x', from: d0, to: mid }, { expr: 'x', from: mid, to: d1 }], markJumps: true })
                } else {
                  patchFn({ pieces: undefined, markJumps: undefined })
                }
              }}
            />
            función partida
          </label>

          {pieces && (
            <div className="flex w-full flex-col gap-1.5 border-t border-(--color-border) pt-1.5">
              <label className="flex items-center gap-1.5 text-(--color-ink-muted)" title="Marcar ● (incluido) y ○ (excluido) donde hay salto entre ramas (convención [a, b)).">
                <input type="checkbox" checked={fn.markJumps === true} onChange={(e) => patchFn({ markJumps: e.target.checked ? true : undefined })} />
                marcar saltos ●/○
              </label>
              {pieces.map((pc, b) => {
                const pcResolved = substituteParamsInExpr(pc.expr, spec.parameters)
                const pinv = pc.expr.trim() !== '' && !parseExpr(pcResolved, plotSyntax).ok
                const ptex = pc.expr.trim() === '' ? null : compileExprToLatex(pcResolved, plotSyntax)
                const patchPiece = (p: Record<string, unknown>) => patchFn({ pieces: pieces.map((q, k) => (k === b ? { ...q, ...p } : q)) })
                return (
                  <div key={b} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-(--color-ink-muted)">rama {b + 1}:</span>
                    <input
                      value={pc.expr}
                      onFocus={(e) => registerFocus(e.currentTarget, (v) => patchPiece({ expr: v }))}
                      onChange={(e) => patchPiece({ expr: e.target.value })}
                      placeholder={plotSyntax === 'latex' ? 'x^{2}' : 'x^2'}
                      aria-label={`Rama ${b + 1} de la función ${i + 1}`}
                      className={['w-40 rounded border bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)', pinv ? 'border-red-500' : 'border-(--color-border)'].join(' ')}
                    />
                    <span className="text-(--color-ink-muted)">en</span>
                    <NumInput value={pc.from} onNum={(v) => patchPiece({ from: v })} label="desde" />
                    a
                    <NumInput value={pc.to} onNum={(v) => patchPiece({ to: v })} label="hasta" />
                    <span className="w-28 shrink-0 overflow-x-auto whitespace-nowrap text-(--color-ink-muted)" aria-hidden>
                      {pinv ? <span className="text-red-500">inválida</span> : ptex ? <KatexInline tex={ptex} /> : null}
                    </span>
                    {pieces.length > 1 && (
                      <button type="button" onClick={() => patchFn({ pieces: pieces.filter((_, k) => k !== b) })} title="Quitar rama" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
                    )}
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  const last = pieces[pieces.length - 1]!
                  patchFn({ pieces: [...pieces, { expr: 'x', from: last.to, to: spec.domain[1] }] })
                }}
                className="self-start rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)"
              >
                + rama
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DataRow({ leading, colorIndex, open, onToggle, onRemove, patch: patchSeries, s, dataFuncs, canAdd, onAddFunction }: RowProps & { s: NonNullable<PlotSpec['data']>[number]; dataFuncs: { index: number; method: string }[]; canAdd: boolean; onAddFunction: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-1">{leading}</span>
        <button
          type="button"
          onClick={() => patchSeries({ disabled: s.disabled ? undefined : true })}
          title={s.disabled ? 'Serie oculta — mostrar' : 'Ocultar serie (sin borrarla)'}
          aria-label={s.disabled ? 'Mostrar serie' : 'Ocultar serie'}
          className="mt-1 text-sm leading-none"
          style={{ color: resolvePlotColor(s.color, colorIndex).hex }}
        >
          {s.disabled ? '○' : '●'}
        </button>
        <span className={s.disabled ? 'opacity-50' : ''}>
          <PointsInput points={s.points} onPoints={(p) => patchSeries({ points: p })} />
        </span>
        <span className="mt-1 ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={open} title="Leyenda, color, trazo y marcas" className={['rounded px-1 hover:bg-(--color-surface)', open ? 'text-(--color-primary)' : 'text-(--color-ink-muted)'].join(' ')}>⋯</button>
          <button type="button" onClick={onRemove} title="Quitar curva" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
        </span>
      </div>
      {open && (
        <div className="ml-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5">
          <LegendField value={s.legend} onChange={(v) => patchSeries({ legend: v })} />
          <ColorStyleControls color={s.color} style={s.style} width={s.width} onColor={(c) => patchSeries({ color: c })} onStyle={(st) => patchSeries({ style: st })} onWidth={(w) => patchSeries({ width: w })} />
          <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Trazar una curva que una, ajuste o recorra los puntos.">
            trazar
            <select
              value={s.interpolate ?? (s.line ? 'linear' : '')}
              onChange={(e) => patchSeries({ interpolate: (e.target.value || undefined) as NonNullable<PlotSpec['data']>[number]['interpolate'], line: undefined })}
              aria-label="método de interpolación / ajuste / trazado"
              className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
            >
              <option value="">— (solo puntos)</option>
              {(['function', 'fit', 'path'] as const).map((g) => (
                <optgroup key={g} label={INTERP_GROUP_LABEL[g]}>
                  {INTERP_METHODS.filter((m) => m.group === g).map((m) => (
                    <option key={m.method} value={m.method}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {s.interpolate === 'regression' && (
            <label className="inline-flex items-center gap-1 text-(--color-ink-muted)" title="Grado del polinomio de regresión (1 = recta).">
              grado
              <input
                type="number"
                min={1}
                max={6}
                value={s.interpDegree ?? 1}
                onChange={(e) => patchSeries({ interpDegree: Math.max(1, Math.min(6, Math.round(Number(e.target.value) || 1))) })}
                aria-label="grado de la regresión"
                className="w-12 rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
              />
            </label>
          )}
          {(s.interpolate === 'polyline' || s.interpolate === 'smooth') && (
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Unir el último punto con el primero (curva cerrada).">
              <input type="checkbox" checked={s.closed === true} onChange={(e) => patchSeries({ closed: e.target.checked ? true : undefined })} />
              cerrada
            </label>
          )}
          <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
            <input type="checkbox" checked={s.open === true} onChange={(e) => patchSeries({ open: e.target.checked ? true : undefined })} />
            marca hueca
          </label>
          {(() => {
            if (!s.interpolate) return null
            const meta = INTERP_METHODS.find((m) => m.method === s.interpolate)
            const isFunction = meta?.group !== 'path'
            const r = interpolateSeries(s.points, s.interpolate, { degree: s.interpDegree, closed: s.closed })
            return (
              <div className="flex w-full flex-col gap-0.5">
                {meta && <span className="text-[11px] text-(--color-ink-muted)">{meta.desc}</span>}
                <span className="flex flex-wrap items-center gap-x-3">
                  {r.equation && <span className="font-mono text-(--color-ink)">{r.equation}</span>}
                  {r.warning && <span className="text-amber-600" title={r.warning}>⚠ {r.warning}</span>}
                  {isFunction && (
                    <span className="inline-flex flex-wrap items-center gap-1.5 text-(--color-ink-muted)">
                      {dataFuncs.length > 0 && (
                        <span className="font-mono text-(--color-primary)">
                          → {dataFuncs.map((d) => `f${d.index + 1} (${INTERP_METHODS.find((m) => m.method === d.method)?.label ?? d.method})`).join(', ')}
                        </span>
                      )}
                      {canAdd && (
                        <button
                          type="button"
                          onClick={onAddFunction}
                          title="Crear una función f(x) con esta interpolación. Podés agregar varias con distinto método (spline, monótona, regresión…) para comparar. Después les ponés tangente/área o les marcás raíces desde Anotaciones."
                          className="rounded border border-(--color-primary) px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface)"
                        >
                          + usar como función
                        </button>
                      )}
                    </span>
                  )}
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export function ParametricRow({ leading, colorIndex, plotSyntax, open, onToggle, onRemove, registerFocus, patch: patchP, parameters, p, index }: RowProps & { p: NonNullable<PlotSpec['parametrics']>[number]; index: number }) {
  const xInvalid = p.x.trim() !== '' && !parseExpr(substituteParamsInExpr(p.x, parameters), plotSyntax, 't').ok
  const yInvalid = p.y.trim() !== '' && !parseExpr(substituteParamsInExpr(p.y, parameters), plotSyntax, 't').ok
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {leading}
        <button
          type="button"
          onClick={() => patchP({ disabled: p.disabled ? undefined : true })}
          title={p.disabled ? 'Paramétrica oculta — mostrar' : 'Ocultar paramétrica'}
          aria-label={p.disabled ? 'Mostrar paramétrica' : 'Ocultar paramétrica'}
          className="text-sm leading-none"
          style={{ color: resolvePlotColor(p.color, colorIndex).hex }}
        >
          {p.disabled ? '○' : '●'}
        </button>
        <span className="text-(--color-ink-muted)">x(t)=</span>
        <input
          value={p.x}
          onFocus={(e) => registerFocus(e.currentTarget, (v) => patchP({ x: v }))}
          onChange={(e) => patchP({ x: e.target.value })}
          placeholder="cos(t)"
          aria-label={`x(t) de la paramétrica ${index + 1}`}
          className={['w-28 rounded border bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)', xInvalid ? 'border-red-500' : 'border-(--color-border)'].join(' ')}
        />
        <span className="text-(--color-ink-muted)">y(t)=</span>
        <input
          value={p.y}
          onFocus={(e) => registerFocus(e.currentTarget, (v) => patchP({ y: v }))}
          onChange={(e) => patchP({ y: e.target.value })}
          placeholder="sin(t)"
          aria-label={`y(t) de la paramétrica ${index + 1}`}
          className={['w-28 rounded border bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)', yInvalid ? 'border-red-500' : 'border-(--color-border)'].join(' ')}
        />
        {(() => {
          const lx = compileExprToLatex(p.x, plotSyntax, 't')
          const ly = compileExprToLatex(p.y, plotSyntax, 't')
          return lx && ly ? (
            <span className="w-28 shrink-0 overflow-x-auto whitespace-nowrap text-(--color-ink-muted)" aria-hidden>
              <KatexInline tex={`\\left(${lx},\\, ${ly}\\right)`} />
            </span>
          ) : null
        })()}
        <span className="text-(--color-ink-muted)">t:</span>
        <NumInput value={p.tmin} onNum={(v) => patchP({ tmin: v })} label="t mínimo" />
        a
        <NumInput value={p.tmax} onNum={(v) => patchP({ tmax: v })} label="t máximo" />
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={open} title="Leyenda, color y trazo" className={['rounded px-1 hover:bg-(--color-surface)', open ? 'text-(--color-primary)' : 'text-(--color-ink-muted)'].join(' ')}>⋯</button>
          <button type="button" onClick={onRemove} title="Quitar curva" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
        </span>
      </div>
      {open && (
        <div className="ml-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5">
          <LegendField value={p.legend} onChange={(v) => patchP({ legend: v })} />
          <ColorStyleControls color={p.color} style={p.style} width={p.width} onColor={(c) => patchP({ color: c })} onStyle={(s) => patchP({ style: s })} onWidth={(w) => patchP({ width: w })} />
        </div>
      )}
    </div>
  )
}

export function PolarRow({ leading, colorIndex, plotSyntax, open, onToggle, onRemove, registerFocus, patch: patchPo, parameters, p, index }: RowProps & { p: NonNullable<PlotSpec['polars']>[number]; index: number }) {
  const rInvalid = p.r.trim() !== '' && !parseExpr(substituteParamsInExpr(p.r, parameters), plotSyntax, 't').ok
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {leading}
        <button
          type="button"
          onClick={() => patchPo({ disabled: p.disabled ? undefined : true })}
          title={p.disabled ? 'Polar oculta — mostrar' : 'Ocultar polar'}
          aria-label={p.disabled ? 'Mostrar polar' : 'Ocultar polar'}
          className="text-sm leading-none"
          style={{ color: resolvePlotColor(p.color, colorIndex).hex }}
        >
          {p.disabled ? '○' : '●'}
        </button>
        <span className="text-(--color-ink-muted)">r(θ)=</span>
        <input
          value={p.r}
          onFocus={(e) => registerFocus(e.currentTarget, (v) => patchPo({ r: v }))}
          onChange={(e) => patchPo({ r: e.target.value })}
          placeholder="1 + cos(t)"
          aria-label={`r(θ) de la polar ${index + 1}`}
          className={['w-40 rounded border bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)', rInvalid ? 'border-red-500' : 'border-(--color-border)'].join(' ')}
        />
        {(() => {
          const lr = p.r.trim() === '' ? null : compileExprToLatex(p.r, plotSyntax, 't')
          return lr ? (
            <span className="w-24 shrink-0 overflow-x-auto whitespace-nowrap text-(--color-ink-muted)" aria-hidden>
              <KatexInline tex={`r = ${lr}`} />
            </span>
          ) : null
        })()}
        <span className="text-(--color-ink-muted)">θ:</span>
        <NumInput value={p.tmin} onNum={(v) => patchPo({ tmin: v })} label="θ mínimo" />
        a
        <NumInput value={p.tmax} onNum={(v) => patchPo({ tmax: v })} label="θ máximo" />
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={open} title="Leyenda, color y trazo" className={['rounded px-1 hover:bg-(--color-surface)', open ? 'text-(--color-primary)' : 'text-(--color-ink-muted)'].join(' ')}>⋯</button>
          <button type="button" onClick={onRemove} title="Quitar curva" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
        </span>
      </div>
      {open && (
        <div className="ml-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5">
          <LegendField value={p.legend} onChange={(v) => patchPo({ legend: v })} />
          <ColorStyleControls color={p.color} style={p.style} width={p.width} onColor={(c) => patchPo({ color: c })} onStyle={(s) => patchPo({ style: s })} onWidth={(w) => patchPo({ width: w })} />
        </div>
      )}
    </div>
  )
}

export function ImplicitRow({ leading, colorIndex, open, onToggle, onRemove, registerFocus, patch: patchIm, parameters, im, index, equalAxes, onEqualAxes }: RowProps & { im: NonNullable<PlotSpec['implicits']>[number]; index: number; equalAxes: boolean; onEqualAxes: () => void }) {
  const invalid = im.equation.trim() !== '' && parseImplicit(substituteParamsInExpr(im.equation, parameters)) == null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {leading}
        <button
          type="button"
          onClick={() => patchIm({ disabled: im.disabled ? undefined : true })}
          title={im.disabled ? 'Implícita oculta — mostrar' : 'Ocultar implícita'}
          aria-label={im.disabled ? 'Mostrar implícita' : 'Ocultar implícita'}
          className="text-sm leading-none"
          style={{ color: resolvePlotColor(im.color, colorIndex).hex }}
        >
          {im.disabled ? '○' : '●'}
        </button>
        <input
          value={im.equation}
          onFocus={(e) => registerFocus(e.currentTarget, (v) => patchIm({ equation: v }))}
          onChange={(e) => patchIm({ equation: e.target.value })}
          placeholder="x^2 + y^2 = 4"
          aria-label={`Ecuación de la implícita ${index + 1}`}
          className={['w-52 rounded border bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)', invalid ? 'border-red-500' : 'border-(--color-border)'].join(' ')}
        />
        <span className="w-6 shrink-0 text-center text-(--color-ink-muted)" aria-hidden>
          {invalid ? <span className="text-red-500">✕</span> : im.equation.trim() !== '' ? '✓' : null}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={open} title="Leyenda, color y trazo" className={['rounded px-1 hover:bg-(--color-surface)', open ? 'text-(--color-primary)' : 'text-(--color-ink-muted)'].join(' ')}>⋯</button>
          <button type="button" onClick={onRemove} title="Quitar curva" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
        </span>
      </div>
      {open && (
        <div className="ml-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5">
          <LegendField value={im.legend} onChange={(v) => patchIm({ legend: v })} />
          <ColorStyleControls color={im.color} style={im.style} width={im.width} onColor={(c) => patchIm({ color: c })} onStyle={(s) => patchIm({ style: s })} onWidth={(w) => patchIm({ width: w })} />
          {!equalAxes && (
            <button type="button" onClick={onEqualAxes} className="rounded px-1.5 py-0.5 text-(--color-ink-muted) underline hover:text-(--color-ink)">
              activar ejes iguales (recomendado)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const CONIC_KIND_LABEL: Record<NonNullable<PlotSpec['conics']>[number]['kind'], string> = {
  circle: 'círculo',
  ellipse: 'elipse',
  parabola: 'parábola',
  hyperbola: 'hipérbola',
}
const CONIC_OPENS_LABEL: Record<'up' | 'down' | 'left' | 'right', string> = { up: '↑ arriba', down: '↓ abajo', left: '← izq.', right: '→ der.' }

/**
 * Fila de **cónica** (círculo/elipse/parábola/hipérbola): primitiva geométrica por parámetros
 * (centro/vértice + semiejes/radio/foco + apertura + rotación), no una expresión. Cada `kind`
 * muestra sólo sus campos; el render (SVG/PDF) reconstruye la curva desde estos parámetros.
 */
export function ConicRow({ leading, colorIndex, open, onToggle, onRemove, patch: patchC, c, index, equalAxes, onEqualAxes }: RowProps & { c: NonNullable<PlotSpec['conics']>[number]; index: number; equalAxes: boolean; onEqualAxes: () => void }) {
  const num = (value: number, onChange: (v: number) => void, label: string): ReactNode => (
    <ParamNumberField value={value} onChange={onChange} ariaLabel={label} className="w-14 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-center text-(--color-ink) outline-none focus:border-(--color-primary)" />
  )
  const lbl = (t: string): ReactNode => <span className="text-[11px] text-(--color-ink-muted)">{t}</span>
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {leading}
        <button
          type="button"
          onClick={() => patchC({ disabled: c.disabled ? undefined : true })}
          title={c.disabled ? 'Cónica oculta — mostrar' : 'Ocultar cónica'}
          aria-label={c.disabled ? 'Mostrar cónica' : 'Ocultar cónica'}
          className="text-sm leading-none"
          style={{ color: resolvePlotColor(c.color, colorIndex).hex }}
        >
          {c.disabled ? '○' : '●'}
        </button>
        <select
          value={c.kind}
          onChange={(e) => patchC({ kind: e.target.value })}
          aria-label={`Tipo de cónica ${index + 1}`}
          className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none"
        >
          {(Object.keys(CONIC_KIND_LABEL) as (keyof typeof CONIC_KIND_LABEL)[]).map((k) => (
            <option key={k} value={k}>{CONIC_KIND_LABEL[k]}</option>
          ))}
        </select>
        {lbl(c.kind === 'parabola' ? 'vértice' : 'centro')}
        {num(c.cx, (v) => patchC({ cx: v }), 'x del centro/vértice')}
        {num(c.cy, (v) => patchC({ cy: v }), 'y del centro/vértice')}
        {c.kind === 'circle' && (<>{lbl('r')}{num(c.r ?? 1, (v) => patchC({ r: v }), 'radio')}</>)}
        {(c.kind === 'ellipse' || c.kind === 'hyperbola') && (<>{lbl('a')}{num(c.a ?? 1, (v) => patchC({ a: v }), 'semieje a')}{lbl('b')}{num(c.b ?? 1, (v) => patchC({ b: v }), 'semieje b')}</>)}
        {c.kind === 'parabola' && (
          <>
            {lbl('p')}{num(c.p ?? 1, (v) => patchC({ p: v }), 'distancia focal')}
            <select value={c.opens ?? 'up'} onChange={(e) => patchC({ opens: e.target.value })} aria-label="apertura de la parábola" className="rounded border border-(--color-border) bg-(--color-surface) px-1 py-0.5 text-(--color-ink) outline-none">
              {(Object.keys(CONIC_OPENS_LABEL) as (keyof typeof CONIC_OPENS_LABEL)[]).map((o) => (
                <option key={o} value={o}>{CONIC_OPENS_LABEL[o]}</option>
              ))}
            </select>
          </>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={open} title="Leyenda, color, trazo y rotación" className={['rounded px-1 hover:bg-(--color-surface)', open ? 'text-(--color-primary)' : 'text-(--color-ink-muted)'].join(' ')}>⋯</button>
          <button type="button" onClick={onRemove} title="Quitar curva" className="rounded px-1 text-(--color-ink-muted) hover:text-red-600">✕</button>
        </span>
      </div>
      {open && (
        <div className="ml-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5">
          <LegendField value={c.legend} onChange={(v) => patchC({ legend: v })} />
          <ColorStyleControls color={c.color} style={c.style} width={c.width} onColor={(col) => patchC({ color: col })} onStyle={(s) => patchC({ style: s })} onWidth={(w) => patchC({ width: w })} />
          {c.kind !== 'circle' && (
            <label className="inline-flex items-center gap-1 text-(--color-ink-muted)" title="Rotación en grados alrededor del centro.">
              rotación
              {num(c.angle ?? 0, (v) => patchC({ angle: v }), 'rotación en grados')}
              °
            </label>
          )}
          {!equalAxes && (
            <button type="button" onClick={onEqualAxes} className="rounded px-1.5 py-0.5 text-(--color-ink-muted) underline hover:text-(--color-ink)">
              activar ejes iguales (recomendado)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
