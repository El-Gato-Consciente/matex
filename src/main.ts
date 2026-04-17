import '@design/tokens.css'
import '@design/layout.css'
import '@design/components.css'

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

import { MathInline }  from '@core/editor/extensions/MathInline'
import { MathDisplay } from '@core/editor/extensions/MathDisplay'
import { TheoremEnv }  from '@core/editor/extensions/TheoremEnv'
import { setEditor }   from '@core/editor/EditorStore'
import { LocalStorageAdapter } from '@features/documents/LocalStorageAdapter'

// Register Lit components (side-effect imports)
import '@ui/toolbar/Toolbar'
import '@features/formula-editor/FormulaPanel'
import '@features/export/ExportModal'

// ── Persistence ─────────────────────────────────────────────────────

const storage = new LocalStorageAdapter()

// ── Editor ──────────────────────────────────────────────────────────

const editorEl = document.getElementById('editor')
if (!editorEl) throw new Error('#editor element not found')

const savedDoc = storage.loadDocument()

const editor: Editor = new Editor({
  element: editorEl,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Start writing your document…',
    }),
    MathInline,
    MathDisplay,
    TheoremEnv,
  ],
  content: (savedDoc ?? { type: 'doc', content: [{ type: 'paragraph' }] }) as never,
  onUpdate({ editor: e }) {
    storage.saveDocument(e.getJSON() as object)
  },
})

setEditor(editor)

// ── Inject Lit components into layout slots ─────────────────────────

// Toolbar — replaces the empty toolbar rows
const appToolbar = document.getElementById('app-toolbar')!
appToolbar.innerHTML = ''
const toolbar = document.createElement('fp-toolbar')
appToolbar.appendChild(toolbar)

// FormulaPanel
const formulaPanel = document.getElementById('formula-panel')!
const panel = document.createElement('fp-formula-panel')
formulaPanel.appendChild(panel)

// ExportModal — appended to body, renders its own <dialog>
const modal = document.createElement('fp-export-modal')
document.body.appendChild(modal)

// Sidebar + coach placeholders (Phase 2 / 3 will replace these)
const sidebar = document.getElementById('snippet-sidebar')!
sidebar.innerHTML = '<div class="sb-placeholder">Snippets<br>(Phase 2)</div>'

const coach = document.getElementById('coach-panel')!
coach.innerHTML = '<div class="cp-placeholder">Coach<br>(Phase 3)</div>'

console.log('Formalia — Phase 1 loaded')
