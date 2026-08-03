import { describe, expect, it } from 'vitest'
import { parseExprXY } from '../plotExpr'
import { implicitCurve } from './implicit'

const curveOf = (src: string, vp = { xmin: -2, xmax: 2, ymin: -2, ymax: 2 }, res = 120) => {
  const p = parseExprXY(src)
  if (!p.ok) throw new Error(p.error)
  return implicitCurve(p.node, vp, res)
}

describe('implicitCurve — marching squares + refinamiento', () => {
  it('círculo x²+y²−1=0 → puntos sobre el radio 1', () => {
    const polys = curveOf('x^2 + y^2 - 1')
    const pts = polys.flat()
    expect(pts.length).toBeGreaterThan(50)
    // Todos los puntos están (muy) cerca del radio 1.
    for (const [x, y] of pts) expect(Math.abs(Math.hypot(x, y) - 1)).toBeLessThan(0.02)
    // Cubre las cuatro direcciones (curva cerrada completa).
    expect(pts.some(([x]) => x > 0.9)).toBe(true)
    expect(pts.some(([x]) => x < -0.9)).toBe(true)
    expect(pts.some(([, y]) => y > 0.9)).toBe(true)
    expect(pts.some(([, y]) => y < -0.9)).toBe(true)
  })

  it('hipérbola rotada x·y=1 (F=x·y−1) → dos ramas', () => {
    const polys = curveOf('x*y - 1', { xmin: -3, xmax: 3, ymin: -3, ymax: 3 })
    const pts = polys.flat()
    expect(pts.length).toBeGreaterThan(20)
    // Cada punto satisface x·y ≈ 1.
    for (const [x, y] of pts) expect(Math.abs(x * y - 1)).toBeLessThan(0.05)
    // Dos ramas (1er y 3er cuadrante).
    expect(pts.some(([x]) => x > 0)).toBe(true)
    expect(pts.some(([x]) => x < 0)).toBe(true)
  })

  it('curva vacía (sin cruce en el viewport) → sin polilíneas', () => {
    expect(curveOf('x^2 + y^2 + 1').length).toBe(0) // nunca 0
  })

  it('curva trascendente sin(x)+sin(y)=1 → hay trazos', () => {
    expect(curveOf('sin(x) + sin(y) - 1', { xmin: -6, xmax: 6, ymin: -6, ymax: 6 }).flat().length).toBeGreaterThan(20)
  })
})
