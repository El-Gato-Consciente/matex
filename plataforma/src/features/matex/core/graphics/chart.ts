import { resolvePlotColor } from '../plotColors'
import { escapeLabel, escapeLatex, itemWidth, num6 } from './util'
import type { ChartSpec } from '../ast'

/**
 * **Familias A1/A2 (comparación/composición) — backend LaTeX.** Compila un `ChartSpec`
 * (categorías + series de valores) a **barras** (`pgfplots ybar`) o **torta** (`pgf-pie`),
 * según `spec.form`. Es el emisor LaTeX de la misma spec que el preview SVG
 * (`chartSvg.ts`, co-localizado) dibuja en la web. Ver `graficos-cartografia-semantica.md`.
 *
 * Nota de modularización: sumar una **forma** nueva (barras apiladas, horizontales, línea…)
 * = un caso más acá + una entrada en el editor; sumar una **familia** nueva (distribución,
 * diagramas…) = un módulo hermano en `core/graphics/`.
 */

/**
 * Formas con **eje pgfplots** (barras agrupadas/apiladas/horizontales/línea). Eje categórico
 * numérico + `xticklabels`/`yticklabels` (robusto ante categorías con caracteres especiales).
 * Una `\addplot` por serie. Horizontal (`hbar`) intercambia los ejes.
 */
function axisChartToLatex(spec: ChartSpec, widthOpt: string): string {
  const horizontal = spec.form === 'hbar'
  const cats = spec.categories
  const ticks = cats.map((_, i) => i + 1).join(',')
  const labels = cats.map((c) => `{${escapeLatex(c)}}`).join(',')
  const barOpt =
    spec.form === 'bar' ? ['ybar'] : spec.form === 'stackedBar' ? ['ybar stacked'] : spec.form === 'hbar' ? ['xbar'] : []
  const valueLabel = spec.ylabel ? escapeLatex(spec.ylabel) : null
  const catAxis = horizontal
    ? [`ytick={${ticks}}`, `yticklabels={${labels}}`, 'xmin=0', 'enlarge y limits=0.2', ...(valueLabel ? [`xlabel={${valueLabel}}`] : [])]
    : [`xtick={${ticks}}`, `xticklabels={${labels}}`, 'ymin=0', 'enlarge x limits=0.2', 'x tick label style={font=\\footnotesize}', ...(valueLabel ? [`ylabel={${valueLabel}}`] : [])]
  const opts = [
    `width=${widthOpt}`,
    ...barOpt,
    'axis lines=left',
    ...catAxis,
    ...(spec.title ? [`title={${escapeLatex(spec.title)}}`] : []),
    ...(spec.legend ? ['legend pos=north east', 'legend cell align=left'] : []),
  ]
  const plots = spec.series.map((s, si) => {
    const color = resolvePlotColor(s.color, si).pgf
    const coords = s.values
      .map((v, i) => (horizontal ? `(${num6(v)},${i + 1})` : `(${i + 1},${num6(v)})`))
      .join(' ')
    // `line`: curva con marcas; barras: relleno.
    const style = spec.form === 'line' ? `color=${color}, mark=*, thick` : `fill=${color}, draw=${color}`
    return `\\addplot[${style}] coordinates {${coords}};`
  })
  const legend =
    spec.legend && spec.series.some((s) => s.label)
      ? [`\\legend{${spec.series.map((s) => escapeLabel(s.label ?? '')).join(', ')}}`]
      : []
  return [
    '\\begin{tikzpicture}',
    `\\begin{axis}[${opts.join(', ')}]`,
    ...plots.map((p) => `  ${p}`),
    ...legend.map((l) => `  ${l}`),
    '\\end{axis}',
    '\\end{tikzpicture}',
  ].join('\n')
}

/** Torta → `pgf-pie`. Usa la 1ª serie; cada sector = `valor/categoría`. */
function pieToLatex(spec: ChartSpec): string {
  const s0 = spec.series[0]
  const slices = spec.categories
    .map((c, i) => `${num6(s0?.values[i] ?? 0)}/${escapeLabel(c)}`)
    .filter((_, i) => (s0?.values[i] ?? 0) > 0)
    .join(', ')
  // `text=legend` deja las etiquetas afuera (leyenda) en vez de encima de sectores chicos.
  const opts = spec.legend ? '[text=legend]' : ''
  return `\\begin{tikzpicture}\n\\pie${opts}{${slices}}\n\\end{tikzpicture}`
}

/** Gráfico categórico → LaTeX según la forma. `width` (fracción) para el eje (la torta no escala igual). */
export function chartToLatex(spec: ChartSpec, width: number | undefined, widthOverride?: string): string {
  if (spec.form === 'pie') return pieToLatex(spec)
  return axisChartToLatex(spec, widthOverride ?? itemWidth(width, '0.8\\linewidth'))
}
