import { describe, expect, it } from 'vitest'
import { filesInput, singleFileInput } from './types'

describe('singleFileInput', () => {
  it('arma un único archivo principal (main.tex por defecto)', () => {
    expect(singleFileInput('texto')).toEqual({
      files: [{ path: 'main.tex', content: 'texto' }],
      mainFile: 'main.tex',
    })
  })

  it('respeta un mainFile personalizado', () => {
    expect(singleFileInput('x', 'doc.tex').mainFile).toBe('doc.tex')
  })
})

describe('filesInput', () => {
  it('antepone el archivo principal a los acompañantes', () => {
    const out = filesInput('main.tex', 'M', [{ path: 'a.tex', content: 'A' }])
    expect(out.files).toEqual([
      { path: 'main.tex', content: 'M' },
      { path: 'a.tex', content: 'A' },
    ])
    expect(out.mainFile).toBe('main.tex')
  })
})
