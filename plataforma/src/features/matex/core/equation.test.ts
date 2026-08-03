import { describe, expect, it } from 'vitest'
import { equationPlan } from './equation'
import type { EquationRow } from './ast'

const r = (tex: string, numbered = false): EquationRow => (numbered ? { tex, numbered } : { tex })

describe('equationPlan (política del envoltorio, compartida compilador/preview)', () => {
  it('1 fila = ecuación suelta (no multilínea), sea numerada o no', () => {
    expect(equationPlan([r('a=b')], true).multiline).toBe(false)
    expect(equationPlan([r('a=b', true)], undefined).multiline).toBe(false)
  })

  it('≥2 filas = multilínea', () => {
    expect(equationPlan([r('a'), r('b')], true).multiline).toBe(true)
  })

  it('aligned default (undefined/true) → align; aligned:false → gather', () => {
    expect(equationPlan([r('a'), r('b')], undefined).env).toBe('align')
    expect(equationPlan([r('a'), r('b')], true).env).toBe('align')
    expect(equationPlan([r('a'), r('b')], false).env).toBe('gather')
  })

  it('starred sii ninguna fila está numerada', () => {
    expect(equationPlan([r('a'), r('b')], true).starred).toBe(true)
    expect(equationPlan([r('a', true), r('b')], true).starred).toBe(false)
    expect(equationPlan([r('a'), r('b', true)], false).starred).toBe(false)
  })
})
