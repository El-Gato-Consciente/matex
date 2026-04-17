import '@design/tokens.css'

// Phase 0 — entry point placeholder.
// Components and editor initialization will be imported here as they are built.
//
// Phase 1 will add:
//   import { initEditor } from '@core/editor/EditorStore'
//   import '@ui/toolbar/Toolbar'
//   import '@features/formula-editor/FormulaPanel'
//
// For now, just confirm the app shell loads correctly.

const app = document.getElementById('app')
if (!app) throw new Error('#app not found')

console.log('Formalia — Phase 0 bootstrap OK')
