import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import type { TheoremEnvType } from '@core/math/types'
import { theoremLabels } from '@core/editor/EditorStore'

// ── Types ────────────────────────────────────────────────────────

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
  proof:       'Demostración',
}

interface EnvItem {
  kind: 'env'
  envType: TheoremEnvType
  label: string
  shortcut: string
}

interface RefItem {
  kind: 'ref'
  id: string
  label: string
}

type MenuItem = EnvItem | RefItem

const ENV_ITEMS: EnvItem[] = [
  { kind: 'env', envType: 'theorem',     label: 'Teorema',      shortcut: 'thm'   },
  { kind: 'env', envType: 'definition',  label: 'Definición',   shortcut: 'def'   },
  { kind: 'env', envType: 'lemma',       label: 'Lema',         shortcut: 'lem'   },
  { kind: 'env', envType: 'proposition', label: 'Proposición',  shortcut: 'prop'  },
  { kind: 'env', envType: 'corollary',   label: 'Corolario',    shortcut: 'cor'   },
  { kind: 'env', envType: 'example',     label: 'Ejemplo',      shortcut: 'ex'    },
  { kind: 'env', envType: 'exercise',    label: 'Ejercicio',    shortcut: 'exr'   },
  { kind: 'env', envType: 'remark',      label: 'Observación',  shortcut: 'rmk'   },
  { kind: 'env', envType: 'note',        label: 'Nota',         shortcut: 'note'  },
  { kind: 'env', envType: 'proof',       label: 'Demostración', shortcut: 'proof' },
]

// ── Item source ──────────────────────────────────────────────────

function getRefItems(): RefItem[] {
  return [...theoremLabels.value.entries()].map(([id, entry]) => {
    const typeName = TYPE_ES[entry.type] ?? entry.type
    const label = entry.title
      ? `${typeName} ${entry.num} — ${entry.title}`
      : `${typeName} ${entry.num}`
    return { kind: 'ref', id, label }
  })
}

function getItems(query: string): MenuItem[] {
  const q = query.toLowerCase().trim()

  if (!q) {
    return [...ENV_ITEMS, ...getRefItems()]
  }

  // Query starts with "ref" → show only references, filter by remainder
  if (q === 'r' || q === 're' || q === 'ref') {
    return getRefItems()
  }
  if (q.startsWith('ref')) {
    const sub = q.slice(3).trim()
    return getRefItems().filter(r => r.label.toLowerCase().includes(sub))
  }

  // General filter across all items
  const all: MenuItem[] = [...ENV_ITEMS, ...getRefItems()]
  return all.filter(item => {
    const text = item.kind === 'env'
      ? `${item.label.toLowerCase()} ${item.shortcut}`
      : item.label.toLowerCase()
    return text.includes(q)
  })
}

// ── Popup DOM ────────────────────────────────────────────────────

type SuggestionProps = {
  items: MenuItem[]
  command: (item: MenuItem) => void
  clientRect?: (() => DOMRect | null) | null
}

class SlashMenuPopup {
  private el: HTMLElement
  private items: MenuItem[]
  private selected = 0
  private onSelect: (item: MenuItem) => void

  constructor(props: SuggestionProps) {
    this.items = props.items
    this.onSelect = props.command
    this.el = document.createElement('div')
    this.el.className = 'slash-menu'
    document.body.appendChild(this.el)
    this._render()
    this._reposition(props.clientRect?.() ?? null)
  }

  update(props: SuggestionProps): void {
    this.items = props.items
    this.onSelect = props.command
    this.selected = 0
    this._render()
    this._reposition(props.clientRect?.() ?? null)
  }

  onKeyDown(event: KeyboardEvent): boolean {
    const len = this.items.length
    if (!len) return false

    if (event.key === 'ArrowDown') {
      this.selected = (this.selected + 1) % len
      this._highlight()
      return true
    }
    if (event.key === 'ArrowUp') {
      this.selected = (this.selected - 1 + len) % len
      this._highlight()
      return true
    }
    if (event.key === 'Enter') {
      const item = this.items[this.selected]
      if (item) this.onSelect(item)
      return true
    }
    return false
  }

  destroy(): void {
    this.el.remove()
  }

  // ── Private ─────────────────────────────────────────────────────

  private _render(): void {
    this.el.innerHTML = ''

    if (this.items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'slash-menu-empty'
      empty.textContent = 'Sin resultados'
      this.el.appendChild(empty)
      return
    }

    let lastGroup = ''
    this.items.forEach((item, i) => {
      const group = item.kind === 'env' ? 'Entornos' : 'Referencias'

      if (group !== lastGroup) {
        const sep = document.createElement('div')
        sep.className = 'slash-menu-group'
        sep.textContent = group
        this.el.appendChild(sep)
        lastGroup = group
      }

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'slash-menu-item' + (i === this.selected ? ' active' : '')

      if (item.kind === 'env') {
        const sc = document.createElement('span')
        sc.className = 'smi-shortcut'
        sc.textContent = `/${item.shortcut}`
        const lb = document.createElement('span')
        lb.className = 'smi-label'
        lb.textContent = item.label
        btn.appendChild(sc)
        btn.appendChild(lb)
      } else {
        const ic = document.createElement('span')
        ic.className = 'smi-icon'
        ic.textContent = '↗'
        const lb = document.createElement('span')
        lb.className = 'smi-label'
        lb.textContent = item.label
        btn.appendChild(ic)
        btn.appendChild(lb)
      }

      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.onSelect(item)
      })

      this.el.appendChild(btn)
    })
  }

  private _reposition(rect: DOMRect | null): void {
    if (!rect) return
    this.el.style.position = 'fixed'
    this.el.style.left = `${rect.left}px`
    this.el.style.top = `${rect.bottom + 6}px`

    requestAnimationFrame(() => {
      const b = this.el.getBoundingClientRect()
      if (b.bottom > window.innerHeight - 8) {
        this.el.style.top = `${rect.top - b.height - 6}px`
      }
      if (b.right > window.innerWidth - 8) {
        this.el.style.left = `${window.innerWidth - b.width - 8}px`
      }
    })
  }

  private _highlight(): void {
    this.el.querySelectorAll<HTMLElement>('.slash-menu-item').forEach((el, i) => {
      el.classList.toggle('active', i === this.selected)
      if (i === this.selected) el.scrollIntoView({ block: 'nearest' })
    })
  }
}

// ── Extension ────────────────────────────────────────────────────

export const SlashMenu = Extension.create({
  name: 'slashMenu',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('slashMenu'),
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: true,

        command({ editor, range, props }) {
          const item = props as MenuItem
          const { state, view } = editor
          const { $from } = state.selection

          if (item.kind === 'env') {
            const { tr, schema } = state
            const envNode = schema.nodes['theoremEnv']!.create(
              { envType: item.envType, id: crypto.randomUUID() },
              [
                schema.nodes['theoremEnvTitle']!.create(),
                schema.nodes['paragraph']!.create(),
              ],
            )
            // Replace the entire current paragraph with the env block
            const from = $from.before($from.depth)
            const to = $from.after($from.depth)
            tr.replaceWith(from, to, envNode)
            // Place cursor inside the title
            tr.setSelection(TextSelection.create(tr.doc, from + 2))
            view.dispatch(tr.scrollIntoView())
          } else {
            // Inline ref: replace the /... text with a resolved theoremRef node
            const { tr, schema } = state
            const refNode = schema.nodes['theoremRef']!.create({ id: item.id })
            tr.replaceWith(range.from, range.to, refNode)
            view.dispatch(tr)
          }
        },

        items({ query }) {
          return getItems(query)
        },

        render() {
          let popup: SlashMenuPopup | null = null

          return {
            onStart(props) {
              popup = new SlashMenuPopup(props as SuggestionProps)
            },
            onUpdate(props) {
              popup?.update(props as SuggestionProps)
            },
            onKeyDown({ event }) {
              if (event.key === 'Escape') {
                popup?.destroy()
                popup = null
                return true
              }
              return popup?.onKeyDown(event) ?? false
            },
            onExit() {
              popup?.destroy()
              popup = null
            },
          }
        },
      }),
    ]
  },
})
