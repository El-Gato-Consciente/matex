// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import type { MatexDoc } from '../core'
import { astToTiptap } from './mapping'
import { listReferenceables, MatexNumbering, resolveRef } from './numbering'
import {
  Figure,
  MatexBlockAttrs,
  MathDisplay,
  MathInline,
  RawLatex,
  Ref,
  TableCell,
  TableHeader,
  TableRow,
  Theorem,
  MatexTable,
} from './nodes'

/** Editor headless con las mismas extensiones que MatexWorkspace, para probar la
 *  numeración en vivo (secciones/teoremas/ecuaciones por fila) y las referencias. */
function makeEditor(doc: MatexDoc): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        hardBreak: false,
      }),
      MathInline,
      MathDisplay,
      RawLatex,
      Ref,
      Theorem,
      MatexTable,
      TableRow,
      TableHeader,
      TableCell,
      Figure,
      MatexBlockAttrs,
      MatexNumbering,
    ],
    content: astToTiptap(doc),
  })
}

let editor: Editor | null = null
afterEach(() => {
  editor?.destroy()
  editor = null
})

describe('numeración en vivo + referenciables', () => {
  it('numera secciones/teoremas/ecuaciones y enumera cada fila numerada', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Intro' }] },
        {
          type: 'mathDisplay',
          rows: [
            { tex: 'a &= b', numbered: true },
            { tex: 'c &= d' }, // sin número → no referenciable
            { tex: 'e &= f', numbered: true },
          ],
        },
        { type: 'theorem', variant: 'theorem', title: 'Bolzano', content: [{ type: 'paragraph', content: [] }] },
        { type: 'heading', level: 2, content: [{ type: 'text', text: 'Sub' }] },
        { type: 'theorem', variant: 'proof', content: [{ type: 'paragraph', content: [] }] }, // proof no numera
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Otra' }] },
        { type: 'mathDisplay', rows: [{ tex: 'x', numbered: true }] },
      ],
    }
    editor = makeEditor(doc)
    const items = listReferenceables(editor.state).map((r) => `${r.typeLabel} ${r.number}`)
    expect(items).toEqual([
      'Sección 1',
      'Ecuación (1)', // a &= b
      'Ecuación (2)', // e &= f (la fila del medio, sin número, no aparece)
      'Teorema 1.1',
      'Sección 1.1',
      'Sección 2',
      'Ecuación (3)', // x (contador continuo entre bloques)
    ])
  })

  it('resolveRef devuelve "Tipo Número" por id de fila y null si cuelga', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Cap' }] },
        { type: 'mathDisplay', rows: [{ tex: 'a=b', numbered: true, id: 'e1' }] },
      ],
    }
    editor = makeEditor(doc)
    expect(resolveRef(editor.state, 'e1')).toBe('Ecuación (1)')
    expect(resolveRef(editor.state, 'no-existe')).toBeNull()
  })

  it('solo las tablas con caption numeran y son referenciables', () => {
    const cell = (text: string) => ({ type: 'tableCell' as const, content: [{ type: 'text' as const, text }] })
    const row = () => ({ type: 'tableRow' as const, cells: [cell('a'), cell('b')] })
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'table', rows: [row()] }, // sin caption → no numera
        { type: 'table', rows: [row()], caption: 'Resultados', id: 'tab1' },
      ],
    }
    editor = makeEditor(doc)
    const tables = listReferenceables(editor.state).filter((r) => r.typeLabel === 'Cuadro')
    expect(tables.map((t) => t.number)).toEqual(['1'])
    expect(resolveRef(editor.state, 'tab1')).toBe('Cuadro 1')
  })

  it('solo las figuras con caption numeran y son referenciables', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'figure', items: [{ kind: 'image', src: 'a.png' }] }, // sin caption → no numera
        { type: 'figure', items: [{ kind: 'image', src: 'b.png' }], caption: 'Diagrama', id: 'fig1' },
        { type: 'figure', items: [{ kind: 'image', src: 'c.png' }], caption: 'Otra' },
      ],
    }
    editor = makeEditor(doc)
    const figs = listReferenceables(editor.state).filter((r) => r.typeLabel === 'Figura')
    expect(figs.map((f) => f.number)).toEqual(['1', '2']) // la sin caption no aparece
    expect(resolveRef(editor.state, 'fig1')).toBe('Figura 1')
  })
})
