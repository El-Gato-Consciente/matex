import { compileExprToAscii, compileExprToLatex, type PlotSpec } from '../core'
import { ARR_KEY, clean, type CurveType } from './plotCurves'

/**
 * **Constructores de parche del editor de curvas** (QA-09, slice 2). Lógica **pura** extraída
 * de `CurvesTab`: dado el `spec` actual y una operación (agregar / quitar / cambiar de tipo /
 * cambiar de notación), devuelven el parche a mezclar en la `spec`. No tocan React ni el DOM,
 * así que se testean solos. La sutileza que cubren —y que antes vivía sin red— es el
 * **reindexado**: quitar una función corre los índices de áreas, tangentes y puntos anclados.
 */

/** El array del `spec` para el tipo de curva `t` (vacío si el campo está ausente). */
export function arrayForType(spec: PlotSpec, t: CurveType): unknown[] {
  return (spec[ARR_KEY[t]] as unknown[] | undefined) ?? []
}

/**
 * Parche que **quita** el ítem `i` del tipo `t`. Al borrar una **función**, reindexa lo que la
 * referencia por índice: áreas (`fn`/`toFn`), tangentes (`fn`) y puntos anclados (`fn`) — los
 * anclados a la función borrada se **desanclan** conservando su `y`. Al borrar una **serie de
 * datos**, elimina las funciones `fromData` que la usaban y reindexa las que apuntan más allá.
 */
export function removalPatch(spec: PlotSpec, t: CurveType, i: number): Record<string, unknown> {
  const funcs = spec.functions
  if (t === 'function') {
    const reindex = (fn: number): number => (fn > i ? fn - 1 : fn)
    return {
      functions: funcs.filter((_, j) => j !== i),
      areas: (spec.areas ?? [])
        .filter((a) => a.fn !== i && a.toFn !== i)
        .map((a) => ({ ...a, fn: reindex(a.fn), ...(a.toFn != null ? { toFn: reindex(a.toFn) } : {}) })),
      tangents: (spec.tangents ?? []).filter((tg) => tg.fn !== i).map((tg) => ({ ...tg, fn: reindex(tg.fn) })),
      points: (spec.points ?? []).map((p) => (p.fn == null ? p : p.fn === i ? { ...p, fn: undefined } : { ...p, fn: reindex(p.fn) })),
    }
  }
  if (t === 'data') {
    return {
      data: (spec.data ?? []).filter((_, j) => j !== i),
      functions: funcs
        .filter((fn) => fn.fromData?.series !== i)
        .map((fn) => (fn.fromData && fn.fromData.series > i ? { ...fn, fromData: { ...fn.fromData, series: fn.fromData.series - 1 } } : fn)),
    }
  }
  return { [ARR_KEY[t]]: arrayForType(spec, t).filter((_, j) => j !== i) }
}

/** Parche que **agrega** un ítem por defecto del tipo `t` (mezclando `extra` = campos preservados). */
export function addPatch(spec: PlotSpec, t: CurveType, extra: Record<string, unknown>): Record<string, unknown> {
  if (t === 'function') return { functions: [...spec.functions, { expr: '', ...extra }] }
  if (t === 'data') return { data: [...(spec.data ?? []), { points: [[0, 0], [1, 1]] as [number, number][], ...extra }] }
  if (t === 'parametric') return { parametrics: [...(spec.parametrics ?? []), { x: 'cos(t)', y: 'sin(t)', tmin: 0, tmax: 6.283, ...extra }] }
  if (t === 'polar') return { polars: [...(spec.polars ?? []), { r: '1 + cos(t)', tmin: 0, tmax: 6.283, ...extra }] }
  if (t === 'implicit') return { implicits: [...(spec.implicits ?? []), { equation: 'x^2 + y^2 = 4', ...extra }] }
  return { conics: [...(spec.conics ?? []), { kind: 'circle', cx: 0, cy: 0, r: 2, ...extra }] }
}

/** Parche que **convierte** la fila `i` de `from` a `to`, preservando leyenda/color/trazo/oculto. */
export function changeTypePatch(spec: PlotSpec, from: CurveType, i: number, to: CurveType): Record<string, unknown> | null {
  if (from === to) return null
  const src = (arrayForType(spec, from)[i] ?? {}) as Record<string, unknown>
  const common = clean({ legend: src.legend, color: src.color, style: src.style, disabled: src.disabled })
  // from ≠ to → arrays distintos, los dos parches no chocan.
  return { ...removalPatch(spec, from, i), ...addPatch(spec, to, common) }
}

/**
 * Parche que cambia la **notación** de los campos de expresión (ASCII↔LaTeX), **convirtiendo**
 * el texto de cada función/paramétrica/polar. Las implícitas se parsean en modo `both`, así que
 * no se tocan. `null` si ya está en ese modo. El `syntax` viaja en el AST porque es la notación
 * **elegida por el autor** (no afecta la salida; sí permite reabrir el editor fiel).
 */
export function syntaxPatch(spec: PlotSpec, mode: 'ascii' | 'latex'): Record<string, unknown> | null {
  const from = spec.syntax ?? 'ascii'
  if (mode === from) return null
  const convert = mode === 'latex' ? compileExprToLatex : compileExprToAscii
  const conv = (s: string): string => convert(s, from) ?? s
  const convT = (s: string): string => convert(s, from, 't') ?? s // paramétricas/polares (variable t)
  const functions = spec.functions.map((f) => ({
    ...f,
    expr: conv(f.expr),
    ...(f.pieces ? { pieces: f.pieces.map((pc) => ({ ...pc, expr: conv(pc.expr) })) } : {}),
  }))
  const patch: Record<string, unknown> = { syntax: mode, functions }
  if (spec.parametrics) patch.parametrics = spec.parametrics.map((p) => ({ ...p, x: convT(p.x), y: convT(p.y) }))
  if (spec.polars) patch.polars = spec.polars.map((p) => ({ ...p, r: convT(p.r) }))
  return patch
}
