import { describe, expect, it } from 'vitest'
import { evaluateChallenge } from './grader'
import type { Challenge } from './types'

const challenge = (mustInclude: string[]): Challenge => ({
  prompt: '',
  starter: '',
  mustInclude,
  hints: [],
})

describe('evaluateChallenge', () => {
  it('aprueba cuando la fuente incluye todos los fragmentos', () => {
    const result = evaluateChallenge(challenge(['\\section', '\\emph']), 'x \\section{a} \\emph{b}')
    expect(result.passed).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('lista los fragmentos que faltan', () => {
    const result = evaluateChallenge(challenge(['\\section', '\\emph']), 'solo \\section{a}')
    expect(result.passed).toBe(false)
    expect(result.missing).toEqual(['\\emph'])
  })

  it('aprueba con mustInclude vacío', () => {
    expect(evaluateChallenge(challenge([]), '').passed).toBe(true)
  })
})
