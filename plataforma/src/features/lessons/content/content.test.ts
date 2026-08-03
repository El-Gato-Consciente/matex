import { describe, expect, it } from 'vitest'
import { allLessons, findLesson } from './index'
import { evaluateChallenge } from '../grader'

/**
 * QA de contenido (puro, sin LaTeX): que la ruta sea **coherente** sin tener que
 * compilar. Complementa a `verify-content.ts` (que sí compila, en CI). Acá
 * chequeamos invariantes que un autor podría romper sin que nada falle al cargar.
 */
describe('ruta de aprendizaje', () => {
  it('los ids de lección son únicos', () => {
    const ids = allLessons.map((lesson) => lesson.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('los prerequisites apuntan a lecciones que existen', () => {
    for (const lesson of allLessons) {
      for (const prereq of lesson.prerequisites) {
        expect(findLesson(prereq), `${lesson.id} → prereq '${prereq}'`).toBeDefined()
      }
    }
  })

  it('el archivo principal no se repite entre los acompañantes', () => {
    for (const lesson of allLessons) {
      const paths = lesson.files.map((file) => file.path)
      expect(new Set(paths).size, `${lesson.id} tiene paths repetidos`).toBe(paths.length)
      expect(paths, `${lesson.id}: mainFile también listado en files`).not.toContain(lesson.mainFile)
    }
  })
})

describe('solución de referencia de cada desafío', () => {
  const conDesafio = allLessons.filter((lesson) => lesson.challenge)

  it('hay desafíos para chequear', () => {
    expect(conDesafio.length).toBeGreaterThan(0)
  })

  it.each(conDesafio.map((lesson) => [lesson.id, lesson] as const))(
    'la solución de %s cumple su mustInclude',
    (_id, lesson) => {
      const challenge = lesson.challenge!
      // La solución de referencia es `solution` si existe, si no el ejemplo.
      const reference = challenge.solution ?? lesson.example
      const result = evaluateChallenge(challenge, reference)
      expect(result.missing, `faltan fragmentos en la solución`).toEqual([])
      expect(result.passed).toBe(true)
    },
  )

  it('mustInclude no tiene fragmentos vacíos ni duplicados', () => {
    for (const lesson of conDesafio) {
      const fragments = lesson.challenge!.mustInclude
      expect(fragments.every((f) => f.trim().length > 0), `${lesson.id} tiene fragmento vacío`).toBe(true)
      expect(new Set(fragments).size, `${lesson.id} tiene mustInclude duplicado`).toBe(fragments.length)
    }
  })
})
