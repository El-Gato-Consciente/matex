import { describe, expect, it } from 'vitest'
import { documentFamily, letterMeta, examMeta, cvMeta, posterMeta } from './family'

describe('documentFamily', () => {
  it('un documento sin `family` es "document"', () => {
    expect(documentFamily(undefined)).toBe('document')
    expect(documentFamily({})).toBe('document')
    expect(documentFamily({ title: 'X', docKind: 'report' })).toBe('document')
  })

  it('lee el discriminante de la familia', () => {
    expect(documentFamily({ family: { kind: 'presentation' } })).toBe('presentation')
    expect(documentFamily({ family: { kind: 'letter', letter: {} } })).toBe('letter')
    expect(documentFamily({ family: { kind: 'exam', exam: {} } })).toBe('exam')
    expect(documentFamily({ family: { kind: 'cv', cv: {} } })).toBe('cv')
    expect(documentFamily({ family: { kind: 'poster', poster: {} } })).toBe('poster')
  })
})

describe('accesores de metadata por familia', () => {
  it('cada accesor devuelve su metadata solo cuando la familia coincide', () => {
    expect(letterMeta({ family: { kind: 'letter', letter: { to: 'X' } } })).toEqual({ to: 'X' })
    expect(letterMeta({ family: { kind: 'cv', cv: {} } })).toBeUndefined()
    expect(examMeta({ family: { kind: 'exam', exam: { instructions: 'i' } } })).toEqual({ instructions: 'i' })
    expect(cvMeta({ family: { kind: 'cv', cv: { email: 'a@b.c' } } })).toEqual({ email: 'a@b.c' })
    expect(posterMeta({ family: { kind: 'poster', poster: { columns: 3 } } })).toEqual({ columns: 3 })
    expect(posterMeta({})).toBeUndefined()
  })

  /**
   * La ganancia de AR-09: el estado ilegal `{letter, presentation}` que los flags sueltos
   * permitían **ya no se puede escribir** — el tipo tiene un solo `family.kind`. Ese test (antes
   * en fase 0) desapareció a propósito: lo que verificaba se volvió irrepresentable.
   */
  it('un documento pertenece a una sola familia (irrepresentable tener dos)', () => {
    const fam = { kind: 'letter', letter: { to: 'X' } } as const
    // No hay forma de que `documentFamily` devuelva dos cosas: `family` es un único discriminante.
    expect(documentFamily({ family: fam })).toBe('letter')
    expect(examMeta({ family: fam })).toBeUndefined() // no es examen, aunque sea "una familia"
  })
})
