import { Node, mergeAttributes } from '@tiptap/core'
import { TheoremEnvView } from '../nodeviews/TheoremEnvView'
import type { TheoremEnvType } from '@core/math/types'

/* ─────────────────────────────────────────────────────────────────
   TheoremEnv — TipTap extension for mathematical environments.
   Supports: theorem, lemma, definition, example, remark, proof, etc.
   Content is editable (has contentDOM). Header derives from attrs.
   ───────────────────────────────────────────────────────────────── */

export const TheoremEnv = Node.create({
  name:    'theoremEnv',
  group:   'block',
  content: 'block+',   // editable body; at least one block child

  addAttributes() {
    return {
      envType:  { default: 'theorem' as TheoremEnvType },
      envTitle: { default: '' },
      label:    { default: '' },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-theorem-env]',
      getAttrs: (el) => ({
        envType:  (el as HTMLElement).dataset['env']   ?? 'theorem',
        envTitle: (el as HTMLElement).dataset['title'] ?? '',
        label:    (el as HTMLElement).dataset['label'] ?? '',
      }),
    }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-theorem-env': '',
      'data-env':         node.attrs['envType'],
      'data-title':       node.attrs['envTitle'],
      'data-label':       node.attrs['label'],
      class: 'theorem-env',
    }), 0]  // 0 = contentDOM slot
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const view = new TheoremEnvView(node, getPos as () => number | undefined)
      return {
        dom:        view.dom,
        contentDOM: view.contentDOM,
        update(n: Parameters<typeof view.update>[0]) {
          return view.update(n)
        },
        destroy() { view.destroy() },
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Backspace — two protections:
       *
       * A) Cursor at the very start of the first child of a theoremEnv.
       *    Blocks ProseMirror's joinBackward which would merge this env
       *    into the preceding block.
       *
       * B) Cursor in an empty top-level paragraph that sits immediately
       *    after a theoremEnv.  Instead of letting joinBackward pull the
       *    cursor into the env, we delete the empty paragraph cleanly.
       */
      Backspace: () => {
        const { selection, doc } = this.editor.state
        if (!selection.empty) return false
        const { $from } = selection

        // ── A: start of first child inside a theoremEnv ──────────────
        if ($from.parentOffset === 0) {
          for (let depth = $from.depth - 1; depth >= 1; depth--) {
            if ($from.node(depth).type === this.type && $from.index(depth) === 0) {
              return true
            }
          }
        }

        // ── B: empty top-level paragraph whose predecessor is a theoremEnv ──
        if (
          $from.depth === 1 &&
          $from.parent.type.name === 'paragraph' &&
          $from.parent.content.size === 0
        ) {
          const idx = $from.index(0)
          if (idx > 0 && doc.child(idx - 1).type === this.type) {
            const { tr } = this.editor.state
            this.editor.view.dispatch(
              tr.delete($from.before(1), $from.after(1)).scrollIntoView()
            )
            return true
          }
        }

        return false
      },

      /**
       * Delete — two protections:
       *
       * A) Cursor at the very end of the last child of a theoremEnv.
       *    Blocks ProseMirror's joinForward which would absorb the
       *    following block into this env.
       *
       * B) Cursor in an empty top-level paragraph that sits immediately
       *    before a theoremEnv.  Delete the empty paragraph cleanly
       *    instead of letting joinForward pull the env's content out.
       */
      Delete: () => {
        const { selection, doc } = this.editor.state
        if (!selection.empty) return false
        const { $from } = selection

        // ── A: end of last child inside a theoremEnv ─────────────────
        for (let depth = $from.depth - 1; depth >= 1; depth--) {
          const node = $from.node(depth)
          if (node.type === this.type) {
            const isLast  = $from.index(depth) === node.childCount - 1
            const isAtEnd = $from.parentOffset === $from.parent.content.size
            if (isLast && isAtEnd) return true
          }
        }

        // ── B: empty top-level paragraph whose successor is a theoremEnv ──
        if (
          $from.depth === 1 &&
          $from.parent.type.name === 'paragraph' &&
          $from.parent.content.size === 0
        ) {
          const idx = $from.index(0)
          if (idx < doc.childCount - 1 && doc.child(idx + 1).type === this.type) {
            const { tr } = this.editor.state
            this.editor.view.dispatch(
              tr.delete($from.before(1), $from.after(1)).scrollIntoView()
            )
            return true
          }
        }

        return false
      },
    }
  },
})
