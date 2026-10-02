import { describe, expect, it } from 'vitest'
import { PLAYGROUND_BODY_OFFSET, playgroundSource } from './playground'

describe('playgroundSource', () => {
  it('envuelve el cuerpo en un documento completo', () => {
    const source = playgroundSource('Hola')
    expect(source).toMatch(/^\\documentclass/)
    expect(source).toContain('\\begin{document}\nHola\n\\end{document}')
  })

  it('PLAYGROUND_BODY_OFFSET lleva la línea del documento a la del cuerpo', () => {
    const lines = playgroundSource('primera\nsegunda').split('\n')
    // Línea N del documento (1-based) = línea N - offset del cuerpo.
    expect(lines[PLAYGROUND_BODY_OFFSET + 1 - 1]).toBe('primera')
    expect(lines[PLAYGROUND_BODY_OFFSET + 2 - 1]).toBe('segunda')
  })
})
