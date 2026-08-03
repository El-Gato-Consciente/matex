/**
 * **Evaluador `f(x)` de una función del gráfico (ME-45).** Unifica las fuentes de una `PlotFunction`:
 * **expresión** (`expr`, parseada), **datos** (`fromData` → interpolación de una serie), y **referencias
 * a otras funciones** (`fN(x)`) resueltas **en tiempo de evaluación** vía un *entorno* de evaluadores
 * (`env`). Esto último permite que una función use a una **función-de-datos** en su fórmula
 * (`f2 = f1(x)+1`, donde `f1` es una tabla interpolada): no hay texto que inline, pero sí se puede
 * evaluar → se resuelve por `env` y se emite como **coordenadas** (como las funciones-de-datos).
 *
 * Se espera un `spec` **ya resuelto** (parámetros sustituidos, referencias entre *expresiones*
 * aplanadas por `resolvePlotFunctions`; las referencias a funciones-de-datos quedan literales `fN`).
 */
import type { PlotFunction, PlotSpec } from '../ast'
import { evalExpr, parseExpr } from '../plotExpr'
import { interpolateEvaluator } from './interpolate'

/** Entorno: evaluador `f(x)` de cada función por índice (`null` si partida/deshabilitada/inválida). */
export function buildFuncEnv(spec: PlotSpec): (((x: number) => number) | null)[] {
  const fns = spec.functions
  const cache: (((x: number) => number) | null | undefined)[] = new Array(fns.length)
  const active = new Set<number>() // guarda de ciclos en tiempo de evaluación
  // `env` referencia a los propios evaluadores (para que `evalExpr` resuelva `fN`).
  const env: (((x: number) => number) | null)[] = fns.map((_, i) => {
    const g = build(i)
    return g
  })

  function build(i: number): ((x: number) => number) | null {
    if (cache[i] !== undefined) return cache[i]!
    const f = fns[i]
    if (!f || f.disabled) return (cache[i] = null)
    if (f.fromData) {
      const pts = spec.data?.[f.fromData.series]?.points
      cache[i] = pts && pts.length >= 2 ? interpolateEvaluator(pts, f.fromData.method, { degree: f.fromData.degree })?.eval ?? null : null
      return cache[i]!
    }
    if (f.pieces && f.pieces.length > 0) return (cache[i] = null) // partida: se evalúa por rama aparte
    const r = parseExpr(f.expr)
    cache[i] = r.ok
      ? (x: number): number => {
          if (active.has(i)) return Number.NaN // ciclo
          active.add(i)
          try {
            return evalExpr(r.node, x, env)
          } finally {
            active.delete(i)
          }
        }
      : null
    return cache[i]!
  }
  fns.forEach((_, i) => build(i))
  return env
}

/** Evaluador de una función concreta (por su lugar en `spec.functions`). */
export function funcEvaluator(spec: PlotSpec, f: PlotFunction | undefined): ((x: number) => number) | null {
  if (!f) return null
  const i = spec.functions.indexOf(f)
  return i >= 0 ? buildFuncEnv(spec)[i] ?? null : null
}

/** Intervalo `[from, to]` en el que la función `fromData` está definida (rango x de sus datos). */
export function fromDataDomain(spec: PlotSpec, f: PlotFunction): [number, number] | null {
  if (!f.fromData) return null
  const xs = spec.data?.[f.fromData.series]?.points.map((p) => p[0]).filter(Number.isFinite) ?? []
  return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null
}

/** ¿La expresión (ya resuelta) referencia otra función `fN`? → se emite por **coordenadas** (no fórmula). */
export function exprRefsFunction(expr: string): boolean {
  return /(^|[^A-Za-z0-9_])f\d+/.test(expr)
}
