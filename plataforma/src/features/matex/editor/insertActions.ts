import type { Editor, JSONContent } from '@tiptap/core'
import type { CalloutVariant, ChartForm, DistForm, TheoremVariant } from '../core'
import { defaultChartSpec, defaultDiagramSpec, defaultDistSpec, defaultTreeSpec } from './defaultSpecs'

/**
 * **Acciones de inserción de nodos** (QA-06, slice 6). Cada una inserta un bloque Matex en el
 * cursor del editor. Eran ~12 métodos dentro del God component `MatexWorkspace`; agrupadas acá,
 * el componente queda solo con orquestación y JSX. Cada una es un `editor.chain().insertContent`
 * puro (los datos de muestra vienen de `defaultSpecs`), así que no hay lógica que testear más
 * allá de lo que ya cubre el round-trip AST↔TipTap de `mapping.test`.
 */

export function insertTheorem(editor: Editor | null, variant: TheoremVariant): void {
  editor?.chain().focus().insertContent({ type: 'theorem', attrs: { variant }, content: [{ type: 'paragraph' }] }).run()
}

export function insertDerivation(editor: Editor | null): void {
  editor
    ?.chain()
    .focus()
    .insertContent({
      type: 'derivation',
      attrs: { title: null, steps: [{ tex: 'x^2 - 1 &= 0', note: 'condición' }, { tex: 'x &= \\pm 1', boxed: true }], id: null, label: null },
    })
    .run()
}

export function insertReasoning(editor: Editor | null): void {
  const cell = () => ({ type: 'reasoningCell', content: [{ type: 'paragraph' }] })
  const row = () => ({ type: 'reasoningRow', attrs: { boxed: false }, content: [cell(), cell()] })
  editor?.chain().focus().insertContent({ type: 'reasoning', attrs: { title: null, id: null, label: null }, content: [row(), row()] }).run()
}

export function insertCallout(editor: Editor | null, variant: CalloutVariant): void {
  editor?.chain().focus().insertContent({ type: 'callout', attrs: { variant }, content: [{ type: 'paragraph' }] }).run()
}

export function insertCodeBlock(editor: Editor | null): void {
  editor?.chain().focus().insertContent({ type: 'codeBlock' }).run()
}

export function insertSlide(editor: Editor | null): void {
  editor?.chain().focus().insertContent({ type: 'slide', attrs: { title: null, reveal: false }, content: [{ type: 'paragraph' }] }).run()
}

/**
 * Inserta un bloque de familia **como hermano** del bloque del mismo tipo que contiene al cursor
 * (justo después), no adentro: con el cursor en la solución de la pregunta 3, «Pregunta» crea la 4,
 * no una pregunta anidada en la solución. Fuera de uno de esos bloques, inserta en el cursor.
 */
function insertFamilyBlock(editor: Editor | null, content: JSONContent & { type: string }): void {
  if (!editor) return
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== content.type) continue
    const after = $from.after(depth)
    editor
      .chain()
      .insertContentAt(after, content)
      .focus(after + 2)
      .run()
    return
  }
  editor.chain().focus().insertContent(content).run()
}

/** Pregunta de examen (familia examen): enunciado vacío, sin puntaje ni solución. */
export function insertExamQuestion(editor: Editor | null): void {
  insertFamilyBlock(editor, { type: 'examQuestion', attrs: { points: null }, content: [{ type: 'paragraph' }] })
}

/** Entrada de CV (familia CV): una línea de la trayectoria, con los campos vacíos. */
export function insertCvEntry(editor: Editor | null): void {
  insertFamilyBlock(editor, { type: 'cvEntry' })
}

/** Bloque de póster (familia póster): un recuadro con título, en la columna que toque. */
export function insertPosterBlock(editor: Editor | null): void {
  insertFamilyBlock(editor, { type: 'posterBlock', attrs: { title: null, column: null }, content: [{ type: 'paragraph' }] })
}

/** Parte (`\part`, ME-46): la división por encima del capítulo (solo report/book). */
export function insertPart(editor: Editor | null): void {
  editor?.chain().focus().insertContent({ type: 'part', attrs: { id: null, label: null }, content: [{ type: 'text', text: 'Parte' }] }).run()
}

export function insertColumns(editor: Editor | null): void {
  const col = { type: 'column', content: [{ type: 'paragraph' }] }
  editor?.chain().focus().insertContent({ type: 'columns', content: [col, { ...col }] }).run()
}

export function insertChart(editor: Editor | null, form: ChartForm): void {
  editor?.chain().focus().insertContent({ type: 'figure', attrs: { items: [{ kind: 'chart', spec: defaultChartSpec(form) }] } }).run()
}

export function insertDist(editor: Editor | null, form: DistForm): void {
  editor?.chain().focus().insertContent({ type: 'figure', attrs: { items: [{ kind: 'distribution', spec: defaultDistSpec(form) }] } }).run()
}

export function insertDiagram(editor: Editor | null): void {
  editor?.chain().focus().insertContent({ type: 'figure', attrs: { items: [{ kind: 'diagram', spec: defaultDiagramSpec() }] } }).run()
}

export function insertTree(editor: Editor | null): void {
  editor?.chain().focus().insertContent({ type: 'figure', attrs: { items: [{ kind: 'tree', spec: defaultTreeSpec() }] } }).run()
}
