import { describe, expect, it } from 'vitest'
import { documentBaseName, latexNeedsBundle } from './downloads'

describe('documentBaseName', () => {
  it('recorta y cae a "documento" si el nombre está vacío', () => {
    expect(documentBaseName('  Mi Paper ')).toBe('Mi Paper')
    expect(documentBaseName('')).toBe('documento')
    expect(documentBaseName('   ')).toBe('documento')
  })
})

describe('latexNeedsBundle', () => {
  it('es .zip si hay recursos que acompañar; .tex pelado si no', () => {
    expect(latexNeedsBundle([])).toBe(false)
    expect(latexNeedsBundle([{ path: 'refs.bib', content: '@book{x}', encoding: 'utf8' }])).toBe(true)
  })
})
