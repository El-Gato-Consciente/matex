import { evalExpr, parseExpr } from '../plotExpr'
import type { PlotParameter, PlotSpec } from '../ast'

/**
 * **Parámetros con nombre (ME-36, fase A).** Sustituye cada parámetro por su **valor actual** en
 * las expresiones del gráfico → una spec "aplanada" (sin nombres libres) que los backends
 * (pgfplots / SVG) evalúan sin cambios, exactamente como [[functionRefs]] aplana `f1`/`f2`. Es la
 * **materialización** del patrón generativo↔materializado: el slider elige el `value`, esto lo
 * hornea en las expresiones. Puro; lo aplican el backend LaTeX, el preview SVG y el editor.
 *
 * La sustitución respeta **límites de identificador** (no toca `a` dentro de `max`/`\alpha`), y
 * envuelve el valor en paréntesis (`a` → `(2)`, negativos seguros). Nombres inválidos o vacíos se
 * ignoran.
 */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Reemplaza el identificador `name` (token completo) por `(value)` en `expr`. */
function subst(expr: string, name: string, value: number): string {
  // Lookbehind/lookahead para no partir identificadores más largos (`a` en `max`, `alpha`).
  const re = new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`, 'g')
  return expr.replace(re, `(${value})`)
}

/**
 * Sustituye **todos** los parámetros por su valor en una expresión (útil también para validar/
 * previsualizar una curva suelta en el editor sin marcarla inválida por usar `a`). Devuelve la
 * expresión tal cual si no hay parámetros.
 */
export function substituteParamsInExpr(expr: string, params: readonly PlotParameter[] | undefined): string {
  if (!params || params.length === 0) return expr
  let out = expr
  for (const p of params) {
    if (!IDENT.test(p.name) || !Number.isFinite(p.value)) continue
    out = subst(out, p.name, p.value)
  }
  return out
}
const applyAll = substituteParamsInExpr

/**
 * Devuelve la misma spec con los **parámetros sustituidos por su valor** en todas las expresiones
 * (funciones + ramas, paramétricas, polares, implícitas) **y** en los campos posicionales que
 * traen expresión (`tangent.atExpr`, `point.xExpr`, `area.fromExpr/toExpr`, `vline.xExpr`,
 * `hline.yExpr`): esos se **evalúan a un número** (constante en los parámetros) → así, con un slider,
 * la tangente se desliza, el punto recorre la curva, el área crece, etc. Si no hay parámetros,
 * devuelve la spec tal cual (sin copiar). No muta la entrada.
 */
export function resolvePlotParameters(spec: PlotSpec): PlotSpec {
  const params = spec.parameters
  if (!params || params.length === 0) return spec
  const map = (e: string): string => applyAll(e, params)
  const syntax = spec.syntax ?? 'ascii'
  /** Evalúa una expresión-constante (en los parámetros) a un número, o `undefined` si no resuelve. */
  const evalConst = (expr: string | undefined): number | undefined => {
    if (expr == null || expr.trim() === '') return undefined
    const r = parseExpr(map(expr), syntax)
    if (!r.ok) return undefined
    const v = evalExpr(r.node, 0)
    return Number.isFinite(v) ? v : undefined
  }
  /** Aplica un `*Expr` opcional a un campo numérico: si evalúa, lo reemplaza; si no, lo deja. */
  const withExpr = <T extends object>(obj: T, exprKey: keyof T, numKey: keyof T): T => {
    const v = evalConst(obj[exprKey] as string | undefined)
    return v != null ? { ...obj, [numKey]: v } : obj
  }
  return {
    ...spec,
    functions: spec.functions.map((f) => ({
      ...f,
      expr: map(f.expr),
      ...(f.pieces ? { pieces: f.pieces.map((pc) => ({ ...pc, expr: map(pc.expr) })) } : {}),
    })),
    ...(spec.parametrics ? { parametrics: spec.parametrics.map((p) => ({ ...p, x: map(p.x), y: map(p.y) })) } : {}),
    ...(spec.polars ? { polars: spec.polars.map((p) => ({ ...p, r: map(p.r) })) } : {}),
    ...(spec.implicits ? { implicits: spec.implicits.map((im) => ({ ...im, equation: map(im.equation) })) } : {}),
    ...(spec.tangents ? { tangents: spec.tangents.map((t) => withExpr(t, 'atExpr', 'at')) } : {}),
    ...(spec.points ? { points: spec.points.map((p) => withExpr(withExpr(p, 'xExpr', 'x'), 'yExpr', 'y')) } : {}),
    ...(spec.areas ? { areas: spec.areas.map((a) => withExpr(withExpr(a, 'fromExpr', 'from'), 'toExpr', 'to')) } : {}),
    ...(spec.vlines ? { vlines: spec.vlines.map((v) => withExpr(v, 'xExpr', 'x')) } : {}),
    ...(spec.hlines ? { hlines: spec.hlines.map((h) => withExpr(h, 'yExpr', 'y')) } : {}),
  }
}
