import { resolvePlotColor } from '../plotColors'
import { svgTag } from './svg'
import type { ChartSpec } from '../ast'

/**
 * **Preview de gráfico categórico (familias A1/A2)** = backend web **puro** del mismo `ChartSpec`
 * que `chart.ts` compila a pgfplots/pgf-pie. Arma **barras** (agrupadas/apiladas/horizontales),
 * **línea** o **torta** como `<svg>` string (sin DOM → vive en `core/`, testeable sin jsdom; el
 * editor inyecta el markup). Par LaTeX: `core/graphics/chart.ts`.
 */
const W = 340
const H = 220

export function chartToSvg(spec: ChartSpec): string {
  const parts =
    spec.form === 'pie' ? renderPie(spec) : spec.form === 'hbar' ? renderHBars(spec) : renderVertical(spec) // bar | stackedBar | line
  return svgTag('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: 'auto' }, parts)
}

const val = (s: { values: number[] }, i: number): number => (Number.isFinite(s.values[i]) ? (s.values[i] as number) : 0)
const clip = (c: string, n = 8): string => (c.length > n ? `${c.slice(0, n - 1)}…` : c)

/** Barras verticales (agrupadas o apiladas) o línea, sobre eje categórico en x. */
function renderVertical(spec: ChartSpec): string[] {
  const left = 30
  const top = 12
  const bottom = 26
  const plotW = W - left - 10
  const plotH = H - top - bottom
  const cats = spec.categories
  const series = spec.series.length > 0 ? spec.series : [{ values: [] as number[] }]
  const stacked = spec.form === 'stackedBar'
  const max = stacked
    ? Math.max(1, ...cats.map((_, i) => series.reduce((a, s) => a + Math.max(0, val(s, i)), 0)))
    : Math.max(1, ...series.flatMap((s) => s.values.map((v) => (Number.isFinite(v) ? v : 0))))
  const n = Math.max(1, cats.length)
  const slot = plotW / n
  const yOf = (v: number): number => top + plotH - (v / max) * plotH

  const parts: string[] = [
    svgTag('line', { x1: left, y1: top, x2: left, y2: top + plotH, stroke: '#9ca3af', 'stroke-width': 1 }),
    svgTag('line', { x1: left, y1: top + plotH, x2: left + plotW, y2: top + plotH, stroke: '#9ca3af', 'stroke-width': 1 }),
  ]

  if (spec.form === 'line') {
    series.forEach((s, si) => {
      const color = resolvePlotColor(s.color, si).hex
      const pts = cats.map((_, i) => `${left + i * slot + slot / 2},${yOf(val(s, i))}`).join(' ')
      parts.push(svgTag('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 1.5 }))
      cats.forEach((_, i) => parts.push(svgTag('circle', { cx: left + i * slot + slot / 2, cy: yOf(val(s, i)), r: 2.5, fill: color })))
    })
  } else if (stacked) {
    const barW = slot * 0.6
    cats.forEach((_, i) => {
      let acc = 0
      const x0 = left + i * slot + (slot - barW) / 2
      series.forEach((s, si) => {
        const v = Math.max(0, val(s, i))
        parts.push(svgTag('rect', { x: x0, y: yOf(acc + v), width: Math.max(1, barW), height: (v / max) * plotH, fill: resolvePlotColor(s.color, si).hex }))
        acc += v
      })
    })
  } else {
    const groupW = slot * 0.7
    const barW = groupW / series.length
    cats.forEach((_, i) => {
      const x0 = left + i * slot + (slot - groupW) / 2
      series.forEach((s, si) => {
        const h = Math.max(0, (val(s, i) / max) * plotH)
        parts.push(svgTag('rect', { x: x0 + si * barW, y: top + plotH - h, width: Math.max(1, barW - 1), height: h, fill: resolvePlotColor(s.color, si).hex }))
      })
    })
  }
  cats.forEach((cat, i) => {
    parts.push(svgTag('text', { x: left + i * slot + slot / 2, y: top + plotH + 14, 'text-anchor': 'middle', 'font-size': 9, fill: '#6b7280' }, clip(cat)))
  })
  return parts
}

/** Barras horizontales agrupadas (categorías en y). */
function renderHBars(spec: ChartSpec): string[] {
  const left = 58
  const top = 10
  const bottom = 12
  const plotW = W - left - 10
  const plotH = H - top - bottom
  const cats = spec.categories
  const series = spec.series.length > 0 ? spec.series : [{ values: [] as number[] }]
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => (Number.isFinite(v) ? v : 0))))
  const n = Math.max(1, cats.length)
  const slot = plotH / n
  const groupH = slot * 0.7
  const barH = groupH / series.length
  const parts: string[] = [svgTag('line', { x1: left, y1: top, x2: left, y2: top + plotH, stroke: '#9ca3af', 'stroke-width': 1 })]
  cats.forEach((cat, i) => {
    const y0 = top + i * slot + (slot - groupH) / 2
    series.forEach((s, si) => {
      const w = Math.max(0, (val(s, i) / max) * plotW)
      parts.push(svgTag('rect', { x: left, y: y0 + si * barH, width: w, height: Math.max(1, barH - 1), fill: resolvePlotColor(s.color, si).hex }))
    })
    parts.push(svgTag('text', { x: left - 4, y: top + i * slot + slot / 2 + 3, 'text-anchor': 'end', 'font-size': 9, fill: '#6b7280' }, clip(cat, 10)))
  })
  return parts
}

/** Torta: sectores de la 1ª serie, color por categoría. */
function renderPie(spec: ChartSpec): string[] {
  const cx = W / 2
  const cy = H / 2
  const r = Math.min(W, H) / 2 - 16
  const values = (spec.series[0]?.values ?? []).map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) {
    return [svgTag('circle', { cx, cy, r, fill: 'none', stroke: '#d1d5db', 'stroke-width': 1 })]
  }
  const parts: string[] = []
  let acc = -Math.PI / 2 // arranca arriba
  values.forEach((v, i) => {
    if (v <= 0) return
    const frac = v / total
    const a1 = acc
    const a2 = acc + frac * 2 * Math.PI
    acc = a2
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const large = frac > 0.5 ? 1 : 0
    parts.push(
      svgTag('path', {
        d: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
        fill: resolvePlotColor(undefined, i).hex, // color por sector (como pgf-pie)
        stroke: '#fff',
        'stroke-width': 1,
      }),
    )
  })
  return parts
}
