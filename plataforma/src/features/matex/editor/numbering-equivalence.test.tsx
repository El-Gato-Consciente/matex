// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { compileToHtml, compileToLatex, type MatexDoc } from '../core'
import { THEOREMS } from '../core/latex/canon'
import { astToTiptap } from './mapping'
import { listReferenceables, MatexNumbering } from './numbering'
import {
  Figure,
  MatexBlockAttrs,
  MathDisplay,
  MathInline,
  Part,
  RawLatex,
  Ref,
  TableCell,
  TableHeader,
  TableRow,
  Theorem,
  MatexTable,
} from './nodes'

/**
 * **QA-08 · equivalencia entre backends (capa rápida).**
 *
 * La tesis del proyecto es «un AST → salidas de calidad». Cada capa de verificación anterior
 * comprobaba *que cada salida se produjera*, nunca *que dos coincidieran* — por eso FIX-18 (el
 * HTML numeraba distinto que el PDF) sobrevivió a 597 tests. Estos tests comparan la **numeración**
 * y la **resolución de referencias** entre el **editor** y el **backend HTML** sobre los mismos
 * documentos, y atan el **backend LaTeX** a la misma política (ver `reglas-del-modelo.md` §3).
 *
 * La equivalencia contra **LaTeX compilado de verdad** (leyendo el `.aux`, la autoridad final)
 * vive en `backend/scripts/verify-numbering.ts`, porque necesita `latexmk`.
 */

function makeEditor(doc: MatexDoc): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, blockquote: false, codeBlock: false, horizontalRule: false, strike: false, hardBreak: false }),
      Part, MathInline, MathDisplay, RawLatex, Ref, Theorem, MatexTable, TableRow, TableHeader, TableCell, Figure, MatexBlockAttrs, MatexNumbering,
    ],
    content: astToTiptap(doc),
  })
}

let editor: Editor | null = null
afterEach(() => {
  editor?.destroy()
  editor = null
})

/** Numeración que ve el **editor**: "tipo número" por objeto, en orden de documento. */
function editorNumbers(doc: MatexDoc): string[] {
  editor = makeEditor(doc)
  return listReferenceables(editor.state).map((r) => `${r.typeLabel} ${r.number}`)
}

/** Numeración que emite el **HTML**: los textos que un `\cref` mostraría, en orden. */
function htmlNumbers(doc: MatexDoc): string[] {
  const html = compileToHtml(doc, { standalone: false })
  const out: string[] = []
  // Encabezados de teorema: «Teorema 1.1 (Título).» / «Lema 1.2.»
  for (const m of html.matchAll(/<strong>(Teorema|Lema|Proposición|Corolario|Definición|Ejemplo) (\d+(?:\.\d+)*)/g)) {
    out.push(`${m[1]} ${m[2]}`)
  }
  return out
}

/** Partes que ve el editor / emite el HTML, en orden. */
const editorParts = (doc: MatexDoc): string[] => editorNumbers(doc).filter((s) => s.startsWith('Parte '))
const htmlParts = (doc: MatexDoc): string[] =>
  [...compileToHtml(doc, { standalone: false }).matchAll(/class="mx-partnum">Parte ([IVXLCDM]+)/g)].map((m) => `Parte ${m[1]}`)

const theorem = (variant: string, title?: string): MatexDoc['content'][number] => ({
  type: 'theorem',
  variant: variant as 'theorem',
  ...(title ? { title } : {}),
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
})
const sec = (text: string, level: 1 | 2 | 3 = 1): MatexDoc['content'][number] => ({ type: 'heading', level, content: [{ type: 'text', text }] })

describe('QA-08 · el editor y el HTML numeran los teoremas igual', () => {
  it('teoremas por sección, contador compartido, proof/remark sin número', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        sec('Primera'),
        theorem('theorem', 'Bolzano'),
        theorem('definition'),
        theorem('remark'), // no numera
        theorem('proof'), // no numera
        sec('Segunda'),
        theorem('lemma'),
      ],
    }
    // El editor lista Sección/Teorema/… ; filtramos a los teoremas para comparar con el HTML.
    const editorThms = editorNumbers(doc).filter((s) => /^(Teorema|Lema|Proposición|Corolario|Definición|Ejemplo)/.test(s))
    const htmlThms = htmlNumbers(doc)
    expect(editorThms).toEqual(['Teorema 1.1', 'Definición 1.2', 'Lema 2.1'])
    expect(htmlThms).toEqual(editorThms) // ← la equivalencia que FIX-18 rompía
  })

  it('un teorema antes de toda sección es «0.1» en ambos (como LaTeX)', () => {
    const doc: MatexDoc = { type: 'doc', version: 3, content: [theorem('theorem', 'Pitágoras'), sec('Luego'), theorem('lemma')] }
    const editorThms = editorNumbers(doc).filter((s) => /^(Teorema|Lema)/.test(s))
    expect(editorThms).toEqual(['Teorema 0.1', 'Lema 1.1'])
    expect(htmlNumbers(doc)).toEqual(editorThms)
  })
})

describe('QA-08 · partes: editor y HTML las numeran igual, en romanos (ME-46)', () => {
  it('partes en romanos, sin reiniciar los capítulos', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 4,
      meta: { docKind: 'book' },
      content: [
        { type: 'part', content: [{ type: 'text', text: 'Primera' }] },
        sec('Cap uno'),
        { type: 'part', content: [{ type: 'text', text: 'Segunda' }] },
        sec('Cap dos'),
      ],
    }
    expect(editorParts(doc)).toEqual(['Parte I', 'Parte II'])
    expect(htmlParts(doc)).toEqual(editorParts(doc))
  })
})

describe('QA-08 · el backend LaTeX obedece la misma política', () => {
  it('el canon declara teoremas [section] y remark estrellado (sin número)', () => {
    // El LaTeX numera vía TeX; su intención debe coincidir con la política. Si alguien cambiara
    // el canon a numeración global, la política y el PDF divergirían — este test lo impide.
    const canon = THEOREMS.join('\n')
    expect(canon).toContain('\\newtheorem{theorem}{Teorema}[section]')
    expect(canon).toContain('\\newtheorem*{remark}')
  })

  it('un documento con teoremas emite \\newtheorem (deja que TeX numere por sección)', () => {
    const doc: MatexDoc = { type: 'doc', version: 3, content: [sec('S'), theorem('theorem')] }
    const tex = compileToLatex(doc)
    expect(tex).toContain('\\newtheorem{theorem}{Teorema}[section]')
    expect(tex).toContain('\\section{S}')
  })
})
