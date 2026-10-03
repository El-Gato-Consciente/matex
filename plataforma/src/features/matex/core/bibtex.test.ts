import { describe, expect, it } from 'vitest'
import type { BibEntry } from './ast'
import { autoKey, emitBibtex, normalizeAuthors, parseBibtex } from './bibtex'
import { parseMatexDoc } from './parse'

describe('bibtex — emitir desde la estructura', () => {
  it('emite @tipo{clave, campo = {valor}} solo con los campos no vacíos', () => {
    const e: BibEntry = { key: 'knuth1984', type: 'book', author: 'Knuth, Donald E.', title: 'The TeXbook', year: '1984', publisher: 'Addison-Wesley' }
    const out = emitBibtex([e])
    expect(out).toContain('@book{knuth1984,')
    expect(out).toContain('author = {Knuth, Donald E.}')
    expect(out).toContain('publisher = {Addison-Wesley}')
    expect(out).not.toContain('journal') // campo vacío no se emite
  })

  it('clave vacía → usa la clave automática (apellido+año)', () => {
    expect(emitBibtex([{ key: '', type: 'article', author: 'Lamport, Leslie', year: '1994' }])).toContain('@article{lamport1994,')
  })

  // BibTeX separa autores solo con ` and `: escritos «a mano» salían desordenados en el PDF
  // («R. Sacco y F. Saleri A. Quarteroni»).
  it.each([
    ['A. Quarteroni, R. Sacco y F. Saleri', 'A. Quarteroni and R. Sacco and F. Saleri'],
    ['R. L. Burden y J. D. Faires', 'R. L. Burden and J. D. Faires'],
    ['Ana Pérez & Juan Gómez', 'Ana Pérez and Juan Gómez'],
    ['Borges, Jorge Luis; Bioy Casares, Adolfo', 'Borges, Jorge Luis and Bioy Casares, Adolfo'],
    ['García Márquez, Gabriel y Borges, Jorge Luis', 'García Márquez, Gabriel and Borges, Jorge Luis'],
  ])('autores escritos a mano: «%s» → «%s»', (written, bibtex) => {
    expect(normalizeAuthors(written)).toBe(bibtex)
  })

  it.each([
    'Knuth, Donald E.',
    'Knuth, Donald E. and Lamport, Leslie',
    'Ortega y Gasset, José', // una sola persona: «Ortega» solo no es un nombre completo
    'A. Quarteroni, R. Sacco, F. Saleri', // sin «y»: ambiguo, no se adivina
    '{Organización Mundial de la Salud y otros}', // entre llaves = literal
  ])('lo que ya está bien o es ambiguo no se toca: «%s»', (author) => {
    expect(normalizeAuthors(author)).toBe(author)
  })

  it('emitBibtex normaliza solo el campo author', () => {
    const out = emitBibtex([{ key: 'k', type: 'book', author: 'Ana Pérez y Juan Gómez', title: 'Rojo y negro' }])
    expect(out).toContain('author = {Ana Pérez and Juan Gómez}')
    expect(out).toContain('title = {Rojo y negro}')
  })
})

describe('bibtex — parsear (importar/migrar)', () => {
  it('parsea entradas con {} y "" y campos en varias líneas', () => {
    const src = `@book{knuth1984,
      author = {Knuth, Donald E.},
      title  = {The {\\TeX}book},
      year   = "1984",
      publisher = {Addison-Wesley},
    }
    @article{lamport1994, author={Lamport, Leslie}, title={LaTeX}, journal={AW}, year={1994}}`
    const entries = parseBibtex(src)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ key: 'knuth1984', type: 'book', author: 'Knuth, Donald E.', title: 'The {\\TeX}book', year: '1984' })
    expect(entries[1]).toMatchObject({ key: 'lamport1994', type: 'article', journal: 'AW' })
  })

  it('normaliza tipos y alias (phdthesis→thesis, school→institution, date→year)', () => {
    const [e] = parseBibtex('@phdthesis{x, author={A}, school={UBA}, date={2020-05}}')
    expect(e?.type).toBe('thesis')
    expect(e?.institution).toBe('UBA')
    expect(e?.year).toBe('2020')
  })

  it('round-trip estructura → .bib → estructura preserva los campos', () => {
    const e: BibEntry = { key: 'k', type: 'incollection', author: 'A, B', title: 'T', booktitle: 'BT', year: '2001', pages: '1--10' }
    expect(parseBibtex(emitBibtex([e]))[0]).toMatchObject(e)
  })

  it('ignora @comment/@string y basura sin romper', () => {
    expect(parseBibtex('@comment{x} basura @book{ok, title={T}} @string{y=1}')).toHaveLength(1)
  })
})

describe('bibtex — clave automática', () => {
  it('apellido+año, sin acentos, minúsculas', () => {
    expect(autoKey({ author: 'Núñez, José and Otro, X', year: '2019' })).toBe('nunez2019')
    expect(autoKey({ author: 'Donald Knuth', year: '1984' })).toBe('knuth1984')
    expect(autoKey({})).toBe('ref')
  })
})

describe('migración: doc viejo con marcador bibliography en el contenido', () => {
  it('quita el marcador del contenido, sube las entradas a doc.references y el estilo a meta', () => {
    const old = {
      type: 'doc',
      version: 3,
      content: [{ type: 'bibliography', entries: '@book{knuth1984, author={Knuth}, title={X}, year={1984}}', style: 'authoryear', title: 'Bibliografía' }],
    }
    const doc = parseMatexDoc(old)
    expect(doc.references).toHaveLength(1)
    expect(doc.references?.[0]).toMatchObject({ key: 'knuth1984', type: 'book' })
    // el marcador ya no es un bloque: se elimina del contenido
    expect(doc.content).toHaveLength(0)
    // estilo/título suben a meta (document-level)
    expect(doc.meta?.bibStyle).toBe('authoryear')
    expect(doc.meta?.bibTitle).toBe('Bibliografía')
  })
})
