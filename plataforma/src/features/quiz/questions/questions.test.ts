import { describe, expect, it } from 'vitest'
import { allQuestions } from './index'
import { findLesson } from '../../lessons/content/index'

/**
 * QA del banco de quiz (puro): que cada pregunta sea jugable y que los
 * distractores no se delaten por su forma. Pauta de autoría (ver `quiz/types.ts`):
 * distractores plausibles y de **largo parejo** al correcto, para que no se
 * pueda adivinar la respuesta mirando cuál es "la más larga/distinta".
 */
describe('banco de preguntas', () => {
  it('hay preguntas', () => {
    expect(allQuestions.length).toBeGreaterThan(0)
  })

  it('los ids de pregunta son únicos', () => {
    const ids = allQuestions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cada pregunta referencia una lección existente, con su nivel', () => {
    for (const q of allQuestions) {
      const lesson = findLesson(q.lessonId)
      expect(lesson, `${q.id} → lección '${q.lessonId}'`).toBeDefined()
      expect(q.level, `${q.id}: level no coincide con la lección`).toBe(lesson!.level)
    }
  })

  it('cada pregunta tiene opciones jugables (≥2 distractores, sin repetir la correcta)', () => {
    for (const q of allQuestions) {
      expect(q.distractors.length, `${q.id} con pocos distractores`).toBeGreaterThanOrEqual(2)
      const options = [q.answer, ...q.distractors]
      expect(new Set(options).size, `${q.id} tiene opciones repetidas`).toBe(options.length)
      expect(q.answer.trim().length, `${q.id} respuesta vacía`).toBeGreaterThan(0)
      expect(q.explanation.trim().length, `${q.id} sin explicación`).toBeGreaterThan(0)
    }
  })

  // Los distractores deben tener largo parejo al de la respuesta: si uno es
  // mucho más largo/corto, se adivina. Toleramos diferencias razonables pero
  // marcamos las desproporcionadas. Margen aditivo para respuestas cortas.
  it('los distractores tienen largo parejo a la respuesta', () => {
    const ratio = 2.5
    const slack = 10
    for (const q of allQuestions) {
      const answerLen = q.answer.length
      for (const distractor of q.distractors) {
        const lo = Math.min(answerLen, distractor.length)
        const hi = Math.max(answerLen, distractor.length)
        expect(
          hi,
          `${q.id}: distractor "${distractor}" (${distractor.length}) muy dispar de la respuesta (${answerLen})`,
        ).toBeLessThanOrEqual(ratio * lo + slack)
      }
    }
  })
})
