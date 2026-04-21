/* ─────────────────────────────────────────────────────────────────
   Formalia — EditorStore
   Single bridge between TipTap and all UI components.
   Lit components and plain TS modules only touch this file —
   never the TipTap Editor object directly.
   ───────────────────────────────────────────────────────────────── */

import { signal } from '@preact/signals-core'
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { NormalizerChange } from '@core/math/types'

// ── Signals ──────────────────────────────────────────────────────

/** LaTeX string of the currently active formula node. */
export const activeFormula = signal<string>('')

/** ProseMirror position of the currently active formula node, or null. */
export const activeNodePos = signal<number | null>(null)

/** Pending normalizer suggestions (Phase 3). Empty in Phase 1. */
export const coachChanges = signal<NormalizerChange[]>([])

/** KaTeX parse error for the formula currently open in FloatingFormulaEditor. */
export const activeFormulaError = signal<string | null>(null)

/** The raw text content of the currently active inline mathInput node. */
export const activeMathInputText = signal<string | null>(null)
export const activeMathInputRect = signal<DOMRect | null>(null)

/** How the floating editor was opened — drives mode and Esc behaviour. */
export type TriggerSource = 'click' | 'keyboard' | 'toolbar'
export const triggerSource = signal<TriggerSource>('click')

/** Type of the currently active formula node. */
export const activeFormulaType = signal<'inline' | 'display' | null>(null)

/** Live document statistics, updated on every editor transaction. */
export const docStats = signal({ words: 0, mathInline: 0, mathDisplay: 0, theoremEnv: 0 })

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

  // Sync internal mathInput state for tooltip
  const { state, view } = _editor
  const { $from } = state.selection
  if ($from.parent.type.name === 'mathInput') {
    activeMathInputText.value = $from.parent.textContent
    const startPos = $from.before()
    let el = view.nodeDOM(startPos)
    // Tiptap might return the text node inside the inline wrapper
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement
    if (el instanceof Element) {
      activeMathInputRect.value = el.getBoundingClientRect()
    } else {
      // Fallback to cursor pos if no element found
      const coords = view.coordsAtPos($from.pos)
      activeMathInputRect.value = {
        top: coords.top, left: coords.left, width: 0, height: coords.bottom - coords.top, bottom: coords.bottom, right: coords.right, x: coords.left, y: coords.top, toJSON: () => {}
      } as DOMRect
    }
  } else {
    activeMathInputText.value = null
    activeMathInputRect.value = null
  }

  _syncDocStats()
}

function _syncDocStats(): void {
  if (!_editor) return
  const doc = _editor.state.doc
  let mathInline = 0, mathDisplay = 0, theoremEnv = 0
  doc.descendants(node => {
    if      (node.type.name === 'mathInline')  mathInline++
    else if (node.type.name === 'mathDisplay') mathDisplay++
    else if (node.type.name === 'theoremEnv')  theoremEnv++
  })
  const text  = doc.textContent.trim()
  const words = text ? text.split(/\s+/).length : 0
  docStats.value = { words, mathInline, mathDisplay, theoremEnv }
}

// ── Node activation (called from NodeView click handlers) ─────────

export function activateNode(pos: number, latex: string, source: TriggerSource = 'click'): void {
  activeNodePos.value = pos
  activeFormula.value = latex
  triggerSource.value = source
  if (_editor) {
    const node = _editor.state.doc.nodeAt(pos)
    activeFormulaType.value = node?.type.name === 'mathDisplay' ? 'display' : 'inline'
    // Blur editor immediately so the cursor doesn't flash on the canvas
    _editor.view.dom.blur()
  }
}

export function deactivateNode(): void {
  activeNodePos.value = null
  activeFormula.value = ''
  activeFormulaError.value = null
  activeFormulaType.value = null
  triggerSource.value = 'click'
}


/**
 * Releases the ProseMirror NodeSelection on the active formula by switching
 * to a TextSelection right after it.  Must be called as soon as the floating
 * editor opens so ProseMirror stops trying to re-assert the NodeSelection
 * (which would steal focus from the textarea on every setNodeMarkup dispatch).
 */
export function releaseFormulaSelection(): void {
  if (!_editor || activeNodePos.value === null) return
  const { state } = _editor
  const pos  = activeNodePos.value
  const node = state.doc.nodeAt(pos)
  if (!node) return
  const afterPos = Math.min(pos + node.nodeSize, state.doc.content.size)
  const $after   = state.doc.resolve(afterPos)
  const sel      = TextSelection.near($after, 1)
  _editor.view.dispatch(state.tr.setSelection(sel))
}

/** Returns focus to the editor canvas (called when closing the floating editor). */
export function focusEditor(): void {
  _editor?.view.focus()
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
 * Insert a new formula node and immediately open the floating editor on it.
 * Used by toolbar buttons and Ctrl+M shortcuts.
 */
export function insertNewFormulaAndActivate(latex: string, displayMode: boolean, source: TriggerSource = 'toolbar'): void {
  if (!_editor) return
  const typeName = displayMode ? 'mathDisplay' : 'mathInline'
  const attrs    = displayMode
    ? { latex, numbered: false, aligned: false, label: '' }
    : { latex }

  // Save position before insert — used as search start for block nodes
  const insertFrom = _editor.state.selection.from

  _editor.chain().focus().insertContent({ type: typeName, attrs }).run()

  const { selection, doc } = _editor.state
  const { $from } = selection

  // Strategy 1: nodeBefore (inline atom — TipTap leaves cursor right after it)
  if ($from.nodeBefore?.type.name === typeName) {
    activateNode($from.pos - $from.nodeBefore.nodeSize, latex, source)
    return
  }

  // Strategy 2: scan forward from insert position (block node case)
  let found = false
  doc.nodesBetween(insertFrom, Math.min(insertFrom + 200, doc.content.size), (node, pos) => {
    if (found) return false
    if (node.type.name === typeName) {
      activateNode(pos, latex, source)
      found = true
      return false
    }
  })
}

/**
 * Returns the DOM element that renders the currently active formula node,
 * used by FloatingFormulaEditor to position itself.
 */
export function getActiveFormulaDOM(): Element | null {
  if (!_editor || activeNodePos.value === null) return null
  const domNode = _editor.view.nodeDOM(activeNodePos.value)
  if (!domNode) return null
  return domNode instanceof Element ? domNode : (domNode as ChildNode).parentElement
}

/**
 * Insert a theorem environment at the current cursor position.
 */
export function insertTheoremEnv(envType: string): void {
  if (!_editor) return
  _editor.chain().focus().insertContent({
    type: 'theoremEnv',
    attrs: { envType, label: '' },
    content: [
      { type: 'theoremEnvTitle' },
      { type: 'paragraph' },
    ],
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
