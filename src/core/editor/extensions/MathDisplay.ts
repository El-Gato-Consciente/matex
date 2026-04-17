import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { MathDisplayView } from '../nodeviews/MathDisplayView'

/* ─────────────────────────────────────────────────────────────────
   MathDisplay — TipTap extension for display math nodes.
   Input rule: typing $$ on a blank paragraph → inserts MathDisplay.
   ───────────────────────────────────────────────────────────────── */

export const MathDisplay = Node.create({
  name:    'mathDisplay',
  group:   'block',
  atom:    true,  // non-editable; cursor jumps over it

  addAttributes() {
    return {
      latex:    { default: '' },
      numbered: { default: false },
      aligned:  { default: false },
      label:    { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-math-display]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-math-display': node.attrs['latex'],
      class: 'math-display',
    })]
  },

  addNodeView() {
    return ({ node, getPos }) =>
      new MathDisplayView(node, getPos as () => number | undefined)
  },

  addInputRules() {
    // Typing $$ on a blank line inserts an empty MathDisplay node.
    return [
      new InputRule({
        find: /^\$\$$/,
        handler: ({ state, range }) => {
          const { tr } = state
          const start  = range.from
          const end    = range.to
          tr.replaceWith(start - 1, end, this.type.create({ latex: '' }))
        },
      }),
    ]
  },
})
