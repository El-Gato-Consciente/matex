import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { registerLatexSerializer } from '@core/serializer/LatexSerializerRegistry'

/* ─────────────────────────────────────────────────────────────────
   TheoremEnvTitle — first required child of theoremEnv.

   content: inline*  → fully editable inline content, supports math,
   marks, etc. — exactly like a paragraph, but scoped to the title
   slot of a theorem environment.

   No group: this node is only valid as the first child of theoremEnv.

   LaTeX: the parent theoremEnv serializer reads this node's inline
   content directly; this serializer returns '' so it is never
   double-emitted if traversal reaches it through the default path.
   ───────────────────────────────────────────────────────────────── */

registerLatexSerializer('theoremEnvTitle', () => '')

export const TheoremEnvTitle = Node.create({
  name:     'theoremEnvTitle',
  content:  'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-theorem-env-title]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-theorem-env-title': '',
      class: 'theorem-env-title',
    }), 0]
  },

  addKeyboardShortcuts() {
    return {
      // Enter in the title → jump into the first body block.
      Enter: () => {
        const { state } = this.editor
        const { $from } = state.selection
        if ($from.parent.type.name !== 'theoremEnvTitle') return false

        const titleEnd = $from.after($from.depth)
        const tr = state.tr
        tr.setSelection(TextSelection.create(tr.doc, titleEnd + 1))
        this.editor.view.dispatch(tr.scrollIntoView())
        return true
      },
    }
  },
})
