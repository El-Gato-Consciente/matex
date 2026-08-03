import { describe, expect, it } from 'vitest'
import { compileExprToAscii, compileExprToLatex, compileExprToPgfplots, evalExpr, parseExpr, tangentSlope } from './plotExpr'

/** Evalúa una expresión (asume que parsea) en un punto. */
function ev(src: string, x: number): number {
  const r = parseExpr(src)
  if (!r.ok) throw new Error(`no parsea: ${src} (${r.error})`)
  return evalExpr(r.node, x)
}

describe('plotExpr — parser + evaluador', () => {
  it('aritmética, precedencia y paréntesis', () => {
    expect(ev('1 + 2*3', 0)).toBe(7)
    expect(ev('(1 + 2)*3', 0)).toBe(9)
    expect(ev('2 - 3 - 1', 0)).toBe(-2) // left-assoc
    expect(ev('8 / 2 / 2', 0)).toBe(2)
  })

  it('expresión constante (para campos numéricos): eval con x=NaN da el valor; con variable → NaN', () => {
    expect(ev('2*pi', Number.NaN)).toBeCloseTo(2 * Math.PI) // constante → válido
    expect(ev('pi/2', Number.NaN)).toBeCloseTo(Math.PI / 2)
    expect(ev('sqrt(2)', Number.NaN)).toBeCloseTo(Math.SQRT2)
    expect(Number.isNaN(ev('2*x', Number.NaN))).toBe(true) // depende de la variable → se rechaza
  })

  it('potencia asociativa a derecha; unario', () => {
    expect(ev('2^3^2', 0)).toBe(2 ** 9) // 2^(3^2)
    expect(ev('-x^2', 3)).toBe(-9) // -(x^2)
    expect(ev('2^-2', 0)).toBe(0.25) // exponente unario
  })

  it('variable x y constantes', () => {
    expect(ev('x^2 + 1', 4)).toBe(17)
    expect(ev('pi', 0)).toBeCloseTo(Math.PI)
    expect(ev('e', 0)).toBeCloseTo(Math.E)
  })

  it('multiplicación implícita: 2x, 2sin(x), (x+1)(x-1)', () => {
    expect(ev('2x', 5)).toBe(10)
    expect(ev('2sin(0)', 0)).toBe(0)
    expect(ev('(x+1)(x-1)', 3)).toBe(8) // x^2 - 1
  })

  it('funciones en radianes (= JS nativo)', () => {
    expect(ev('sin(pi/2)', 0)).toBeCloseTo(1)
    expect(ev('cos(0)', 0)).toBe(1)
    expect(ev('ln(e)', 0)).toBeCloseTo(1)
    expect(ev('log(100)', 0)).toBeCloseTo(2) // log = base 10
    expect(ev('sqrt(9)', 0)).toBe(3)
    expect(ev('abs(-4)', 0)).toBe(4)
  })

  it('fuera de dominio → NaN/Infinity (no rompe)', () => {
    expect(Number.isNaN(ev('sqrt(x)', -1))).toBe(true)
    expect(ev('1/x', 0)).toBe(Infinity)
  })

  it('acepta LaTeX indistintamente de ASCII (mismo resultado)', () => {
    // llaves = agrupación; \frac, \sqrt, \sin, \cdot, \pi, \left\right, ^{}
    expect(ev('x^{2}', 3)).toBe(9)
    expect(ev('\\frac{1}{x}', 4)).toBe(0.25)
    expect(ev('\\sqrt{x}', 9)).toBe(3)
    expect(ev('\\sin\\left(x\\right)', 0)).toBe(0)
    expect(ev('2\\cdot x', 5)).toBe(10)
    expect(ev('\\frac{x^2}{4}', 4)).toBe(4)
    expect(ev('\\sin(\\pi/2)', 0)).toBeCloseTo(1)
    // ASCII y LaTeX dan lo mismo
    expect(ev('\\frac{1}{2}x + 1', 4)).toBe(ev('(1/2)x + 1', 4))
    expect(compileExprToPgfplots('\\frac{x^2}{4}')).toBe(compileExprToPgfplots('x^2/4'))
    expect(compileExprToLatex('\\sqrt{x}')).toBe(compileExprToLatex('sqrt(x)'))
  })

  it('errores legibles', () => {
    expect(parseExpr('')).toMatchObject({ ok: false })
    expect(parseExpr('x +')).toMatchObject({ ok: false })
    expect(parseExpr('foo(x)')).toMatchObject({ ok: false, error: expect.stringContaining('función desconocida') })
    expect(parseExpr('y + 1')).toMatchObject({ ok: false })
    expect(parseExpr('2 @ 3')).toMatchObject({ ok: false })
  })
})

describe('plotExpr — emisor pgfplots', () => {
  it('emite pgfplots correcto (parentizado)', () => {
    expect(compileExprToPgfplots('x^2 - 1')).toBe('((x ^ 2) - 1)')
    expect(compileExprToPgfplots('sin(x)')).toBe('sin(x)')
    expect(compileExprToPgfplots('log(x)')).toBe('log10(x)') // base 10 → log10
    expect(compileExprToPgfplots('-x')).toBe('(-x)')
    expect(compileExprToPgfplots('2x')).toBe('(2 * x)') // mult implícita explícita en la salida
    expect(compileExprToPgfplots('pi*x')).toBe('(pi * x)')
  })

  it('variable configurable: `t` en vez de `x` (paramétricas/polares)', () => {
    expect(compileExprToPgfplots('cos(t)', 't')).toBe('cos(t)')
    expect(compileExprToPgfplots('t^2 + 1', 't')).toBe('((t ^ 2) + 1)')
    expect(parseExpr('t^2', 'both', 't')).toMatchObject({ ok: true })
    expect(parseExpr('x', 'both', 't')).toMatchObject({ ok: false }) // `x` no es la variable
    // conversión de modo (toggle ASCII↔LaTeX) también en variable `t`
    expect(compileExprToAscii('\\sin\\left(t\\right)', 'latex', 't')).toBe('sin(t)')
    expect(compileExprToLatex('t^2', 'both', 't')).toBe('t^{2}')
  })

  it('sec/csc/cot → recíprocas de cos/sin/tan (radian-safe)', () => {
    expect(compileExprToPgfplots('sec(x)')).toBe('(1/cos(x))')
    expect(compileExprToPgfplots('csc(x)')).toBe('(1/sin(x))')
    expect(compileExprToPgfplots('cot(x)')).toBe('(1/tan(x))')
  })

  it('expresión inválida → null', () => {
    expect(compileExprToPgfplots('x +')).toBeNull()
  })
})

describe('plotExpr — emisor LaTeX (leyendas/labels math)', () => {
  it('emite LaTeX matemático parentizando lo mínimo', () => {
    expect(compileExprToLatex('x^2')).toBe('x^{2}')
    expect(compileExprToLatex('1/x')).toBe('\\frac{1}{x}')
    expect(compileExprToLatex('sqrt(x)')).toBe('\\sqrt{x}')
    expect(compileExprToLatex('sin(x)')).toBe('\\sin\\left(x\\right)')
    expect(compileExprToLatex('abs(x)')).toBe('\\abs{x}')
    expect(compileExprToLatex('2*x')).toBe('2 \\cdot x')
    expect(compileExprToLatex('(x+1)^2')).toBe('\\left(x + 1\\right)^{2}')
    expect(compileExprToLatex('pi*x')).toBe('\\pi \\cdot x')
    expect(compileExprToLatex('exp(x)')).toBe('e^{x}')
    expect(compileExprToLatex('sec(x)')).toBe('\\sec\\left(x\\right)')
    expect(compileExprToLatex('cot(x)')).toBe('\\cot\\left(x\\right)')
  })

  it('expresión inválida → null', () => {
    expect(compileExprToLatex('x +')).toBeNull()
  })
})

describe('plotExpr — modo ASCII vs LaTeX + emisor ASCII', () => {
  it('modo ASCII rechaza comandos/llaves LaTeX; modo LaTeX los acepta', () => {
    expect(parseExpr('\\sqrt{x}', 'ascii')).toMatchObject({ ok: false })
    expect(parseExpr('x^{2}', 'ascii')).toMatchObject({ ok: false })
    expect(parseExpr('\\sqrt{x}', 'latex')).toMatchObject({ ok: true })
    // lo común vale en ambos modos
    expect(parseExpr('sqrt(x)', 'ascii')).toMatchObject({ ok: true })
    expect(parseExpr('x^2', 'ascii')).toMatchObject({ ok: true })
    expect(parseExpr('sin(x)', 'latex')).toMatchObject({ ok: true })
  })

  it('exprToAscii: LaTeX → ASCII (para convertir al cambiar de modo)', () => {
    expect(compileExprToAscii('\\frac{x^2}{4}')).toBe('x^2/4')
    expect(compileExprToAscii('\\sqrt{x}')).toBe('sqrt(x)')
    expect(compileExprToAscii('\\sin\\left(x\\right)')).toBe('sin(x)')
    expect(compileExprToAscii('\\frac{1}{2}')).toBe('1/2')
  })

  it('round-trip ASCII↔LaTeX vía AST (misma matemática)', () => {
    // ascii → latex → ascii preserva el AST (mismo pgfplots)
    const ascii = 'x^2/4 + sin(x)'
    const latex = compileExprToLatex(ascii)!
    expect(compileExprToPgfplots(compileExprToAscii(latex)!)).toBe(compileExprToPgfplots(ascii))
  })

  it('abs round-trip: \\abs{…} vuelve a ASCII (no \\left|…\\right| que no reparsea)', () => {
    expect(compileExprToLatex('abs(x)')).toBe('\\abs{x}')
    expect(parseExpr('\\abs{x}', 'latex')).toMatchObject({ ok: true })
    expect(compileExprToAscii('\\abs{x-1}')).toBe('abs(x - 1)')
  })
})

describe('referencias fN por evaluador (ME-45: usar una función-de-datos en otra fórmula)', () => {
  it('parsea fN(x) y evalúa vía env (f2 = f1(x)+1 con f1 = evaluador arbitrario)', () => {
    const r = parseExpr('f1(x) + 1')
    expect(r.ok).toBe(true)
    const f1 = (x: number): number => x * x // f1 podría ser una interpolación; acá un cuadrado
    expect(evalExpr((r as { node: import('./plotExpr').ExprNode }).node, 3, [f1])).toBe(10) // 3²+1
  })
  it('fN sin paréntesis = fN(x); sin env da NaN', () => {
    const r = parseExpr('2*f1')
    expect(r.ok).toBe(true)
    const node = (r as { node: import('./plotExpr').ExprNode }).node
    expect(evalExpr(node, 5, [(x) => x + 1])).toBe(12) // 2*(5+1)
    expect(Number.isNaN(evalExpr(node, 5))).toBe(true) // sin env
  })
})

describe('tangentSlope — pendiente numérica + detección de tangente vertical', () => {
  const evOf = (src: string) => {
    const r = parseExpr(src)
    if (!r.ok) throw new Error(`no parsea: ${src}`)
    return (x: number): number => evalExpr(r.node, x)
  }
  const at = (src: string, x: number) => {
    const f = evOf(src)
    return tangentSlope(f, x, f(x))
  }

  it('pendiente FINITA empinada NO es vertical (caso reportado (1-2x)/√(1-x²) en x=0.86)', () => {
    const { m, vertical } = at('(1-2*x)/sqrt(1-x^2)', 0.86)
    expect(vertical).toBe(false)
    expect(m).toBeCloseTo(-8.58, 1) // f'(0.86) finita, ~-8.58
  })

  it('recta empinada finita (y=50x) sigue siendo recta, no vertical', () => {
    expect(at('50*x', 0.3).vertical).toBe(false)
  })

  it('pendiente que DIVERGE en el borde del dominio SÍ es vertical (√(1-x²) en x=1)', () => {
    expect(at('sqrt(1 - x^2)', 1).vertical).toBe(true)
    expect(at('sqrt(1 - x^2)', -1).vertical).toBe(true)
  })

  it('tangente común: parábola en x=1 → m≈2, no vertical', () => {
    const { m, vertical } = at('x^2', 1)
    expect(vertical).toBe(false)
    expect(m).toBeCloseTo(2, 3)
  })
})
