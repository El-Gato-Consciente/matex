/* ─────────────────────────────────────────────────────────────────
   Formalia — EditorStore
   Single bridge between TipTap and all UI components.
   Lit components and plain TS modules only touch this file —
   never the TipTap Editor object directly.
   ───────────────────────────────────────────────────────────────── */

import { signal } from '@preact/signals-core'
import type { Editor } from '@tiptap/core'
import type { NormalizerChange } from '@core/math/types'

// ── Signals ──────────────────────────────────────────────────────

/** LaTeX string of the currently active formula node. */
export const activeFormula = signal<string>('')

/** ProseMirror position of the currently active formula node, or null. */
export const activeNodePos = signal<number | null>(null)

/** Pending normalizer suggestions (Phase 3). Empty in Phase 1. */
export const coachChanges = signal<NormalizerChange[]>([])

/** Toolbar / mark active states, updated on every editor transaction. */
export const editorFmtState = signal({
  bold:        false,
  italic:      false,
  code:        false,
  h1:          false,
  h2:          false,
  h3:          false,
  bulletList:  false,
  orderedList: false,
  canUndo:     false,
  canRedo:     false,
})

// ── Internal editor ref ───────────────────────────────────────────

let _editor: Editor | null = null

export function setEditor(editor: Editor): void {
  _editor = editor
  editor.on('selectionUpdate', _syncFmtState)
  editor.on('update',          _syncFmtState)
  _syncFmtState()
}

function _syncFmtState(): void {
  if (!_editor) return
  editorFmtState.value = {
    bold:        _editor.isActive('bold'),
    italic:      _editor.isActive('italic'),
    code:        _editor.isActive('code'),
    h1:          _editor.isActive('heading', { level: 1 }),
    h2:          _editor.isActive('heading', { level: 2 }),
    h3:          _editor.isActive('heading', { level: 3 }),
    bulletList:  _editor.isActive('bulletList'),
    orderedList: _editor.isActive('orderedList'),
    canUndo:     _editor.can().undo(),
    canRedo:     _editor.can().redo(),
  }
}

// ── Node activation (called from NodeView click handlers) ─────────

export function activateNode(pos: number, latex: string): void {
  activeNodePos.value = pos
  activeFormula.value = latex
}

export function deactivateNode(): void {
  activeNodePos.value = null
  activeFormula.value = ''
}

// ── Formula mutations (called from FormulaPanel) ──────────────────

/**
 * Push a new LaTeX value to the currently active formula node.
 * Called on every keystroke in the textarea.
 */
export function updateActiveFormula(latex: string): void {
  if (!_editor || activeNodePos.value === null) return
  activeFormula.value = latex

  const { state } = _editor
  const pos  = activeNodePos.value
  const node = state.doc.nodeAt(pos)
  if (!node) return

  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex })
  _editor.view.dispatch(tr)
}

/**
 * Insert a new formula node at the current cursor position.
 * After insertion, the new node becomes the active node.
 */
export function insertNewFormula(latex: string, displayMode: boolean): void {
  if (!_editor) return
  if (displayMode) {
    _editor.chain().focus().insertContent({
      type: 'mathDisplay',
      attrs: { latex, numbered: false, aligned: false, label: '' },
    }).run()
  } else {
    _editor.chain().focus().insertContent({
      type: 'mathInline',
      attrs: { latex },
    }).run()
  }
}

/**
 * Insert a theorem environment at the current cursor position.
 */
export function insertTheoremEnv(envType: string): void {
  if (!_editor) return
  _editor.chain().focus().insertContent({
    type: 'theoremEnv',
    attrs: { envType, envTitle: '', label: '' },
    content: [{ type: 'paragraph' }],
  }).run()
}

// ── Formatting commands (called from Toolbar) ─────────────────────

export function toggleBold():        void { _editor?.chain().focus().toggleBold().run() }
export function toggleItalic():      void { _editor?.chain().focus().toggleItalic().run() }
export function toggleCode():        void { _editor?.chain().focus().toggleCode().run() }
export function setHeading(level: 1 | 2 | 3): void {
  _editor?.chain().focus().toggleHeading({ level }).run()
}
export function toggleBulletList():  void { _editor?.chain().focus().toggleBulletList().run() }
export function toggleOrderedList(): void { _editor?.chain().focus().toggleOrderedList().run() }
export function undo():              void { _editor?.chain().focus().undo().run() }
export function redo():              void { _editor?.chain().focus().redo().run() }

// ── Document-level operations ────────────────────────────────────

export function clearDocument(): void {
  if (!_editor) return
  deactivateNode()
  _editor.commands.setContent(
    { type: 'doc', content: [{ type: 'paragraph' }] },
    /* emitUpdate */ true
  )
}

export function loadExample(): void {
  // Imported lazily to avoid circular deps at module init time
  import('@features/documents/exampleDocument').then(({ EXAMPLE_DOCUMENT }) => {
    if (!_editor) return
    deactivateNode()
    _editor.commands.setContent(EXAMPLE_DOCUMENT as never, /* emitUpdate */ true)
    // Scroll back to top
    _editor.commands.focus('start')
  })
}

// ── Document serialization helper (called from ExportModal) ───────

export function getEditorJSON(): object | null {
  return _editor?.getJSON() ?? null
}

export function getEditorDoc() {
  return _editor?.state.doc ?? null
}
