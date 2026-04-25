import { Node, mergeAttributes } from '@tiptap/core'
import { registerLatexSerializer } from '@core/serializer/LatexSerializerRegistry'
import { FootnoteRefView } from '@core/editor/nodeviews/FootnoteRefView'
import { insertFootnote } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   FootnoteRef — inline atom that marks a footnote reference [N].
   Its pair (FootnoteBlock) lives at the end of the document.
   LaTeX: \footnote{block content} — serialized at this position.
   ───────────────────────────────────────────────────────────────── */

registerLatexSerializer('footnoteRef', (node, ctx) => {
  const id = node.attrs['id'] as string
  // Find matching footnoteBlock anywhere in the document
  let blockNode: import('@tiptap/pm/model').Node | null = null
  ctx.doc.descendants((n) => {
    if (blockNode) return false
    if (n.type.name === 'footnoteBlock' && n.attrs['id'] === id) {
      blockNode = n
      return false
    }
  })
  if (!blockNode) return '\\footnote{}'
  const content = ctx.serializeFragment((blockNode as import('@tiptap/pm/model').Node).content).trim()
  return `\\footnote{${content}}`
})

export const FootnoteRef = Node.create({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-footnote-ref]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-footnote-ref': node.attrs['id'],
      class: 'fn-ref',
    })]
  },

  addNodeView() {
    return ({ node, getPos }) =>
      new FootnoteRefView(node, getPos as () => number | undefined)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-f': () => { insertFootnote(); return true },
    }
  },
})
