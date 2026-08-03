import { describe, expect, it } from 'vitest'
import { interpolateSeries, interpolateEvaluator } from './interpolate'

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol

describe('interpolateSeries — interpolación / ajuste (ME-45)', () => {
  it('lineal: devuelve los puntos ordenados por x', () => {
    const { curve } = interpolateSeries([[2, 4], [0, 0], [1, 1]], 'linear')
    expect(curve.map((p) => p[0])).toEqual([0, 1, 2])
  })

  it('spline pasa POR los puntos de datos (y=x² en x=−2..2)', () => {
    const pts: [number, number][] = [[-2, 4], [-1, 1], [0, 0], [1, 1], [2, 4]]
    const { curve } = interpolateSeries(pts, 'spline')
    // en cada x de dato, el spline reproduce el y
    for (const [px, py] of pts) {
      const hit = curve.find((c) => near(c[0], px, 1e-3))
      expect(hit && near(hit[1], py, 1e-3)).toBeTruthy()
    }
  })

  it('polinómica (Lagrange) reproduce exactamente una parábola con 3 puntos', () => {
    const { curve } = interpolateSeries([[-1, 1], [0, 0], [2, 4]], 'polynomial')
    // y = x² → en x=1.5 debería dar 2.25
    const mid = curve.reduce((best, c) => (Math.abs(c[0] - 1.5) < Math.abs(best[0] - 1.5) ? c : best))
    expect(near(mid[1], mid[0] ** 2, 0.02)).toBe(true)
  })

  it('regresión lineal ajusta y = 2x + 1 aunque los puntos no sean exactos', () => {
    const { curve, equation } = interpolateSeries([[0, 1.1], [1, 2.9], [2, 5.1], [3, 6.9]], 'regression', { degree: 1 })
    expect(curve.length).toBeGreaterThan(2)
    expect(equation).toMatch(/y ≈/)
    // pendiente ≈ 2 (primer y último punto muestreado)
    const slope = (curve[curve.length - 1]![1] - curve[0]![1]) / (curve[curve.length - 1]![0] - curve[0]![0])
    expect(near(slope, 2, 0.1)).toBe(true)
  })

  it('x REPETIDO con distinto y → promedia y avisa (no rompe)', () => {
    const { curve, warning } = interpolateSeries([[0, 0], [1, 1], [1, 3], [2, 2]], 'linear')
    expect(warning).toMatch(/repetidos/)
    const atOne = curve.find((c) => near(c[0], 1))
    expect(atOne && near(atOne[1], 2)).toBeTruthy() // (1+3)/2 = 2
  })

  it('regresión tolera x repetidos sin aviso (ajusta, no interpola)', () => {
    const { warning } = interpolateSeries([[1, 1], [1, 3], [2, 2], [3, 5]], 'regression')
    expect(warning).toBeUndefined()
  })

  it('monótona (PCHIP) pasa por los puntos y NO sobrepasa (datos monótonos)', () => {
    const pts: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1]]
    const { curve } = interpolateSeries(pts, 'monotone')
    for (const [px, py] of pts) {
      const hit = curve.find((c) => near(c[0], px, 1e-3))
      expect(hit && near(hit[1], py, 1e-3)).toBeTruthy()
    }
    // monótona no creciente-decreciente espuria: ningún y por debajo de 0 ni por encima de 1
    expect(curve.every(([, y]) => y >= -1e-6 && y <= 1 + 1e-6)).toBe(true)
  })

  it('trayectoria: polyline cerrada vuelve al primer punto', () => {
    const p: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
    const open = interpolateSeries(p, 'polyline')
    const closed = interpolateSeries(p, 'polyline', { closed: true })
    expect(open.curve).toHaveLength(4)
    expect(closed.curve[closed.curve.length - 1]).toEqual([0, 0]) // cierra al primero
  })

  it('trayectoria smooth (Catmull-Rom) acepta puntos con x repetido / verticales (no es función)', () => {
    // un "8"/óvalo con x repetidos — imposible como y=f(x), válido como curva
    const p: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]]
    const { curve, warning } = interpolateSeries(p, 'smooth', { closed: true })
    expect(warning).toBeUndefined() // no promedia ni se queja: es una trayectoria
    expect(curve.length).toBeGreaterThan(p.length)
  })

  it('regresión exponencial ajusta y = 2·e^{0.5x}', () => {
    const pts: [number, number][] = [0, 1, 2, 3, 4].map((x) => [x, 2 * Math.exp(0.5 * x)])
    const { equation } = interpolateSeries(pts, 'reg-exp')
    expect(equation).toMatch(/e\^/)
    expect(equation).toMatch(/2/) // a≈2
  })

  it('regresión potencia y = 3·x^2; logarítmica no rompe con x>0', () => {
    const pw: [number, number][] = [1, 2, 3, 4].map((x) => [x, 3 * x ** 2])
    expect(interpolateSeries(pw, 'reg-power').equation).toMatch(/x\^/)
    const lg: [number, number][] = [1, 2, 3, 4].map((x) => [x, Math.log(x) + 5])
    expect(interpolateSeries(lg, 'reg-log').equation).toMatch(/ln\(x\)/)
  })

  it('reg-power ignora (con aviso) puntos con x≤0 o y≤0', () => {
    const { warning } = interpolateSeries([[-1, 2], [1, 3], [2, 12], [3, 27]], 'reg-power')
    expect(warning).toMatch(/ignoraron/)
  })

  it('interpolateEvaluator: la spline de datos es una f(x) evaluable (ME-45 N2)', () => {
    const ev = interpolateEvaluator([[-2, 4], [-1, 1], [0, 0], [1, 1], [2, 4]], 'spline')
    expect(ev).not.toBeNull()
    expect(near(ev!.eval(0), 0, 1e-6)).toBe(true)
    expect(near(ev!.eval(1), 1, 1e-6)).toBe(true) // pasa por los puntos
  })

  it('interpolateEvaluator: los métodos de trayectoria NO son función → null', () => {
    expect(interpolateEvaluator([[0, 0], [1, 1], [0, 2]], 'smooth')).toBeNull()
    expect(interpolateEvaluator([[0, 0], [1, 1]], 'polyline')).toBeNull()
  })

  it('interpolateEvaluator: regresión lineal → evaluador con ecuación', () => {
    const ev = interpolateEvaluator([[0, 1], [1, 3], [2, 5]], 'regression', { degree: 1 })
    expect(ev?.equation).toMatch(/y ≈/)
    expect(near(ev!.eval(3), 7, 1e-6)).toBe(true) // y = 2x+1
  })
})
