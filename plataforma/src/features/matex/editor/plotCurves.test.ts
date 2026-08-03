import { describe, expect, it } from 'vitest'
import type { CurveRef, PlotSpec } from '../core'
import { ARR_KEY, clean, curveCount, CURVE_LABEL, curveOptions, curveRefKey, parseCurveRefKey, subDigits } from './plotCurves'

/** Spec mínima con los arrays que la prueba necesita (el resto queda por defecto). */
function spec(partial: Partial<PlotSpec>): PlotSpec {
  return { functions: [], domain: [-5, 5], ...partial }
}

describe('plotCurves — mapeo tipo↔array', () => {
  it('ARR_KEY y CURVE_LABEL cubren los seis tipos', () => {
    const types = ['function', 'data', 'parametric', 'polar', 'implicit', 'conic'] as const
    for (const t of types) {
      expect(ARR_KEY[t]).toBeTruthy()
      expect(CURVE_LABEL[t]).toBeTruthy()
    }
    // ARR_KEY apunta al nombre real del array en el PlotSpec.
    expect(ARR_KEY.function).toBe('functions')
    expect(ARR_KEY.parametric).toBe('parametrics')
  })
})

describe('curveCount — curvas reales, sin ejes', () => {
  it('suma funciones + implícitas + paramétricas + polares', () => {
    const s = spec({
      functions: [{ expr: 'x' }, { expr: 'x^2' }],
      implicits: [{ equation: 'x^2+y^2=1' }],
      parametrics: [{ x: 'cos(t)', y: 'sin(t)' }],
    } as Partial<PlotSpec>)
    expect(curveCount(s)).toBe(4)
  })

  it('es 0 sin curvas (arrays ausentes)', () => {
    expect(curveCount(spec({}))).toBe(0)
  })
})

describe('curveOptions — curvas + ejes con etiqueta', () => {
  it('rotula funciones f1.. e incluye siempre los dos ejes', () => {
    const opts = curveOptions(spec({ functions: [{ expr: 'x' }, { expr: 'x^2' }] } as Partial<PlotSpec>))
    expect(opts.map((o) => o.label)).toEqual(['f1', 'f2', 'eje x', 'eje y'])
  })

  it('trunca ecuaciones implícitas largas a 15 + elipsis', () => {
    const long = 'x^2 + y^2 + z^2 = 100'
    const opts = curveOptions(spec({ implicits: [{ equation: long }] } as Partial<PlotSpec>))
    const implicit = opts.find((o) => o.ref.kind === 'implicit')
    expect(implicit?.label).toBe(`${long.slice(0, 15)}…`)
  })

  it('usa un nombre genérico para la implícita vacía', () => {
    const opts = curveOptions(spec({ implicits: [{ equation: '   ' }] } as Partial<PlotSpec>))
    expect(opts.find((o) => o.ref.kind === 'implicit')?.label).toBe('implícita 1')
  })
})

describe('curveRefKey / parseCurveRefKey — round-trip', () => {
  const refs: CurveRef[] = [
    { kind: 'function', i: 0 },
    { kind: 'implicit', i: 3 },
    { kind: 'parametric', i: 1 },
    { kind: 'polar', i: 2 },
    { kind: 'xaxis', i: 0 },
    { kind: 'yaxis', i: 0 },
  ]
  it('serializa y deserializa sin pérdida', () => {
    for (const r of refs) expect(parseCurveRefKey(curveRefKey(r))).toEqual(r)
  })

  it('rechaza claves inválidas', () => {
    expect(parseCurveRefKey('bogus:0')).toBeNull()
    expect(parseCurveRefKey('function:NaN')).toBeNull()
    expect(parseCurveRefKey('')).toBeNull()
  })
})

describe('subDigits — subíndices unicode', () => {
  it('convierte cada dígito a su subíndice', () => {
    expect(subDigits(1)).toBe('₁')
    expect(subDigits(42)).toBe('₄₂')
  })
})

describe('clean — descarta claves undefined', () => {
  it('quita solo las undefined y conserva falsy legítimos', () => {
    expect(clean({ a: 1, b: undefined, c: 0, d: '', e: false })).toEqual({ a: 1, c: 0, d: '', e: false })
  })
})
