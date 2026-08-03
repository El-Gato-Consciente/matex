import type { Challenge } from './types'

export interface ChallengeResult {
  readonly passed: boolean
  /** Fragmentos requeridos que faltan en la fuente del alumno. */
  readonly missing: readonly string[]
}

/**
 * Corrección **pura** de un desafío: comprueba que la fuente incluya todos los
 * fragmentos requeridos. Sencillo a propósito; el modelo declarativo deja crecer
 * la corrección (regex, AST, comparación de salida) sin cambiar la UI.
 */
export function evaluateChallenge(challenge: Challenge, source: string): ChallengeResult {
  const missing = challenge.mustInclude.filter((fragment) => !source.includes(fragment))
  return { passed: missing.length === 0, missing }
}
