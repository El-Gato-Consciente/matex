import '@design/tokens.css'
import '@design/layout.css'
import '@design/components.css'
import '/node_modules/mathlive/mathlive-static.css'
import 'katex/dist/katex.min.css'

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

import { MathInline }        from '@core/editor/extensions/MathInline'
import { MathDisplay }       from '@core/editor/extensions/MathDisplay'
import { TheoremEnv }        from '@core/editor/extensions/TheoremEnv'
import { TheoremEnvTitle }   from '@core/editor/extensions/TheoremEnvTitle'
import { FormulaNavigation } from '@core/editor/extensions/FormulaNavigation'
import { MathInputNode, MathDisplayInputNode, MathInputTrigger, MathInputAutoCommit } from '@core/editor/extensions/MathInput'
import { SlashMenu }          from '@core/editor/extensions/SlashMenu'
import { SnippetPalette }     from '@core/editor/extensions/SnippetPalette'
import { SectionNumbering }   from '@core/editor/extensions/SectionNumbering'
import { TheoremRef }         from '@core/editor/extensions/TheoremRef'
import { FootnoteRef }        from '@core/editor/extensions/FootnoteRef'
import { FootnoteBlock }      from '@core/editor/extensions/FootnoteBlock'
import { setEditor, initDocMeta, docMeta } from '@core/editor/EditorStore'
import { effect } from '@preact/signals-core'
import { LocalStorageAdapter } from '@features/documents/LocalStorageAdapter'
import { toStorage, fromStorage } from '@features/documents/DocumentSerializer'

// Register Lit components (side-effect imports)
import '@features/documents/DocHeader'
import '@features/documents/DocPanel'
import '@features/documents/TemplateSelector'
import '@ui/toolbar/Toolbar'
import '@ui/status-bar/StatusBar'
import '@features/formula-editor/FloatingFormulaEditor'
import '@features/formula-editor/MathPreviewTooltip'
import '@features/formula-editor/SnippetSidebar'
import '@features/coach/CoachPanel'
import '@features/export/ExportModal'

// ── Persistence ─────────────────────────────────────────────────────

const storage = new LocalStorageAdapter()

// ── Editor ──────────────────────────────────────────────────────────

const editorEl = document.getElementById('editor')
if (!editorEl) throw new Error('#editor element not found')

let currentDoc = storage.loadDocument()

// Initialize docMeta signal from persisted metadata
if (currentDoc?.metadata) {
  initDocMeta({
    title:       currentDoc.metadata.title       ?? '',
    author:      currentDoc.metadata.author      ?? '',
    email:       currentDoc.metadata.email       ?? '',
    date:        currentDoc.metadata.date        ?? '',
    institution: currentDoc.metadata.institution ?? '',
    abstract:    currentDoc.metadata.abstract    ?? '',
    keywords:    currentDoc.metadata.keywords    ?? '',
    language:    currentDoc.metadata.language    ?? 'es',
  })
}

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
    MathInputNode,
    MathDisplayInputNode,
    MathInputAutoCommit,
    MathInputTrigger,
    SlashMenu,
    SnippetPalette,
    SectionNumbering,
    TheoremRef,
    FootnoteRef,
    FootnoteBlock,
  ],
  content: (currentDoc ? fromStorage(currentDoc) : { type: 'doc', content: [{ type: 'paragraph' }] }) as never,
  onUpdate({ editor: e }) {
    currentDoc = _save(e.getJSON())
  },
})

function _save(json?: object) {
  const prev: Parameters<typeof toStorage>[1] = {
    ...currentDoc,
    metadata: { ...currentDoc?.metadata, ...docMeta.value, savedAt: 0, createdAt: currentDoc?.metadata?.createdAt ?? 0 },
  }
  const doc = toStorage((json ?? editor.getJSON()) as never, prev)
  storage.saveDocument(doc)
  return doc
}

setEditor(editor)

// Persist whenever metadata changes (title, author, date, institution)
effect(() => {
  docMeta.value  // subscribe
  if (editor) _save()
})

// ── Inject Lit components into layout slots ─────────────────────────

// Toolbar — replaces the empty toolbar rows
const appToolbar = document.getElementById('app-toolbar')!
appToolbar.innerHTML = ''
const toolbar = document.createElement('fp-toolbar')
appToolbar.appendChild(toolbar)

// DocHeader — mounted above the editor canvas
const editorWrap = document.getElementById('editor-wrap') ?? editorEl.parentElement!
const docHeader = document.createElement('fp-doc-header')
editorWrap.insertBefore(docHeader, editorEl)

// TemplateSelector — appended to body, renders its own <dialog>
const templateSelector = document.createElement('fp-template-selector')
document.body.appendChild(templateSelector)

// ExportModal — appended to body, renders its own <dialog>
const modal = document.createElement('fp-export-modal')
document.body.appendChild(modal)

// FloatingFormulaEditor — fixed-position overlay, appended to body
const floatingEditor = document.createElement('fp-floating-formula')
document.body.appendChild(floatingEditor)

// Tooltip para inline $ math preview
const mathTooltip = document.createElement('fp-math-preview-tooltip')
document.body.appendChild(mathTooltip)

// StatusBar
const statusBarEl = document.getElementById('status-bar')!
statusBarEl.appendChild(document.createElement('fp-status-bar'))

// Doc panel (left)
const docPanel = document.getElementById('doc-panel')!
docPanel.appendChild(document.createElement('fp-doc-panel'))

// Snippet sidebar (right)
const sidebar = document.getElementById('snippet-sidebar')!
sidebar.innerHTML = ''
sidebar.appendChild(document.createElement('fp-snippet-sidebar'))


console.log('Formalia — Phase 1 loaded')
