import '@design/tokens.css'
import '@design/layout.css'
import '@design/components.css'
import '/node_modules/mathlive/mathlive-static.css'

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

import { MathInline }        from '@core/editor/extensions/MathInline'
import { MathDisplay }       from '@core/editor/extensions/MathDisplay'
import { TheoremEnv }        from '@core/editor/extensions/TheoremEnv'
import { TheoremEnvTitle }   from '@core/editor/extensions/TheoremEnvTitle'
import { FormulaNavigation } from '@core/editor/extensions/FormulaNavigation'
import { SlashCommands }    from '@core/editor/extensions/SlashCommands'
import { setEditor }         from '@core/editor/EditorStore'
import { LocalStorageAdapter } from '@features/documents/LocalStorageAdapter'
import { toStorage, fromStorage } from '@features/documents/DocumentSerializer'

// Register Lit components (side-effect imports)
import '@ui/toolbar/Toolbar'
import '@ui/status-bar/StatusBar'
import '@features/formula-editor/FloatingFormulaEditor'
import '@features/formula-editor/SnippetSidebar'
import '@features/export/ExportModal'

// ── Persistence ─────────────────────────────────────────────────────

const storage = new LocalStorageAdapter()

// ── Editor ──────────────────────────────────────────────────────────

const editorEl = document.getElementById('editor')
if (!editorEl) throw new Error('#editor element not found')

let currentDoc = storage.loadDocument()

const editor: Editor = new Editor({
  element: editorEl,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Start writing your document…',
    }),
    MathInline,
    MathDisplay,
    TheoremEnvTitle,
    TheoremEnv,
    FormulaNavigation,
    SlashCommands,
  ],
  content: (currentDoc ? fromStorage(currentDoc) : { type: 'doc', content: [{ type: 'paragraph' }] }) as never,
  onUpdate({ editor: e }) {
    currentDoc = toStorage(e.getJSON(), currentDoc ?? undefined)
    storage.saveDocument(currentDoc)
  },
})

setEditor(editor)

// ── Inject Lit components into layout slots ─────────────────────────

// Toolbar — replaces the empty toolbar rows
const appToolbar = document.getElementById('app-toolbar')!
appToolbar.innerHTML = ''
const toolbar = document.createElement('fp-toolbar')
appToolbar.appendChild(toolbar)

// ExportModal — appended to body, renders its own <dialog>
const modal = document.createElement('fp-export-modal')
document.body.appendChild(modal)

// FloatingFormulaEditor — fixed-position overlay, appended to body
const floatingEditor = document.createElement('fp-floating-formula')
document.body.appendChild(floatingEditor)

// StatusBar
const statusBarEl = document.getElementById('status-bar')!
statusBarEl.appendChild(document.createElement('fp-status-bar'))

// Sidebar
const sidebar = document.getElementById('snippet-sidebar')!
sidebar.innerHTML = ''
sidebar.appendChild(document.createElement('fp-snippet-sidebar'))

const coach = document.getElementById('coach-panel')!
coach.innerHTML = '<div class="cp-placeholder">Coach<br>(Phase 3)</div>'

console.log('Formalia — Phase 1 loaded')
