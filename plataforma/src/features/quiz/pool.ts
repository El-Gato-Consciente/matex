import type { Question } from './types'
import { allQuestions } from './questions'

export type QuizScope = 'lesson' | 'level' | 'all'

/** Preguntas dentro del alcance elegido (lección actual / nivel actual / todas). */
export function questionsInScope(scope: QuizScope, lessonId: string, level: number): Question[] {
  switch (scope) {
    case 'lesson':
      return allQuestions.filter((question) => question.lessonId === lessonId)
    case 'level':
      return allQuestions.filter((question) => question.level === level)
    case 'all':
      return [...allQuestions]
  }
}

export { allQuestions }
