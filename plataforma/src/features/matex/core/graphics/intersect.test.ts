import { describe, expect, it } from 'vitest'
import { intersectionPoints } from './intersect'
import type { PlotSpec } from '../ast'

const vp = { xmin: -3, xmax: 3, ymin: -3, ymax: 3 }
/** ¿Hay un punto cerca de (x, y) (tolerancia por el muestreo)? */
const near = (pts: [number, number][], x: number, y: number, tol = 0.05): boolean =>
  pts.some(([px, py]) => Math.abs(px - x) < tol && Math.abs(py - y) < tol)

describe('intersectionPoints', () => {
  it('recta y=x ∩ parábola y=x² → (0,0) y (1,1)', () => {
    const spec: PlotSpec = { functions: [{ expr: 'x' }, { expr: 'x^2' }], domain: [-3, 3], range: [-3, 3] }
    const pts = intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'function', i: 1 }, vp)
    expect(near(pts, 0, 0)).toBe(true)
    expect(near(pts, 1, 1)).toBe(true)
    expect(pts.length).toBe(2)
  })

  it('recta y=0 ∩ circunferencia x²+y²=4 → (±2, 0)', () => {
    const spec: PlotSpec = { functions: [{ expr: '0' }], implicits: [{ equation: 'x^2 + y^2 = 4' }], domain: [-3, 3], range: [-3, 3] }
    const pts = intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'implicit', i: 0 }, vp)
    expect(near(pts, 2, 0, 0.1)).toBe(true)
    expect(near(pts, -2, 0, 0.1)).toBe(true)
  })

  it('parábola y=x²−1 ∩ eje x → raíces (±1, 0)', () => {
    const spec: PlotSpec = { functions: [{ expr: 'x^2 - 1' }], domain: [-3, 3], range: [-3, 3] }
    const pts = intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'xaxis', i: 0 }, vp)
    expect(near(pts, 1, 0)).toBe(true)
    expect(near(pts, -1, 0)).toBe(true)
  })

  it('x² ∩ eje x (tangente, no cruza) → (0, 0) por detección de tangencia', () => {
    const spec: PlotSpec = { functions: [{ expr: 'x^2' }], domain: [-3, 3], range: [-3, 3] }
    const pts = intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'xaxis', i: 0 }, vp)
    expect(near(pts, 0, 0, 0.02)).toBe(true)
  })

  it('x³ ∩ eje x → (0, 0)', () => {
    const spec: PlotSpec = { functions: [{ expr: 'x^3' }], domain: [-3, 3], range: [-3, 3] }
    const pts = intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'xaxis', i: 0 }, vp)
    expect(near(pts, 0, 0, 0.02)).toBe(true)
  })

  it('f(x)=2x+1 ∩ eje y → ordenada al origen (0, 1)', () => {
    const spec: PlotSpec = { functions: [{ expr: '2*x + 1' }], domain: [-3, 3], range: [-3, 3] }
    const pts = intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'yaxis', i: 0 }, vp)
    expect(near(pts, 0, 1)).toBe(true)
  })

  it('curvas que no se cruzan → sin puntos', () => {
    const spec: PlotSpec = { functions: [{ expr: '2' }, { expr: '-2' }], domain: [-3, 3], range: [-3, 3] }
    expect(intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'function', i: 1 }, vp)).toHaveLength(0)
  })

  it('referencia inválida (curva inexistente) → sin puntos, sin romper', () => {
    const spec: PlotSpec = { functions: [{ expr: 'x' }], domain: [-3, 3] }
    expect(intersectionPoints(spec, { kind: 'function', i: 0 }, { kind: 'function', i: 9 }, vp)).toHaveLength(0)
  })
})
