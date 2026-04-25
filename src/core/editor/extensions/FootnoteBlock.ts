import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { registerLatexSerializer } from '@core/serializer/LatexSerializerRegistry'
import { FootnoteBlockView } from '@core/editor/nodeviews/FootnoteBlockView'

/* ─────────────────────────────────────────────────────────────────
   FootnoteBlock — editable block node that lives immediately after
   the paragraph containing its paired FootnoteRef inline atom.
   ───────────────────────────────────────────────────────────────── */

// FootnoteBlock emits nothing — FootnoteRef handles \footnote{...}
registerLatexSerializer('footnoteBlock', () => '')

export const FootnoteBlock = TiptapNode.create({
  name: 'footnoteBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-footnote-block]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-footnote-block': node.attrs['id'],
      class: 'fn-block',
    }), 0]
  },

  addNodeView() {
    return ({ node, getPos }: { node: PmNode; getPos: () => number | undefined }) =>
      new FootnoteBlockView(node, getPos)
  },
})
