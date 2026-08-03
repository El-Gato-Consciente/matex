import { describe, expect, it } from 'vitest'
import type { PlotSpec } from '../core'
import { evalConst, fnValueAt, parsePointsText, PLOT_TOKEN_GROUPS } from './plotEditorUtils'

function spec(partial: Partial<PlotSpec>): PlotSpec {
  return { functions: [], domain: [-5, 5], ...partial }
}

describe('parsePointsText — puntos desde texto libre', () => {
  it('acepta una línea por punto, separadores coma o espacio', () => {
    expect(parsePointsText('1 2\n3,4\n-5 6')).toEqual([
      [1, 2],
      [3, 4],
      [-5, 6],
    ])
  })

  it('ignora líneas inválidas (menos de dos números o no numéricas)', () => {
    expect(parsePointsText('1 2\nbasura\n7\n8 9')).toEqual([
      [1, 2],
      [8, 9],
    ])
  })

  it('toma solo las dos primeras columnas de cada línea', () => {
    expect(parsePointsText('1 2 3 4')).toEqual([[1, 2]])
  })
})

describe('evalConst — número o expresión constante', () => {
  it('parsea números directos, incluidos negativos y decimales', () => {
    expect(evalConst('3.14')).toBeCloseTo(3.14)
    expect(evalConst('-2')).toBe(-2)
  })

  it('evalúa expresiones constantes con el motor', () => {
    expect(evalConst('pi/2')).toBeCloseTo(Math.PI / 2)
    expect(evalConst('sqrt(2)')).toBeCloseTo(Math.SQRT2)
  })

  it('rechaza lo que depende de x (no es constante) y lo vacío', () => {
    expect(evalConst('2*x')).toBeNull()
    expect(evalConst('   ')).toBeNull()
    expect(evalConst('no-parsea(')).toBeNull()
  })
})

describe('fnValueAt — evalúa f(x) con parámetros y ramas', () => {
  it('evalúa una función explícita', () => {
    expect(fnValueAt(spec({ functions: [{ expr: 'x^2' }] }), 0, 3)).toBe(9)
  })

  it('resuelve parámetros con nombre en la expresión', () => {
    const s = spec({ functions: [{ expr: 'a*x' }], parameters: [{ name: 'a', value: 2 }] })
    expect(fnValueAt(s, 0, 4)).toBe(8)
  })

  it('elige la rama que contiene x en funciones a trozos', () => {
    const s = spec({
      functions: [{ expr: '', pieces: [{ expr: '-x', from: -5, to: 0 }, { expr: 'x', from: 0, to: 5 }] }],
    })
    expect(fnValueAt(s, 0, -3)).toBe(3)
    expect(fnValueAt(s, 0, 3)).toBe(3)
  })

  it('null para índice inexistente o expresión no parseable', () => {
    expect(fnValueAt(spec({ functions: [{ expr: 'x' }] }), 5, 1)).toBeNull()
    expect(fnValueAt(spec({ functions: [{ expr: 'sqrt(' }] }), 0, 1)).toBeNull()
  })

  it('null cuando el resultado no es finito (fuera del dominio real)', () => {
    expect(fnValueAt(spec({ functions: [{ expr: 'sqrt(x)' }] }), 0, -1)).toBeNull()
  })
})

describe('PLOT_TOKEN_GROUPS — paleta de fórmulas', () => {
  it('todos los tokens tienen las variantes ascii y latex', () => {
    for (const group of PLOT_TOKEN_GROUPS) {
      for (const tok of group) {
        expect(tok.ascii.length).toBeGreaterThan(0)
        expect(tok.latex.length).toBeGreaterThan(0)
        expect(tok.title.length).toBeGreaterThan(0)
      }
    }
  })
})
