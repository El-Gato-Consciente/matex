import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { theoremLabels, subscribeToLabels } from '@core/editor/EditorStore'
import { registerLatexSerializer } from '@core/serializer/LatexSerializerRegistry'

const TYPE_ES: Record<string, string> = {
  theorem:     'Teorema',
  definition:  'Definición',
  lemma:       'Lema',
  proposition: 'Proposición',
  corollary:   'Corolario',
  example:     'Ejemplo',
  exercise:    'Ejercicio',
  remark:      'Obs.',
  note:        'Nota',
}

const TYPE_EN: Record<string, string> = {
  theorem:     'Theorem',
  definition:  'Definition',
  lemma:       'Lemma',
  proposition: 'Proposition',
  corollary:   'Corollary',
  example:     'Example',
  exercise:    'Exercise',
  remark:      'Remark',
  note:        'Note',
}

const SHORT: Record<string, string> = {
  theorem: 'thm', definition: 'def', lemma: 'lem',
  proposition: 'prop', corollary: 'cor', example: 'ex',
  exercise: 'exr', remark: 'rmk', note: 'note',
}

registerLatexSerializer('theoremRef', (node) => {
  const id    = (node.attrs['id'] as string ?? '').trim()
  const entry = id ? theoremLabels.value.get(id) : null
  if (!entry) return '\\ref{?}'
  const typeName  = TYPE_EN[entry.type] ?? entry.type
  const shortType = SHORT[entry.type] ?? entry.type.slice(0, 3)
  return `${typeName}~\\ref{${shortType}:${entry.num}}`
})

export const TheoremRef = Node.create({
  name: 'theoremRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { id: { default: '' } }
  },

  parseHTML() {
    return [{
      tag: 'span[data-theorem-ref]',
      getAttrs: el => ({ id: (el as HTMLElement).dataset['theoremRef'] ?? '' }),
    }]
  },

  renderHTML({ node }) {
    return ['span', mergeAttributes({ 'data-theorem-ref': node.attrs['id'], class: 'theorem-ref' }), '…']
  },

  addNodeView() {
    return ({ node: initialNode, editor, getPos }) => {
      // Mutable ref so update() and render() always see the latest node
      let currentNode = initialNode

      const dom = document.createElement('span')
      dom.className = 'theorem-ref'
      dom.contentEditable = 'false'

      // ── Render ────────────────────────────────────────────────
      const render = () => {
        const id    = currentNode.attrs['id'] as string
        const entry = id ? theoremLabels.value.get(id) : null
        if (entry) {
          const typeName = TYPE_ES[entry.type] ?? entry.type
          dom.textContent = entry.title
            ? `${typeName} ${entry.num} (${entry.title})`
            : `${typeName} ${entry.num}`
          dom.title = `→ #${id}`
          dom.classList.remove('theorem-ref--unresolved')
        } else {
          dom.textContent = '↗ ref'
          dom.title = 'Clic para seleccionar referencia'
          dom.classList.add('theorem-ref--unresolved')
        }
      }

      const unsubscribeLabels = subscribeToLabels(render)

      // ── Picker ────────────────────────────────────────────────
      let picker: HTMLElement | null = null

      const closePicker = () => {
        picker?.remove()
        picker = null
        document.removeEventListener('mousedown', onOutside)
      }

      const onOutside = (e: Event) => {
        if (!picker?.contains(e.target as globalThis.Node)) closePicker()
      }

      const openPicker = () => {
        closePicker()
        const entries = [...theoremLabels.value.entries()]
        if (entries.length === 0) return

        picker = document.createElement('div')
        picker.className = 'theorem-ref-picker'

        entries.forEach(([id, entry]) => {
          const btn = document.createElement('button')
          btn.className = 'theorem-ref-picker-item'
          const typeName = TYPE_ES[entry.type] ?? entry.type
          btn.textContent = entry.title
            ? `${typeName} ${entry.num} — ${entry.title}`
            : `${typeName} ${entry.num}`
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault()
            const pos = typeof getPos === 'function' ? getPos() : undefined
            if (pos == null) return
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, id })
            )
            closePicker()
          })
          picker!.appendChild(btn)
        })

        document.body.appendChild(picker)
        const rect = dom.getBoundingClientRect()
        picker.style.position = 'fixed'
        picker.style.top  = `${rect.bottom + 4}px`
        picker.style.left = `${rect.left}px`

        setTimeout(() => document.addEventListener('mousedown', onOutside), 0)
      }

      // ── Click: navigate if resolved, open picker if not ───────
      dom.addEventListener('click', (e) => {
        e.stopPropagation()
        const id    = currentNode.attrs['id'] as string
        const entry = id ? theoremLabels.value.get(id) : null
        if (entry) {
          requestAnimationFrame(() => {
            const domEl = editor.view.nodeDOM(entry.pos)
            const el = domEl instanceof Element
              ? domEl
              : (domEl as unknown as globalThis.Node | null)?.parentElement
            el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          })
        } else {
          openPicker()
        }
      })

      return {
        dom,
        update(newNode) {
          if (newNode.type.name !== 'theoremRef') return false
          currentNode = newNode
          render()
          return true
        },
        destroy() {
          unsubscribeLabels()
          closePicker()
        },
      }
    }
  },

  addKeyboardShortcuts() {
    const navigate = () => {
      const { selection } = this.editor.state
      if (!(selection instanceof NodeSelection)) return false
      if (selection.node.type.name !== 'theoremRef') return false
      const id    = selection.node.attrs['id'] as string
      const entry = id ? theoremLabels.value.get(id) : null
      if (!entry) return false
      requestAnimationFrame(() => {
        const domEl = this.editor.view.nodeDOM(entry.pos)
        const el = domEl instanceof Element
          ? domEl
          : (domEl as unknown as globalThis.Node | null)?.parentElement
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
      return true
    }
    return { Enter: navigate }
  },
})
