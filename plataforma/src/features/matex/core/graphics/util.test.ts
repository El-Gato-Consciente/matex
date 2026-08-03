import { describe, expect, it } from 'vitest'
import { escapeLatex } from './util'

/**
 * `escapeLatex` protege el PDF de lo que se tipea en el editor visual: escapa los reservados de
 * LaTeX y **traduce los símbolos Unicode matemáticos** (π, √, ≤, ², ₙ…), que de otro modo hacen
 * fallar a pdflatex con "Unicode character not set up for use with LaTeX".
 */
describe('escapeLatex', () => {
  it('escapa los caracteres reservados de LaTeX', () => {
    expect(escapeLatex('100% & $5 #1 _x {a}')).toBe('100\\% \\& \\$5 \\#1 \\_x \\{a\\}')
    expect(escapeLatex('a\\b')).toBe('a\\textbackslash{}b')
    expect(escapeLatex('x^2')).toBe('x\\textasciicircum{}2')
    expect(escapeLatex('a~b')).toBe('a\\textasciitilde{}b')
  })

  it('traduce símbolos Unicode matemáticos a comandos LaTeX', () => {
    expect(escapeLatex('T = 2π')).toBe('T = 2$\\pi$')
    expect(escapeLatex('√2')).toBe('$\\surd$2')
    expect(escapeLatex('a ≤ b ≠ c')).toBe('a $\\le$ b $\\neq$ c')
    expect(escapeLatex('x² y₃')).toBe('x$^{2}$ y$_{3}$')
    expect(escapeLatex('5 − 3')).toBe('5 $-$ 3') // menos tipográfico U+2212
    expect(escapeLatex('A → B')).toBe('A $\\to$ B')
  })

  it('deja intactos los acentos y la ñ (los cubre fontenc/babel)', () => {
    expect(escapeLatex('función año índice')).toBe('función año índice')
  })
})
