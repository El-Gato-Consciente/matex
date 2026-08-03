import { describe, expect, it } from 'vitest'
import { isTextPath } from './files'

describe('isTextPath', () => {
  it('reconoce extensiones de texto (sin distinguir mayúsculas)', () => {
    expect(isTextPath('main.tex')).toBe(true)
    expect(isTextPath('refs.bib')).toBe(true)
    expect(isTextPath('a/b/c.TXT')).toBe(true)
    expect(isTextPath('estilo.sty')).toBe(true)
  })

  it('trata el resto como binario', () => {
    expect(isTextPath('imagen.png')).toBe(false)
    expect(isTextPath('doc.pdf')).toBe(false)
    expect(isTextPath('sinextension')).toBe(false)
  })
})
