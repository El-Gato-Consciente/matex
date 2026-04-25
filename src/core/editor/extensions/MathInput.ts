import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, Selection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/* ─────────────────────────────────────────────────────────────────
   MathInput — TipTap Node & Extension
   When the user types $ in plain text, it inserts a mathInput node.
   Inside the mathInput node, typing $ again commits it to a mathInline node.
   ───────────────────────────────────────────────────────────────── */

// ── Shared helpers ────────────────────────────────────────────────

/**
 * Commits a mathInput node (inline) to a mathInline atom and moves the cursor.
 * If the node is empty, it is deleted instead.
 */
function commitInlineAndMove(editor: any, side: 'left' | 'right'): boolean {
  const { state, view } = editor
  const { $from } = state.selection
  const latex = $from.parent.textContent
  const pos    = $from.before()
  const endpos = $from.after()
  const tr = state.tr

  if (!latex.trim()) {
    tr.delete(pos, endpos)
  } else {
    tr.replaceWith(pos, endpos, state.schema.nodes.mathInline.create({ latex }))
  }
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, side === 'right' ? pos + 1 : pos)))
  return true
}

/**
 * Replaces a committed mathInline/mathDisplay node with an editable
 * mathInput/mathDisplayInput node, placing the cursor at start or end.
 */
function openNodeAsInput(
  editor: any,
  node: any,
  pos: number,
  endPos: number,
  cursorAtEnd: boolean,
  isDisplay = false,
): void {
  const { state, view } = editor
  const latex: string = node.attrs.latex || ''
  const inputType = isDisplay
    ? state.schema.nodes.mathDisplayInput
    : state.schema.nodes.mathInput
  const newNode = inputType.create(null, latex ? state.schema.text(latex) : null)
  const tr = state.tr.replaceWith(pos, endPos, newNode)
  const cursorPos = cursorAtEnd ? pos + 1 + latex.length : pos + 1
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursorPos)))
}

// ── MathInputNode ─────────────────────────────────────────────────

export const MathInputNode = Node.create({
  name: 'mathInput',
  group: 'inline',
  content: 'text*',
  inline: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'span.math-input-node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span', mergeAttributes(HTMLAttributes, { class: 'math-input-node' }),
      ['span', { class: 'math-input-boundary', contenteditable: 'false' }, '​'],
      ['span', { class: 'math-input-content' }, 0],
      ['span', { class: 'math-input-boundary', contenteditable: 'false' }, '​'],
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('mathInputPaste'),
        props: {
          handlePaste(view, event) {
            const { $from } = view.state.selection
            const parentType = $from.parent.type.name
            if (parentType !== 'mathInput' && parentType !== 'mathDisplayInput') return false
            // Bypass ProseMirror's slice-fitting logic — paste as plain text directly
            const text = event.clipboardData?.getData('text/plain') ?? ''
            if (!text) return false
            view.dispatch(view.state.tr.insertText(text))
            return true
          },
        },
      }),
      new Plugin({
        key: new PluginKey('mathInputEmptyClass'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (
                (node.type.name === 'mathInput' || node.type.name === 'mathDisplayInput') &&
                node.textContent.length === 0
              ) {
                decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-empty' }))
              }
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
      new Plugin({
        key: new PluginKey('mathInputFocusHighlight'),
        view() {
          return {
            update(view) {
              const { $from } = view.state.selection
              let inside = false
              for (let d = $from.depth; d >= 0; d--) {
                const name = $from.node(d).type.name
                if (name === 'mathInput' || name === 'mathDisplayInput') { inside = true; break }
              }
              document.body.classList.toggle('has-inline-edit', inside)
            },
            destroy() {
              document.body.classList.remove('has-inline-edit')
            },
          }
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Enter': () => {
        const { state, view } = this.editor
        const { $from } = state.selection
        const node = $from.parent

        if (node.type.name !== 'mathInput' && node.type.name !== 'mathDisplayInput') return false

        const isDisplay = node.type.name === 'mathDisplayInput'
        const text   = node.textContent
        const pos    = $from.before()
        const endpos = $from.after()
        const tr     = state.tr

        if (!text.trim()) {
          tr.delete(pos, endpos)
        } else {
          const newNode = isDisplay
            ? state.schema.nodes.mathDisplay.create({ latex: text })
            : state.schema.nodes.mathInline.create({ latex: text })
          tr.replaceWith(pos, endpos, newNode)
        }
        view.dispatch(tr)
        return true
      },

      'Shift-Enter': () => {
        const { state, view } = this.editor
        const { $from } = state.selection
        if ($from.parent.type.name !== 'mathInput') return false
        view.dispatch(state.tr.insertText('\n'))
        return true
      },

      'Escape': () => {
        const { state, view } = this.editor
        const { $from } = state.selection
        const node = $from.parent

        if (node.type.name !== 'mathInput' && node.type.name !== 'mathDisplayInput') return false

        const isDisplay = node.type.name === 'mathDisplayInput'
        const text   = node.textContent
        const pos    = $from.before()
        const endpos = $from.after()
        const tr     = state.tr

        if (!text.trim()) {
          // Empty inline → revert to literal "$". Empty display → just delete.
          if (isDisplay) {
            tr.delete(pos, endpos)
            view.dispatch(tr)
          } else {
            tr.replaceWith(pos, endpos, state.schema.text('$'))
            view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)))
          }
        } else {
          // Has content → commit as formula and exit
          const newNode = isDisplay
            ? state.schema.nodes.mathDisplay.create({ latex: text })
            : state.schema.nodes.mathInline.create({ latex: text })
          tr.replaceWith(pos, endpos, newNode)
          view.dispatch(tr)
        }
        view.focus()
        return true
      },

      'Space': () => {
        const { state, view } = this.editor
        const { $from } = state.selection
        // $ + Space while empty → revert to literal "$ "
        if ($from.parent.type.name !== 'mathInput' || $from.parent.textContent.length !== 0) return false
        const pos    = $from.before()
        const endpos = $from.after()
        const tr = state.tr.replaceWith(pos, endpos, state.schema.text('$ '))
        view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 2)))
        return true
      },

      'ArrowRight': () => {
        const { state } = this.editor
        const { $from, empty } = state.selection
        if (!empty || $from.parent.type.name !== 'mathInput') return false

        const size = $from.parent.content.size
        if ($from.parentOffset === size) {
          return commitInlineAndMove(this.editor, 'right')
        }
        if ($from.parentOffset === size - 1) {
          this.editor.view.dispatch(
            state.tr.setSelection(TextSelection.create(state.doc, $from.pos + 1))
          )
          return true
        }
        return false
      },

      'ArrowLeft': () => {
        const { state } = this.editor
        const { $from, empty } = state.selection
        if (!empty || $from.parent.type.name !== 'mathInput') return false

        if ($from.parentOffset === 0) {
          return commitInlineAndMove(this.editor, 'left')
        }
        if ($from.parentOffset === 1) {
          this.editor.view.dispatch(
            state.tr.setSelection(TextSelection.create(state.doc, $from.pos - 1))
          )
          return true
        }
        return false
      },

      'Alt-Enter': () => {
        const { state } = this.editor
        const sel = state.selection as any
        if (!sel.node) return false
        const node = sel.node
        const name = node.type.name
        if (name !== 'mathInline' && name !== 'mathDisplay') return false

        openNodeAsInput(this.editor, node, sel.from, sel.from + node.nodeSize, false, name === 'mathDisplay')
        return true
      },

      'Alt-ArrowRight': () => {
        const { state } = this.editor
        const sel = state.selection as any

        // Node selection of mathInline → open at start
        if (sel.node?.type.name === 'mathInline') {
          openNodeAsInput(this.editor, sel.node, sel.from, sel.from + sel.node.nodeSize, false)
          return true
        }

        // Cursor right before a mathInline → open at start
        const { $from, empty } = state.selection
        if (!empty) return false
        const nodeAfter = $from.nodeAfter
        if (nodeAfter?.type.name === 'mathInline') {
          openNodeAsInput(this.editor, nodeAfter, $from.pos, $from.pos + nodeAfter.nodeSize, false)
          return true
        }
        return false
      },

      'Alt-ArrowLeft': () => {
        const { state } = this.editor
        const sel = state.selection as any

        // Node selection of mathInline → open at end
        if (sel.node?.type.name === 'mathInline') {
          openNodeAsInput(this.editor, sel.node, sel.from, sel.from + sel.node.nodeSize, true)
          return true
        }

        // Cursor right after a mathInline → open at end
        const { $from, empty } = state.selection
        if (!empty) return false
        const nodeBefore = $from.nodeBefore
        if (nodeBefore?.type.name === 'mathInline') {
          const pos = $from.pos - nodeBefore.nodeSize
          openNodeAsInput(this.editor, nodeBefore, pos, $from.pos, true)
          return true
        }
        return false
      },
    }
  },
})

// ── MathInputAutoCommit ───────────────────────────────────────────

/**
 * Monitors the cursor. If the selection leaves a mathInput node
 * (click outside, keyboard jump), auto-commits it to a real formula.
 */
export const MathInputAutoCommit = Extension.create({
  name: 'mathInputAutoCommit',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('mathInputAutoCommit'),
        appendTransaction(_, __, newState) {
          const tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'mathInput' && node.type.name !== 'mathDisplayInput') return

            // Structural check: is the selection inside this node?
            const { selection } = newState
            let selectionIsInside = false
            for (let i = 0; i <= selection.$from.depth; i++) {
              if (selection.$from.node(i) === node) {
                selectionIsInside = true
                break
              }
            }
            if (selectionIsInside) return

            const latex    = node.textContent
            const isDisplay = node.type.name === 'mathDisplayInput'

            if (!latex.trim()) {
              tr.delete(pos, pos + node.nodeSize)
            } else {
              const nodeType = isDisplay
                ? newState.schema.nodes.mathDisplay
                : newState.schema.nodes.mathInline
              tr.replaceWith(pos, pos + node.nodeSize, nodeType.create({ latex }))
            }
            modified = true
          })

          return modified ? tr : null
        },
      }),
    ]
  },
})

// ── MathInputTrigger ──────────────────────────────────────────────

/** Intercepts $ key to create/commit mathInput nodes. */
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
            const { $from } = state.selection
            const parentType = $from.parent.type.name

            // Inside a mathInput: $ closes/commits it
            if (parentType === 'mathInput' || parentType === 'mathDisplayInput') {
              // Allow literal \$ inside the formula
              const textBefore = $from.parent.textContent.substring(0, $from.parentOffset)
              if (textBefore.endsWith('\\')) return false

              const latexContent = $from.parent.textContent
              const pos    = $from.before()
              const endpos = $from.after()
              const tr     = state.tr

              // Empty mathInput + $ → upgrade to block display input ($$)
              if (parentType === 'mathInput' && !latexContent.trim()) {
                tr.replaceWith(pos, endpos, state.schema.nodes.mathDisplayInput.create())
                tr.setSelection(Selection.near(tr.doc.resolve(pos + 1)))
                view.dispatch(tr)
                return true
              }

              // Commit the formula
              const nodeType = parentType === 'mathDisplayInput'
                ? state.schema.nodes.mathDisplay
                : state.schema.nodes.mathInline
              tr.replaceWith(pos, endpos, nodeType.create({ latex: latexContent }))
              view.dispatch(tr)
              return true
            }

            // Outside: $ → create a new empty inline input node
            const tr = state.tr
            tr.replaceWith(from, to, state.schema.nodes.mathInput.create())
            tr.setSelection(TextSelection.create(tr.doc, from + 1))
            view.dispatch(tr)
            return true
          },
        },
      }),
    ]
  },
})

// ── MathDisplayInputNode ──────────────────────────────────────────

export const MathDisplayInputNode = Node.create({
  name: 'mathDisplayInput',
  group: 'block',
  content: 'text*',
  selectable: true,
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div.math-display-input-node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div', mergeAttributes(HTMLAttributes, { class: 'math-display-input-node' }),
      ['span', { class: 'math-input-boundary', contenteditable: 'false' }, '​'],
      ['span', { class: 'math-input-content' }, 0],
      ['span', { class: 'math-input-boundary', contenteditable: 'false' }, '​'],
    ]
  },
})
