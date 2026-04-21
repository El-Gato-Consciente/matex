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
    return [
      'span', mergeAttributes(HTMLAttributes, { class: 'math-input-node' }),
      ['span', { class: 'math-input-boundary', contenteditable: 'false' }, '\u200B'],
      ['span', { class: 'math-input-content' }, 0],
      ['span', { class: 'math-input-boundary', contenteditable: 'false' }, '\u200B']
    ]
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
        const { state, view } = this.editor
        const { selection } = state
        const { $from } = selection
        const node = $from.parent

        if (node.type.name === 'mathInput') {
          const text = node.textContent
          const tr = state.tr
          const pos = $from.before()
          const endpos = $from.after()

          if (!text.trim()) {
            tr.delete(pos, endpos)
          } else {
            tr.replaceWith(pos, endpos, state.schema.nodes.mathInline.create({ latex: text }))
          }
          view.dispatch(tr)
          return true
        }
        return false
      },
      'Shift-Enter': () => {
        const { state, view } = this.editor
        const { selection } = state
        const { $from } = selection
        if ($from.parent.type.name === 'mathInput') {
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
          view.dispatch(state.tr.delete(pos, endpos))
          view.focus()
          return true
        }
        return false
      },
      'ArrowRight': () => {
        const { state, view } = this.editor
        const { selection } = state
        const { $from, empty } = selection
        if (!empty) return false

        // 1. Escaping mathInput to the right
        if ($from.parent.type.name === 'mathInput') {
          const size = $from.parent.content.size
          if ($from.parentOffset === size) {
            const latex = $from.parent.textContent
            const pos = $from.before()
            const endpos = $from.after()
            const tr = state.tr
            if (!latex.trim()) {
              tr.delete(pos, endpos)
            } else {
              tr.replaceWith(pos, endpos, state.schema.nodes.mathInline.create({ latex }))
            }
            view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)))
            return true
          } else if ($from.parentOffset === size - 1) {
            view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, $from.pos + 1)))
            return true
          }
        }

        // 2. Entering mathInline from the left
        const nodeAfter = $from.nodeAfter
        if (nodeAfter && nodeAfter.type.name === 'mathInline') {
          const latex = nodeAfter.attrs.latex || ''
          const pos = $from.pos
          const tr = state.tr
          const newNode = state.schema.nodes.mathInput.create(null, latex ? state.schema.text(latex) : null)
          tr.replaceWith(pos, pos + nodeAfter.nodeSize, newNode)
          view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)))
          return true
        }
        
        return false
      },
      'ArrowLeft': () => {
        const { state, view } = this.editor
        const { selection } = state
        const { $from, empty } = selection
        if (!empty) return false

        // 1. Escaping mathInput to the left
        if ($from.parent.type.name === 'mathInput') {
          if ($from.parentOffset === 0) {
            const latex = $from.parent.textContent
            const pos = $from.before()
            const endpos = $from.after()
            const tr = state.tr
            if (!latex.trim()) {
              tr.delete(pos, endpos)
            } else {
              tr.replaceWith(pos, endpos, state.schema.nodes.mathInline.create({ latex }))
            }
            view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos)))
            return true
          } else if ($from.parentOffset === 1) {
            view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, $from.pos - 1)))
            return true
          }
        }

        // 2. Entering mathInline from the right
        const nodeBefore = $from.nodeBefore
        if (nodeBefore && nodeBefore.type.name === 'mathInline') {
          const latex = nodeBefore.attrs.latex || ''
          const pos = $from.pos - nodeBefore.nodeSize
          const tr = state.tr
          const newNode = state.schema.nodes.mathInput.create(null, latex ? state.schema.text(latex) : null)
          tr.replaceWith(pos, $from.pos, newNode)
          view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1 + latex.length)))
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
              const textBefore = $from.parent.textContent.substring(0, $from.parentOffset)
              if (textBefore.endsWith('\\')) {
                // If it's escaped like \$, do not close the formula, just let Prosemirror insert the $ char as text
                return false
              }

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
