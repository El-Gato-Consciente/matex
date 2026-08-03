/**
 * **Interpolación / ajuste / trazado de una serie de datos (ME-45).** Dada una nube de puntos, traza
 * la curva que los **conecta, ajusta o recorre** según el método — puro y headless (coordenadas a los
 * 3 backends, como las implícitas: "lo que se ve = lo que compila", sin gnuplot). Tres categorías:
 *
 * - **Función y=f(x)** (pasa por los puntos; ordena por x, promedia x repetidos): `linear`, `step`,
 *   `spline` (cúbica natural), `monotone` (PCHIP, suave y sin sobrepasar), `polynomial` (Lagrange).
 * - **Ajuste** por mínimos cuadrados (NO pasa por los puntos): `regression` (polinómica grado d),
 *   `reg-exp` (y=a·e^{bx}), `reg-log` (y=a·ln x+b), `reg-power` (y=a·x^b).
 * - **Curva/trayectoria por orden** (paramétrica; **puede ser cerrada**; NO tiene por qué ser función):
 *   `polyline` (poligonal por orden), `smooth` (Catmull-Rom centrípeta).
 */
import type { PlotInterpMethod } from '../ast'

export type InterpMethod = PlotInterpMethod

export interface InterpResult {
  /** Polilínea a dibujar (ya muestreada). Vacía si no se pudo. */
  curve: [number, number][]
  /** Aviso semántico (no error): x repetidos promediados, Runge, puntos fuera de dominio, etc. */
  warning?: string
  /** Ecuación del ajuste (solo métodos `reg*`), lista para rótulo/leyenda. */
  equation?: string
}

/** Categoría semántica de un método (para agrupar en el editor). */
export type InterpGroup = 'function' | 'fit' | 'path'
export interface InterpMethodMeta {
  method: PlotInterpMethod
  label: string
  group: InterpGroup
  desc: string
}
/** Catálogo único de métodos (etiqueta + grupo + descripción) — el editor renderiza desde acá. */
export const INTERP_METHODS: readonly InterpMethodMeta[] = [
  { method: 'linear', label: 'lineal', group: 'function', desc: 'Segmentos rectos entre los puntos (ordenados por x).' },
  { method: 'step', label: 'escalonada', group: 'function', desc: 'Escalonada: valor constante entre puntos consecutivos.' },
  { method: 'spline', label: 'spline', group: 'function', desc: 'Spline cúbica natural: suave (C²), pasa por los puntos, 2ª derivada nula en los extremos. Puede sobrepasar.' },
  { method: 'monotone', label: 'monótona', group: 'function', desc: 'Spline monótona (PCHIP / Fritsch–Carlson): suave y sin sobrepasar; conserva la monotonía de los datos.' },
  { method: 'polynomial', label: 'polinómica', group: 'function', desc: 'Polinomio de Lagrange de grado n−1 por todos los puntos. ¡Con muchos puntos oscila (fenómeno de Runge)!' },
  { method: 'regression', label: 'polinómica', group: 'fit', desc: 'Ajuste polinómico de grado d por mínimos cuadrados (no pasa por los puntos).' },
  { method: 'reg-exp', label: 'exponencial', group: 'fit', desc: 'Ajuste exponencial y = a·e^(b·x) por mínimos cuadrados (linealiza en ln y; requiere y > 0).' },
  { method: 'reg-log', label: 'logarítmica', group: 'fit', desc: 'Ajuste logarítmico y = a·ln(x) + b por mínimos cuadrados (requiere x > 0).' },
  { method: 'reg-power', label: 'potencia', group: 'fit', desc: 'Ajuste potencial y = a·x^b por mínimos cuadrados (linealiza en log–log; requiere x > 0, y > 0).' },
  { method: 'polyline', label: 'poligonal', group: 'path', desc: 'Poligonal por orden: une los puntos en el orden dado. Puede cerrarse; no tiene por qué ser función de x.' },
  { method: 'smooth', label: 'suave', group: 'path', desc: 'Curva suave por orden (Catmull-Rom centrípeta): pasa por los puntos en el orden dado, puede cerrarse.' },
]
export const INTERP_GROUP_LABEL: Record<InterpGroup, string> = {
  function: 'Función (pasa por los puntos)',
  fit: 'Ajuste (mínimos cuadrados)',
  path: 'Curva por orden (trayectoria)',
}

const SAMPLES = 160

// ————————————————————————— helpers de "función y=f(x)" —————————————————————————

/** Ordena por x y **colapsa x repetidos** promediando sus y. Devuelve si hubo colapso. */
function asFunction(points: readonly [number, number][]): { xs: number[]; ys: number[]; collapsed: boolean } {
  const finite = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  const sorted = [...finite].sort((a, b) => a[0] - b[0])
  const xs: number[] = []
  const ys: number[] = []
  let collapsed = false
  let i = 0
  while (i < sorted.length) {
    let j = i
    let sum = 0
    while (j < sorted.length && Math.abs(sorted[j]![0] - sorted[i]![0]) < 1e-9) {
      sum += sorted[j]![1]
      j += 1
    }
    if (j - i > 1) collapsed = true
    xs.push(sorted[i]![0])
    ys.push(sum / (j - i))
    i = j
  }
  return { xs, ys, collapsed }
}

/** Spline **cúbica natural** (2ª derivada nula en los extremos). Evaluador `f(x)`. */
function naturalSpline(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  const h = new Array(n - 1).fill(0).map((_, i) => xs[i + 1]! - xs[i]!)
  const a = new Array(n).fill(0)
  const b = new Array(n).fill(1)
  const c = new Array(n).fill(0)
  const d = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i += 1) {
    a[i] = h[i - 1]!
    b[i] = 2 * (h[i - 1]! + h[i]!)
    c[i] = h[i]!
    d[i] = 6 * ((ys[i + 1]! - ys[i]!) / h[i]! - (ys[i]! - ys[i - 1]!) / h[i - 1]!)
  }
  for (let i = 1; i < n; i += 1) {
    const m = a[i]! / b[i - 1]!
    b[i] -= m * c[i - 1]!
    d[i] -= m * d[i - 1]!
  }
  const c2 = new Array(n).fill(0)
  c2[n - 1] = n > 1 ? d[n - 1]! / b[n - 1]! : 0
  for (let i = n - 2; i >= 0; i -= 1) c2[i] = (d[i]! - c[i]! * c2[i + 1]!) / b[i]!
  return (x: number): number => {
    let i = 0
    while (i < n - 2 && x > xs[i + 1]!) i += 1
    const t = x - xs[i]!
    const hi = h[i]! || 1
    const A = ys[i]!
    const B = (ys[i + 1]! - ys[i]!) / hi - (hi * (2 * c2[i]! + c2[i + 1]!)) / 6
    const C = c2[i]! / 2
    const D = (c2[i + 1]! - c2[i]!) / (6 * hi)
    return A + B * t + C * t * t + D * t * t * t
  }
}

/** Spline **monótona** (PCHIP / Fritsch–Carlson): Hermite cúbica con pendientes que no sobrepasan. */
function monotoneCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  const h = new Array(n - 1).fill(0).map((_, i) => xs[i + 1]! - xs[i]!)
  const delta = h.map((hi, i) => (ys[i + 1]! - ys[i]!) / hi)
  const d = new Array(n).fill(0)
  d[0] = delta[0] ?? 0
  d[n - 1] = delta[n - 2] ?? 0
  for (let i = 1; i < n - 1; i += 1) {
    if (delta[i - 1]! * delta[i]! <= 0) d[i] = 0 // extremo local → pendiente 0 (conserva monotonía)
    else {
      const w1 = 2 * h[i]! + h[i - 1]!
      const w2 = h[i]! + 2 * h[i - 1]!
      d[i] = (w1 + w2) / (w1 / delta[i - 1]! + w2 / delta[i]!)
    }
  }
  return (x: number): number => {
    let i = 0
    while (i < n - 2 && x > xs[i + 1]!) i += 1
    const hi = h[i]! || 1
    const t = (x - xs[i]!) / hi
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    return h00 * ys[i]! + h10 * hi * d[i]! + h01 * ys[i + 1]! + h11 * hi * d[i + 1]!
  }
}

/** Polinomio de Lagrange por todos los puntos, evaluado en `x`. */
function lagrange(xs: number[], ys: number[], x: number): number {
  let sum = 0
  for (let i = 0; i < xs.length; i += 1) {
    let term = ys[i]!
    for (let j = 0; j < xs.length; j += 1) if (j !== i) term *= (x - xs[j]!) / (xs[i]! - xs[j]!)
    sum += term
  }
  return sum
}

// ————————————————————————— helpers de "ajuste" (LSQ) —————————————————————————

/** Ajuste polinómico grado `deg` por ecuaciones normales + eliminación gaussiana; coefs [a0,a1,…]. */
function polyfit(points: readonly [number, number][], deg: number): number[] | null {
  const pts = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  const m = deg + 1
  if (pts.length < m) return null
  const M: number[][] = Array.from({ length: m }, () => new Array<number>(m + 1).fill(0))
  for (const [x, y] of pts) {
    const pow: number[] = [1]
    for (let k = 1; k <= 2 * deg; k += 1) pow[k] = pow[k - 1]! * x
    for (let r = 0; r < m; r += 1) {
      const row = M[r]!
      for (let cc = 0; cc < m; cc += 1) row[cc] = (row[cc] ?? 0) + pow[r + cc]!
      row[m] = (row[m] ?? 0) + pow[r]! * y
    }
  }
  for (let col = 0; col < m; col += 1) {
    let piv = col
    for (let r = col + 1; r < m; r += 1) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r
    if (Math.abs(M[piv]![col]!) < 1e-12) return null
    const tmp = M[col]!
    M[col] = M[piv]!
    M[piv] = tmp
    const cRow = M[col]!
    for (let r = 0; r < m; r += 1) {
      if (r === col) continue
      const row = M[r]!
      const f = row[col]! / cRow[col]!
      for (let cc = col; cc <= m; cc += 1) row[cc] = (row[cc] ?? 0) - f * cRow[cc]!
    }
  }
  const out: number[] = []
  for (let r = 0; r < m; r += 1) out.push(M[r]![m]! / M[r]![r]!)
  return out
}

/** Recta y = intercept + slope·x por mínimos cuadrados (para linealizar exp/log/potencia). */
function linFit(pairs: [number, number][]): { intercept: number; slope: number } | null {
  const n = pairs.length
  if (n < 2) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const [x, y] of pairs) {
    sx += x
    sy += y
    sxx += x * x
    sxy += x * y
  }
  const det = n * sxx - sx * sx
  if (Math.abs(det) < 1e-12) return null
  const slope = (n * sxy - sx * sy) / det
  return { slope, intercept: (sy - slope * sx) / n }
}

// ————————————————————————— trayectoria (Catmull-Rom) —————————————————————————

/** Curva **suave por orden**: Catmull-Rom **centrípeta** (α=0.5, sin lazos/cúspides). Abierta o cerrada. */
function catmullRom(pts: readonly [number, number][], closed: boolean): [number, number][] {
  const p = pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  const n = p.length
  if (n < 3) return closed && n >= 2 ? [...p, p[0]!] : [...p]
  // Secuencia de control con padding (envuelve si es cerrada; duplica extremos si es abierta).
  const P: [number, number][] = closed ? [p[n - 1]!, ...p, p[0]!, p[1]!] : [p[0]!, ...p, p[n - 1]!]
  const segCount = closed ? n : n - 1
  const K = 16 // muestras por segmento
  const mix = (a: [number, number], b: [number, number], wa: number, wb: number): [number, number] => [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb]
  const knot = (ti: number, a: [number, number], b: [number, number]): number => ti + Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5)
  const out: [number, number][] = [P[1]!]
  for (let i = 1; i <= segCount; i += 1) {
    const p0 = P[i - 1]!
    const p1 = P[i]!
    const p2 = P[i + 1]!
    const p3 = P[i + 2]!
    const t0 = 0
    const t1 = knot(t0, p0, p1)
    const t2 = knot(t1, p1, p2)
    const t3 = knot(t2, p2, p3)
    for (let k = 1; k <= K; k += 1) {
      const t = t1 + ((t2 - t1) * k) / K
      const a1 = mix(p0, p1, (t1 - t) / (t1 - t0), (t - t0) / (t1 - t0))
      const a2 = mix(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1))
      const a3 = mix(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2))
      const b1 = mix(a1, a2, (t2 - t) / (t2 - t0), (t - t0) / (t2 - t0))
      const b2 = mix(a2, a3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1))
      out.push(mix(b1, b2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1)))
    }
  }
  return out
}

// ————————————————————————— formato de ecuaciones —————————————————————————

const round3 = (v: number): number => Math.round(v * 1000) / 1000
const fnum = (n: number): string => String(round3(n)).replace('-', '−')

function polyEquation(coefs: number[]): string {
  const terms: string[] = []
  for (let k = coefs.length - 1; k >= 0; k -= 1) {
    const c = round3(coefs[k]!)
    if (c === 0) continue
    const mag = Math.abs(c)
    const pw = k === 0 ? '' : k === 1 ? 'x' : `x^${k}`
    const body = mag === 1 && k > 0 ? pw : `${fnum(mag)}${pw ? '·' + pw : ''}`
    terms.push((terms.length === 0 ? (c < 0 ? '−' : '') : c < 0 ? ' − ' : ' + ') + body)
  }
  return `y ≈ ${terms.join('') || '0'}`
}

// ————————————————————————— dispatch —————————————————————————

/** Modelo de ajuste no lineal (exp/log/potencia) linealizado: predictor + ecuación + nº de puntos descartados. */
function nonlinearModel(points: readonly [number, number][], kind: 'reg-exp' | 'reg-log' | 'reg-power'): { predict: (x: number) => number; equation: string; dropped: number; lo: number; hi: number } | null {
  const raw = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  const valid = raw.filter(([x, y]) => (kind === 'reg-exp' ? y > 0 : kind === 'reg-log' ? x > 0 : x > 0 && y > 0))
  if (valid.length < 2) return null
  const pairs: [number, number][] =
    kind === 'reg-exp' ? valid.map(([x, y]) => [x, Math.log(y)]) : kind === 'reg-log' ? valid.map(([x, y]) => [Math.log(x), y]) : valid.map(([x, y]) => [Math.log(x), Math.log(y)])
  const fit = linFit(pairs)
  if (!fit) return null
  let predict: (x: number) => number
  let equation: string
  if (kind === 'reg-exp') {
    const a = Math.exp(fit.intercept)
    const b = fit.slope
    predict = (x) => a * Math.exp(b * x)
    equation = `y ≈ ${fnum(a)}·e^(${fnum(b)}·x)`
  } else if (kind === 'reg-log') {
    const a = fit.slope
    const b = fit.intercept
    predict = (x) => a * Math.log(x) + b
    equation = `y ≈ ${fnum(a)}·ln(x) ${b >= 0 ? '+ ' + fnum(b) : '− ' + fnum(-b)}`
  } else {
    const a = Math.exp(fit.intercept)
    const b = fit.slope
    predict = (x) => a * x ** b
    equation = `y ≈ ${fnum(a)}·x^(${fnum(b)})`
  }
  const xsAll = valid.map((p) => p[0])
  let lo = Math.min(...xsAll)
  const hi = Math.max(...xsAll)
  if ((kind === 'reg-log' || kind === 'reg-power') && lo <= 0) lo = Math.max(1e-6, hi / 1000)
  return { predict, equation, dropped: raw.length - valid.length, lo, hi }
}

/**
 * **Evaluador `f(x)`** de un método que ES función (spline/monótona/Lagrange/regresión) — para usar la
 * interpolación como una **función de primera clase** (`PlotFunction.fromData` → tangente/área/raíces/
 * hover, ME-45 nivel 2). Devuelve `null` para los métodos de **trayectoria** (polyline/smooth), que NO
 * son función, o si faltan puntos. También trae la ecuación/aviso cuando aplica.
 */
export function interpolateEvaluator(points: readonly [number, number][], method: InterpMethod, opts: { degree?: number | undefined } = {}): { eval: (x: number) => number; equation?: string; warning?: string } | null {
  if (method === 'polyline' || method === 'smooth') return null
  if (method === 'regression') {
    const coefs = polyfit(points, Math.max(1, Math.min(6, Math.round(opts.degree ?? 1))))
    return coefs ? { eval: (x) => coefs.reduce((s, c, k) => s + c * x ** k, 0), equation: polyEquation(coefs) } : null
  }
  if (method === 'reg-exp' || method === 'reg-log' || method === 'reg-power') {
    const m = nonlinearModel(points, method)
    return m ? { eval: m.predict, equation: m.equation, ...(m.dropped > 0 ? { warning: `${m.dropped} punto(s) fuera del dominio del modelo se ignoraron` } : {}) } : null
  }
  const { xs, ys, collapsed } = asFunction(points)
  if (xs.length < 2) return null
  const idxOf = (x: number): number => {
    let i = 0
    while (i < xs.length - 2 && x > xs[i + 1]!) i += 1
    return i
  }
  let ev: (x: number) => number
  if (method === 'linear') ev = (x) => { const i = idxOf(x); const t = (x - xs[i]!) / (xs[i + 1]! - xs[i]!); return ys[i]! + t * (ys[i + 1]! - ys[i]!) }
  else if (method === 'step') ev = (x) => ys[idxOf(x)]!
  else if (method === 'spline') ev = naturalSpline(xs, ys)
  else if (method === 'monotone') ev = monotoneCubic(xs, ys)
  else ev = (x) => lagrange(xs, ys, x)
  const warn = collapsed ? 'x repetidos: se promediaron los y' : method === 'polynomial' && xs.length > 8 ? 'polinomio de grado alto: puede oscilar (Runge)' : undefined
  return { eval: ev, ...(warn ? { warning: warn } : {}) }
}

export function interpolateSeries(points: readonly [number, number][], method: InterpMethod, opts: { degree?: number | undefined; closed?: boolean | undefined } = {}): InterpResult {
  // — Trayectoria por orden (paramétrica; puede ser cerrada; no exige ser función) —
  if (method === 'polyline' || method === 'smooth') {
    const p = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    if (p.length < 2) return { curve: [] }
    if (method === 'polyline') return { curve: opts.closed ? [...p, p[0]!] : [...p] }
    return { curve: catmullRom(p, opts.closed === true) }
  }

  // — Ajuste por mínimos cuadrados (no pasa por los puntos) —
  if (method === 'regression') {
    const deg = Math.max(1, Math.min(6, Math.round(opts.degree ?? 1)))
    const coefs = polyfit(points, deg)
    if (!coefs) return { curve: [], warning: 'no hay suficientes puntos para el ajuste' }
    const xsAll = points.map((p) => p[0]).filter(Number.isFinite)
    const lo = Math.min(...xsAll)
    const hi = Math.max(...xsAll)
    const evalPoly = (x: number): number => coefs.reduce((s, c, k) => s + c * x ** k, 0)
    const curve: [number, number][] = []
    for (let i = 0; i <= SAMPLES; i += 1) {
      const x = lo + ((hi - lo) * i) / SAMPLES
      curve.push([x, evalPoly(x)])
    }
    return { curve, equation: polyEquation(coefs) }
  }
  if (method === 'reg-exp' || method === 'reg-log' || method === 'reg-power') {
    const m = nonlinearModel(points, method)
    if (!m) return { curve: [], warning: 'no hay suficientes puntos válidos para el ajuste' }
    const curve: [number, number][] = []
    for (let i = 0; i <= SAMPLES; i += 1) {
      const x = m.lo + ((m.hi - m.lo) * i) / SAMPLES
      const y = m.predict(x)
      if (Number.isFinite(y)) curve.push([x, y])
    }
    return { curve, equation: m.equation, ...(m.dropped > 0 ? { warning: `${m.dropped} punto(s) fuera del dominio del modelo se ignoraron` } : {}) }
  }

  // — Función y=f(x) (pasa por los puntos; ordena por x, promedia x repetidos) —
  const { xs, ys, collapsed } = asFunction(points)
  if (xs.length < 2) return { curve: [], ...(collapsed ? { warning: 'x repetidos: se promediaron los y' } : {}) }
  const warn = collapsed ? 'hay x repetidos con distinto y: se promediaron (para datos con ruido usá regresión; para una curva cerrada usá "curva por orden")' : undefined

  if (method === 'linear') return { curve: xs.map((x, i) => [x, ys[i]!]), ...(warn ? { warning: warn } : {}) }
  if (method === 'step') {
    const curve: [number, number][] = []
    for (let i = 0; i < xs.length; i += 1) {
      curve.push([xs[i]!, ys[i]!])
      if (i < xs.length - 1) curve.push([xs[i + 1]!, ys[i]!])
    }
    return { curve, ...(warn ? { warning: warn } : {}) }
  }
  const f = method === 'spline' ? naturalSpline(xs, ys) : method === 'monotone' ? monotoneCubic(xs, ys) : (x: number): number => lagrange(xs, ys, x)
  const curve: [number, number][] = []
  for (let i = 0; i <= SAMPLES; i += 1) {
    const x = xs[0]! + ((xs[xs.length - 1]! - xs[0]!) * i) / SAMPLES
    const y = f(x)
    if (Number.isFinite(y)) curve.push([x, y])
  }
  const runge = method === 'polynomial' && xs.length > 8 ? 'polinomio de grado alto: puede oscilar (Runge) — considerá spline, monótona o regresión' : undefined
  const warning = warn ?? runge
  return { curve, ...(warning ? { warning } : {}) }
}
