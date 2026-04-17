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
})
