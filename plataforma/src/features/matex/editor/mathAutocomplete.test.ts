import { describe, expect, it } from 'vitest'
import { tokenBeforeCaret } from './mathAutocomplete'
import { mathCommandCatalog } from './mathPalette'

describe('mathAutocomplete · detección de token \\comando', () => {
  it('detecta el token \\palabra justo antes del cursor', () => {
    expect(tokenBeforeCaret('\\alp', 4)).toEqual({ word: 'alp', start: 0 })
    expect(tokenBeforeCaret('x + \\bet', 8)).toEqual({ word: 'bet', start: 4 })
  })

  it('el token vacío \\ es válido (word = "")', () => {
    expect(tokenBeforeCaret('\\', 1)).toEqual({ word: '', start: 0 })
  })

  it('sin barra antes del cursor → null', () => {
    expect(tokenBeforeCaret('alpha', 5)).toBeNull()
    expect(tokenBeforeCaret('\\alpha ', 7)).toBeNull() // hay un espacio → cortó el token
  })

  it('respeta la posición del cursor (no mira lo que hay después)', () => {
    // cursor entre "\al" y "pha": el token es "al"
    expect(tokenBeforeCaret('\\alpha', 3)).toEqual({ word: 'al', start: 0 })
  })
})

describe('mathCommandCatalog', () => {
  it('devuelve comandos \\… ordenados, sin duplicados, con snippet', () => {
    const cat = mathCommandCatalog()
    expect(cat.length).toBeGreaterThan(20)
    const cmds = cat.map((c) => c.cmd)
    expect(cmds).toContain('\\alpha')
    expect(cmds).toContain('\\frac')
    expect(cmds).toContain('\\int')
    // ordenado
    expect([...cmds]).toEqual([...cmds].sort((a, b) => a.localeCompare(b)))
    // sin duplicados
    expect(new Set(cmds).size).toBe(cmds.length)
    // \frac inserta plantilla con huecos
    expect(cat.find((c) => c.cmd === '\\frac')?.insert).toContain('{}')
  })

  it('un prefijo filtra los comandos esperados (como el dropdown)', () => {
    const cat = mathCommandCatalog()
    const startsWith = (q: string) => cat.filter((c) => c.cmd.slice(1).toLowerCase().startsWith(q)).map((c) => c.cmd)
    expect(startsWith('al')).toContain('\\alpha')
    expect(startsWith('sum')).toContain('\\sum')
  })
})
