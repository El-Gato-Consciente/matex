import { compileExprToLatex, compileExprToPgfplots, evalExpr, parseExpr, tangentSlope, type ExprNode } from '../plotExpr'
import { resolvePlotColor } from '../plotColors'
import { resolvePlotStyle } from '../plotTheme'
import { detectFeatures, detectAsymptotes } from './features'
import { interpolateSeries } from './interpolate'
import { funcEvaluator, fromDataDomain, exprRefsFunction } from './funcEval'
import { conicCurve, conicLabel } from './conic'
import { resolvePlotFunctions } from './functionRefs'
import { resolvePlotParameters } from './parameters'
import { implicitCurve, parseImplicit } from './implicit'
import { intersectionPoints } from './intersect'
import { escapeLabel, escapeLatex, itemWidth, num6 } from './util'
import type { AreaPattern, PlotArea, PlotPiece, PlotSpec } from '../ast'

/**
 * **Familia A4 (relación) — backend LaTeX.** Compila un `PlotSpec` (curvas `y=f(x)`,
 * datos/scatter, paramétricas, polares + anotaciones) a un `tikzpicture`/`axis` de pgfplots.
 * Es el emisor LaTeX de la misma spec que el preview SVG (`relationSvg.ts`, co-localizado) dibuja
 * en la web — "lo que se ve = lo que compila". Ver `matex/03-modelo-semantico/graficos-cartografia-semantica.md`.
 */

// Argumento de trig por encima del cual pgfplots **desborda** ("Dimension too large") al reducir
// el rango (~límite de dimensión de TeX). Por ejemplo `sin(1/x²)` cerca de 0. Con margen: por
// debajo se usa `{expr}` (salida limpia); por encima se muestrea en JS → coordenadas (robusto).
const TRIG_ARG_LIMIT = 3000
const TRIG_FNS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot'])

/** Máximo |argumento| que recibe alguna función trigonométrica del árbol sobre `[from, to]`. */
function maxTrigArg(node: ExprNode, from: number, to: number): number {
  const args: ExprNode[] = []
  const collect = (n: ExprNode): void => {
    if (n.t === 'call') {
      if (TRIG_FNS.has(n.fn)) args.push(n.a)
      collect(n.a)
    } else if (n.t === 'neg') collect(n.a)
    else if (n.t === 'bin') {
      collect(n.a)
      collect(n.b)
    }
  }
  collect(node)
  if (args.length === 0) return 0
  let m = 0
  const N = 400
  for (let k = 0; k <= N; k += 1) {
    const x = from + ((to - from) * k) / N
    for (const a of args) {
      const v = Math.abs(evalExpr(a, x))
      if (Number.isFinite(v) && v > m) m = v
    }
  }
  return m
}

/**
 * Cuerpo de un `\addplot` de función: `{pgf}` (pgfplots muestrea; salida limpia) **salvo** que una
 * trig reciba un argumento gigante sobre el tramo → pgfplots desbordaría; ahí se **muestrea en JS**
 * (como el preview) y se emiten coordenadas acotadas — robusto y fiel a lo que se ve.
 */
function fnPlotBody(exprSrc: string, pgf: string, syntax: 'ascii' | 'latex', from: number, to: number): string {
  const parsed = parseExpr(exprSrc, syntax)
  if (parsed.ok && maxTrigArg(parsed.node, from, to) > TRIG_ARG_LIMIT) {
    const N = 400
    const coords: string[] = []
    for (let k = 0; k <= N; k += 1) {
      const x = from + ((to - from) * k) / N
      const y = evalExpr(parsed.node, x)
      if (Number.isFinite(y)) coords.push(`(${num6(x)},${num6(Math.max(-1e4, Math.min(1e4, y)))})`)
    }
    if (coords.length > 0) return `coordinates {${coords.join(' ')}}`
  }
  return `{${pgf}}`
}

// ── Áreas: texturas de relleno + valor calculado (integral) ────────────────────
const AREA_PATTERN_PGF: Record<Exclude<AreaPattern, 'solid'>, string> = {
  lines: 'north east lines',
  'lines-alt': 'north west lines',
  crosshatch: 'crosshatch',
  dots: 'dots',
  grid: 'grid',
  horizontal: 'horizontal lines',
  vertical: 'vertical lines',
}
/** Opciones de relleno de un área: color translúcido (`solid`) o una **textura** (`patterns`). */
function areaFill(pattern: AreaPattern | undefined, colorPgf: string): string {
  return !pattern || pattern === 'solid'
    ? `fill=${colorPgf}, fill opacity=0.2`
    : `pattern=${AREA_PATTERN_PGF[pattern]}, pattern color=${colorPgf}`
}
const fmtVal = (n: number): string => String(Number(n.toFixed(2)))
/** Opción `yshift` del rótulo de valor según `labelPos` (ME-34): `above`↑ / `below`↓ / `auto`=sin
 *  desplazar. Se despega el rótulo de la curva u otros rótulos. */
const labelShift = (pos: 'auto' | 'above' | 'below' | undefined): string => (pos === 'above' ? ', yshift=10pt' : pos === 'below' ? ', yshift=-10pt' : '')
/** Opciones pgfplots de **guion + grosor** desde el estilo efectivo (p. ej. ", dashed, thick"). */
function dashWidthOpt(eff: { dash: 'solid' | 'dashed' | 'dotted'; pgfWidth: string }): string {
  return [...(eff.dash === 'dashed' ? ['dashed'] : eff.dash === 'dotted' ? ['dotted'] : []), ...(eff.pgfWidth ? [eff.pgfWidth] : [])].map((s) => `, ${s}`).join('')
}
/** Ecuación LaTeX de una asíntota horizontal/oblicua `y = m x + b` legible (`y = x`, `y = 2`, `y = -0.5x + 3`). */
function asymptoteEqLatex(m0: number, b0: number): string {
  const m = Math.round(m0 * 100) / 100
  const b = Math.round(b0 * 100) / 100
  if (m === 0) return `y = ${fmtVal(b)}`
  const mp = m === 1 ? 'x' : m === -1 ? '-x' : `${fmtVal(m)}x`
  const bp = b === 0 ? '' : b > 0 ? ` + ${fmtVal(b)}` : ` - ${fmtVal(-b)}`
  return `y = ${mp}${bp}`
}
/** Integral definida numérica `∫[from,to] f` (trapecios); `null` si `f` no evalúa en algún punto. */
function integrate(f: (x: number) => number | null, from: number, to: number, N = 300): number | null {
  const h = (to - from) / N
  let prev = f(from)
  if (prev == null || !Number.isFinite(prev)) return null
  let sum = 0
  for (let k = 1; k <= N; k += 1) {
    const y = f(from + h * k)
    if (y == null || !Number.isFinite(y)) return null
    sum += ((prev + y) / 2) * h
    prev = y
  }
  return sum
}
/** Valor de la función `fn` (con ramas) en `x`, o `null`. */
function fnEvalAt(fn: PlotSpec['functions'][number], x: number): number | null {
  const src = exprAtX(fn, x)
  return src != null ? evalExprAt(src, x) : null
}
/** Integral del área (`∫f` bajo la curva, o `∫(f−g)` entre curvas) + posición para el rótulo. */
function areaInfo(spec: PlotSpec, area: PlotArea): { val: number; x: number; y: number } | null {
  const fn = spec.functions[area.fn]
  if (!fn) return null
  const g = area.toFn != null ? spec.functions[area.toFn] : null
  const val = integrate(
    (x) => {
      const a = fnEvalAt(fn, x)
      if (a == null) return null
      if (!g) return a
      const b = fnEvalAt(g, x)
      return b == null ? null : a - b
    },
    area.from,
    area.to,
  )
  if (val == null) return null
  const midx = (area.from + area.to) / 2
  const a = fnEvalAt(fn, midx) ?? 0
  const midy = g ? (a + (fnEvalAt(g, midx) ?? 0)) / 2 : a / 2
  return { val, x: midx, y: midy }
}

/**
 * Rectángulos de una **suma de Riemann** (izq/der/medio) o **trapecios** sobre `[from,to]` (ME-40c):
 * geometría numérica compartida con el backend SVG. Cada quad va de la base (eje o curva `toFn`) a la
 * altura muestreada; `sum` es la suma de las áreas (aproximación de la integral). `null` si no evalúa.
 */
function riemannQuads(spec: PlotSpec, area: PlotArea): { quads: [number, number][][]; sum: number } | null {
  const fn = spec.functions[area.fn]
  if (!fn || !area.riemann) return null
  const g = area.toFn != null ? spec.functions[area.toFn] : null
  if (area.toFn != null && !g) return null
  const lo = Math.min(area.from, area.to)
  const hi = Math.max(area.from, area.to)
  const n = Math.max(1, Math.min(200, Math.round(area.riemannN ?? 8)))
  const h = (hi - lo) / n
  const base = (x: number): number => (g ? (fnEvalAt(g, x) ?? NaN) : 0)
  const top = (x: number): number => fnEvalAt(fn, x) ?? NaN
  const quads: [number, number][][] = []
  let sum = 0
  for (let i = 0; i < n; i += 1) {
    const xL = lo + i * h
    const xR = xL + h
    if (area.riemann === 'trapezoid') {
      const tL = top(xL)
      const tR = top(xR)
      const bL = base(xL)
      const bR = base(xR)
      if (![tL, tR, bL, bR].every((v) => Number.isFinite(v))) continue
      quads.push([[xL, bL], [xL, tL], [xR, tR], [xR, bR]])
      sum += (((tL - bL) + (tR - bR)) / 2) * h
    } else {
      const xs = area.riemann === 'left' ? xL : area.riemann === 'right' ? xR : (xL + xR) / 2
      const t = top(xs)
      const bs = base(xs)
      if (!Number.isFinite(t) || !Number.isFinite(bs)) continue
      quads.push([[xL, bs], [xL, t], [xR, t], [xR, bs]])
      sum += (t - bs) * h
    }
  }
  return { quads, sum }
}

/** Evalúa `src` en `x` (para detectar saltos entre ramas), o `null` si no parsea. */
function evalExprAt(src: string, x: number): number | null {
  const r = parseExpr(src)
  return r.ok ? evalExpr(r.node, x) : null
}

const gcd2 = (a: number, b: number): number => (b === 0 ? a : gcd2(b, a % b))

/** Etiqueta LaTeX de un tick en `k · π/2` (0, `\pi`, `\frac{\pi}{2}`, `-\frac{3\pi}{2}`…). */
function piTickLabel(k: number): string {
  if (k === 0) return '$0$'
  const g = gcd2(Math.abs(k), 2)
  const num = k / g
  const den = 2 / g
  const sign = num < 0 ? '-' : ''
  const a = Math.abs(num)
  const coef = a === 1 ? '\\pi' : `${a}\\pi`
  return den === 1 ? `$${sign}${coef}$` : `$${sign}\\frac{${coef}}{2}$`
}

/** Opciones de eje para marcar el eje x en múltiplos de π/2 dentro del dominio. */
function piTickOpts(domain: [number, number]): string[] {
  const half = Math.PI / 2
  const kmin = Math.ceil(domain[0] / half - 1e-9)
  const kmax = Math.floor(domain[1] / half + 1e-9)
  const ticks: string[] = []
  const labels: string[] = []
  for (let k = kmin; k <= kmax; k += 1) {
    ticks.push(num6(k * half))
    labels.push(piTickLabel(k))
  }
  return ticks.length > 0 ? [`xtick={${ticks.join(',')}}`, `xticklabels={${labels.join(',')}}`] : []
}

/** La expresión de la rama que contiene `x` (para tangentes a funciones partidas), o `null`. */
function exprAtX(fn: { expr: string; pieces?: PlotPiece[] | undefined }, x: number): string | null {
  if (fn.pieces && fn.pieces.length > 0) {
    const pc = fn.pieces.find((p) => x >= Math.min(p.from, p.to) && x <= Math.max(p.from, p.to))
    return pc ? pc.expr : null
  }
  return fn.expr
}

/** Leyenda `\begin{cases}` de una función partida: expresión + condición de intervalo por rama. */
function piecewiseCasesLatex(pieces: PlotPiece[]): string {
  const rows = pieces.map((pc, i) => {
    const e = compileExprToLatex(pc.expr) ?? escapeLatex(pc.expr)
    const cond =
      pieces.length === 1 ? `${pc.from} \\le x \\le ${pc.to}`
      : i === 0 ? `x < ${pc.to}`
      : i === pieces.length - 1 ? `x \\ge ${pc.from}`
      : `${pc.from} \\le x < ${pc.to}`
    return `${e} & ${cond}`
  })
  return `f(x) = \\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`
}

/**
 * **Gráfico de funciones** → `tikzpicture`/`axis` de pgfplots. Radianes vía
 * `trig format plots=rad` (coincide con el preview JS). Ejes por el origen (`axis lines=
 * middle`), muestreo denso. Cada función se emite desde el AST (`compileExprToPgfplots`).
 */
export function plotToLatex(specIn: PlotSpec, width: number | undefined, widthOverride?: string): string {
  // Primero sustituimos los parámetros por su valor (`a x^2` → `2 x^2`), luego resolvemos las
  // referencias entre funciones (`f1(x)+1`, composición) → exprs aplanadas.
  const specP = resolvePlotParameters(specIn)
  const spec = { ...specP, functions: resolvePlotFunctions(specP.functions) }
  const syntax = spec.syntax ?? 'ascii'
  const sampleN = spec.samples && spec.samples > 1 ? Math.round(spec.samples) : 100
  const opts = [
    `width=${widthOverride ?? itemWidth(width, '0.8\\linewidth')}`,
    `domain=${spec.domain[0]}:${spec.domain[1]}`,
    `samples=${sampleN}`,
    'axis lines=middle',
    'trig format plots=rad',
    // Asíntotas (tan, 1/x, sec…): los valores ±∞ se cortan como salto, no como línea
    // espuria; además silencia la lluvia de NOTES "coordinate dropped (unbounded)".
    'unbounded coords=jump',
  ]
  if (spec.range) {
    opts.push(`ymin=${spec.range[0]}`, `ymax=${spec.range[1]}`, `restrict y to domain=${spec.range[0]}:${spec.range[1]}`)
  }
  if (spec.equalAxes) opts.push('axis equal image')
  if (spec.grid) opts.push('grid=major')
  if (spec.hideTicks) opts.push('ticks=none')
  else if (spec.piTicks) opts.push(...piTickOpts(spec.domain))
  if (spec.xlabel) opts.push(`xlabel={${escapeLatex(spec.xlabel)}}`)
  if (spec.ylabel) opts.push(`ylabel={${escapeLatex(spec.ylabel)}}`)
  if (spec.title) opts.push(`title={${escapeLatex(spec.title)}}`)
  if (spec.legend) {
    // Traducción semántica → vocabulario pgfplots (el backend LaTeX; otros backends traducen distinto).
    const legendPgf = { 'top-left': 'north west', 'top-right': 'north east', 'bottom-left': 'south west', 'bottom-right': 'south east', 'outside-right': 'outer north east' } as const
    opts.push(`legend pos=${legendPgf[spec.legendPos ?? 'top-left']}`)
  }

  // Índices de función que necesitan `name path` (referidos por "área entre curvas").
  const namedPaths = new Set<number>()
  for (const area of spec.areas ?? []) {
    if (area.toFn != null) namedPaths.add(area.fn).add(area.toFn)
  }
  const drawable = (i: number | undefined): boolean => {
    const fn = i != null ? spec.functions[i] : undefined
    return !!fn && !fn.disabled && compileExprToPgfplots(fn.expr) != null
  }

  const plots: string[] = []
  // Sumas de Riemann / trapecios (ME-40c): rectángulos didácticos, detrás de todo. Reemplazan el
  // relleno suave (bajo la curva o entre curvas) por la aproximación por rectángulos/trapecios.
  for (const area of spec.areas ?? []) {
    if (!area.riemann) continue
    const fn = spec.functions[area.fn]
    if (!fn || fn.disabled) continue
    const r = riemannQuads(spec, area)
    if (!r || r.quads.length === 0) continue
    const colorPgf = resolvePlotStyle({ color: fn.color, role: fn.role, index: area.fn }).color.pgf
    const fillOpt = areaFill(area.pattern, colorPgf)
    for (const q of r.quads) {
      const path = q.map(([x, y]) => `(axis cs:${num6(x)},${num6(y)})`).join(' -- ')
      plots.push(`\\draw[draw=${colorPgf}, line width=0.3pt, ${fillOpt}] ${path} -- cycle;`)
    }
    if (area.showValue) {
      const midx = (area.from + area.to) / 2
      const a0 = fnEvalAt(fn, midx) ?? 0
      const g = area.toFn != null ? spec.functions[area.toFn] : null
      const midy = g ? (a0 + (fnEvalAt(g, midx) ?? 0)) / 2 : a0 / 2
      plots.push(`\\node[font=\\footnotesize, inner sep=1.5pt, fill=white, fill opacity=0.6, text opacity=1${labelShift(area.labelPos)}] at (axis cs:${num6(midx)},${num6(midy)}) {$\\sum \\approx ${fmtVal(r.sum)}$};`)
    }
  }
  // Detrás de las curvas: áreas **bajo** la curva (al eje) + verticales + horizontales.
  // `forget plot` = fuera de la leyenda; `\closedcycle` cierra al eje.
  for (const area of spec.areas ?? []) {
    if (area.toFn != null || area.riemann) continue // "entre curvas" y Riemann van aparte
    const fn = spec.functions[area.fn]
    if (!fn || fn.disabled) continue
    const expr = compileExprToPgfplots(fn.expr)
    if (!expr) continue
    plots.push(
      `\\addplot[draw=none, ${areaFill(area.pattern, resolvePlotStyle({ color: fn.color, role: fn.role, index: area.fn }).color.pgf)}, domain=${area.from}:${area.to}, forget plot] ${fnPlotBody(fn.expr, expr, syntax, area.from, area.to)} \\closedcycle;`,
    )
    if (area.showValue) {
      const info = areaInfo(spec, area)
      if (info) plots.push(`\\node[font=\\footnotesize, inner sep=1.5pt, fill=white, fill opacity=0.6, text opacity=1${labelShift(area.labelPos)}] at (axis cs:${num6(info.x)},${num6(info.y)}) {$\\int \\approx ${fmtVal(info.val)}$};`)
    }
  }
  for (const v of spec.vlines ?? []) {
    plots.push(`\\draw[dashed, gray] ({axis cs:${v.x},0} |- {rel axis cs:0,0}) -- ({axis cs:${v.x},0} |- {rel axis cs:0,1});`)
    if (v.label) plots.push(`\\node[anchor=north east, font=\\footnotesize, gray] at ({axis cs:${v.x},0} |- {rel axis cs:0,1}) {${escapeLabel(v.label)}};`)
  }
  for (const h of spec.hlines ?? []) {
    plots.push(`\\draw[dashed, gray] ({rel axis cs:0,0} |- {axis cs:0,${h.y}}) -- ({rel axis cs:1,0} |- {axis cs:0,${h.y}});`)
    if (h.label) plots.push(`\\node[anchor=south east, font=\\footnotesize, gray] at ({rel axis cs:1,0} |- {axis cs:0,${h.y}}) {${escapeLabel(h.label)}};`)
  }
  spec.functions.forEach((fn, i) => {
    if (fn.disabled) return // oculta: no se dibuja ni entra en la leyenda (el color de índice se conserva)
    // Estilo por rol (ME-38): color/grosor/guion, con override explícito ganando.
    const eff = resolvePlotStyle({ color: fn.color, style: fn.style, width: fn.width, role: fn.role, index: i })
    const color = eff.color.pgf
    const styleOpt = [...(eff.dash === 'dashed' ? ['dashed'] : eff.dash === 'dotted' ? ['dotted'] : []), ...(eff.pgfWidth ? [eff.pgfWidth] : [])]

    // **Función partida**: una curva por rama (mismo color), leyenda \begin{cases} y —si se
    // pide— marcas de continuidad ●/○ donde hay salto entre ramas.
    if (fn.pieces && fn.pieces.length > 0) {
      let drawn = false
      for (const pc of fn.pieces) {
        const expr = compileExprToPgfplots(pc.expr)
        if (!expr) continue
        const o = ['smooth', `color=${color}`, ...styleOpt, `domain=${pc.from}:${pc.to}`]
        if (drawn) o.push('forget plot') // solo la 1ª rama ocupa el lugar de la leyenda
        plots.push(`\\addplot[${o.join(', ')}] ${fnPlotBody(pc.expr, expr, syntax, pc.from, pc.to)};`)
        drawn = true
      }
      if (spec.legend && drawn) {
        plots.push(`\\addlegendentry{${fn.legend ? escapeLabel(fn.legend) : `$${piecewiseCasesLatex(fn.pieces)}$`}}`)
      }
      if (fn.markJumps) {
        for (let b = 0; b < fn.pieces.length - 1; b += 1) {
          const left = fn.pieces[b]!
          const right = fn.pieces[b + 1]!
          const x = right.from
          const lv = evalExprAt(left.expr, x)
          const rv = evalExprAt(right.expr, x)
          if (lv == null || rv == null || !Number.isFinite(lv) || !Number.isFinite(rv)) continue
          if (Math.abs(lv - rv) < 1e-9) continue // continua en el empalme → sin marcas
          // La rama derecha "posee" el empalme (● incluido); la izquierda queda ○ (excluido).
          plots.push(`\\addplot[only marks, mark=*, mark size=1.5pt, black, forget plot] coordinates {(${x}, ${rv})};`)
          plots.push(`\\addplot[only marks, mark=o, mark size=1.5pt, black, forget plot] coordinates {(${x}, ${lv})};`)
        }
      }
      return
    }

    // **Sin fórmula cerrada para pgfplots** (ME-45): función-de-datos (`fromData`) o que **referencia**
    // una función-de-datos (`f2 = f1(x)+1`) → se emite por **coordenadas** muestreando su evaluador.
    if (fn.fromData || exprRefsFunction(fn.expr)) {
      const ev = funcEvaluator(spec, fn)
      const dd = fromDataDomain(spec, fn) ?? fn.domain ?? spec.domain
      if (ev) {
        const coords: string[] = []
        for (let k = 0; k <= 160; k += 1) {
          const x = dd[0] + ((dd[1] - dd[0]) * k) / 160
          const y = ev(x)
          if (Number.isFinite(y)) coords.push(`(${num6(x)},${num6(y)})`)
        }
        if (coords.length >= 2) {
          plots.push(`\\addplot[smooth, color=${color}${styleOpt.length ? ', ' + styleOpt.join(', ') : ''}] coordinates {${coords.join(' ')}};`)
          if (spec.legend) plots.push(`\\addlegendentry{${fn.legend ? escapeLabel(fn.legend) : fn.fromData ? 'datos' : `$${compileExprToLatex(fn.expr) ?? escapeLatex(fn.expr)}$`}}`)
        }
      }
      return
    }

    const expr = compileExprToPgfplots(fn.expr)
    if (!expr) return // expresión inválida → se omite (el editor la marca)
    const o = ['smooth', `color=${color}`, ...styleOpt]
    const [mfrom, mto] = fn.domain ?? spec.domain
    if (fn.domain) o.push(`domain=${fn.domain[0]}:${fn.domain[1]}`) // curva restringida (a trozos)
    if (namedPaths.has(i)) o.push(`name path=matexf${i}`)
    plots.push(`\\addplot[${o.join(', ')}] ${fnPlotBody(fn.expr, expr, syntax, mfrom, mto)};`)
    if (spec.legend) {
      // Leyenda: la custom si la hay; si no, la **fórmula automática** en math.
      const auto = compileExprToLatex(fn.expr)
      plots.push(`\\addlegendentry{${fn.legend ? escapeLabel(fn.legend) : auto ? `$${auto}$` : escapeLatex(fn.expr)}}`)
    }
  })
  // Áreas **entre** curvas (fillbetween): después de las paths; translúcidas sobre las curvas.
  for (const area of spec.areas ?? []) {
    if (area.toFn == null || area.riemann || !drawable(area.fn) || !drawable(area.toFn)) continue
    const fn = spec.functions[area.fn]!
    plots.push(
      `\\addplot[${areaFill(area.pattern, resolvePlotStyle({ color: fn.color, role: fn.role, index: area.fn }).color.pgf)}, forget plot] fill between[of=matexf${area.fn} and matexf${area.toFn}, soft clip={domain=${area.from}:${area.to}}];`,
    )
    if (area.showValue) {
      const info = areaInfo(spec, area)
      if (info) plots.push(`\\node[font=\\footnotesize, inner sep=1.5pt, fill=white, fill opacity=0.6, text opacity=1${labelShift(area.labelPos)}] at (axis cs:${num6(info.x)},${num6(info.y)}) {$\\int \\approx ${fmtVal(info.val)}$};`)
    }
  }
  // Series de datos (scatter): marcas y, opcional, línea. Color tras las funciones.
  ;(spec.data ?? []).forEach((s, i) => {
    if (s.disabled || s.points.length === 0) return
    const seff = resolvePlotStyle({ color: s.color, style: s.style, width: s.width, index: spec.functions.length + i })
    const color = seff.color.pgf
    const coords = s.points.map(([x, y]) => `(${num6(x)},${num6(y)})`).join(' ')
    const mark = s.open ? 'o' : '*'
    const dashOpt = dashWidthOpt(seff)
    if (s.interpolate) {
      // Curva interpolada/ajustada (computada en JS → coordenadas) + las marcas de los datos.
      const { curve } = interpolateSeries(s.points, s.interpolate, { degree: s.interpDegree, closed: s.closed })
      if (curve.length >= 2) plots.push(`\\addplot[color=${color}${dashOpt}, forget plot] coordinates {${curve.map(([x, y]) => `(${num6(x)},${num6(y)})`).join(' ')}};`)
      plots.push(`\\addplot[only marks, color=${color}, mark=${mark}, mark size=2pt] coordinates {${coords}};`)
    } else if (s.line) {
      plots.push(`\\addplot[smooth, color=${color}${dashOpt}, mark=${mark}, mark size=1.5pt] coordinates {${coords}};`)
    } else {
      plots.push(`\\addplot[only marks, color=${color}, mark=${mark}, mark size=2pt] coordinates {${coords}};`)
    }
    if (spec.legend) plots.push(`\\addlegendentry{${s.legend ? escapeLabel(s.legend) : 'datos'}}`)
  })
  // Curvas paramétricas (x(t), y(t)): mismas radianes; color tras funciones+datos.
  ;(spec.parametrics ?? []).forEach((p, i) => {
    if (p.disabled) return
    const xt = compileExprToPgfplots(p.x, 't')
    const yt = compileExprToPgfplots(p.y, 't')
    if (xt == null || yt == null) return
    const eff = resolvePlotStyle({ color: p.color, style: p.style, width: p.width, index: spec.functions.length + (spec.data?.length ?? 0) + i })
    const color = eff.color.pgf
    const styleOpt = dashWidthOpt(eff)
    // `variable=t`: sin esto pgfmath no conoce `t` en las expresiones.
    plots.push(`\\addplot[parametric, variable=t, smooth, samples=${sampleN}, domain=${num6(p.tmin)}:${num6(p.tmax)}, color=${color}${styleOpt}] ({${xt}}, {${yt}});`)
    if (spec.legend) {
      const lx = compileExprToLatex(p.x, 'both', 't')
      const ly = compileExprToLatex(p.y, 'both', 't')
      plots.push(`\\addlegendentry{${p.legend ? escapeLabel(p.legend) : lx && ly ? `$(${lx},\\, ${ly})$` : 'paramétrica'}}`)
    }
  })
  // Curvas polares r(θ): se emiten como la paramétrica (r·cos t, r·sin t) sobre el cartesiano.
  ;(spec.polars ?? []).forEach((p, i) => {
    if (p.disabled) return
    const rt = compileExprToPgfplots(p.r, 't')
    if (rt == null) return
    const idx = spec.functions.length + (spec.data?.length ?? 0) + (spec.parametrics?.length ?? 0) + i
    const eff = resolvePlotStyle({ color: p.color, style: p.style, width: p.width, index: idx })
    const color = eff.color.pgf
    const styleOpt = dashWidthOpt(eff)
    plots.push(
      `\\addplot[parametric, variable=t, smooth, samples=${sampleN}, domain=${num6(p.tmin)}:${num6(p.tmax)}, color=${color}${styleOpt}] ({(${rt})*cos(t)}, {(${rt})*sin(t)});`,
    )
    if (spec.legend) {
      const lr = compileExprToLatex(p.r, 'both', 't')
      plots.push(`\\addlegendentry{${p.legend ? escapeLabel(p.legend) : lr ? `$r = ${lr}$` : 'polar'}}`)
    }
  })
  // Curvas implícitas F(x,y)=0: se computan (marching squares) y se emiten como polilíneas.
  ;(spec.implicits ?? []).forEach((im, k) => {
    if (im.disabled) return
    const node = parseImplicit(im.equation)
    if (!node) return
    const [ymin, ymax] = spec.range ?? spec.domain
    const polys = implicitCurve(node, { xmin: spec.domain[0], xmax: spec.domain[1], ymin, ymax }, 150)
    if (polys.length === 0) return
    const idx = spec.functions.length + (spec.data?.length ?? 0) + (spec.parametrics?.length ?? 0) + (spec.polars?.length ?? 0) + k
    const eff = resolvePlotStyle({ color: im.color, style: im.style, width: im.width, index: idx })
    const color = eff.color.pgf
    const styleOpt = dashWidthOpt(eff)
    polys.forEach((poly, pi) => {
      const coords = poly.map(([x, y]) => `(${num6(x)},${num6(y)})`).join(' ')
      plots.push(`\\addplot[smooth, color=${color}${styleOpt}${pi > 0 ? ', forget plot' : ''}] coordinates {${coords}};`)
    })
    if (spec.legend) plots.push(`\\addlegendentry{${im.legend ? escapeLabel(im.legend) : `$${im.equation}$`}}`)
  })
  // Cónicas semánticas (ME-42): se emiten como polilíneas (coordenadas), como las implícitas.
  ;(spec.conics ?? []).forEach((cn, k) => {
    if (cn.disabled) return
    const idx = spec.functions.length + (spec.data?.length ?? 0) + (spec.parametrics?.length ?? 0) + (spec.polars?.length ?? 0) + (spec.implicits?.length ?? 0) + k
    const eff = resolvePlotStyle({ color: cn.color, style: cn.style, width: cn.width, index: idx })
    const styleOpt = dashWidthOpt(eff)
    conicCurve(cn).forEach((poly, pi) => {
      if (poly.length < 2) return
      const coords = poly.map(([x, y]) => `(${num6(x)},${num6(y)})`).join(' ')
      plots.push(`\\addplot[color=${eff.color.pgf}${styleOpt}${pi > 0 ? ', forget plot' : ''}] coordinates {${coords}};`)
    })
    if (spec.legend) plots.push(`\\addlegendentry{${cn.legend ? escapeLabel(cn.legend) : conicLabel(cn)}}`)
  })
  // Rectas tangentes: pendiente numérica f'(at) → `y = f(at) + m(x−at)` + punto de tangencia.
  for (const t of spec.tangents ?? []) {
    const fn = spec.functions[t.fn]
    if (!fn || fn.disabled) continue
    // Evaluador por `expr`/`fromData` (funcEvaluator) o por rama (partida).
    let ev = funcEvaluator(spec, fn)
    if (!ev) {
      const src = exprAtX(fn, t.at)
      ev = src != null ? (x: number): number => evalExprAt(src, x) ?? Number.NaN : null
    }
    if (!ev) continue
    // y en el punto: si el borde del dominio da no-finito, se aproxima desde el lado definido.
    let y0 = ev(t.at)
    if (!Number.isFinite(y0)) {
      const near = [ev(t.at - 1e-4), ev(t.at + 1e-4)].find((v) => Number.isFinite(v))
      if (near == null) continue
      y0 = near
    }
    // Pendiente robusta: vertical ⟺ diverge al achicar h (propiedad de la función, no de la ventana).
    const { m, vertical } = tangentSlope(ev, t.at, y0)
    const color = resolvePlotStyle({ color: fn.color, role: fn.role, index: t.fn }).color.pgf
    if (vertical) {
      plots.push(`\\draw[dashed, thick, color=${color}] ({axis cs:${num6(t.at)},0} |- {rel axis cs:0,0}) -- ({axis cs:${num6(t.at)},0} |- {rel axis cs:0,1});`)
    } else {
      plots.push(`\\addplot[dashed, thick, color=${color}, forget plot] {(${num6(y0)}) + (${num6(m)})*(x - (${num6(t.at)}))};`)
    }
    plots.push(`\\addplot[only marks, mark=*, mark size=1.5pt, black, forget plot] coordinates {(${num6(t.at)}, ${num6(y0)})};`)
    // Rótulo: el custom y/o el valor de la pendiente f'(x₀) (la derivada), si se pide.
    const parts2 = [t.label ? escapeLabel(t.label) : '', t.showValue ? (vertical ? `$f'(${num6(t.at)}) \\to \\infty$` : `$f'(${num6(t.at)}) \\approx ${fmtVal(m)}$`) : ''].filter(Boolean)
    if (parts2.length > 0) plots.push(`\\node[anchor=south west, font=\\footnotesize, inner sep=2pt${labelShift(t.labelPos)}] at (axis cs:${num6(t.at)},${num6(y0)}) {${parts2.join('\\ ')}};`)
  }
  // Puntos marcados encima de las curvas (`o` = hueco/valor no incluido, `*` = lleno).
  // Si el punto está anclado a una función (`fn`), su `y` se computa `= f(x)` (ignora la almacenada).
  for (const p of spec.points ?? []) {
    let anchored = false
    let py = p.y
    if (p.fn != null) {
      const fn = spec.functions[p.fn]
      const src = fn && !fn.disabled ? exprAtX(fn, p.x) : null
      const v = src != null ? evalExprAt(src, p.x) : null
      if (v != null && Number.isFinite(v)) {
        py = v
        anchored = true
      }
    }
    const [px, pv] = anchored ? [num6(p.x), num6(py)] : [String(p.x), String(p.y)]
    plots.push(`\\addplot[only marks, mark=${p.open ? 'o' : '*'}, mark size=1.5pt, black, forget plot] coordinates {(${px}, ${pv})};`)
    if (p.label) plots.push(`\\node[anchor=south west, font=\\footnotesize, inner sep=2pt] at (axis cs:${px},${pv}) {${escapeLabel(p.label)}};`)
  }
  // Rasgos notables **auto-detectados** (ME-39): raíces / extremos / inflexiones (numérico, mismo
  // cálculo que el SVG → "lo que se ve = lo que compila"). Marca ● (inflexión ○) + rótulo máx/mín.
  spec.functions.forEach((fn, i) => {
    if (fn.disabled || (fn.pieces && fn.pieces.length > 0)) return
    if (!fn.markRoots && !fn.markExtrema && !fn.markInflections && !fn.markYIntercept) return
    const ev = funcEvaluator(spec, fn)
    if (!ev) return
    const color = resolvePlotStyle({ color: fn.color, role: fn.role, index: i }).color.pgf
    for (const ft of detectFeatures(ev, fromDataDomain(spec, fn) ?? fn.domain ?? spec.domain, { roots: fn.markRoots, extrema: fn.markExtrema, inflections: fn.markInflections, yIntercept: fn.markYIntercept })) {
      const mark = ft.kind === 'inflection' ? 'o' : '*'
      plots.push(`\\addplot[only marks, mark=${mark}, mark size=1.6pt, color=${color}, forget plot] coordinates {(${num6(ft.x)}, ${num6(ft.y)})};`)
      const name = ft.kind === 'max' ? 'm\\\'ax' : ft.kind === 'min' ? 'm\\\'in' : ft.kind === 'inflection' ? 'infl' : ft.kind === 'yintercept' ? 'ord.' : ''
      const coord = fn.featureCoords ? `$(${fmtVal(ft.x)},\\, ${fmtVal(ft.y)})$` : ''
      const lbl = [name, coord].filter(Boolean).join('\\ ')
      if (lbl) plots.push(`\\node[anchor=south west, font=\\scriptsize, inner sep=2pt] at (axis cs:${num6(ft.x)},${num6(ft.y)}) {${lbl}};`)
    }
  })
  // Asíntotas auto-detectadas (ME-39): rectas **gris punteadas** (verticales, horizontales u oblicuas).
  spec.functions.forEach((fn) => {
    if (fn.disabled || !fn.markAsymptotes || (fn.pieces && fn.pieces.length > 0)) return
    const ev = funcEvaluator(spec, fn)
    if (!ev) return
    for (const a of detectAsymptotes(ev, fromDataDomain(spec, fn) ?? fn.domain ?? spec.domain)) {
      if (a.kind === 'vertical' && a.at != null) {
        plots.push(`\\draw[dashed, gray] ({axis cs:${num6(a.at)},0} |- {rel axis cs:0,0}) -- ({axis cs:${num6(a.at)},0} |- {rel axis cs:0,1});`)
        if (fn.featureCoords) plots.push(`\\node[anchor=north west, font=\\scriptsize, gray, inner sep=2pt] at ({axis cs:${num6(a.at)},0} |- {rel axis cs:0,1}) {$x = ${fmtVal(a.at)}$};`)
      } else if (a.m != null && a.b != null) {
        plots.push(`\\addplot[dashed, gray, forget plot] {(${num6(a.m)})*x + (${num6(a.b)})};`)
        if (fn.featureCoords) plots.push(`\\node[anchor=south east, font=\\scriptsize, gray, inner sep=2pt] at ({rel axis cs:1,0} |- {axis cs:0,${num6(a.m * spec.domain[1] + a.b)}}) {$${asymptoteEqLatex(a.m, a.b)}$};`)
      }
    }
  })
  // Intersecciones de curvas: puntos calculados en JS (polilíneas → segmentos) → marcas.
  ;(spec.intersections ?? []).forEach((inter) => {
    if (inter.disabled) return
    const [iy0, iy1] = spec.range ?? spec.domain
    const pts = intersectionPoints(spec, inter.a, inter.b, { xmin: spec.domain[0], xmax: spec.domain[1], ymin: iy0, ymax: iy1 })
    if (pts.length === 0) return
    const color = inter.color ? resolvePlotColor(inter.color, 0).pgf : 'black'
    const coords = pts.map(([x, y]) => `(${num6(x)},${num6(y)})`).join(' ')
    plots.push(`\\addplot[only marks, mark=*, mark size=2pt, color=${color}, forget plot] coordinates {${coords}};`)
    if (inter.label) {
      const [lx, ly] = pts[0]!
      plots.push(`\\node[anchor=south west, font=\\footnotesize, inner sep=2pt] at (axis cs:${num6(lx)},${num6(ly)}) {${escapeLabel(inter.label)}};`)
    }
    if (inter.showCoords) {
      const fmt = (n: number): string => String(Number(n.toFixed(2)))
      for (const [x, y] of pts) {
        plots.push(`\\node[anchor=north west, font=\\scriptsize, inner sep=1.5pt] at (axis cs:${num6(x)},${num6(y)}) {$(${fmt(x)},\\, ${fmt(y)})$};`)
      }
    }
  })
  // Textos libres anotados en (x, y).
  for (const t of spec.texts ?? []) {
    if (!t.text.trim()) continue
    plots.push(`\\node[font=\\footnotesize, inner sep=2pt] at (axis cs:${num6(t.x)},${num6(t.y)}) {${escapeLabel(t.text)}};`)
  }
  return [
    '\\begin{tikzpicture}',
    `\\begin{axis}[${opts.join(', ')}]`,
    ...plots.map((p) => `  ${p}`),
    '\\end{axis}',
    '\\end{tikzpicture}',
  ].join('\n')
}
