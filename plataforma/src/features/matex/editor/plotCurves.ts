import type { CurveRef, PlotSpec } from '../core'

/**
 * **Dominio de las referencias de curva** del editor de gráficos (QA-09, slice 1). Lógica
 * **pura** extraída de `PlotEditor.tsx`: los cinco tipos de curva que conviven sobre el eje
 * cartesiano, el mapeo tipo↔array del `PlotSpec`, y la (de)serialización de una `CurveRef` a
 * clave de `<select>`. Antes vivía enredada en el JSX; acá es testeable sin jsdom y la
 * consumen tanto `PlotEditor` como sus filas.
 */

/** Los cinco tipos de curva que conviven sobre el eje cartesiano (familia A4). */
export type CurveType = 'function' | 'data' | 'parametric' | 'polar' | 'implicit' | 'conic'

/** Etiqueta legible de cada tipo (para el selector de tipo por fila). */
export const CURVE_LABEL: Record<CurveType, string> = {
  function: 'explícita',
  data: 'datos',
  parametric: 'paramétrica',
  polar: 'polar',
  implicit: 'implícita',
  conic: 'cónica',
}

/** Array del `PlotSpec` donde vive cada tipo de curva (el modelo los mantiene separados). */
export const ARR_KEY: Record<CurveType, 'functions' | 'data' | 'parametrics' | 'polars' | 'implicits' | 'conics'> = {
  function: 'functions',
  data: 'data',
  parametric: 'parametrics',
  polar: 'polars',
  implicit: 'implicits',
  conic: 'conics',
}

/** Cantidad de curvas reales (sin contar los ejes) — para saber si tiene sentido intersecar. */
export function curveCount(spec: PlotSpec): number {
  return spec.functions.length + (spec.implicits?.length ?? 0) + (spec.parametrics?.length ?? 0) + (spec.polars?.length ?? 0)
}

/** Curvas + ejes que pueden intersecarse, con su etiqueta (para los selectores de intersección). */
export function curveOptions(spec: PlotSpec): { ref: CurveRef; label: string }[] {
  const out: { ref: CurveRef; label: string }[] = []
  spec.functions.forEach((_, i) => out.push({ ref: { kind: 'function', i }, label: `f${i + 1}` }))
  ;(spec.implicits ?? []).forEach((im, i) => {
    const eq = im.equation.trim()
    out.push({ ref: { kind: 'implicit', i }, label: eq ? (eq.length > 16 ? `${eq.slice(0, 15)}…` : eq) : `implícita ${i + 1}` })
  })
  ;(spec.parametrics ?? []).forEach((_, i) => out.push({ ref: { kind: 'parametric', i }, label: `paramétrica ${i + 1}` }))
  ;(spec.polars ?? []).forEach((_, i) => out.push({ ref: { kind: 'polar', i }, label: `polar ${i + 1}` }))
  // Los ejes como pseudo-curvas: ∩ eje x = raíces, ∩ eje y = ordenada al origen.
  out.push({ ref: { kind: 'xaxis', i: 0 }, label: 'eje x' })
  out.push({ ref: { kind: 'yaxis', i: 0 }, label: 'eje y' })
  return out
}

/** Serializa una `CurveRef` a clave estable para un `<option>` (`kind:i`). */
export const curveRefKey = (r: CurveRef): string => `${r.kind}:${r.i}`

/** Deserializa la clave de `<option>` a `CurveRef`; `null` si la clave no es válida. */
export function parseCurveRefKey(s: string): CurveRef | null {
  const [kind, iStr] = s.split(':')
  if (kind === 'xaxis' || kind === 'yaxis') return { kind, i: 0 }
  const i = Number(iStr)
  return (kind === 'function' || kind === 'implicit' || kind === 'parametric' || kind === 'polar') && Number.isFinite(i)
    ? { kind, i }
    : null
}

/** Dígitos de un número como subíndices unicode (1 → ₁) para rotular las funciones (f₁, f₂…). */
export function subDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)] ?? d)
}

/** Sin claves `undefined` (para no pisar con vacío al convertir de tipo de curva). */
export function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
