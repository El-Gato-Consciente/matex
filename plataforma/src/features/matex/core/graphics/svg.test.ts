import { describe, expect, it } from 'vitest'
import { chartToSvg } from './chartSvg'
import { plotDisplayWindow, plotToSvg } from './relationSvg'
import { escapeXml, svgTag } from './svg'
import type { ChartSpec, PlotSpec } from '../ast'

// El backend web de gráficos es PURO (string, sin DOM): estos tests corren en Node, sin jsdom.
// Eso es exactamente lo que garantiza la co-localización con el backend LaTeX en core/.

describe('svgTag / escapeXml', () => {
  it('self-closing sin inner y con atributos escapados', () => {
    expect(svgTag('rect', { x: 1, y: 2 })).toBe('<rect x="1" y="2"/>')
    expect(svgTag('text', { class: 'a"b' }, 'x')).toBe('<text class="a&quot;b">x</text>')
  })
  it('omite atributos undefined (trazo continuo vs dashed)', () => {
    expect(svgTag('path', { d: 'M0 0', 'stroke-dasharray': undefined })).toBe('<path d="M0 0"/>')
  })
  it('escapa texto de contenido', () => {
    expect(escapeXml('a < b & c')).toBe('a &lt; b &amp; c')
    expect(svgTag('text', {}, '<script>')).toBe('<text>&lt;script&gt;</text>')
  })
  it('inner como array = markup hijo (no se escapa)', () => {
    expect(svgTag('svg', {}, ['<rect/>', '<circle/>'])).toBe('<svg><rect/><circle/></svg>')
  })
})

describe('plotToSvg (familia A4, puro)', () => {
  const base: PlotSpec = { functions: [{ expr: 'x^2' }], domain: [-3, 3] }

  it('devuelve un <svg> con el trazo de la función', () => {
    const svg = plotToSvg(base)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('class="matex-plot-svg"')
    expect(svg).toContain('<path') // la curva
  })

  it('dibuja la curva implícita como polilínea (path M/L)', () => {
    const svg = plotToSvg({ ...base, functions: [], implicits: [{ equation: 'x^2 + y^2 = 4' }], equalAxes: true })
    const paths = svg.match(/<path/g) ?? []
    expect(paths.length).toBeGreaterThan(0)
  })

  it('escapa los rótulos de texto (sin romper el markup)', () => {
    const svg = plotToSvg({ ...base, texts: [{ x: 0, y: 0, text: 'a < b' }] })
    expect(svg).toContain('a &lt; b')
    expect(svg).not.toContain('a < b')
  })

  it('funciones deshabilitadas no trazan', () => {
    const off = plotToSvg({ ...base, functions: [{ expr: 'x^2', disabled: true }] })
    expect(off).not.toContain('<path')
  })

  it('plotDisplayWindow: sin equalAxes = dominio × rango; con equalAxes expande (el zoom arranca de ahí)', () => {
    expect(plotDisplayWindow({ functions: [{ expr: 'x' }], domain: [-2, 2], range: [-3, 3] })).toEqual({ xmin: -2, xmax: 2, ymin: -3, ymax: 3 })
    const eq = plotDisplayWindow({ functions: [{ expr: 'x' }], domain: [-1, 1], range: [-1, 1], equalAxes: true })
    expect(eq.xmax - eq.xmin).toBeGreaterThan(eq.ymax - eq.ymin) // PW>PH → x se ensancha
    const view = { xmin: 0, xmax: 5, ymin: 0, ymax: 5 }
    expect(plotDisplayWindow({ functions: [{ expr: 'x' }], domain: [-1, 1], equalAxes: true }, view)).toEqual(view) // vista explícita gana
  })

  it('acepta una vista (zoom/pan) que reemplaza domain/range sin tocar la spec', () => {
    const full = plotToSvg(base)
    const zoomed = plotToSvg(base, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 })
    expect(zoomed).toContain('<path') // la curva sigue trazándose en la ventana nueva
    expect(zoomed).not.toBe(full) // ventana distinta → render distinto
  })

  it('muestra números en los ejes (coherencia con el PDF); ocultables con hideTicks', () => {
    // Chequeamos el **elemento** tick (`class="matex-plot-tick"`), no el nombre en el `<style>` embebido.
    expect(plotToSvg(base)).toContain('class="matex-plot-tick"')
    expect(plotToSvg({ ...base, hideTicks: true })).not.toContain('class="matex-plot-tick"')
  })

  it('punto anclado a f → se dibuja en y=f(x), no en la y almacenada', () => {
    // f(2)=4 con range [0,4] → cy = sy(4) = 8.0; la y=0 almacenada daría 212.0.
    const svg = plotToSvg({ ...base, range: [0, 4], points: [{ x: 2, y: 0, fn: 0 }] })
    expect(svg).toContain('cy="8.0"')
    expect(svg).not.toContain('cy="212.0"')
  })
})

describe('chartToSvg (familias A1/A2, puro)', () => {
  const cats: ChartSpec = { form: 'bar', categories: ['A', 'B'], series: [{ values: [3, 5] }] }

  it('barras → <rect>', () => {
    const svg = chartToSvg(cats)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<rect')
  })
  it('torta → sectores <path>', () => {
    const svg = chartToSvg({ ...cats, form: 'pie' })
    expect(svg).toContain('<path')
  })
  it('línea → <polyline>', () => {
    expect(chartToSvg({ ...cats, form: 'line' })).toContain('<polyline')
  })
})

describe('marcas de los ejes dentro del dibujo', () => {
  // Con el dominio desde 0 el eje Y va pegado al borde izquierdo: sus números a la izquierda
  // quedaban fuera del viewBox y se recortaban («1.5» se leía «5»).
  it('con el eje Y en el borde, los números del eje Y van del lado de adentro', () => {
    const svg = plotToSvg({ functions: [{ expr: 'sqrt(x)' }], domain: [0, 4] } as PlotSpec)
    const yTicks = [...svg.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="(start|end)"[^>]*class="matex-plot-tick"/g)]
    expect(yTicks.length).toBeGreaterThan(0)
    for (const [, , anchor] of yTicks) expect(anchor).toBe('start')
  })

  it('con el eje Y en el medio, los números siguen a su izquierda', () => {
    const svg = plotToSvg({ functions: [{ expr: 'x' }], domain: [-4, 4] } as PlotSpec)
    expect(svg).toMatch(/text-anchor="end"[^>]*class="matex-plot-tick"/)
  })
})
