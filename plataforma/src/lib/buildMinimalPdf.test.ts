import { describe, expect, it } from 'vitest'
import { buildMinimalPdf } from './buildMinimalPdf'

describe('buildMinimalPdf', () => {
  it('produce un PDF con cabecera, contenido y EOF', () => {
    const text = new TextDecoder().decode(buildMinimalPdf(['Hola', 'Mundo']))
    expect(text.startsWith('%PDF-')).toBe(true)
    expect(text).toContain('%%EOF')
    expect(text).toContain('Hola')
  })

  it('no rompe con una lista vacía', () => {
    const text = new TextDecoder().decode(buildMinimalPdf([]))
    expect(text.startsWith('%PDF-')).toBe(true)
    expect(text).toContain('%%EOF')
  })
})
