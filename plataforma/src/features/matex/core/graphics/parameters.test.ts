import { describe, expect, it } from 'vitest'
import { resolvePlotParameters } from './parameters'
import type { PlotSpec } from '../ast'

const base = (functions: PlotSpec['functions'], parameters?: PlotSpec['parameters']): PlotSpec => ({
  functions,
  domain: [-5, 5],
  ...(parameters ? { parameters } : {}),
})

describe('resolvePlotParameters (ME-36 fase A)', () => {
  it('sustituye el parámetro por su valor (envuelto en paréntesis)', () => {
    const out = resolvePlotParameters(base([{ expr: 'a*x^2 + b' }], [{ name: 'a', value: 2 }, { name: 'b', value: -3 }]))
    expect(out.functions[0]!.expr).toBe('(2)*x^2 + (-3)')
  })

  it('respeta límites de identificador (no toca `a` dentro de `max`/`abs`/nombres largos)', () => {
    const out = resolvePlotParameters(base([{ expr: 'max(a, x) + abs(a)' }], [{ name: 'a', value: 4 }]))
    expect(out.functions[0]!.expr).toBe('max((4), x) + abs((4))')
    // no rompió `max`/`abs`
    expect(out.functions[0]!.expr).toContain('max(')
    expect(out.functions[0]!.expr).toContain('abs(')
  })

  it('sustituye en ramas (pieces), paramétricas, polares e implícitas', () => {
    const out = resolvePlotParameters({
      functions: [{ expr: '', pieces: [{ expr: 'a*x', from: 0, to: 1 }] }],
      domain: [-5, 5],
      parametrics: [{ x: 'a*cos(t)', y: 'a*sin(t)', tmin: 0, tmax: 6.28 }],
      polars: [{ r: 'a + cos(t)', tmin: 0, tmax: 6.28 }],
      implicits: [{ equation: 'x^2 + y^2 = a' }],
      parameters: [{ name: 'a', value: 3 }],
    })
    expect(out.functions[0]!.pieces![0]!.expr).toBe('(3)*x')
    expect(out.parametrics![0]!.x).toBe('(3)*cos(t)')
    expect(out.polars![0]!.r).toBe('(3) + cos(t)')
    expect(out.implicits![0]!.equation).toBe('x^2 + y^2 = (3)')
  })

  it('sin parámetros devuelve la misma spec (identidad)', () => {
    const spec = base([{ expr: 'x^2' }])
    expect(resolvePlotParameters(spec)).toBe(spec)
  })

  it('ignora parámetros con nombre inválido o valor no finito', () => {
    const out = resolvePlotParameters(base([{ expr: '2a + x' }], [{ name: '2a', value: 1 }, { name: 'k', value: NaN }]))
    expect(out.functions[0]!.expr).toBe('2a + x') // ninguno se aplicó
  })

  it('no muta la entrada', () => {
    const spec = base([{ expr: 'a*x' }], [{ name: 'a', value: 2 }])
    resolvePlotParameters(spec)
    expect(spec.functions[0]!.expr).toBe('a*x')
  })

  it('campos posicionales con `*Expr` se evalúan a número (tangente/punto/área/vlines/hlines)', () => {
    const out = resolvePlotParameters({
      functions: [{ expr: 'x^2' }],
      domain: [-5, 5],
      parameters: [{ name: 'a', value: 3 }],
      tangents: [{ fn: 0, at: 0, atExpr: 'a' }],
      points: [{ x: 0, y: 0, fn: 0, xExpr: 'a - 1' }],
      areas: [{ fn: 0, from: 0, to: 0, toExpr: 'a' }],
      vlines: [{ x: 0, xExpr: 'a/2' }],
      hlines: [{ y: 0, yExpr: 'a*a' }],
    })
    expect(out.tangents![0]!.at).toBe(3)
    expect(out.points![0]!.x).toBe(2)
    expect(out.areas![0]!.to).toBe(3)
    expect(out.vlines![0]!.x).toBe(1.5)
    expect(out.hlines![0]!.y).toBe(9)
  })

  it('un `*Expr` que no resuelve (parámetro inexistente) deja el valor numérico', () => {
    const out = resolvePlotParameters({
      functions: [{ expr: 'x' }],
      domain: [-5, 5],
      parameters: [{ name: 'a', value: 2 }],
      tangents: [{ fn: 0, at: 1.5, atExpr: 'b' }], // `b` no existe → queda `at`
    })
    expect(out.tangents![0]!.at).toBe(1.5)
  })
})
