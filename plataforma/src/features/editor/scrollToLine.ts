import type { EditorView } from '@codemirror/view'

/** Lleva el cursor del editor a una línea (1-based) y la deja a la vista. */
export function scrollToLine(view: EditorView, line: number): void {
  const target = Math.min(Math.max(line, 1), view.state.doc.lines)
  const info = view.state.doc.line(target)
  view.dispatch({ selection: { anchor: info.from }, scrollIntoView: true })
  view.focus()
}
