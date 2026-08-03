import { describe, expect, it } from 'vitest'
import { evalExpr, parseExpr } from '../plotExpr'
import { detectFeatures, detectAsymptotes, type FeatureKind } from './features'

/** Evaluador `f(x)` de `src` (asume que parsea). */
function evOf(src: string): (x: number) => number {
  const r = parseExpr(src)
  if (!r.ok) throw new Error(`no parsea: ${src}`)
  return (x: number) => evalExpr(r.node, x)
}
/** Parsea `src` y detecta rasgos en `domain`. */
function feats(src: string, domain: [number, number], opts: { roots?: boolean; extrema?: boolean; inflections?: boolean; yIntercept?: boolean }) {
  return detectFeatures(evOf(src), domain, opts)
}
const xsOf = (fs: { x: number }[]) => fs.map((f) => f.x).sort((a, b) => a - b)
const kindsAt = (fs: { x: number; kind: FeatureKind }[]) => fs.map((f) => `${f.kind}@${f.x.toFixed(2)}`)

describe('detectFeatures — rasgos notables numéricos (ME-39)', () => {
  it('raíces de x²−1 en [−2,2] → x=±1', () => {
    const xs = xsOf(feats('x^2 - 1', [-2, 2], { roots: true }))
    expect(xs.length).toBe(2)
    expect(xs[0]).toBeCloseTo(-1, 3)
    expect(xs[1]).toBeCloseTo(1, 3)
  })

  it('extremo de x² en [−2,2] → mínimo en x=0', () => {
    const fs = feats('x^2', [-2, 2], { extrema: true })
    expect(fs.length).toBe(1)
    expect(fs[0]!.kind).toBe('min')
    expect(fs[0]!.x).toBeCloseTo(0, 3)
  })

  it('extremos de x³−3x en [−3,3] → máx en −1, mín en +1', () => {
    const fs = feats('x^3 - 3*x', [-3, 3], { extrema: true }).sort((a, b) => a.x - b.x)
    expect(kindsAt(fs)).toEqual(['max@-1.00', 'min@1.00'])
  })

  it('ordenada al origen de x²+2 en [−3,3] → (0, 2)', () => {
    const fs = feats('x^2 + 2', [-3, 3], { yIntercept: true })
    expect(fs.length).toBe(1)
    expect(fs[0]!.kind).toBe('yintercept')
    expect(fs[0]!.x).toBe(0)
    expect(fs[0]!.y).toBeCloseTo(2, 6)
  })

  it('ordenada al origen NO se marca si 0 está fuera del dominio', () => {
    expect(feats('1/x', [1, 5], { yIntercept: true }).length).toBe(0)
  })

  it('inflexión de x³ en [−2,2] → x=0', () => {
    const fs = feats('x^3', [-2, 2], { inflections: true })
    expect(fs.length).toBe(1)
    expect(fs[0]!.x).toBeCloseTo(0, 2)
  })

  it('no inventa raíces en la asíntota de 1/x (el "cruce" del polo se descarta)', () => {
    const fs = feats('1/x', [-2, 2], { roots: true })
    expect(fs.length).toBe(0)
  })

  it('raíz DOBLE (tangente): x² toca el eje en x=0 sin cruzarlo → se detecta igual', () => {
    const fs = feats('x^2', [-2, 2], { roots: true })
    expect(fs.length).toBe(1)
    expect(fs[0]!.x).toBeCloseTo(0, 3)
  })

  it('(x−1)² → raíz doble en x=1', () => {
    const fs = feats('(x-1)^2', [-1, 3], { roots: true })
    expect(fs.map((f) => f.x)).toHaveLength(1)
    expect(fs[0]!.x).toBeCloseTo(1, 3)
  })
})

describe('detectAsymptotes — asíntotas numéricas (ME-39)', () => {
  const asy = (src: string, domain: [number, number]) => detectAsymptotes(evOf(src), domain)

  it('1/(x−1): vertical x=1 + horizontal y=0', () => {
    const a = asy('1/(x-1)', [-4, 6])
    expect(a.some((z) => z.kind === 'vertical' && Math.abs(z.at! - 1) < 1e-2)).toBe(true)
    expect(a.some((z) => z.kind === 'horizontal' && Math.abs(z.b!) < 1e-2)).toBe(true)
  })

  it('(x²+1)/x: vertical x=0 + oblicua y=x', () => {
    const a = asy('(x^2+1)/x', [-6, 6])
    expect(a.some((z) => z.kind === 'vertical' && Math.abs(z.at!) < 1e-2)).toBe(true)
    expect(a.some((z) => z.kind === 'oblique' && Math.abs(z.m! - 1) < 1e-2 && Math.abs(z.b!) < 1e-2)).toBe(true)
  })

  it('parábola x²: sin asíntotas (no converge a una recta)', () => {
    expect(asy('x^2', [-5, 5]).length).toBe(0)
  })
})
