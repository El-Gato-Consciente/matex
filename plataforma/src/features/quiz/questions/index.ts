import type { Question } from '../types'
import { nivel0Questions } from './nivel0'
import { nivel1Questions } from './nivel1'
import { nivel2Questions } from './nivel2'
import { nivel3Questions } from './nivel3'
import { nivel4Questions } from './nivel4'

/** Todas las preguntas de opción múltiple de la ruta. */
export const allQuestions: readonly Question[] = [
  ...nivel0Questions,
  ...nivel1Questions,
  ...nivel2Questions,
  ...nivel3Questions,
  ...nivel4Questions,
]
