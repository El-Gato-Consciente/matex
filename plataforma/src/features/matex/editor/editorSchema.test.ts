import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { exemplars } from '@/features/showcase/data'
import { templates } from '@/features/templates/data'
import type { MatexDoc } from '../core'
import { matexEditorExtensions } from './editorExtensions'
import { astToTiptap } from './mapping'

/**
 * **Toda plantilla y todo ejemplo abre en el editor visual.** Si el mapping produce algo que el esquema de TipTap
 * no acepta (un nodo no registrado, un texto vacío), el editor abre el documento **vacío** y el
 * primer cambio lo pisa. Pasó con examen, CV y póster: el modelo y las plantillas los tenían, el
 * editor no. Se valida contra el MISMO esquema que usa `MatexWorkspace`.
 */
const schema = getSchema(matexEditorExtensions({ resolveSrc: () => null }))
const opens = (doc: MatexDoc) => schema.nodeFromJSON(astToTiptap(doc)).check()

describe('esquema del editor visual', () => {
  const documents = [...templates, ...exemplars].filter((d) => d.matex).map((d) => [d.id, d.matex!] as const)

  it.each(documents)('«%s» abre sin contenido inválido', (_id, doc) => {
    expect(() => opens(doc)).not.toThrow()
  })

  it('un texto vacío del modelo no llega al editor (ProseMirror lo rechaza)', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        { type: 'examQuestion', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Enunciado' }] }], solution: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] },
      ],
    }
    expect(() => opens(doc)).not.toThrow()
    expect(JSON.stringify(astToTiptap(doc))).not.toContain('"text":""')
  })
})
