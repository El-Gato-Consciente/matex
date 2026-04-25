/* ─────────────────────────────────────────────────────────────────
   Formalia — EditorStore
   Single bridge between TipTap and all UI components.
   Lit components and plain TS modules only touch this file —
   never the TipTap Editor object directly.
   ───────────────────────────────────────────────────────────────── */

import { signal, effect } from '@preact/signals-core'
import type { Editor } from '@tiptap/core'
import katex from 'katex'
import { TextSelection, Selection } from '@tiptap/pm/state'
import type { NormalizerChange } from '@core/math/types'

// ── Signals ──────────────────────────────────────────────────────

/** LaTeX string of the currently active formula node. */
export const activeFormula = signal<string>('')

/** ProseMirror position of the currently active formula node, or null. */
export const activeNodePos = signal<number | null>(null)

/** The exact DOM element of the currently active formula node. */
export const activeNodeDOM = signal<Element | null>(null)

/** Pending normalizer suggestions (Phase 3). Empty in Phase 1. */
export const coachChanges = signal<NormalizerChange[]>([])

/** KaTeX parse error for the formula currently open in FloatingFormulaEditor. */
export const activeFormulaError = signal<string | null>(null)

/** The raw text content of the currently active inline mathInput node. */
export const activeMathInputText = signal<string | null>(null)
export const activeMathInputRect = signal<DOMRect | null>(null)
/** ProseMirror position of the active mathInput node (before() the node). Used to detect formula switches. */
export const activeMathInputNodePos = signal<number | null>(null)

/** How the floating editor was opened — drives mode and Esc behaviour. */
export type TriggerSource = 'click' | 'keyboard' | 'toolbar'
export const triggerSource = signal<TriggerSource>('click')

/** Type of the currently active formula node. */
export const activeFormulaType = signal<'inline' | 'display' | null>(null)

/** Live document statistics, updated on every editor transaction. */
export const docStats = signal({ words: 0, mathInline: 0, mathDisplay: 0, theoremEnv: 0 })

/** Flat list of headings for the document outline, updated on every transaction. */
export interface OutlineItem { level: 1 | 2 | 3; text: string; pos: number; num: string }
export const docOutline = signal<OutlineItem[]>([])

/** Map from UUID → resolved theorem entry, updated on every transaction. */
export interface TheoremLabelEntry { type: string; num: string; pos: number; title: string }
export const theoremLabels = signal<Map<string, TheoremLabelEntry>>(new Map())

/** Map from UUID → footnote entry, updated on every transaction. */
export interface FootnoteEntry { num: number; pos: number; blockPos: number }
export const footnoteMap = signal<Map<string, FootnoteEntry>>(new Map())


/** Callbacks invoked synchronously every time theoremLabels is updated. */
const _labelsSubscribers = new Set<() => void>()
export function subscribeToLabels(cb: () => void): () => void {
  _labelsSubscribers.add(cb)
  // Fire immediately so the subscriber can render the current state
  cb()
  return () => _labelsSubscribers.delete(cb)
}

/** Document identity metadata. */
export interface DocMeta {
  title:       string
  author:      string
  email:       string
  date:        string
  institution: string
  abstract:    string
  keywords:    string
  language:    'es' | 'en'
}
export const docMeta = signal<DocMeta>({ title: '', author: '', email: '', date: '', institution: '', abstract: '', keywords: '', language: 'es' })

/** 
 * Unique identifier used to signal that a specific formula node view 
 * should automatically activate itself. Used for keyboard/toolbar insertions.
 */
export const pendingActivationSignal = signal<string | null>(null)

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
  // Populate signals immediately for the content already in the editor,
  // then migrate any nodes that are missing UUIDs (old format) in one transaction.
  _syncDocStats()
  _migrateOrphanIds()
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
  const parentType = $from.parent.type.name
  if (parentType === 'mathInput' || parentType === 'mathDisplayInput') {
    activeMathInputText.value = $from.parent.textContent
    activeMathInputNodePos.value = $from.before()
    activeFormulaType.value = (parentType === 'mathDisplayInput') ? 'display' : 'inline'
    const startPos = $from.before()
    let el = view.nodeDOM(startPos)
    // Tiptap might return the text node inside the inline wrapper
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement
    if (el instanceof Element) {
      activeMathInputRect.value = el.getBoundingClientRect()
    } else {
      const coords = view.coordsAtPos($from.pos)
      activeMathInputRect.value = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
    }
  } else {
    activeMathInputText.value = null
    activeMathInputRect.value = null
    activeMathInputNodePos.value = null
    // activeFormulaType.value is handled by deactivateNode or NodeViews
  }

  _syncDocStats()
}

const _UNNUMBERED_ENV = new Set(['proof'])

// Assign UUIDs to all theoremEnv nodes that have an empty id, in one transaction.
function _migrateOrphanIds(): void {
  if (!_editor) return
  const { state } = _editor
  const { tr } = state
  let changed = false
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'theoremEnv' && !(node.attrs['id'] as string)?.trim()) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: crypto.randomUUID() })
      changed = true
    }
  })
  if (changed) _editor.view.dispatch(tr)
}

function _syncDocStats(): void {
  if (!_editor) return
  const doc = _editor.state.doc
  let mathInline = 0, mathDisplay = 0, theoremEnv = 0
  const outline: OutlineItem[] = []
  const labelMap = new Map<string, TheoremLabelEntry>()
  const fnMap    = new Map<string, FootnoteEntry>()
  let fnNum = 0
  let c1 = 0, c2 = 0, c3 = 0
  let envInSection = 0   // shared counter across all env types, resets per H1

  // First pass: collect block positions
  const fnBlockPos = new Map<string, number>()
  doc.descendants((node, pos) => {
    if (node.type.name === 'footnoteBlock') {
      fnBlockPos.set(node.attrs['id'] as string, pos)
      return false
    }
  })

  doc.descendants((node, pos) => {
    if      (node.type.name === 'mathInline')  { mathInline++; return false }
    else if (node.type.name === 'mathDisplay') { mathDisplay++; return false }
    else if (node.type.name === 'footnoteRef') {
      const id = node.attrs['id'] as string
      fnNum++
      fnMap.set(id, { num: fnNum, pos, blockPos: fnBlockPos.get(id) ?? -1 })
      return false
    }
    else if (node.type.name === 'theoremEnv') {
      theoremEnv++
      const envType = node.attrs['envType'] as string
      const id      = (node.attrs['id'] as string ?? '').trim()
      if (!_UNNUMBERED_ENV.has(envType)) {
        envInSection++
        const num = c1 > 0 ? `${c1}.${envInSection}` : `${envInSection}`
        const title = node.childCount > 0 ? node.child(0).textContent.trim() : ''
        if (id) labelMap.set(id, { type: envType, num, pos, title })
      }
    }
    else if (node.type.name === 'heading') {
      const level = node.attrs['level'] as 1 | 2 | 3
      const text  = node.textContent.trim()
      let num: string
      if (level === 1) { c1++; c2 = 0; c3 = 0; num = `${c1}`; envInSection = 0 }
      else if (level === 2) { c2++; c3 = 0; num = `${c1}.${c2}` }
      else                  { c3++;           num = `${c1}.${c2}.${c3}` }
      if (text) outline.push({ level, text, pos, num })
    }
  })

  const text  = doc.textContent.trim()
  const words = text ? text.split(/\s+/).length : 0
  docStats.value      = { words, mathInline, mathDisplay, theoremEnv }
  docOutline.value    = outline
  theoremLabels.value = labelMap
  footnoteMap.value   = fnMap
  _labelsSubscribers.forEach(cb => cb())
}


// ── Node activation (called from NodeView click handlers) ─────────

export function activateNode(pos: number, latex: string, dom: Element | null = null, source: TriggerSource = 'click'): void {
  activeNodePos.value = pos
  activeFormula.value = latex
  activeNodeDOM.value = dom
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
  activeNodeDOM.value = null
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
export function releaseFormulaSelection(atPos?: number | null): void {
  if (!_editor) return
  const { state } = _editor
  
  const pos = atPos ?? activeNodePos.value
  if (pos === null) {
    // Fallback to start if no position is known
    _editor.view.dispatch(state.tr.setSelection(TextSelection.atStart(state.doc)))
    return
  }

  const node = state.doc.nodeAt(pos)
  const afterPos = Math.min(pos + (node?.nodeSize || 0), state.doc.content.size)
  const $after = state.doc.resolve(afterPos)

  // Use Selection.near to find the closest valid spot (like a GapCursor)
  // but without a heavy bias that would jump into the next node.
  const sel = Selection.near($after, -1)
  _editor.view.dispatch(state.tr.setSelection(sel))
}

/** Returns focus to the editor canvas (called when closing the floating editor). */
export function focusEditor(): void {
  _editor?.view.focus()
}

/** Scrolls the editor to the heading at the given ProseMirror position. */
export function scrollToHeading(pos: number): void {
  if (!_editor) return
  const { state, view } = _editor
  const $pos = state.doc.resolve(pos + 1)
  const sel  = Selection.near($pos)
  view.dispatch(state.tr.setSelection(sel))
  view.focus()
  requestAnimationFrame(() => {
    const dom = view.nodeDOM(pos)
    const el = dom instanceof Element ? dom : (dom as Node | null)?.parentElement
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  })
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

  // 1. SIGNAL: Generate a unique token for this specific insertion
  const token = Math.random().toString(36).substring(2)
  pendingActivationSignal.value = token
  triggerSource.value = source

  // Add the token to the node attributes so the View can recognize it
  const attrsWithToken = { ...attrs, activationToken: token }

  // 2. INSERT: TipTap creates the node and triggers the NodeView constructor
  _editor.chain().focus().insertContent({ type: typeName, attrs: attrsWithToken }).run()
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
    attrs: { envType, id: crypto.randomUUID() },
    content: [
      { type: 'theoremEnvTitle' },
      { type: 'paragraph' },
    ],
  }).run()
}

/**
 * If the cursor is inside a mathInput or mathDisplayInput node, inserts
 * `text` at the cursor and returns true. Returns false otherwise.
 */
export function insertIntoActiveMathInput(text: string): boolean {
  if (!_editor) return false
  const { state, view } = _editor
  const { $from } = state.selection
  const parentType = $from.parent.type.name
  if (parentType !== 'mathInput' && parentType !== 'mathDisplayInput') return false
  view.dispatch(state.tr.insertText(text))
  view.focus()
  return true
}

/** Insert a footnoteRef at cursor + footnoteBlock right after the containing paragraph. */
export function insertFootnote(): void {
  if (!_editor) return
  const { state, view } = _editor
  const { tr, schema } = state
  const id = crypto.randomUUID()

  const refNode   = schema.nodes['footnoteRef']!.create({ id })
  const blockNode = schema.nodes['footnoteBlock']!.create(
    { id },
    schema.nodes['paragraph']!.create(),
  )

  // Position after the top-level block containing the cursor
  const topLevelEnd = state.selection.$from.after(1)

  // Insert ref at cursor, then block right after the containing paragraph.
  // tr.mapping.map() adjusts for the ref insertion that precedes the block.
  tr.replaceWith(state.selection.from, state.selection.to, refNode)
  tr.insert(tr.mapping.map(topLevelEnd), blockNode)
  view.dispatch(tr)
}

/** Delete both the footnoteRef and its footnoteBlock. */
export function deleteFootnote(id: string): void {
  if (!_editor) return
  const { state, view } = _editor
  const { tr } = state
  const toDelete: Array<{ from: number; to: number }> = []

  state.doc.descendants((node, pos) => {
    if (
      (node.type.name === 'footnoteRef' || node.type.name === 'footnoteBlock') &&
      node.attrs['id'] === id
    ) {
      toDelete.push({ from: pos, to: pos + node.nodeSize })
    }
  })

  // Delete in reverse order so earlier positions stay valid
  toDelete.sort((a, b) => b.from - a.from)
  for (const { from, to } of toDelete) tr.delete(from, to)
  view.dispatch(tr)
}

/** Scroll the editor to the footnoteBlock for `id` and place cursor inside it. */
export function scrollToFootnoteBlock(id: string): void {
  if (!_editor) return
  const entry = footnoteMap.value.get(id)
  if (!entry || entry.blockPos < 0) return

  const { view } = _editor
  const dom = view.nodeDOM(entry.blockPos)
  const el = dom instanceof Element ? dom : (dom as ChildNode | null)?.parentElement
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  // Place cursor inside the block's first paragraph
  try {
    const $pos = _editor.state.doc.resolve(entry.blockPos + 2)
    view.dispatch(
      _editor.state.tr.setSelection(TextSelection.near($pos))
    )
    view.focus()
  } catch { /* position may be invalid if block is empty */ }
}

/** Scroll the editor to the footnoteRef for `id` and place cursor after it. */
export function scrollToFootnoteRef(id: string): void {
  if (!_editor) return
  const entry = footnoteMap.value.get(id)
  if (!entry) return

  const { view } = _editor
  const dom = view.nodeDOM(entry.pos)
  const el = dom instanceof Element ? dom : (dom as ChildNode | null)?.parentElement
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  try {
    const $pos = _editor.state.doc.resolve(entry.pos + 1)
    view.dispatch(_editor.state.tr.setSelection(TextSelection.near($pos)))
    view.focus()
  } catch { /* position may be invalid */ }
}


export function insertTheoremRef(id: string): void {
  if (!_editor) return
  const { state, view } = _editor
  const { tr, schema } = state
  const refNode = schema.nodes['theoremRef']?.create({ id })
  if (!refNode) return
  view.dispatch(tr.replaceSelectionWith(refNode))
  _editor.view.focus()
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
  docMeta.value = { title: '', author: '', email: '', date: '', institution: '', abstract: '', keywords: '', language: 'es' }
  _editor.commands.setContent(
    { type: 'doc', content: [{ type: 'paragraph' }] },
    /* emitUpdate */ true
  )
}

export function loadExample(): void {
  // Imported lazily to avoid circular deps at module init time
  import('@features/documents/ExampleDocument').then(({ EXAMPLE_DOCUMENT }) => {
    if (!_editor) return
    deactivateNode()
    docMeta.value = {
      title:       'Análisis Real — Continuidad y Derivada',
      author:      'Formalia',
      email:       '',
      date:        '',
      institution: '',
      abstract:    '',
      keywords:    'análisis real, continuidad, derivada',
      language:    'es',
    }
    _editor.commands.setContent(EXAMPLE_DOCUMENT as never, /* emitUpdate */ true)
    _migrateOrphanIds()
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

// ── Document metadata ─────────────────────────────────────────────

export function initDocMeta(meta: Partial<DocMeta>): void {
  docMeta.value = {
    title:       meta.title       ?? '',
    author:      meta.author      ?? '',
    email:       meta.email       ?? '',
    date:        meta.date        ?? '',
    institution: meta.institution ?? '',
    abstract:    meta.abstract    ?? '',
    keywords:    meta.keywords    ?? '',
    language:    meta.language    ?? 'es',
  }
}

export function updateDocMeta(patch: Partial<DocMeta>): void {
  docMeta.value = { ...docMeta.value, ...patch }
}

/**
 * Replaces the entire editor content programmatically.
 * Used by TemplateSelector when the user picks a new template.
 */
export function setDocumentContent(content: import('@tiptap/core').JSONContent): void {
  if (!_editor) return
  deactivateNode()
  _editor.commands.setContent(content as never, /* emitUpdate */ true)
  _migrateOrphanIds()
  _editor.commands.focus('start')
}

// ── Validation logic (Auto-updates activeFormulaError) ─────────────

effect(() => {
  const text = activeMathInputText.value
  // We only handle inline validation here. 
  // FloatingFormulaEditor still handles its own for now to maintain its local state logic.
  if (text !== null) {
    if (!text.trim()) {
      activeFormulaError.value = null
      return
    }
    try {
      katex.renderToString(text, { throwOnError: true })
      activeFormulaError.value = null
    } catch (err) {
      activeFormulaError.value = (err as Error).message.replace(/^KaTeX parse error: /, '')
    }
  }
})
