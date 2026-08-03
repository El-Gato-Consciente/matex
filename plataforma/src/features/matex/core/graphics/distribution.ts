import { resolvePlotColor } from '../plotColors'
import { escapeLabel, escapeLatex, itemWidth, num6 } from './util'
import type { DistSpec } from '../ast'

/**
 * **Familia A3 (distribución) — stats en JS + backend LaTeX.** La materia prima son **muestras
 * crudas**: el histograma las agrupa en bins y el boxplot calcula cuartiles. Se computa en JS (como
 * implícitas/intersecciones) y se emite a pgfplots (histograma `ybar interval`; boxplot
 * `boxplot prepared`, requiere `\usepgfplotslibrary{statistics}`). Par web: `distributionSvg.ts`.
 */

/** Bins de un histograma: bordes (`n+1`) y conteos (`n`). `bins` default ≈ √n (2–50). */
export function histogram(samples: readonly number[], bins?: number): { edges: number[]; counts: number[] } {
  const xs = samples.filter((x) => Number.isFinite(x))
  if (xs.length === 0) return { edges: [0, 1], counts: [0] }
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  if (lo === hi) return { edges: [lo - 0.5, lo + 0.5], counts: [xs.length] }
  const n = bins && bins > 0 ? Math.min(200, Math.round(bins)) : Math.max(2, Math.min(50, Math.ceil(Math.sqrt(xs.length))))
  const width = (hi - lo) / n
  const edges = Array.from({ length: n + 1 }, (_, i) => lo + i * width)
  const counts = new Array<number>(n).fill(0)
  for (const x of xs) {
    const k = Math.min(n - 1, Math.max(0, Math.floor((x - lo) / width)))
    counts[k] = counts[k]! + 1
  }
  return { edges, counts }
}

/** Cuantil `p∈[0,1]` de un array **ordenado** (interpolación lineal). */
function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo)
}

export interface BoxStats {
  q1: number
  median: number
  q3: number
  whiskerLo: number
  whiskerHi: number
  outliers: number[]
}
/** Cuartiles + bigotes (1.5·IQR, acotados a los datos) + outliers de una muestra. `null` si vacía. */
export function boxplot(samples: readonly number[]): BoxStats | null {
  const xs = samples.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (xs.length === 0) return null
  const q1 = quantile(xs, 0.25)
  const median = quantile(xs, 0.5)
  const q3 = quantile(xs, 0.75)
  const iqr = q3 - q1
  const loFence = q1 - 1.5 * iqr
  const hiFence = q3 + 1.5 * iqr
  const inRange = xs.filter((x) => x >= loFence && x <= hiFence)
  return {
    q1,
    median,
    q3,
    whiskerLo: inRange.length ? inRange[0]! : q1,
    whiskerHi: inRange.length ? inRange[inRange.length - 1]! : q3,
    outliers: xs.filter((x) => x < loFence || x > hiFence),
  }
}

/** Compila un `DistSpec` a un `axis` de pgfplots (histograma o boxplot). */
export function distToLatex(spec: DistSpec, width: number | undefined, widthOverride?: string): string {
  const colorPgf = (i: number, c: string | undefined): string => resolvePlotColor(c, i).pgf
  const opts = [`width=${widthOverride ?? itemWidth(width, '0.8\\linewidth')}`]
  if (spec.title) opts.push(`title={${escapeLatex(spec.title)}}`)
  if (spec.xlabel) opts.push(`xlabel={${escapeLatex(spec.xlabel)}}`)
  if (spec.ylabel) opts.push(`ylabel={${escapeLatex(spec.ylabel)}}`)
  const plots: string[] = []

  if (spec.form === 'histogram') {
    opts.push('ybar interval', 'ymin=0')
    if (spec.legend) opts.push('legend pos=north east')
    spec.data.forEach((s, i) => {
      const { edges, counts } = histogram(s.samples, spec.bins)
      const coords = counts.map((c, k) => `(${num6(edges[k]!)},${c})`).join(' ')
      const color = colorPgf(i, s.color)
      plots.push(`\\addplot[fill=${color}, fill opacity=0.5, draw=${color}] coordinates {${coords} (${num6(edges[edges.length - 1]!)},0)};`)
      if (spec.legend) plots.push(`\\addlegendentry{${s.label ? escapeLabel(s.label) : `datos ${i + 1}`}}`)
    })
  } else {
    // Boxplot: cada `\addplot` se ubica en una posición entera consecutiva (1, 2, …).
    opts.push('boxplot/draw direction=y', 'ymajorgrids')
    opts.push(`xtick={${spec.data.map((_, i) => i + 1).join(',')}}`)
    opts.push(`xticklabels={${spec.data.map((s, i) => `{${s.label ? escapeLabel(s.label) : i + 1}}`).join(',')}}`)
    spec.data.forEach((s, i) => {
      const b = boxplot(s.samples)
      if (!b) return
      const prep = `boxplot prepared={lower whisker=${num6(b.whiskerLo)}, lower quartile=${num6(b.q1)}, median=${num6(b.median)}, upper quartile=${num6(b.q3)}, upper whisker=${num6(b.whiskerHi)}}`
      const color = colorPgf(i, s.color)
      const outs = b.outliers.map((o) => `(0,${num6(o)})`).join(' ')
      plots.push(`\\addplot[${prep}, draw=${color}, fill=${color}, fill opacity=0.3, mark=*, mark size=1pt, mark options={${color}}] coordinates {${outs}};`)
    })
  }

  return ['\\begin{tikzpicture}', `\\begin{axis}[${opts.join(', ')}]`, ...plots.map((p) => `  ${p}`), '\\end{axis}', '\\end{tikzpicture}'].join('\n')
}
