import { evalExpr, parseExpr } from '../plotExpr'
import { resolvePlotFunctions } from './functionRefs'
import { implicitCurve, parseImplicit, type Point, type Viewport } from './implicit'
import type { CurveRef, PlotSpec } from '../ast'

/**
 * **Intersecciones de curvas** (familia A4). No hay forma cerrada general (una recta y una
 * cónica, dos parábolas, `f` y `g`…), así que —igual que las implícitas— se **computa en JS**:
 * cada curva se reduce a **polilíneas** (muestreo / marching squares) y se intersecan segmento a
 * segmento. Los puntos resultantes se emiten como coordenadas (pgfplots + SVG). Sin `gnuplot`.
 */

/** Muestrea `y = fx(x)` en `[from, to]`, cortando en no-finitos/asíntotas → polilíneas. */
function sampleY(fx: (x: number) => number, from: number, to: number, vp: Viewport, N = 400): Point[][] {
  if (to <= from) return []
  const margin = vp.ymax - vp.ymin
  const lo = vp.ymin - margin
  const hi = vp.ymax + margin
  const polys: Point[][] = []
  let cur: Point[] = []
  for (let k = 0; k <= N; k += 1) {
    const x = from + ((to - from) * k) / N
    const y = fx(x)
    if (Number.isFinite(y) && y >= lo && y <= hi) cur.push([x, y])
    else {
      if (cur.length > 1) polys.push(cur)
      cur = []
    }
  }
  if (cur.length > 1) polys.push(cur)
  return polys
}

/** Muestrea una curva paramétrica `t → (x(t), y(t))`, cortando fuera de una caja ampliada. */
function sampleParam(fp: (t: number) => Point, t0: number, t1: number, vp: Viewport, M = 600): Point[][] {
  const mx = vp.xmax - vp.xmin
  const my = vp.ymax - vp.ymin
  const polys: Point[][] = []
  let cur: Point[] = []
  for (let k = 0; k <= M; k += 1) {
    const t = t0 + ((t1 - t0) * k) / M
    const [x, y] = fp(t)
    if (Number.isFinite(x) && Number.isFinite(y) && x >= vp.xmin - mx && x <= vp.xmax + mx && y >= vp.ymin - my && y <= vp.ymax + my) {
      cur.push([x, y])
    } else {
      if (cur.length > 1) polys.push(cur)
      cur = []
    }
  }
  if (cur.length > 1) polys.push(cur)
  return polys
}

/** Polilíneas de la curva referida dentro del viewport (incluye los ejes como pseudo-curvas). */
export function curveToPolylines(spec: PlotSpec, ref: CurveRef, vp: Viewport): Point[][] {
  const syntax = spec.syntax ?? 'ascii'
  if (ref.kind === 'xaxis') return [[[vp.xmin, 0], [vp.xmax, 0]]] // eje x (y=0): intersecar da raíces
  if (ref.kind === 'yaxis') return [[[0, vp.ymin], [0, vp.ymax]]] // eje y (x=0): ordenada al origen
  if (ref.kind === 'function') {
    const f = resolvePlotFunctions(spec.functions, 'x')[ref.i]
    if (!f || f.disabled) return []
    const ranges =
      f.pieces && f.pieces.length > 0
        ? f.pieces.map((p) => ({ expr: p.expr, from: Math.max(vp.xmin, Math.min(p.from, p.to)), to: Math.min(vp.xmax, Math.max(p.from, p.to)) }))
        : [{ expr: f.expr, from: vp.xmin, to: vp.xmax }]
    const out: Point[][] = []
    for (const r of ranges) {
      const parsed = parseExpr(r.expr, syntax)
      if (parsed.ok) out.push(...sampleY((x) => evalExpr(parsed.node, x), r.from, r.to, vp))
    }
    return out
  }
  if (ref.kind === 'implicit') {
    const im = spec.implicits?.[ref.i]
    if (!im || im.disabled) return []
    const node = parseImplicit(im.equation)
    return node ? implicitCurve(node, vp, 200) : []
  }
  if (ref.kind === 'parametric') {
    const p = spec.parametrics?.[ref.i]
    if (!p || p.disabled) return []
    const rx = parseExpr(p.x, syntax, 't')
    const ry = parseExpr(p.y, syntax, 't')
    if (!rx.ok || !ry.ok) return []
    return sampleParam((t) => [evalExpr(rx.node, t), evalExpr(ry.node, t)], p.tmin, p.tmax, vp)
  }
  // polar: r(θ) → (r·cos θ, r·sin θ)
  const p = spec.polars?.[ref.i]
  if (!p || p.disabled) return []
  const rr = parseExpr(p.r, syntax, 't')
  if (!rr.ok) return []
  return sampleParam(
    (t) => {
      const r = evalExpr(rr.node, t)
      return [r * Math.cos(t), r * Math.sin(t)]
    },
    p.tmin,
    p.tmax,
    vp,
  )
}

/** Intersección de dos segmentos (o `null`), con rechazo rápido por caja envolvente. */
function segInt(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  if (Math.min(a1[0], a2[0]) > Math.max(b1[0], b2[0]) || Math.max(a1[0], a2[0]) < Math.min(b1[0], b2[0])) return null
  if (Math.min(a1[1], a2[1]) > Math.max(b1[1], b2[1]) || Math.max(a1[1], a2[1]) < Math.min(b1[1], b2[1])) return null
  const rx = a2[0] - a1[0]
  const ry = a2[1] - a1[1]
  const sx = b2[0] - b1[0]
  const sy = b2[1] - b1[1]
  const d = rx * sy - ry * sx
  if (Math.abs(d) < 1e-12) return null // paralelos/colineales
  const t = ((b1[0] - a1[0]) * sy - (b1[1] - a1[1]) * sx) / d
  const u = ((b1[0] - a1[0]) * ry - (b1[1] - a1[1]) * rx) / d
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return [a1[0] + t * rx, a1[1] + t * ry]
}

/** Puntos de intersección entre dos conjuntos de polilíneas (deduplicados). */
export function polylineIntersections(A: readonly Point[][], B: readonly Point[][]): Point[] {
  const found: Point[] = []
  for (const pa of A) {
    for (let i = 0; i < pa.length - 1; i += 1) {
      for (const pb of B) {
        for (let j = 0; j < pb.length - 1; j += 1) {
          const p = segInt(pa[i]!, pa[i + 1]!, pb[j]!, pb[j + 1]!)
          if (p) found.push(p)
        }
      }
    }
  }
  const seen = new Set<string>()
  const out: Point[] = []
  for (const [x, y] of found) {
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push([x, y])
    }
  }
  return out
}

/** Evaluador `y = f(x)` si la curva se puede ver como **función de x** (función o eje x); si no, `null`. */
function asFunctionOfX(spec: PlotSpec, ref: CurveRef): ((x: number) => number) | null {
  if (ref.kind === 'xaxis') return () => 0
  if (ref.kind !== 'function') return null
  const f = resolvePlotFunctions(spec.functions, 'x')[ref.i]
  if (!f || f.disabled) return null
  const syntax = spec.syntax ?? 'ascii'
  if (f.pieces && f.pieces.length > 0) {
    const pcs = f.pieces.map((p) => ({ lo: Math.min(p.from, p.to), hi: Math.max(p.from, p.to), r: parseExpr(p.expr, syntax) }))
    return (x) => {
      const pc = pcs.find((p) => x >= p.lo && x <= p.hi)
      return pc && pc.r.ok ? evalExpr(pc.r.node, x) : NaN
    }
  }
  const r = parseExpr(f.expr, syntax)
  return r.ok ? (x) => evalExpr(r.node, x) : null
}

/** Refina una raíz de `h` por bisección en `[lo, hi]` (donde `h` cambia de signo). */
function bisect(h: (x: number) => number, lo: number, hi: number): number {
  let a = lo
  let b = hi
  let fa = h(a)
  for (let i = 0; i < 50; i += 1) {
    const m = (a + b) / 2
    const fm = h(m)
    if (!Number.isFinite(fm) || fm === 0) return m
    if ((fm < 0) === (fa < 0)) {
      a = m
      fa = fm
    } else {
      b = m
    }
  }
  return (a + b) / 2
}

/**
 * Raíces de `h(x)=0` en `[from, to]`: **cruces** (con bisección → precisos) **y tangencias**
 * (mínimos locales de `|h|` por debajo de una tolerancia; así se detecta p. ej. `x² ∩ eje x`).
 */
function functionRoots(h: (x: number) => number, from: number, to: number, yspan: number): number[] {
  const N = 1000
  const xs: number[] = []
  const hs: number[] = []
  for (let k = 0; k <= N; k += 1) {
    const x = from + ((to - from) * k) / N
    xs.push(x)
    hs.push(h(x))
  }
  const roots: number[] = []
  for (let k = 0; k < N; k += 1) {
    const a = hs[k]!
    const b = hs[k + 1]!
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (a === 0) roots.push(xs[k]!)
    else if (a * b < 0) roots.push(bisect(h, xs[k]!, xs[k + 1]!))
  }
  if (hs[N] === 0) roots.push(xs[N]!)
  // Tangencias: mínimo local de |h| bajo tolerancia (la curva toca sin cruzar).
  const tol = Math.max(1e-9, yspan * 1e-4)
  for (let k = 1; k < N; k += 1) {
    const p = Math.abs(hs[k - 1]!)
    const c = Math.abs(hs[k]!)
    const n = Math.abs(hs[k + 1]!)
    if (Number.isFinite(p) && Number.isFinite(c) && Number.isFinite(n) && c <= p && c <= n && c < tol) roots.push(xs[k]!)
  }
  roots.sort((a, b) => a - b)
  const eps = Math.max(1e-9, Math.abs(to - from) * 5e-4)
  const out: number[] = []
  for (const r of roots) if (out.length === 0 || Math.abs(r - out[out.length - 1]!) > eps) out.push(r)
  return out
}

/**
 * Puntos donde las curvas `a` y `b` se cruzan, dentro del viewport. Para el caso **función de x**
 * (curva ∩ curva, curva ∩ eje x) usa **búsqueda de raíces** (precisa + detecta tangencias como
 * `x²`); eje y ∩ función = la ordenada al origen; el resto (implícitas/paramétricas/polares) por
 * intersección de polilíneas.
 */
export function intersectionPoints(spec: PlotSpec, a: CurveRef, b: CurveRef, vp: Viewport): Point[] {
  const fa = asFunctionOfX(spec, a)
  const fb = asFunctionOfX(spec, b)
  if (fa && fb && (a.kind === 'function' || b.kind === 'function')) {
    const margin = vp.ymax - vp.ymin
    return functionRoots((x) => fa(x) - fb(x), vp.xmin, vp.xmax, margin)
      .map((x) => [x, fa(x)] as Point)
      .filter(([, y]) => Number.isFinite(y) && y >= vp.ymin - margin && y <= vp.ymax + margin)
  }
  // Eje y (x=0) ∩ una función de x → la ordenada al origen (0, g(0)).
  if ((a.kind === 'yaxis') !== (b.kind === 'yaxis')) {
    const g = asFunctionOfX(spec, a.kind === 'yaxis' ? b : a)
    if (g) return vp.xmin <= 0 && vp.xmax >= 0 && Number.isFinite(g(0)) ? [[0, g(0)]] : []
  }
  return polylineIntersections(curveToPolylines(spec, a, vp), curveToPolylines(spec, b, vp))
}
