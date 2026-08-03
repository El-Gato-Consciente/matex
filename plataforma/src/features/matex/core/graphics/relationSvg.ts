import { evalExpr, exprMathMLBody, wrapMathML, parseExpr, parseExprVars, tangentSlope } from '../plotExpr'
import { resolvePlotColor } from '../plotColors'
import { resolvePlotStyle } from '../plotTheme'
import { detectFeatures, detectAsymptotes } from './features'
import { interpolateSeries } from './interpolate'
import { conicCurve } from './conic'
import { funcEvaluator, fromDataDomain } from './funcEval'
import { resolvePlotFunctions } from './functionRefs'
import { resolvePlotParameters, substituteParamsInExpr } from './parameters'
import { implicitCurve, parseImplicit } from './implicit'
import { intersectionPoints } from './intersect'
import { svgTag, escapeXml } from './svg'
import type { AreaPattern, PlotSpec } from '../ast'

type Pt = { x: number; y: number }
/** Tramo dibujable de una función: su AST ya parseado y el intervalo `[from,to]` recortado a la ventana. */
type DrawSeg = { evalAt: (x: number) => number; from: number; to: number }

/** Valor numérico con 2 decimales, sin ceros de más (para rótulos de área/derivada). */
const fmt2 = (n: number): string => String(Number(n.toFixed(2)))
/** Desplazamiento vertical (px de pantalla) del rótulo de valor según `labelPos` (ME-34): `above`
 *  lo sube, `below` lo baja, `auto` usa el offset por defecto de cada anotación. */
const labelDy = (pos: 'auto' | 'above' | 'below' | undefined, autoDy: number): number => (pos === 'above' ? -16 : pos === 'below' ? 16 : autoDy)

/** Número para rótulos de rasgos: 2 decimales, con el signo menos tipográfico `−`. */
const featNum = (n: number): string => fmt2(n).replace('-', '−')

/** Ecuación de una asíntota horizontal/oblicua `y = m·x + b` en forma legible (`y = x`, `y = 2`, `y = −0.5x + 3`).
 *  Redondea a 2 decimales **antes** de comparar → un `b`≈0.001 no imprime "+ 0". */
const asyEq = (m0: number, b0: number): string => {
  const m = Math.round(m0 * 100) / 100
  const b = Math.round(b0 * 100) / 100
  if (m === 0) return `y = ${featNum(b)}`
  const mp = m === 1 ? 'x' : m === -1 ? '−x' : `${featNum(m)}x`
  const bp = b === 0 ? '' : b > 0 ? ` + ${featNum(b)}` : ` − ${featNum(-b)}`
  return `y = ${mp}${bp}`
}

/** Definición `<pattern>` SVG para la textura de un área (líneas/crosshatch/puntos/grilla/…). */
function svgAreaPatternDef(id: string, type: Exclude<AreaPattern, 'solid'>, color: string): string {
  const s = `stroke="${color}" stroke-width="0.8" fill="none"`
  const inner =
    type === 'lines'
      ? `<path d="M0 6 L6 0" ${s}/>`
      : type === 'lines-alt'
        ? `<path d="M0 0 L6 6" ${s}/>`
        : type === 'crosshatch'
          ? `<path d="M0 6 L6 0 M0 0 L6 6" ${s}/>`
          : type === 'grid'
            ? `<path d="M0 0 H6 M0 0 V6" ${s}/>`
            : type === 'horizontal'
              ? `<path d="M0 3 H6" ${s}/>`
              : type === 'vertical'
                ? `<path d="M3 0 V6" ${s}/>`
                : `<circle cx="1.5" cy="1.5" r="0.9" fill="${color}"/>`
  return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse">${inner}</pattern>`
}

/**
 * **Preview del gráfico (familia A4)** = el "backend web" **puro** de la misma `PlotSpec` que
 * `relation.ts` compila a pgfplots. Evalúa cada `f(x)` (con `evalExpr`) sobre el dominio y arma un
 * `<svg>` como **string** (sin DOM → vive en `core/`, testeable sin jsdom; el editor inyecta el
 * markup). Corta el trazo en discontinuidades/asíntotas (valores no finitos o muy fuera de rango)
 * para no dibujar líneas verticales espurias. Par LaTeX: `core/graphics/relation.ts`.
 */

/** `stroke-dasharray` según el estilo de trazo (o `undefined` = trazo continuo). */
const dash = (style: string | undefined): string | undefined =>
  style === 'dashed' ? '6 3' : style === 'dotted' ? '1.5 3' : undefined

/** **Dimensiones del viewBox** del SVG del gráfico (fuente única): ancho, alto y padding
 *  interno. Las comparte el builder del SVG y el controlador interactivo del HTML (hover/coords). */
export const PLOT_VIEW = { w: 340, h: 220, pad: 8 } as const

const PW = PLOT_VIEW.w
const PH = PLOT_VIEW.h
const PPAD = PLOT_VIEW.pad

/** Rango Y automático (con 8% de margen) a partir de valores finitos; `[-1,1]` si no hay. */
function autoRangeFrom(ys: readonly number[]): [number, number] {
  const f = ys.filter((y) => Number.isFinite(y))
  let ymin = f.length ? Math.min(...f) : -1
  let ymax = f.length ? Math.max(...f) : 1
  if (ymin === ymax) {
    ymin -= 1
    ymax += 1
  }
  const m = (ymax - ymin) * 0.08
  return [ymin - m, ymax + m]
}
/** Expande la ventana para que la escala px/unidad sea igual en x e y (como `axis equal image`). */
export function equalAxesExpand(xmin: number, xmax: number, ymin: number, ymax: number): PlotView {
  const availW = PW - 2 * PPAD
  const availH = PH - 2 * PPAD
  const s = Math.min(availW / (xmax - xmin || 1), availH / (ymax - ymin || 1))
  const showX = availW / s
  const showY = availH / s
  const xc = (xmin + xmax) / 2
  const yc = (ymin + ymax) / 2
  return { xmin: xc - showX / 2, xmax: xc + showX / 2, ymin: yc - showY / 2, ymax: yc + showY / 2 }
}
/** Marcas "lindas" (pasos 1/2/5·10^k) dentro de `[lo, hi]` — aproxima el algoritmo de pgfplots. */
function niceTicks(lo: number, hi: number, target = 6): number[] {
  const span = hi - lo
  if (!(span > 0)) return []
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(t)
  return out
}

/** Valores `y` finitos muestreados de funciones/paramétricas/polares (para el rango auto). */
function sampleFiniteYs(spec: PlotSpec, xmin: number, xmax: number): number[] {
  const ys: number[] = []
  const N = 100
  for (const f of spec.functions) {
    if (f.disabled) continue
    const srcs = f.pieces && f.pieces.length > 0 ? f.pieces.map((p) => p.expr) : [f.expr]
    for (const src of srcs) {
      const r = parseExpr(src)
      if (!r.ok) continue
      for (let k = 0; k <= N; k += 1) {
        const y = evalExpr(r.node, xmin + ((xmax - xmin) * k) / N)
        if (Number.isFinite(y)) ys.push(y)
      }
    }
  }
  for (const p of spec.parametrics ?? []) {
    if (p.disabled) continue
    const ry = parseExpr(p.y, 'both', 't')
    if (!ry.ok) continue
    for (let k = 0; k <= N; k += 1) {
      const y = evalExpr(ry.node, p.tmin + ((p.tmax - p.tmin) * k) / N)
      if (Number.isFinite(y)) ys.push(y)
    }
  }
  for (const p of spec.polars ?? []) {
    if (p.disabled) continue
    const rr = parseExpr(p.r, 'both', 't')
    if (!rr.ok) continue
    for (let k = 0; k <= N; k += 1) {
      const t = p.tmin + ((p.tmax - p.tmin) * k) / N
      const y = evalExpr(rr.node, t) * Math.sin(t)
      if (Number.isFinite(y)) ys.push(y)
    }
  }
  return ys
}

/**
 * **Ventana efectivamente mostrada** por `plotToSvg` (dominio en x; rango dado o auto en y; con
 * `equalAxes` expandida). La usa el editor para que el zoom/pan **arranque desde lo que se ve**
 * (sin saltos) y para "fijar la vista". Con una `view` explícita, esa es la ventana.
 */
export function plotDisplayWindow(specIn: PlotSpec, view?: PlotView): PlotView {
  if (view) return view
  const specP = resolvePlotParameters(specIn)
  const spec = { ...specP, functions: resolvePlotFunctions(specP.functions) }
  const [xmin, xmax] = spec.domain
  const [ymin, ymax] = spec.range ?? autoRangeFrom(sampleFiniteYs(spec, xmin, xmax))
  return spec.equalAxes ? equalAxesExpand(xmin, xmax, ymin, ymax) : { xmin, xmax, ymin, ymax }
}

/**
 * `y = f(x)` de cada función **no oculta** en `x` — para el **tooltip de hover** (ME-43), en el editor
 * y en el HTML (vía runtime). Resuelve parámetros y referencias `f1` igual que el render, y respeta el
 * dominio propio de cada curva. Puro; el que llama elige la más cercana al cursor y la formatea.
 */
export function plotValuesAt(specIn: PlotSpec, x: number): { index: number; y: number }[] {
  const specP = resolvePlotParameters(specIn)
  const spec = { ...specP, functions: resolvePlotFunctions(specP.functions) }
  const out: { index: number; y: number }[] = []
  spec.functions.forEach((f, i) => {
    if (f.disabled) return
    // Fuera del dominio (propio o de los datos si es `fromData`) no hay valor.
    const dd = f.fromData ? fromDataDomain(spec, f) : f.domain
    if (dd && (x < dd[0] || x > dd[1])) return
    let ev: ((x: number) => number) | null = funcEvaluator(spec, f)
    if (!ev && f.pieces && f.pieces.length > 0) {
      const src = f.pieces.find((pc) => x >= Math.min(pc.from, pc.to) && x <= Math.max(pc.from, pc.to))?.expr
      const r = src != null ? parseExpr(src) : null
      ev = r && r.ok ? (xx: number): number => evalExpr(r.node, xx) : null
    }
    if (!ev) return
    const y = ev(x)
    if (Number.isFinite(y)) out.push({ index: i, y })
  })
  return out
}

/**
 * **Leyenda de rasgos (ME-43):** panel que lista los rasgos auto-detectados (raíces, extremos,
 * inflexiones, asíntotas) con sus coordenadas/ecuaciones, por función — alternativa a rotularlos
 * *sobre* el gráfico cuando satura. Overlay HTML (editor + HTML); en el HTML se recomputa en vivo con
 * los sliders vía el runtime. `''` si no hay ninguna función con marcas.
 */
export function plotFeatureLegendHtml(specIn: PlotSpec): string {
  const specP = resolvePlotParameters(specIn)
  const spec = { ...specP, functions: resolvePlotFunctions(specP.functions) }
  const blocks: string[] = []
  spec.functions.forEach((f, i) => {
    if (f.disabled || (f.pieces && f.pieces.length > 0)) return
    if (!f.markRoots && !f.markExtrema && !f.markInflections && !f.markAsymptotes && !f.markYIntercept) return
    const ev = funcEvaluator(spec, f)
    if (!ev) return
    const dom = fromDataDomain(spec, f) ?? f.domain ?? spec.domain
    const feats = detectFeatures(ev, dom, { roots: f.markRoots, extrema: f.markExtrema, inflections: f.markInflections, yIntercept: f.markYIntercept })
    const items: string[] = []
    const pt = (t: { x: number; y: number }): string => `(${featNum(t.x)}, ${featNum(t.y)})`
    const roots = feats.filter((t) => t.kind === 'root')
    if (roots.length) items.push(`raíces: x = ${roots.map((t) => featNum(t.x)).join(', ')}`)
    const yint = feats.find((t) => t.kind === 'yintercept')
    if (yint) items.push(`ord. origen: (0, ${featNum(yint.y)})`)
    const maxs = feats.filter((t) => t.kind === 'max')
    if (maxs.length) items.push(`máx: ${maxs.map(pt).join(', ')}`)
    const mins = feats.filter((t) => t.kind === 'min')
    if (mins.length) items.push(`mín: ${mins.map(pt).join(', ')}`)
    const infs = feats.filter((t) => t.kind === 'inflection')
    if (infs.length) items.push(`inflex.: ${infs.map(pt).join(', ')}`)
    if (f.markAsymptotes) {
      const eqs = detectAsymptotes(ev, dom).map((a) => (a.kind === 'vertical' ? `x = ${featNum(a.at!)}` : asyEq(a.m!, a.b!)))
      if (eqs.length) items.push(`asíntotas: ${eqs.join(', ')}`)
    }
    if (items.length === 0) return
    const color = resolvePlotStyle({ color: f.color, role: f.role, index: i }).color.hex
    blocks.push(
      `<div class="mx-featleg-fn"><span class="mx-featleg-sw" style="background:${color}"></span><div class="mx-featleg-items">${items.map((s) => `<span>${escapeXml(s)}</span>`).join('')}</div></div>`,
    )
  })
  return blocks.length > 0 ? `<div class="mx-featleg">${blocks.join('')}</div>` : ''
}

/**
 * Ventana **interactiva** opcional para el preview (zoom/pan): reemplaza `domain`/`range` y
 * desactiva `equalAxes`/auto-rango (la vista **es** la ventana explícita). No toca el AST; al
 * "fijar la vista" el editor la escribe en `domain`/`range` para que el PDF coincida.
 */
export interface PlotView {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}

/**
 * **Texto alternativo (ME-43, accesibilidad).** Descripción legible del gráfico para lectores de
 * pantalla (`aria-label` + `<title>` del SVG): título, funciones con sus fórmulas y rasgos marcados,
 * otras familias de curvas y el dominio. Se arma del spec **original** (parámetros como letras).
 */
export function plotAltText(spec: PlotSpec): string {
  const out: string[] = [spec.title?.trim() ? `Gráfico «${spec.title.trim()}»` : 'Gráfico de funciones']
  const fnDesc: string[] = []
  spec.functions.forEach((f, i) => {
    if (f.disabled) return
    const body = f.fromData ? `f${i + 1} = interpolación de una serie de datos` : f.pieces && f.pieces.length > 0 ? `f${i + 1} = función a trozos` : `f${i + 1}(x) = ${f.expr}`
    const marks = [f.markRoots ? 'raíces' : '', f.markExtrema ? 'extremos' : '', f.markInflections ? 'inflexiones' : '', f.markAsymptotes ? 'asíntotas' : '', f.markYIntercept ? 'ordenada al origen' : ''].filter(Boolean)
    fnDesc.push(marks.length > 0 ? `${body} (marca ${marks.join(', ')})` : body)
  })
  if (fnDesc.length > 0) out.push(fnDesc.join('; '))
  const extra = [
    spec.implicits?.length ? `${spec.implicits.length} curva(s) implícita(s)` : '',
    spec.parametrics?.length ? `${spec.parametrics.length} curva(s) paramétrica(s)` : '',
    spec.polars?.length ? `${spec.polars.length} curva(s) polar(es)` : '',
    spec.conics?.length ? `${spec.conics.length} cónica(s)` : '',
    spec.data?.length ? `${spec.data.length} serie(s) de datos` : '',
  ].filter(Boolean)
  if (extra.length > 0) out.push(extra.join(', '))
  out.push(`Dominio x de ${spec.domain[0]} a ${spec.domain[1]}`)
  return `${out.join('. ')}.`
}

export function plotToSvg(specIn: PlotSpec, view?: PlotView): string {
  // Parámetros → valor, luego referencias entre funciones (`f1(x)+1`), antes de evaluar.
  const specP = resolvePlotParameters(specIn)
  const spec = { ...specP, functions: resolvePlotFunctions(specP.functions) }
  const W = PLOT_VIEW.w
  const H = PLOT_VIEW.h
  const pad = PLOT_VIEW.pad
  const [xmin, xmax] = view ? [view.xmin, view.xmax] : spec.domain
  const N = 240

  const sampleRange = (evalAt: (x: number) => number, lo: number, hi: number): Pt[] => {
    if (hi <= lo) return []
    const pts: Pt[] = []
    for (let k = 0; k <= N; k += 1) {
      const x = lo + ((hi - lo) * k) / N
      pts.push({ x, y: evalAt(x) })
    }
    return pts
  }

  // Evaluador `f(x)` por función (por `expr` o por `fromData`; null si partida/deshabilitada/inválida).
  const evals = spec.functions.map((f) => funcEvaluator(spec, f))
  // Segmentos **dibujables** por función: (evaluador, [from,to]) recortado a la ventana. 1 si es simple
  // (con su dominio o el rango de datos si es `fromData`); N si es partida. Se remuestrea adaptativo.
  const funcSegs: DrawSeg[][] = spec.functions.map((f, i) => {
    if (f.disabled) return []
    if (f.pieces && f.pieces.length > 0) {
      return f.pieces
        .map((pc): DrawSeg | null => {
          const r = parseExpr(pc.expr)
          return r.ok ? { evalAt: (x: number) => evalExpr(r.node, x), from: Math.max(xmin, pc.from), to: Math.min(xmax, pc.to) } : null
        })
        .filter((s): s is DrawSeg => s != null && s.to > s.from)
    }
    const ev = evals[i]
    if (!ev) return []
    const dd = f.fromData ? fromDataDomain(spec, f) : f.domain ?? null
    const from = dd ? Math.max(xmin, dd[0]) : xmin
    const to = dd ? Math.min(xmax, dd[1]) : xmax
    return to > from ? [{ evalAt: ev, from, to }] : []
  })
  // Muestreo uniforme (solo para el **autorango** Y): denso pero barato. El trazo real se remuestrea
  // adaptativo más abajo, cuando ya existe la transformación a pantalla.
  const funcCurves: Pt[][][] = funcSegs.map((segs) => segs.map((s) => sampleRange(s.evalAt, s.from, s.to)))

  // Paramétricas y polares: se guardan los nodos + intervalo de `t` (para remuestrear adaptativo al
  // dibujar) y una muestra uniforme para el autorango.
  const paramNodes = (spec.parametrics ?? []).map((p) => {
    if (p.disabled) return null
    const rx = parseExpr(p.x, 'both', 't')
    const ry = parseExpr(p.y, 'both', 't')
    return rx.ok && ry.ok ? { at: (t: number): Pt => ({ x: evalExpr(rx.node, t), y: evalExpr(ry.node, t) }), tmin: p.tmin, tmax: p.tmax } : null
  })
  const polarNodes = (spec.polars ?? []).map((p) => {
    if (p.disabled) return null
    const rr = parseExpr(p.r, 'both', 't')
    return rr.ok
      ? { at: (t: number): Pt => { const r = evalExpr(rr.node, t); return { x: r * Math.cos(t), y: r * Math.sin(t) } }, tmin: p.tmin, tmax: p.tmax }
      : null
  })
  const sampleParam = (n: { at: (t: number) => Pt; tmin: number; tmax: number } | null, M: number): Pt[] => {
    if (!n) return []
    const pts: Pt[] = []
    for (let k = 0; k <= M; k += 1) pts.push(n.at(n.tmin + ((n.tmax - n.tmin) * k) / M))
    return pts
  }
  const paramCurves: Pt[][] = paramNodes.map((n) => sampleParam(n, 200))
  const polarCurves: Pt[][] = polarNodes.map((n) => sampleParam(n, 240))

  // Rango Y: la vista interactiva, el dado, o automático a partir de los valores finitos.
  let ymin: number
  let ymax: number
  if (view) {
    ymin = view.ymin
    ymax = view.ymax
  } else if (spec.range) {
    ;[ymin, ymax] = spec.range
  } else {
    ;[ymin, ymax] = autoRangeFrom([...funcCurves.flat(2), ...paramCurves.flat(), ...polarCurves.flat()].map((p) => p.y))
  }

  // Ventana **mostrada**. Con `equalAxes`, se expande el eje con más lugar para que la
  // escala px/unidad sea la misma en x e y (círculos redondos), como `axis equal image`.
  let dxmin = xmin
  let dxmax = xmax
  let dymin = ymin
  let dymax = ymax
  if (spec.equalAxes && !view) {
    ;({ xmin: dxmin, xmax: dxmax, ymin: dymin, ymax: dymax } = equalAxesExpand(xmin, xmax, ymin, ymax))
  }

  const sx = (x: number): number => pad + ((x - dxmin) / (dxmax - dxmin)) * (W - 2 * pad)
  const sy = (y: number): number => H - pad - ((y - dymin) / (dymax - dymin)) * (H - 2 * pad)
  // Viewport para computar implícitas/intersecciones: la vista si hay zoom/pan, si no la ventana del spec.
  const curveVp = view ?? {
    xmin: spec.domain[0],
    xmax: spec.domain[1],
    ymin: (spec.range ?? spec.domain)[0],
    ymax: (spec.range ?? spec.domain)[1],
  }

  // Muestreo **adaptativo** en espacio de pantalla: parte de una grilla base y subdivide cada
  // segmento mientras el punto medio se aparte de la cuerda más de `TOL` px (o hasta `MAXD` niveles).
  // Da trazos suaves a cualquier zoom sin sobre-muestrear los tramos rectos; junto a asíntotas o
  // discontinuidades refina para ajustar el corte. Vale para f(x), paramétricas y polares.
  const TOL = 0.3
  const MAXD = 7
  const BASE = 80
  const finite = (p: Pt): boolean => Number.isFinite(p.x) && Number.isFinite(p.y)
  const adaptiveCurve = (P: (t: number) => Pt, lo: number, hi: number): Pt[] => {
    const out: Pt[] = []
    if (hi <= lo) return out
    const rec = (t0: number, p0: Pt, t1: number, p1: Pt, depth: number): void => {
      const tm = (t0 + t1) / 2
      const pm = P(tm)
      let split = depth < MAXD
      if (split) {
        const f0 = finite(p0)
        const f1 = finite(p1)
        const fm = finite(pm)
        if (f0 && f1 && fm) {
          const ax = sx(p0.x)
          const ay = sy(p0.y)
          const dx = sx(p1.x) - ax
          const dy = sy(p1.y) - ay
          const len = Math.hypot(dx, dy) || 1
          split = Math.abs((sx(pm.x) - ax) * dy - (sy(pm.y) - ay) * dx) / len > TOL
        } else {
          split = f0 || f1 || fm // borde de un tramo no-finito: refinar para ajustar el corte
        }
      }
      if (split) {
        rec(t0, p0, tm, pm, depth + 1)
        out.push(pm)
        rec(tm, pm, t1, p1, depth + 1)
      }
    }
    const step = (hi - lo) / BASE
    let pt = lo
    let pp = P(lo)
    out.push(pp)
    for (let k = 1; k <= BASE; k += 1) {
      const t = lo + step * k
      const p = P(t)
      rec(pt, pp, t, p, 0)
      out.push(p)
      pt = t
      pp = p
    }
    return out
  }

  const parts: string[] = []
  const defs: string[] = [] // <pattern> de texturas de área
  let areaPatIdx = 0
  const line = (x1: number, y1: number, x2: number, y2: number, cls: string): void => {
    parts.push(svgTag('line', { x1, y1, x2, y2, class: cls }))
  }
  const text = (x: number, y: number, str: string, anchor: 'start' | 'end'): void => {
    parts.push(svgTag('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': anchor, class: 'matex-plot-label' }, str))
  }

  // Grilla opcional (líneas en enteros dentro del rango, hasta ~10 por eje).
  if (spec.grid) {
    const step = (hi: number, lo: number): number => Math.max(1, Math.ceil((hi - lo) / 10))
    for (let x = Math.ceil(dxmin); x <= dxmax; x += step(dxmax, dxmin)) line(sx(x), pad, sx(x), H - pad, 'matex-plot-grid')
    for (let y = Math.ceil(dymin); y <= dymax; y += step(dymax, dymin)) line(pad, sy(y), W - pad, sy(y), 'matex-plot-grid')
  }
  // Ejes por el origen (si 0 cae en la ventana mostrada).
  if (dymin <= 0 && dymax >= 0) line(pad, sy(0), W - pad, sy(0), 'matex-plot-axis')
  if (dxmin <= 0 && dxmax >= 0) line(sx(0), pad, sx(0), H - pad, 'matex-plot-axis')

  // Marcas del eje x en múltiplos de π/2 (funciones trigonométricas).
  if (spec.piTicks) {
    const half = Math.PI / 2
    const y0 = dymin <= 0 && dymax >= 0 ? sy(0) : H - pad
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    const label = (k: number): string => {
      if (k === 0) return '0'
      const g = gcd(Math.abs(k), 2)
      const a = Math.abs(k / g)
      const coef = a === 1 ? 'π' : `${a}π`
      return `${k < 0 ? '−' : ''}${2 / g === 1 ? coef : `${coef}/2`}`
    }
    for (let k = Math.ceil(dxmin / half); k <= Math.floor(dxmax / half); k += 1) {
      if (k === 0) continue
      const X = sx(k * half)
      line(X, y0 - 3, X, y0 + 3, 'matex-plot-axis')
      text(X, y0 + 13, label(k), 'end')
    }
  }

  // Números en los ejes (pasos "lindos", aprox. pgfplots) → coherencia con el PDF. El eje x se
  // omite si hay `piTicks` (ya pone sus marcas de π); ambos se omiten con `hideTicks`.
  if (!spec.hideTicks) {
    const numLbl = (v: number): string => String(Number(v.toFixed(6))).replace('-', '−')
    if (!spec.piTicks) {
      const y0 = dymin <= 0 && dymax >= 0 ? sy(0) : H - pad
      for (const tx of niceTicks(dxmin, dxmax)) {
        if (Math.abs(tx) < 1e-9) continue // el 0 lo comparten ambos ejes
        const X = sx(tx)
        line(X, y0 - 2.5, X, y0 + 2.5, 'matex-plot-axis')
        parts.push(svgTag('text', { x: X.toFixed(1), y: (y0 + 11).toFixed(1), 'text-anchor': 'middle', class: 'matex-plot-tick' }, numLbl(tx)))
      }
    }
    const x0 = dxmin <= 0 && dxmax >= 0 ? sx(0) : pad
    for (const ty of niceTicks(dymin, dymax)) {
      if (Math.abs(ty) < 1e-9) continue
      const Y = sy(ty)
      line(x0 - 2.5, Y, x0 + 2.5, Y, 'matex-plot-axis')
      parts.push(svgTag('text', { x: (x0 - 4).toFixed(1), y: (Y + 3).toFixed(1), 'text-anchor': 'end', class: 'matex-plot-tick' }, numLbl(ty)))
    }
  }

  // Líneas verticales (asíntotas / valores destacados).
  for (const v of spec.vlines ?? []) {
    line(sx(v.x), pad, sx(v.x), H - pad, 'matex-plot-vline')
    if (v.label) text(sx(v.x) - 2, pad + 9, v.label, 'end')
  }
  // Líneas horizontales (asíntotas horizontales / valores destacados).
  for (const h of spec.hlines ?? []) {
    line(pad, sy(h.y), W - pad, sy(h.y), 'matex-plot-vline')
    if (h.label) text(W - pad - 2, sy(h.y) - 2, h.label, 'end')
  }

  // Áreas sombreadas. Bajo la curva (al eje y=0) o **entre** dos curvas (`toFn`). Detrás.
  for (const area of spec.areas ?? []) {
    const node = evals[area.fn]
    if (!node) continue
    const a = Math.min(area.from, area.to)
    const b = Math.max(area.from, area.to)
    // Resolución adaptativa al zoom: ~200 muestras en la parte visible → el borde no se ve recto al acercar.
    const M = Math.max(64, Math.min(2000, Math.ceil((200 * (b - a)) / Math.max(1e-6, dxmax - dxmin))))
    const sample = (g: (x: number) => number): { x: number; y: number }[] => {
      const out: { x: number; y: number }[] = []
      for (let i = 0; i <= M; i += 1) {
        const x = a + ((b - a) * i) / M
        const y = g(x)
        if (Number.isFinite(y)) out.push({ x, y })
      }
      return out
    }
    const top = sample(node)
    if (top.length < 2) continue
    // Borde inferior: la otra curva (área entre) o el eje y=0.
    const other = area.toFn != null ? evals[area.toFn] : null
    const bottom =
      area.toFn != null && other
        ? sample(other).reverse()
        : [{ x: b, y: 0 }, { x: a, y: 0 }]
    if (area.toFn != null && bottom.length < 2) continue
    const pts = [...top, ...bottom].map((p) => `${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
    const areaFn = spec.functions[area.fn]
    const colorHex = resolvePlotStyle({ color: areaFn?.color, role: areaFn?.role, index: area.fn }).color.hex
    let fill = colorHex
    let fillOpacity: string | undefined = '0.2'
    if (area.pattern && area.pattern !== 'solid') {
      const id = `matex-area-${areaPatIdx}`
      areaPatIdx += 1
      defs.push(svgAreaPatternDef(id, area.pattern, colorHex))
      fill = `url(#${id})`
      fillOpacity = undefined
    }
    // Suma de Riemann / trapecios (ME-40c): reemplaza el relleno suave por rectángulos didácticos.
    if (area.riemann) {
      const gBase = area.toFn != null ? other : null
      if (area.toFn != null && !gBase) continue
      const n = Math.max(1, Math.min(200, Math.round(area.riemannN ?? 8)))
      const h = (b - a) / n
      const base = (x: number): number => (gBase ? gBase(x) : 0)
      let sum = 0
      for (let i = 0; i < n; i += 1) {
        const xL = a + i * h
        const xR = xL + h
        let quad: { x: number; y: number }[]
        if (area.riemann === 'trapezoid') {
          const tL = node(xL)
          const tR = node(xR)
          const bL = base(xL)
          const bR = base(xR)
          if (![tL, tR, bL, bR].every((v) => Number.isFinite(v))) continue
          quad = [{ x: xL, y: bL }, { x: xL, y: tL }, { x: xR, y: tR }, { x: xR, y: bR }]
          sum += (((tL - bL) + (tR - bR)) / 2) * h
        } else {
          const xs = area.riemann === 'left' ? xL : area.riemann === 'right' ? xR : (xL + xR) / 2
          const t = node(xs)
          const bs = base(xs)
          if (!Number.isFinite(t) || !Number.isFinite(bs)) continue
          quad = [{ x: xL, y: bs }, { x: xL, y: t }, { x: xR, y: t }, { x: xR, y: bs }]
          sum += (t - bs) * h
        }
        const d = `M${quad.map((p) => `${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' L')} Z`
        parts.push(svgTag('path', { d, fill, 'fill-opacity': fillOpacity, stroke: colorHex, 'stroke-width': '0.6', 'stroke-opacity': '0.7' }))
      }
      if (area.showValue) {
        const midx = (a + b) / 2
        const fm = node(midx)
        const midy = gBase ? (fm + gBase(midx)) / 2 : fm / 2
        if (Number.isFinite(midy)) parts.push(svgTag('text', { x: sx(midx).toFixed(1), y: (sy(midy) + labelDy(area.labelPos, 0)).toFixed(1), 'text-anchor': 'middle', class: 'matex-plot-areaval' }, `Σ≈${fmt2(sum)}`))
      }
      continue
    }
    parts.push(svgTag('path', { d: `M${pts.join(' L')} Z`, fill, 'fill-opacity': fillOpacity, stroke: 'none' }))
    if (area.showValue) {
      // Integral ∫[from,to] (f − g|eje) por trapecios (mismo criterio que el backend LaTeX).
      const g = area.toFn != null ? other : null
      const N = 300
      let val = 0
      let prev: number | null = null
      let ok = true
      for (let k = 0; k <= N; k += 1) {
        const x = area.from + ((area.to - area.from) * k) / N
        let y = node(x)
        if (g) y -= g(x)
        if (!Number.isFinite(y)) {
          ok = false
          break
        }
        if (prev != null) val += ((prev + y) / 2) * ((area.to - area.from) / N)
        prev = y
      }
      if (ok) {
        const midx = (area.from + area.to) / 2
        const fm = node(midx)
        const midy = g ? (fm + g(midx)) / 2 : fm / 2
        parts.push(svgTag('text', { x: sx(midx).toFixed(1), y: (sy(midy) + labelDy(area.labelPos, 0)).toFixed(1), 'text-anchor': 'middle', class: 'matex-plot-areaval' }, `∫≈${fmt2(val)}`))
      }
    }
  }

  funcSegs.forEach((segs, i) => {
    const f = spec.functions[i]
    // Estilo por rol (ME-38): color/grosor/guion, con override explícito ganando.
    const eff = resolvePlotStyle({ color: f?.color, style: f?.style, width: f?.width, role: f?.role, index: i })
    // Sombreado de semiplano (ME-41): región `y > f(x)` (above) o `y < f(x)` (below). Antes del trazo.
    const shadeEval = evals[i]
    if (f?.shade && shadeEval) {
      const clamp = (y: number): number => Math.max(dymin, Math.min(dymax, y))
      const closeY = f.shade === 'above' ? dymax : dymin
      let dd = ''
      for (let k = 0; k <= 200; k += 1) {
        const x = dxmin + ((dxmax - dxmin) * k) / 200
        const y = shadeEval(x)
        dd += `${k ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(clamp(Number.isFinite(y) ? y : closeY)).toFixed(1)}`
      }
      parts.push(svgTag('path', { d: `${dd} L${sx(dxmax).toFixed(1)} ${sy(closeY).toFixed(1)} L${sx(dxmin).toFixed(1)} ${sy(closeY).toFixed(1)} Z`, fill: eff.color.hex, 'fill-opacity': '0.15', stroke: 'none' }))
    }
    for (const seg of segs) {
      const pts = adaptiveCurve((x) => ({ x, y: seg.evalAt(x) }), seg.from, seg.to)
      let d = ''
      let pen = false
      for (const p of pts) {
        const Y = sy(p.y)
        // Cortar en no-finitos o excursiones muy fuera de la caja (asíntotas).
        if (!Number.isFinite(p.y) || Y < -H || Y > 2 * H) {
          pen = false
          continue
        }
        d += `${pen ? ' L' : ' M'}${sx(p.x).toFixed(1)} ${Y.toFixed(1)}`
        pen = true
      }
      if (!d) continue
      parts.push(
        svgTag('path', {
          d: d.trim(),
          fill: 'none',
          stroke: eff.color.hex,
          'stroke-width': String(eff.strokeWidth),
          'stroke-linejoin': 'round',
          'stroke-dasharray': dash(eff.dash),
        }),
      )
    }
    // Función inversa (ME-40a): reflejo sobre y=x → dibuja {(f(x), x)} punteado.
    if (f?.inverse) {
      for (const seg of segs) {
        const ip = adaptiveCurve((x) => ({ x, y: seg.evalAt(x) }), seg.from, seg.to)
        let di = ''
        let pen = false
        for (const p of ip) {
          const X = sx(p.y)
          const Y = sy(p.x)
          if (!Number.isFinite(p.y) || X < -W || X > 2 * W || Y < -H || Y > 2 * H) {
            pen = false
            continue
          }
          di += `${pen ? ' L' : ' M'}${X.toFixed(1)} ${Y.toFixed(1)}`
          pen = true
        }
        if (di) parts.push(svgTag('path', { d: di.trim(), fill: 'none', stroke: eff.color.hex, 'stroke-width': String(eff.strokeWidth), 'stroke-linejoin': 'round', 'stroke-dasharray': '5 3' }))
      }
    }
    // Etiqueta flotante con la fórmula al final del trazo (ME-40b, estilo Desmos).
    if (f?.endLabel && f.expr) {
      const seg = segs[segs.length - 1]
      if (seg) {
        let ex = seg.to
        let ey = seg.evalAt(ex)
        for (let k = 0; k < 30 && !(Number.isFinite(ey) && sy(ey) > pad + 6 && sy(ey) < H - pad - 6); k += 1) {
          ex -= (seg.to - seg.from) / 60
          ey = seg.evalAt(ex)
        }
        if (Number.isFinite(ey)) text(sx(ex) - 3, sy(ey) - 4, f.legend?.trim() ? f.legend : f.expr, 'end')
      }
    }
  })

  // Rectas tangentes: pendiente numérica f'(at) → recta por el punto de tangencia.
  for (const t of spec.tangents ?? []) {
    const f = spec.functions[t.fn]
    if (!f || f.disabled) continue
    // Evaluador: por rama (partida), o por `expr`/`fromData` (funcEvaluator).
    let ev: ((x: number) => number) | null = funcEvaluator(spec, f)
    if (!ev && f.pieces && f.pieces.length > 0) {
      const src = f.pieces.find((p) => t.at >= Math.min(p.from, p.to) && t.at <= Math.max(p.from, p.to))?.expr
      const r = src != null ? parseExpr(src) : null
      ev = r && r.ok ? (x: number): number => evalExpr(r.node, x) : null
    }
    if (!ev) continue
    // y en el punto: si el borde del dominio da no-finito, se aproxima desde el lado definido.
    let y0 = ev(t.at)
    if (!Number.isFinite(y0)) {
      const near = [ev(t.at - 1e-4), ev(t.at + 1e-4)].find((v) => Number.isFinite(v))
      if (near == null) continue
      y0 = near
    }
    const { m, vertical } = tangentSlope(ev, t.at, y0)
    const stroke = resolvePlotStyle({ color: f.color, role: f.role, index: t.fn }).color.hex
    if (vertical) {
      parts.push(
        svgTag('line', {
          x1: sx(t.at).toFixed(1),
          y1: sy(dymax).toFixed(1),
          x2: sx(t.at).toFixed(1),
          y2: sy(dymin).toFixed(1),
          stroke,
          'stroke-width': '1.2',
          'stroke-dasharray': '5 3',
        }),
      )
    } else {
      const yAt = (x: number): number => y0 + m * (x - t.at)
      parts.push(
        svgTag('line', {
          x1: sx(dxmin).toFixed(1),
          y1: sy(yAt(dxmin)).toFixed(1),
          x2: sx(dxmax).toFixed(1),
          y2: sy(yAt(dxmax)).toFixed(1),
          stroke,
          'stroke-width': '1.2',
          'stroke-dasharray': '5 3',
        }),
      )
    }
    parts.push(svgTag('circle', { cx: sx(t.at).toFixed(1), cy: sy(y0).toFixed(1), r: '2.6', class: 'matex-plot-point' }))
    const tParts = [t.label ?? '', t.showValue ? (vertical ? "f'→∞" : `f'≈${fmt2(m)}`) : ''].filter(Boolean)
    if (tParts.length > 0) text(sx(t.at) + 4, sy(y0) + labelDy(t.labelPos, -3), tParts.join('  '), 'start')
  }

  // Continuidad en funciones partidas: ● (incluido) y ○ (excluido) donde hay salto.
  for (const f of spec.functions) {
    if (f.disabled || !f.markJumps || !f.pieces || f.pieces.length < 2) continue
    const nodesP = f.pieces.map((pc) => {
      const r = parseExpr(pc.expr)
      return r.ok ? r.node : null
    })
    for (let b = 0; b < f.pieces.length - 1; b += 1) {
      const left = nodesP[b]
      const right = nodesP[b + 1]
      const x = f.pieces[b + 1]!.from
      if (!left || !right) continue
      const lv = evalExpr(left, x)
      const rv = evalExpr(right, x)
      if (!Number.isFinite(lv) || !Number.isFinite(rv) || Math.abs(lv - rv) < 1e-9) continue
      const dot = (y: number, open: boolean): void => {
        parts.push(
          svgTag('circle', {
            cx: sx(x).toFixed(1),
            cy: sy(y).toFixed(1),
            r: '2.6',
            class: 'matex-plot-point',
            fill: open ? 'var(--color-surface, #fff)' : undefined,
            stroke: open ? 'currentColor' : undefined,
            'stroke-width': open ? '1.2' : undefined,
          }),
        )
      }
      dot(rv, false) // rama derecha: incluido ●
      dot(lv, true) // rama izquierda: excluido ○
    }
  }

  // Trazo continuo (paramétricas/polares) desde puntos ya muestreados, cortando en no-finitos / fuera de caja.
  const openCurvePath = (pts: Pt[]): string => {
    let d = ''
    let pen = false
    for (const p of pts) {
      const X = sx(p.x)
      const Y = sy(p.y)
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Y < -H || Y > 2 * H || X < -W || X > 2 * W) {
        pen = false
        continue
      }
      d += `${pen ? ' L' : ' M'}${X.toFixed(1)} ${Y.toFixed(1)}`
      pen = true
    }
    return d
  }

  // Curvas paramétricas: remuestreo adaptativo de t → (x(t), y(t)).
  paramNodes.forEach((n, i) => {
    if (!n) return
    const d = openCurvePath(adaptiveCurve(n.at, n.tmin, n.tmax))
    if (!d) return
    const p = spec.parametrics?.[i]
    const eff = resolvePlotStyle({ color: p?.color, style: p?.style, width: p?.width, index: spec.functions.length + (spec.data?.length ?? 0) + i })
    parts.push(svgTag('path', { d: d.trim(), fill: 'none', stroke: eff.color.hex, 'stroke-width': String(eff.strokeWidth), 'stroke-linejoin': 'round', 'stroke-dasharray': dash(eff.dash) }))
  })

  // Curvas polares (mismo trazado; color tras funciones+datos+paramétricas).
  polarNodes.forEach((n, i) => {
    if (!n) return
    const d = openCurvePath(adaptiveCurve(n.at, n.tmin, n.tmax))
    if (!d) return
    const p = spec.polars?.[i]
    const eff = resolvePlotStyle({ color: p?.color, style: p?.style, width: p?.width, index: spec.functions.length + (spec.data?.length ?? 0) + (spec.parametrics?.length ?? 0) + i })
    parts.push(svgTag('path', { d: d.trim(), fill: 'none', stroke: eff.color.hex, 'stroke-width': String(eff.strokeWidth), 'stroke-linejoin': 'round', 'stroke-dasharray': dash(eff.dash) }))
  })

  // Curvas implícitas F(x,y)=0: se computan (marching squares) sobre el mismo viewport que el PDF
  // y se dibujan como polilíneas → "lo que se ve = lo que compila".
  ;(spec.implicits ?? []).forEach((im, i) => {
    if (im.disabled) return
    const node = parseImplicit(im.equation)
    if (!node) return
    const polys = implicitCurve(node, curveVp, 120)
    const idx = spec.functions.length + (spec.data?.length ?? 0) + (spec.parametrics?.length ?? 0) + (spec.polars?.length ?? 0) + i
    const eff = resolvePlotStyle({ color: im.color, style: im.style, width: im.width, index: idx })
    for (const poly of polys) {
      if (poly.length < 2) continue
      const d = poly.map(([x, y], k) => `${k ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ')
      parts.push(svgTag('path', { d, fill: 'none', stroke: eff.color.hex, 'stroke-width': String(eff.strokeWidth), 'stroke-linejoin': 'round', 'stroke-dasharray': dash(eff.dash) }))
    }
  })

  // Cónicas semánticas (ME-42): polilíneas paramétricas (círculo/elipse/parábola/hipérbola).
  ;(spec.conics ?? []).forEach((cn, i) => {
    if (cn.disabled) return
    const idx = spec.functions.length + (spec.data?.length ?? 0) + (spec.parametrics?.length ?? 0) + (spec.polars?.length ?? 0) + (spec.implicits?.length ?? 0) + i
    const eff = resolvePlotStyle({ color: cn.color, style: cn.style, width: cn.width, index: idx })
    for (const poly of conicCurve(cn)) {
      if (poly.length < 2) continue
      const d = openCurvePath(poly.map(([x, y]) => ({ x, y })))
      if (d) parts.push(svgTag('path', { d: d.trim(), fill: 'none', stroke: eff.color.hex, 'stroke-width': String(eff.strokeWidth), 'stroke-linejoin': 'round', 'stroke-dasharray': dash(eff.dash) }))
    }
  })

  // Series de datos (scatter): marcas y, opcional, curva que las une/ajusta (interpolación, ME-45).
  ;(spec.data ?? []).forEach((s, i) => {
    if (s.disabled || s.points.length === 0) return
    const seff = resolvePlotStyle({ color: s.color, style: s.style, width: s.width, index: spec.functions.length + i })
    const color = seff.color.hex
    // Interpolación/ajuste: si hay método, traza la curva computada; si no, el `line` simple (legado).
    const curve = s.interpolate ? interpolateSeries(s.points, s.interpolate, { degree: s.interpDegree, closed: s.closed }).curve : s.line ? s.points : []
    if (curve.length >= 2) {
      const d = curve.map(([x, y], k) => `${k ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ')
      parts.push(
        svgTag('path', { d, fill: 'none', stroke: color, 'stroke-width': String(seff.strokeWidth), 'stroke-linejoin': 'round', 'stroke-dasharray': dash(seff.dash) }),
      )
    }
    for (const [x, y] of s.points) {
      parts.push(
        svgTag('circle', {
          cx: sx(x).toFixed(1),
          cy: sy(y).toFixed(1),
          r: '2.4',
          fill: s.open ? 'var(--color-surface, #fff)' : color,
          stroke: s.open ? color : undefined,
          'stroke-width': s.open ? '1.2' : undefined,
        }),
      )
    }
  })

  // Puntos marcados (encima de las curvas); `open` = círculo hueco (valor no incluido).
  // Anclados a una función (`fn`) → la `y` se computa `= f(x)` (ignora la almacenada).
  const pointY = (p: NonNullable<PlotSpec['points']>[number]): number => {
    if (p.fn == null) return p.y
    const f = spec.functions[p.fn]
    if (!f || f.disabled) return p.y
    const src =
      f.pieces && f.pieces.length > 0
        ? f.pieces.find((pc) => p.x >= Math.min(pc.from, pc.to) && p.x <= Math.max(pc.from, pc.to))?.expr
        : f.expr
    if (src == null) return p.y
    const r = parseExpr(src)
    if (!r.ok) return p.y
    const v = evalExpr(r.node, p.x)
    return Number.isFinite(v) ? v : p.y
  }
  for (const p of spec.points ?? []) {
    const py = pointY(p)
    parts.push(
      svgTag('circle', {
        cx: sx(p.x).toFixed(1),
        cy: sy(py).toFixed(1),
        r: '2.6',
        class: 'matex-plot-point',
        fill: p.open ? 'var(--color-surface, #fff)' : undefined,
        stroke: p.open ? 'currentColor' : undefined,
        'stroke-width': p.open ? '1.2' : undefined,
      }),
    )
    if (p.label) text(sx(p.x) + 4, sy(py) - 3, p.label, 'start')
  }

  // Rasgos notables **auto-detectados** (ME-39): raíces / extremos / inflexiones marcados
  // numéricamente sobre el dominio de la función (independiente de la vista → igual que el PDF).
  spec.functions.forEach((f, i) => {
    if (f.disabled || (f.pieces && f.pieces.length > 0)) return
    if (!f.markRoots && !f.markExtrema && !f.markInflections && !f.markYIntercept) return
    const ev = evals[i]
    if (!ev) return
    const feats = detectFeatures(ev, fromDataDomain(spec, f) ?? f.domain ?? spec.domain, { roots: f.markRoots, extrema: f.markExtrema, inflections: f.markInflections, yIntercept: f.markYIntercept })
    const color = resolvePlotStyle({ color: f.color, role: f.role, index: i }).color.hex
    for (const ft of feats) {
      const open = ft.kind === 'inflection'
      parts.push(
        svgTag('circle', {
          cx: sx(ft.x).toFixed(1),
          cy: sy(ft.y).toFixed(1),
          r: '3',
          fill: open ? 'var(--color-surface, #fff)' : color,
          stroke: color,
          'stroke-width': open ? '1.4' : '1',
        }),
      )
      const name = ft.kind === 'max' ? 'máx' : ft.kind === 'min' ? 'mín' : ft.kind === 'inflection' ? 'infl' : ft.kind === 'yintercept' ? 'ord.' : ''
      const coord = f.featureCoords ? `(${featNum(ft.x)}, ${featNum(ft.y)})` : ''
      const lbl = [name, coord].filter(Boolean).join(' ')
      if (lbl) text(sx(ft.x) + 4, sy(ft.y) - 3, lbl, 'start')
    }
  })

  // Asíntotas auto-detectadas (ME-39): rectas **gris punteadas** (estilo auxiliar, ME-38).
  spec.functions.forEach((f, i) => {
    if (f.disabled || !f.markAsymptotes || (f.pieces && f.pieces.length > 0)) return
    const ev = evals[i]
    if (!ev) return
    const asy = resolvePlotStyle({ role: 'auxiliary', index: 0 })
    for (const a of detectAsymptotes(ev, fromDataDomain(spec, f) ?? f.domain ?? spec.domain)) {
      const asLine = (x1v: number, y1v: number, x2v: number, y2v: number): void => {
        parts.push(svgTag('line', { x1: sx(x1v).toFixed(1), y1: sy(y1v).toFixed(1), x2: sx(x2v).toFixed(1), y2: sy(y2v).toFixed(1), stroke: asy.color.hex, 'stroke-width': '1.1', 'stroke-dasharray': '5 3' }))
      }
      if (a.kind === 'vertical' && a.at != null) {
        asLine(a.at, dymin, a.at, dymax)
        if (f.featureCoords) text(sx(a.at) + 3, pad + 9, `x = ${featNum(a.at)}`, 'start')
      } else if (a.m != null && a.b != null) {
        asLine(dxmin, a.m * dxmin + a.b, dxmax, a.m * dxmax + a.b)
        if (f.featureCoords) text(W - pad - 3, sy(a.m * dxmax + a.b) - 3, asyEq(a.m, a.b), 'end')
      }
    }
  })

  // Intersecciones de curvas: puntos calculados en JS → marcas (más grandes para destacar).
  ;(spec.intersections ?? []).forEach((inter) => {
    if (inter.disabled) return
    const pts = intersectionPoints(spec, inter.a, inter.b, curveVp)
    const color = inter.color ? resolvePlotColor(inter.color, 0).hex : 'currentColor'
    const fmt = (n: number): string => String(Number(n.toFixed(2)))
    pts.forEach(([x, y], k) => {
      parts.push(svgTag('circle', { cx: sx(x).toFixed(1), cy: sy(y).toFixed(1), r: '3', class: 'matex-plot-point', fill: color }))
      if (k === 0 && inter.label) text(sx(x) + 4, sy(y) - 3, inter.label, 'start')
      if (inter.showCoords) parts.push(svgTag('text', { x: (sx(x) + 4).toFixed(1), y: (sy(y) + 11).toFixed(1), 'text-anchor': 'start', class: 'matex-plot-label' }, `(${fmt(x)}, ${fmt(y)})`))
    })
  })

  // Textos libres anotados en (x, y) (centrados en el punto).
  for (const t of spec.texts ?? []) {
    if (!t.text.trim()) continue
    parts.push(svgTag('text', { x: sx(t.x).toFixed(1), y: sy(t.y).toFixed(1), 'text-anchor': 'middle', class: 'matex-plot-label' }, t.text))
  }

  // Rótulos de ejes (como pgfplots): en los extremos de los ejes.
  const axX0 = dxmin <= 0 && dxmax >= 0 ? sx(0) : pad
  const axY0 = dymin <= 0 && dymax >= 0 ? sy(0) : H - pad
  if (spec.xlabel) parts.push(svgTag('text', { x: (W - pad).toFixed(1), y: (axY0 - 4).toFixed(1), 'text-anchor': 'end', class: 'matex-plot-axislabel' }, spec.xlabel))
  if (spec.ylabel) parts.push(svgTag('text', { x: (axX0 + 5).toFixed(1), y: (pad + 3).toFixed(1), 'text-anchor': 'start', class: 'matex-plot-axislabel' }, spec.ylabel))

  // (La leyenda ya no se dibuja en el SVG: va como overlay HTML con MathML —ver `plotLegendHtml`—
  //  para verse en KaTeX/MathML completa y actualizarse en vivo con los sliders.)

  // Título del gráfico (arriba, centrado).
  if (spec.title) {
    parts.push(svgTag('text', { x: (W / 2).toFixed(1), y: '10', 'text-anchor': 'middle', class: 'matex-plot-title' }, spec.title))
  }

  if (defs.length > 0) parts.unshift(`<defs>${defs.join('')}</defs>`)
  // Estilo **embebido** (self-contained): usa `currentColor` → se adapta al tema del consumidor
  // (editor claro/oscuro, HTML light/dark) y **no depende de CSS externo**. Antes vivía en
  // `index.css` (solo el editor), por eso el 2º backend HTML mostraba el gráfico sin ejes/grilla.
  parts.unshift(PLOT_STYLE)
  // Accesibilidad (ME-43): `role="img"` + `aria-label` (nombre accesible) + `<title>`/`<desc>` para
  // que un lector de pantalla describa el gráfico. `<title>`/`<desc>` van **primeros** (los AT los
  // asocian por orden, sin necesitar ids únicos entre varios gráficos de la página).
  const alt = plotAltText(specIn)
  parts.unshift(`<title>${escapeXml(spec.title?.trim() || 'Gráfico')}</title><desc>${escapeXml(alt)}</desc>`)
  return svgTag('svg', { viewBox: `0 0 ${W} ${H}`, class: 'matex-plot-svg', width: '100%', height: 'auto', style: 'color:inherit', role: 'img', 'aria-label': alt }, parts)
}

const LEG_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * **Leyenda como HTML overlay con MathML** (no en el SVG): fórmula **completa y con calidad
 * matemática** (MathML nativo, sin embeber KaTeX). **Convención GeoGebra:** los parámetros **con
 * slider** (rango) se muestran como su **LETRA** (el slider indica el valor) → leyenda simbólica y
 * estable; los parámetros **fijos** (sin rango) se sustituyen por su **número**. Mismo orden/color
 * que el trazado. Cada tipo de curva se renderiza como MathML (función, implícita `=`, par
 * paramétrico, polar `r=`); un `legend` explícito gana como texto.
 */
export function plotLegendHtml(specIn: PlotSpec): string {
  if (!specIn.legend) return ''
  const syntax = specIn.syntax ?? 'ascii'
  const params = specIn.parameters ?? []
  // Con slider (rango) → letra; sin rango → número (se sustituye).
  const sliderVars = params.filter((p) => p.min != null && p.max != null && p.min < p.max && LEG_IDENT.test(p.name)).map((p) => p.name)
  const fixed = params.filter((p) => !sliderVars.includes(p.name))
  const sub = (src: string): string => substituteParamsInExpr(src, fixed)
  const nFn = specIn.functions.length
  const nData = specIn.data?.length ?? 0
  const nParam = specIn.parametrics?.length ?? 0
  const nPolar = specIn.polars?.length ?? 0
  const rows: string[] = []
  const swatch = (colorHex: string, style: string | undefined): string => {
    const s = style === 'dashed' ? 'dashed' : style === 'dotted' ? 'dotted' : 'solid'
    return `<span class="mx-leg-swatch" style="border-top:2.5px ${s} ${colorHex}"></span>`
  }
  // Cuerpo MathML de una expresión (con las letras de los sliders + las variables base), o null.
  const body = (src: string, base: string[]): string | null => {
    const r = parseExprVars(sub(src), [...base, ...sliderVars], syntax)
    return r.ok ? exprMathMLBody(r.node) : null
  }
  const math1 = (src: string): string => {
    const b = body(src, ['x'])
    return b ? wrapMathML(b) : escapeXml(sub(src))
  }
  const mathEq = (eq: string): string => {
    const i = eq.indexOf('=')
    const l = body(i >= 0 ? eq.slice(0, i) : eq, ['x', 'y'])
    if (i < 0) return l ? wrapMathML(l) : escapeXml(sub(eq))
    const r = body(eq.slice(i + 1), ['x', 'y'])
    return l && r ? wrapMathML(`${l}<mo>=</mo>${r}`) : escapeXml(sub(eq))
  }
  const mathPair = (xs: string, ys: string): string => {
    const x = body(xs, ['t'])
    const y = body(ys, ['t'])
    return x && y ? wrapMathML(`<mo>(</mo>${x}<mo>,</mo>${y}<mo>)</mo>`) : escapeXml(`(${sub(xs)}, ${sub(ys)})`)
  }
  const mathPolar = (rs: string): string => {
    const b = body(rs, ['t'])
    return b ? wrapMathML(`<mi>r</mi><mo>=</mo>${b}`) : escapeXml(`r = ${sub(rs)}`)
  }
  const row = (disabled: boolean | undefined, explicit: string | undefined, autoHtml: string, colorHex: string, style: string | undefined): void => {
    if (disabled) return
    const lab = explicit && explicit.trim() ? escapeXml(explicit) : autoHtml
    if (!lab) return
    rows.push(`<span class="mx-leg-row">${swatch(colorHex, style)}<span class="mx-leg-lab">${lab}</span></span>`)
  }
  specIn.functions.forEach((f, i) => {
    const eff = resolvePlotStyle({ color: f.color, style: f.style, role: f.role, index: i })
    row(f.disabled, f.legend, math1(f.expr), eff.color.hex, eff.dash)
  })
  specIn.data?.forEach((s, i) => row(s.disabled, s.legend || 'datos', 'datos', resolvePlotColor(s.color, nFn + i).hex, s.style))
  specIn.parametrics?.forEach((p, i) => row(p.disabled, p.legend, mathPair(p.x, p.y), resolvePlotColor(p.color, nFn + nData + i).hex, p.style))
  specIn.polars?.forEach((p, i) => row(p.disabled, p.legend, mathPolar(p.r), resolvePlotColor(p.color, nFn + nData + nParam + i).hex, p.style))
  specIn.implicits?.forEach((im, i) => row(im.disabled, im.legend, mathEq(im.equation), resolvePlotColor(im.color, nFn + nData + nParam + nPolar + i).hex, im.style))
  if (rows.length === 0) return ''
  return `<div class="mx-legend" data-pos="${specIn.legendPos ?? 'top-left'}">${rows.join('')}</div>`
}

/** Estilos de ejes/grilla/rótulos del plot, **dentro del SVG** (portable a cualquier backend). */
const PLOT_STYLE =
  '<style>' +
  '.matex-plot-axis{stroke:currentColor;stroke-width:1;opacity:.55}' +
  '.matex-plot-grid{stroke:currentColor;stroke-width:.5;opacity:.16}' +
  '.matex-plot-vline{stroke:currentColor;stroke-width:.75;stroke-dasharray:3 2;opacity:.55}' +
  '.matex-plot-point{fill:currentColor}' +
  '.matex-plot-label{fill:currentColor;font-size:9px;opacity:.65}' +
  '.matex-plot-tick{fill:currentColor;font-size:7.5px;opacity:.6}' +
  '.matex-plot-title{fill:currentColor;font-size:11px;font-weight:600}' +
  '.matex-plot-areaval{fill:currentColor;font-size:8px}' +
  '.matex-plot-axislabel{fill:currentColor;font-size:9px;font-style:italic;opacity:.8}' +
  '</style>'
