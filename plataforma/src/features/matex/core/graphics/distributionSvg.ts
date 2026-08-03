import { resolvePlotColor } from '../plotColors'
import { boxplot, histogram } from './distribution'
import { svgTag } from './svg'
import type { DistSpec } from '../ast'

/**
 * **Preview de distribución (familia A3)** = backend web **puro** del mismo `DistSpec` que
 * `distribution.ts` compila a pgfplots. Histograma (barras por bin) o boxplot (caja + bigotes +
 * outliers), dibujados como `<svg>` string. Par LaTeX: `core/graphics/distribution.ts`.
 */
const W = 340
const H = 220

const nice = (v: number): string => String(Number(v.toFixed(2))).replace('-', '−')
/** Marcas "lindas" (1/2/5·10^k) dentro de `[lo, hi]`. */
function ticks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo
  if (!(span > 0)) return []
  const mag = Math.pow(10, Math.floor(Math.log10(span / target)))
  const norm = span / target / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(t)
  return out
}

export function distToSvg(spec: DistSpec): string {
  return spec.form === 'histogram' ? histSvg(spec) : boxSvg(spec)
}

function histSvg(spec: DistSpec): string {
  const left = 32
  const top = 12
  const bottom = 22
  const plotW = W - left - 10
  const plotH = H - top - bottom
  const bins = spec.data.map((s) => histogram(s.samples, spec.bins))
  const xmin = Math.min(...bins.map((b) => b.edges[0]!))
  const xmax = Math.max(...bins.map((b) => b.edges[b.edges.length - 1]!))
  const ymax = Math.max(1, ...bins.map((b) => Math.max(0, ...b.counts)))
  const sx = (v: number): number => left + ((v - xmin) / (xmax - xmin || 1)) * plotW
  const sy = (c: number): number => top + plotH - (c / ymax) * plotH
  const parts: string[] = [
    svgTag('line', { x1: left, y1: top, x2: left, y2: top + plotH, stroke: '#9ca3af', 'stroke-width': 1 }),
    svgTag('line', { x1: left, y1: top + plotH, x2: left + plotW, y2: top + plotH, stroke: '#9ca3af', 'stroke-width': 1 }),
  ]
  bins.forEach((b, i) => {
    const color = resolvePlotColor(spec.data[i]?.color, i).hex
    b.counts.forEach((c, k) => {
      const x0 = sx(b.edges[k]!)
      const x1 = sx(b.edges[k + 1]!)
      parts.push(svgTag('rect', { x: x0.toFixed(1), y: sy(c).toFixed(1), width: Math.max(0.5, x1 - x0).toFixed(1), height: (plotH - (sy(c) - top)).toFixed(1), fill: color, 'fill-opacity': '0.5', stroke: color, 'stroke-width': 0.6 }))
    })
  })
  for (const t of ticks(0, ymax)) {
    parts.push(svgTag('text', { x: (left - 3).toFixed(1), y: (sy(t) + 3).toFixed(1), 'text-anchor': 'end', class: 'matex-plot-tick' }, nice(t)))
  }
  for (const t of ticks(xmin, xmax)) {
    parts.push(svgTag('text', { x: sx(t).toFixed(1), y: (top + plotH + 12).toFixed(1), 'text-anchor': 'middle', class: 'matex-plot-tick' }, nice(t)))
  }
  return svgTag('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: 'auto' }, parts)
}

function boxSvg(spec: DistSpec): string {
  const left = 32
  const top = 12
  const bottom = 22
  const plotW = W - left - 10
  const plotH = H - top - bottom
  const stats = spec.data.map((s) => boxplot(s.samples))
  const all = spec.data.flatMap((s) => s.samples).filter((x) => Number.isFinite(x))
  let ymin = all.length ? Math.min(...all) : 0
  let ymax = all.length ? Math.max(...all) : 1
  if (ymin === ymax) {
    ymin -= 1
    ymax += 1
  }
  const pad = (ymax - ymin) * 0.08
  ymin -= pad
  ymax += pad
  const sy = (v: number): number => top + plotH - ((v - ymin) / (ymax - ymin || 1)) * plotH
  const n = Math.max(1, spec.data.length)
  const slot = plotW / n
  const boxW = Math.min(40, slot * 0.5)
  const parts: string[] = [svgTag('line', { x1: left, y1: top, x2: left, y2: top + plotH, stroke: '#9ca3af', 'stroke-width': 1 })]
  for (const t of ticks(ymin, ymax)) {
    parts.push(svgTag('line', { x1: left, y1: sy(t).toFixed(1), x2: left + plotW, y2: sy(t).toFixed(1), stroke: '#e5e7eb', 'stroke-width': 0.5 }))
    parts.push(svgTag('text', { x: (left - 3).toFixed(1), y: (sy(t) + 3).toFixed(1), 'text-anchor': 'end', class: 'matex-plot-tick' }, nice(t)))
  }
  stats.forEach((b, i) => {
    if (!b) return
    const cx = left + slot * (i + 0.5)
    const color = resolvePlotColor(spec.data[i]?.color, i).hex
    const x0 = cx - boxW / 2
    // Bigotes (con topes) + caja + mediana.
    parts.push(svgTag('line', { x1: cx, y1: sy(b.whiskerHi).toFixed(1), x2: cx, y2: sy(b.q3).toFixed(1), stroke: color, 'stroke-width': 1 }))
    parts.push(svgTag('line', { x1: cx, y1: sy(b.whiskerLo).toFixed(1), x2: cx, y2: sy(b.q1).toFixed(1), stroke: color, 'stroke-width': 1 }))
    parts.push(svgTag('line', { x1: (cx - boxW / 4).toFixed(1), y1: sy(b.whiskerHi).toFixed(1), x2: (cx + boxW / 4).toFixed(1), y2: sy(b.whiskerHi).toFixed(1), stroke: color, 'stroke-width': 1 }))
    parts.push(svgTag('line', { x1: (cx - boxW / 4).toFixed(1), y1: sy(b.whiskerLo).toFixed(1), x2: (cx + boxW / 4).toFixed(1), y2: sy(b.whiskerLo).toFixed(1), stroke: color, 'stroke-width': 1 }))
    parts.push(svgTag('rect', { x: x0.toFixed(1), y: sy(b.q3).toFixed(1), width: boxW.toFixed(1), height: Math.max(0.5, sy(b.q1) - sy(b.q3)).toFixed(1), fill: color, 'fill-opacity': '0.3', stroke: color, 'stroke-width': 1 }))
    parts.push(svgTag('line', { x1: x0.toFixed(1), y1: sy(b.median).toFixed(1), x2: (x0 + boxW).toFixed(1), y2: sy(b.median).toFixed(1), stroke: color, 'stroke-width': 1.5 }))
    for (const o of b.outliers) parts.push(svgTag('circle', { cx: cx.toFixed(1), cy: sy(o).toFixed(1), r: '1.6', fill: 'none', stroke: color, 'stroke-width': 0.8 }))
    const label = spec.data[i]?.label ?? String(i + 1)
    parts.push(svgTag('text', { x: cx.toFixed(1), y: (top + plotH + 12).toFixed(1), 'text-anchor': 'middle', class: 'matex-plot-tick' }, label))
  })
  return svgTag('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: 'auto' }, parts)
}
