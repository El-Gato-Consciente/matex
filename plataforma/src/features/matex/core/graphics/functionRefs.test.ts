import { describe, expect, it } from 'vitest'
import { evalExpr, parseExpr } from '../plotExpr'
import { resolvePlotFunctions } from './functionRefs'

/** Evalúa una expresión ASCII en `x` (NaN si no parsea). */
function evalAt(expr: string, x: number): number {
  const p = parseExpr(expr)
  return p.ok ? evalExpr(p.node, x) : Number.NaN
}
const resolvedExpr = (fns: { expr: string }[], i: number): string => resolvePlotFunctions(fns)[i]!.expr

describe('functionRefs — resolución de referencias entre funciones (A4)', () => {
  it('transformación g(x)=f1(x)+1 sustituye el texto de f1', () => {
    const r = resolvedExpr([{ expr: 'x^2' }, { expr: 'f1(x)+1' }], 1)
    expect(r).not.toContain('f1')
    expect(parseExpr(r).ok).toBe(true)
    expect(evalAt(r, 3)).toBeCloseTo(10) // 3^2 + 1
  })

  it('composición f2(f1(x)) = (x+1)^2', () => {
    const r = resolvedExpr([{ expr: 'x+1' }, { expr: 'x^2' }, { expr: 'f2(f1(x))' }], 2)
    expect(r).not.toMatch(/f[12]/)
    expect(evalAt(r, 2)).toBeCloseTo(9) // (2+1)^2
  })

  it('referencia sin argumento f1 equivale a f1(x)', () => {
    expect(evalAt(resolvedExpr([{ expr: '2*x' }, { expr: 'f1+3' }], 1), 5)).toBeCloseTo(13) // 2*5+3
  })

  it('ciclo f1↔f2 deja la referencia sin resolver (queda inválida)', () => {
    expect(resolvePlotFunctions([{ expr: 'f2(x)' }, { expr: 'f1(x)' }])[0]!.expr).toMatch(/f\d/)
  })

  it('auto-referencia f1 dentro de f1 no se resuelve (evita bucle)', () => {
    expect(resolvePlotFunctions([{ expr: 'f1(x)+1' }])[0]!.expr).toContain('f1')
  })

  it('referencia a función inexistente se deja tal cual', () => {
    expect(resolvePlotFunctions([{ expr: 'f9(x)' }])[0]!.expr).toContain('f9')
  })

  it('sin referencias no cambia; resuelve también las ramas partidas', () => {
    expect(resolvedExpr([{ expr: 'sin(x)' }], 0)).toBe('sin(x)')
    const piece = resolvePlotFunctions([{ expr: 'x^2' }, { expr: '', pieces: [{ expr: 'f1(x)' }] }])[1]!
    expect(piece.pieces?.[0]?.expr).not.toContain('f1')
  })
})
