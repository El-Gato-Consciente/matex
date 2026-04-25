import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { TheoremEnvView } from '../nodeviews/TheoremEnvView'
import type { TheoremEnvType } from '@core/math/types'
import { registerLatexSerializer } from '@core/serializer/LatexSerializerRegistry'

import { theoremLabels } from '@core/editor/EditorStore'

registerLatexSerializer('theoremEnv', (node, ctx) => {
  const envType = (node.attrs['envType'] as string) ?? 'theorem'
  const id      = (node.attrs['id']      as string) ?? ''

  // child(0) is always theoremEnvTitle; serialize its inline content as the title
  const titleText = ctx.serializeInline(node.child(0).content).trim()
  const titleOpt  = titleText ? `[${titleText}]` : ''

  // Auto-generate \label from the resolved number (e.g. \label{thm:2.3})
  const entry     = id ? theoremLabels.value.get(id) : null
  const shortType = envType.slice(0, 3)  // thm, def, lem, pro, cor, exa, exr, rem, not
  const labelLine = entry ? `  \\label{${shortType}:${entry.num}}\n` : ''

  // body = all children after the title node
  const bodyParts: string[] = []
  for (let i = 1; i < node.childCount; i++) bodyParts.push(ctx.serializeNode(node.child(i)))
  const body = bodyParts.join('\n').trim()

  if (envType === 'proof') {
    return `\\begin{proof}${titleOpt}\n${labelLine}  ${body}\n\\end{proof}\n`
  }
  return `\\begin{${envType}}${titleOpt}\n${labelLine}  ${body}\n\\end{${envType}}\n`
})

/* ─────────────────────────────────────────────────────────────────
   TheoremEnv — TipTap extension for mathematical environments.
   Supports: theorem, lemma, definition, example, remark, proof, etc.
   Content is editable (has contentDOM). Header derives from attrs.

   isolating: true
   ───────────────
   Makes the node boundaries opaque to ProseMirror's generic editing
   commands (joinBackward, joinForward, liftEmptyBlock).  This prevents
   the node from being accidentally merged with adjacent blocks when
   the cursor is at its start or end.  Without this, every such case
   required a manual keyboard-shortcut guard.

   The custom keyboard shortcuts below cover only the behaviours that
   isolating does NOT handle automatically:
     • Enter on the last empty paragraph  → exit the environment
     • Enter with a GapCursor inside      → insert paragraph at gap
     • Backspace/Delete on an empty       → clean-delete of that
       paragraph adjacent to the env        paragraph (outside the env)
   ───────────────────────────────────────────────────────────────── */

export const TheoremEnv = Node.create({
  name:       'theoremEnv',
  group:      'block',
  content:    'theoremEnvTitle block+',
  isolating:  true,   // ← blocks generic join/lift across env boundaries

  addAttributes() {
    return {
      envType: { default: 'theorem' as TheoremEnvType },
      id:      { default: '' },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-theorem-env]',
      getAttrs: (el) => ({
        envType: (el as HTMLElement).dataset['env'] ?? 'theorem',
        id:      (el as HTMLElement).dataset['id']  ?? '',
      }),
    }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-theorem-env': '',
      'data-env':         node.attrs['envType'],
      'data-id':          node.attrs['id'],
      class: 'theorem-env',
    }), 0]  // 0 = contentDOM slot
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const view = new TheoremEnvView(
        node,
        getPos as () => number | undefined,
        editor as import('@tiptap/core').Editor,
      )
      return {
        dom:        view.dom,
        contentDOM: view.contentDOM,
        update(n) { return view.update(n) },
        stopEvent(e: Event) { return view.stopEvent(e) },
        ignoreMutation(m) { return view.ignoreMutation(m) },
        destroy() { view.destroy() },
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Enter
       *
       * A) GapCursor directly inside a theoremEnv (e.g. after a mathDisplay
       *    atom at the end).  splitBlock does nothing here — insert a paragraph
       *    at the gap so the user can continue typing inside the env.
       *
       * B) Cursor in an empty paragraph inside the env.
       *    isolating already stops liftEmptyBlock from splitting the env, but
       *    we also want a clean "exit" UX:
       *    - Last child → remove the empty paragraph and insert a plain
       *      paragraph after the env (same pattern as exiting a list).
       *    - Not last child → splitBlock (creates a new paragraph inside).
       */
      Enter: () => {
        const { selection, schema } = this.editor.state
        if (!selection.empty) return false
        const { $from } = selection

        // ── A: GapCursor inside a theoremEnv ─────────────────────────
        if (!$from.parent.isTextblock && $from.parent.type === this.type) {
          const { tr } = this.editor.state
          const para = schema.nodes['paragraph']!.create()
          tr.insert($from.pos, para)
          tr.setSelection(TextSelection.create(tr.doc, $from.pos + 1))
          this.editor.view.dispatch(tr.scrollIntoView())
          return true
        }

        // ── B: Empty paragraph inside a theoremEnv ───────────────────
        if ($from.parent.content.size !== 0) return false

        let envDepth = -1
        for (let d = $from.depth - 1; d >= 1; d--) {
          if ($from.node(d).type === this.type) { envDepth = d; break }
        }
        if (envDepth === -1) return false

        const envNode     = $from.node(envDepth)
        const isLastChild = $from.index(envDepth) === envNode.childCount - 1

        if (!isLastChild) {
          // Not the last child: create a new paragraph inside the env.
          return this.editor.commands.splitBlock()
        }

        // Last empty child → exit the env.
        const { tr } = this.editor.state
        const paraType = schema.nodes['paragraph']!

        if (envNode.childCount === 2) {
          // Title + this one empty para: replace the whole env with a paragraph.
          const envStart = $from.before(envDepth)
          const envEnd   = $from.after(envDepth)
          tr.replaceWith(envStart, envEnd, paraType.create())
          tr.setSelection(TextSelection.create(tr.doc, envStart + 1))
        } else {
          // Multiple children: delete the empty last paragraph, insert
          // a paragraph after the env.
          const paraStart = $from.before($from.depth)
          const paraEnd   = $from.after($from.depth)
          const envAfter  = $from.after(envDepth)
          tr.delete(paraStart, paraEnd)
          const insertAt = tr.mapping.map(envAfter)
          tr.insert(insertAt, paraType.create())
          tr.setSelection(TextSelection.create(tr.doc, insertAt + 1))
        }
        this.editor.view.dispatch(tr.scrollIntoView())
        return true
      },

      /**
       * Backspace
       *
       * isolating handles: cursor at start of first child (joinBackward is
       * blocked automatically — nothing happens, which is correct).
       *
       * What isolating does NOT cover: a top-level empty paragraph that sits
       * immediately after a theoremEnv.  joinBackward for that paragraph can't
       * enter the env (isolating), but it also can't lift the paragraph
       * (already at doc level), so without this handler the cursor gets stuck.
       * Solution: delete the empty paragraph cleanly.
       */
      Backspace: () => {
        const { selection, doc } = this.editor.state
        if (!selection.empty) return false
        const { $from } = selection

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
       * Delete
       *
       * isolating handles: cursor at end of last child (joinForward is
       * blocked automatically — nothing happens, which is correct).
       *
       * Same gap as Backspace: a top-level empty paragraph immediately before
       * a theoremEnv.  Delete for that paragraph can't pull content out of the
       * env (isolating), but the cursor gets stuck.  Delete the paragraph.
       */
      Delete: () => {
        const { selection, doc } = this.editor.state
        if (!selection.empty) return false
        const { $from } = selection

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
