// @vitest-environment jsdom
import { CompletionContext, type Completion } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { latexCompletionSource } from './latexCompletions'

/** Aplica la opción `label` del completado en `doc` con el cursor en `cursor`. */
function applyOption(doc: string, cursor: number, label: string): string {
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: cursor } }) })
  try {
    const result = latexCompletionSource(new CompletionContext(view.state, cursor, false))
    const option = result?.options.find((o) => o.label === label) as Completion | undefined
    if (!option || typeof option.apply !== 'function') throw new Error(`sin apply para ${label}`)
    option.apply(view, option, result!.from, cursor)
    return view.state.doc.toString()
  } finally {
    view.destroy()
  }
}

describe('apply de \\begin/\\end sin } de más', () => {
  it('\\end{ con } auto-cerrada no duplica la llave', () => {
    // "\end{}" con el cursor entre las llaves (auto-cerrado por basicSetup).
    expect(applyOption('\\end{}', 5, 'align')).toBe('\\end{align}')
  })

  it('\\end{ sin llave de cierre igual queda bien cerrada', () => {
    expect(applyOption('\\end{', 5, 'align')).toBe('\\end{align}')
  })

  it('\\begin{ con } auto-cerrada no deja una llave suelta al final', () => {
    const out = applyOption('\\begin{}', 7, 'center')
    expect(out.startsWith('\\begin{center}')).toBe(true)
    expect(out.endsWith('\\end{center}')).toBe(true)
    expect(out).not.toContain('}}') // sin la llave de más
  })
})
