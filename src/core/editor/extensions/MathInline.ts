import { Node, mergeAttributes } from '@tiptap/core'
import { MathInlineView } from '../nodeviews/MathInlineView'
import { registerLatexSerializer } from '@core/serializer/LatexSerializerRegistry'

/* ─────────────────────────────────────────────────────────────────
   MathInline — TipTap extension for inline math nodes.
   Stored as: <span data-math-inline="latex">
   ───────────────────────────────────────────────────────────────── */

registerLatexSerializer('mathInline', (node) => `$${node.attrs['latex']}$`)

export const MathInline = Node.create({
  name:   'mathInline',
  group:  'inline',
  inline: true,
  atom:   true,   // non-editable leaf; cursor jumps over it
  selectable: true,

  addAttributes() {
    return {
      latex: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-math-inline': node.attrs['latex'],
      class: 'math-inline',
    })]
  },

  addNodeView() {
    return ({ node, getPos }) =>
      new MathInlineView(node, getPos as () => number | undefined)
  },
})
