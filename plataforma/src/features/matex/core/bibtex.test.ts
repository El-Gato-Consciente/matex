import { describe, expect, it } from 'vitest'
import type { BibEntry } from './ast'
import { autoKey, emitBibtex, parseBibtex } from './bibtex'
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
