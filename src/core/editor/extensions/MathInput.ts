import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/* ─────────────────────────────────────────────────────────────────
   MathInput — TipTap Node & Extension
   When the user types $ in plain text, it inserts a mathInput node.
   Inside the mathInput node, typing $ again commits it to a mathInline node.
   ───────────────────────────────────────────────────────────────── */

export const MathInputNode = Node.create({
  name: 'mathInput',
  group: 'inline',
  content: 'text*',
  inline: true,
  selectable: true,

  parseHTML() {
    return [
      { tag: 'span.math-input-node' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'math-input-node' }), 0]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('mathInputEmptyClass'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'mathInput' && node.textContent.length === 0) {
                decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                  class: 'is-empty'
                }))
              }
            })
            return DecorationSet.create(state.doc, decorations)
          }
        }
      })
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Enter': () => {
        // Find if we are currently inside a mathInput
        const { state, view } = this.editor
        const { selection } = state
        const { $from } = selection
        const node = $from.parent

        if (node.type.name === 'mathInput') {
          const text = node.textContent
          // Re-create as mathInline
          const tr = state.tr
          const pos = $from.before()
          const endpos = $from.after()

          tr.replaceWith(pos, endpos, state.schema.nodes.mathInline.create({ latex: text }))
          view.dispatch(tr)
          // Do not open regular popup, we're committing it
          return true
        }
        return false
      },
      'Shift-Enter': () => {
        // Inside mathInput we allow inserting new line but ProseMirror text nodes 
        // normally don't map Enter to \n. Better to insert a text \n or just let it be.
        // Actually, Tiptap's hardBreak will trigger if we don't handle it, 
        // but mathInput only accepts text. We can manually insert \n if we want.
        const { state, view } = this.editor
        const { selection } = state
        const { $from } = selection
        if ($from.parent.type.name === 'mathInput') {
          // just insert a newline character
          view.dispatch(state.tr.insertText('\n'))
          return true
        }
        return false
      },
      'Escape': () => {
        const { state, view } = this.editor
        const { selection } = state
        const { $from } = selection
        const node = $from.parent

        if (node.type.name === 'mathInput') {
          const pos = $from.before()
          const endpos = $from.after()
          // Abort: delete the node entirely (or replace with text). User asked: "que se anule y desaparezca"
          view.dispatch(state.tr.delete(pos, endpos))
          view.focus()
          return true
        }
        return false
      }
    }
  }
})

// Extension to handle the $ text input dynamically
export const MathInputTrigger = Extension.create({
  name: 'mathInputTrigger',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('mathInputTrigger'),
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== '$') return false

            const { state } = view
            const { selection } = state
            const { $from } = selection

            // Case 1: We are ALREADY inside a mathInput node.
            if ($from.parent.type.name === 'mathInput') {
              const mathInputNode = $from.parent
              const latexContent = mathInputNode.textContent
              const pos = $from.before()
              const endpos = $from.after()

              const tr = state.tr
              tr.replaceWith(pos, endpos, state.schema.nodes.mathInline.create({ latex: latexContent }))
              view.dispatch(tr)
              return true // consume the $
            }

            // Case 2: We are outside, user types $. Insert an empty mathInput node.
            // Create start of mathInput node.
            const tr = state.tr
            const emptyNode = state.schema.nodes.mathInput.create()
            tr.replaceWith(from, to, emptyNode)
            
            // Move cursor inside the newly created node
            // The node size of an empty inline text node container is usually bounds. 
            const newPos = from + 1
            tr.setSelection(TextSelection.create(tr.doc, newPos))
            
            view.dispatch(tr)
            return true // consume the $
          },
        },
      }),
    ]
  },
})
