import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { insertNewFormulaAndActivate } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   BackslashTrigger — TipTap extension
   When the user types \ in plain text, intercepts it and opens
   the floating formula editor in code mode with \ pre-loaded.
   Esc in the editor inserts a literal \ back into the document.
   ───────────────────────────────────────────────────────────────── */

export const BackslashTrigger = Extension.create({
  name: 'backslashTrigger',

  addKeyboardShortcuts() {
    return {}
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(_view, _from, _to, text) {
            if (text !== '\\') return false
            // Defer so ProseMirror finishes its own handling first
            setTimeout(() => insertNewFormulaAndActivate('', false, 'backslash'), 0)
            return true  // consume the \ — don't insert it into the doc
          },
        },
      }),
    ]
  },
})
