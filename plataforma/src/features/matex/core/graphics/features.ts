/**
 * **Detección automática de rasgos notables (ME-39).** Dada una función ya parseada, encuentra
 * numéricamente sus **raíces** (cruces con el eje x), **extremos** (máx/mín por cambio de signo de
 * f′) e **inflexiones** (cambio de signo de f″) dentro del dominio. Es la tesis de Matex aplicada a
 * las anotaciones: el usuario declara *qué quiere marcar* y el compilador lo **calcula**, en vez de
 * ubicar coordenadas a mano. Puro y headless → sirve a los 3 backends (SVG/HTML y pgfplots).
 *
 * Método: muestreo denso + **bisección** en los cambios de signo. Robusto ante asíntotas (los cruces
 * "de salto" de un polo dan |f| enorme → se descartan como raíz; f′ no cambia de signo a través de un
 * polo → sin extremos falsos).
 */

export type FeatureKind = 'root' | 'min' | 'max' | 'inflection' | 'yintercept'
export interface DetectedFeature {
  x: number
  y: number
  kind: FeatureKind
}
export interface DetectOptions {
  roots?: boolean | undefined
  extrema?: boolean | undefined
  inflections?: boolean | undefined
  /** Intersección con el eje **y**: el punto `(0, f(0))` si `0` está en el dominio (ME-39). */
  yIntercept?: boolean | undefined
}

const SAMPLES = 600 // muestras del dominio para localizar cambios de signo
const MAX_FEATURES = 40 // tope de marcas por tipo (evita saturar en funciones oscilatorias)

/** Cero de `g` (continua, con cambio de signo en `[a,b]`) por bisección. */
function bisect(g: (x: number) => number, a: number, b: number, ga: number): number {
  let lo = a
  let hi = b
  let glo = ga
  for (let i = 0; i < 60 && hi - lo > 1e-13; i += 1) {
    const mid = (lo + hi) / 2
    const gm = g(mid)
    if (!Number.isFinite(gm)) return mid
    if (gm === 0) return mid
    if (glo < 0 === gm < 0) {
      lo = mid
      glo = gm
    } else {
      hi = mid
    }
  }
  return (lo + hi) / 2
}

/** Ceros de `g` en `[x0,x1]`: cambios de signo entre muestras finitas consecutivas → bisección. */
function zerosOf(g: (x: number) => number, x0: number, x1: number): number[] {
  const step = (x1 - x0) / SAMPLES
  const out: number[] = []
  let px = x0
  let pg = g(x0)
  for (let i = 1; i <= SAMPLES; i += 1) {
    const x = x0 + step * i
    const gx = g(x)
    if (Number.isFinite(pg) && Number.isFinite(gx)) {
      if (pg === 0) out.push(px)
      else if (pg < 0 !== gx < 0) out.push(bisect(g, px, x, pg))
    }
    px = x
    pg = gx
  }
  return out
}

/**
 * **Toques tangentes**: raíces/ceros de multiplicidad par (`x²`, `(x−1)²`) donde `f` **toca** el eje
 * sin cambiar de signo → `zerosOf` (que busca cambios de signo) los pierde. Se detectan como mínimos
 * locales de `|f|` que **llegan a ~0**, refinando con una mini-bisección de `f′` alrededor.
 */
function touchZeros(f: (x: number) => number, x0: number, x1: number): number[] {
  const step = (x1 - x0) / SAMPLES
  const h = Math.max(1e-7, step / 100)
  const d1 = (t: number): number => (f(t + h) - f(t - h)) / (2 * h)
  const out: number[] = []
  for (let i = 1; i < SAMPLES; i += 1) {
    const x = x0 + step * i
    const a = Math.abs(f(x - step))
    const b = Math.abs(f(x))
    const c = Math.abs(f(x + step))
    // Mínimo local de |f| pequeño → posible cero tangente (un cruce ya lo toma `zerosOf`).
    if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) || b > a || b > c || b >= step * 2) continue
    // Refina al vértice (cero de f′) por bisección; si f allí es ~0, es una raíz tangente.
    const g0 = d1(x - step)
    const gb = d1(x + step)
    const vert = Number.isFinite(g0) && Number.isFinite(gb) && g0 < 0 !== gb < 0 ? bisect(d1, x - step, x + step, g0) : x
    if (Math.abs(f(vert)) < 1e-4) out.push(vert)
  }
  return out
}

/** Ordena y colapsa valores más próximos que `tol` (evita marcas duplicadas del muestreo). */
function dedup(xs: number[], tol: number): number[] {
  const sorted = [...xs].sort((a, b) => a - b)
  const out: number[] = []
  for (const x of sorted) if (out.length === 0 || Math.abs(x - out[out.length - 1]!) > tol) out.push(x)
  return out
}

export function detectFeatures(f: (x: number) => number, domain: [number, number], opts: DetectOptions): DetectedFeature[] {
  const [x0, x1] = domain
  if (!(x1 > x0)) return []
  const h = Math.max(1e-6, (x1 - x0) / 1e5)
  const d1 = (x: number): number => (f(x + h) - f(x - h)) / (2 * h)
  const d2 = (x: number): number => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h)
  const tol = (x1 - x0) / 400
  const out: DetectedFeature[] = []

  if (opts.roots) {
    // Cruces (cambio de signo) + toques tangentes (raíz doble, p. ej. x²: toca sin cruzar).
    const roots = dedup([...zerosOf(f, x0, x1), ...touchZeros(f, x0, x1)], tol).slice(0, MAX_FEATURES)
    for (const x of roots) {
      if (Math.abs(f(x)) < 1e-3) out.push({ x, y: 0, kind: 'root' }) // descarta el "cruce" de un polo
    }
  }
  if (opts.extrema) {
    for (const x of dedup(zerosOf(d1, x0, x1), tol).slice(0, MAX_FEATURES)) {
      const y = f(x)
      if (!Number.isFinite(y)) continue
      const curv = d2(x)
      if (!Number.isFinite(curv) || Math.abs(curv) < 1e-6) continue // recta local: no es extremo real
      out.push({ x, y, kind: curv > 0 ? 'min' : 'max' })
    }
  }
  if (opts.inflections) {
    for (const x of dedup(zerosOf(d2, x0, x1), tol).slice(0, MAX_FEATURES)) {
      const y = f(x)
      if (Number.isFinite(y) && Math.abs(d1(x)) < 1e6) out.push({ x, y, kind: 'inflection' })
    }
  }
  if (opts.yIntercept && x0 <= 0 && x1 >= 0) {
    // Ordenada al origen: el punto (0, f(0)) si el eje y está dentro del dominio y f(0) es finito.
    const y = f(0)
    if (Number.isFinite(y)) out.push({ x: 0, y, kind: 'yintercept' })
  }
  return out
}

/** Asíntota detectada: `vertical` (x = at) u **oblicua/horizontal** (y = m·x + b; horizontal si m≈0). */
export interface Asymptote {
  kind: 'vertical' | 'horizontal' | 'oblique'
  at?: number
  m?: number
  b?: number
}

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4

/**
 * **Asíntotas automáticas (ME-39, rebanada 2).** Verticales: polos donde `|f|→∞` (ceros de `1/f`,
 * más un barrido por magnitud para polos pares), verificando que la función **diverja** al acercarse
 * (no un simple pico). Horizontales/oblicuas: comportamiento **en ±∞** por ajuste lineal lejano
 * (`m` = pendiente entre dos puntos lejanos, `b` = ordenada) validado con el **residuo → 0** en un
 * tercer punto (rechaza lo que no converge, p. ej. `tan`, parábolas). Conservador: sin límite claro,
 * no reporta.
 */
export function detectAsymptotes(f: (x: number) => number, domain: [number, number]): Asymptote[] {
  const [x0, x1] = domain
  if (!(x1 > x0)) return []
  const out: Asymptote[] = []

  // --- Verticales: `1/f → 0` en un polo. Cambio de signo = polo impar; barrido de magnitud = par. ---
  const inv = (x: number): number => 1 / f(x)
  const candidates = zerosOf(inv, x0, x1)
  const stepV = (x1 - x0) / SAMPLES
  for (let i = 0; i <= SAMPLES; i += 1) {
    const x = x0 + stepV * i
    const v = Math.abs(f(x))
    if (v > 1e6 && Math.abs(f(x - stepV)) <= v && Math.abs(f(x + stepV)) <= v) candidates.push(x) // pico local enorme (polo par)
  }
  const diverges = (a: number): boolean => {
    const near = (e: number): number => Math.max(Math.abs(f(a - e)), Math.abs(f(a + e)))
    return near(1e-6) > 1e3 && near(1e-6) > near(1e-2) // crece al acercarse y es grande
  }
  const vtol = (x1 - x0) / 300
  const poles: number[] = []
  for (const a of dedup(candidates, vtol)) {
    if (a <= x0 + vtol || a >= x1 - vtol) continue // pegado al borde: no es asíntota interior
    if (diverges(a) && poles.length < MAX_FEATURES) poles.push(a)
  }
  for (const a of poles) out.push({ kind: 'vertical', at: round4(a) })

  // --- Horizontales / oblicuas: ajuste lineal en ±∞, validado con el residuo en un punto más lejano. ---
  const farFit = (sgn: number): Asymptote | null => {
    const X1 = sgn * 1e3
    const X2 = sgn * 1e4
    const X3 = sgn * 1e5
    const f1 = f(X1)
    const f2 = f(X2)
    const f3 = f(X3)
    if (![f1, f2, f3].every(Number.isFinite)) return null
    const m = (f2 - f1) / (X2 - X1)
    const b = f1 - m * X1
    if (Math.abs(f3 - (m * X3 + b)) > 1e-2) return null // no converge a una recta
    return Math.abs(m) < 1e-6 ? { kind: 'horizontal', m: 0, b: round4(b) } : { kind: 'oblique', m: round4(m), b: round4(b) }
  }
  const same = (p: Asymptote, q: Asymptote): boolean => p.kind === q.kind && Math.abs((p.m ?? 0) - (q.m ?? 0)) < 1e-4 && Math.abs((p.b ?? 0) - (q.b ?? 0)) < 1e-4
  for (const a of [farFit(1), farFit(-1)]) {
    if (a && !out.some((o) => same(o, a))) out.push(a)
  }
  return out
}
