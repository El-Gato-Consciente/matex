import { describe, expect, it } from 'vitest'
import { lessonCompileInput } from './compile'
import type { Lesson } from './types'

const lesson = (over: Partial<Lesson>): Lesson => ({
  id: 'l',
  level: 0,
  title: '',
  capa: 'semantica',
  objective: '',
  prerequisites: [],
  content: [],
  example: '',
  files: [],
  mainFile: 'main.tex',
  seeAlso: [],
  ...over,
})

describe('lessonCompileInput', () => {
  it('lección de un solo archivo', () => {
    expect(lessonCompileInput(lesson({}), 'SRC')).toEqual({
      files: [{ path: 'main.tex', content: 'SRC' }],
      mainFile: 'main.tex',
    })
  })

  it('lección multi-archivo incluye los acompañantes', () => {
    const out = lessonCompileInput(lesson({ files: [{ path: 'x.tex', content: 'X' }] }), 'SRC')
    expect(out.files).toHaveLength(2)
    expect(out.files[1]).toEqual({ path: 'x.tex', content: 'X' })
  })
})
