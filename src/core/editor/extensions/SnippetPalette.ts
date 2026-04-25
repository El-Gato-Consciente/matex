import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey, TextSelection } from '@tiptap/pm/state'
import katex from 'katex'
import {
  BUILTIN_SNIPPETS, userSnippets, recordUsage, toMathLiveLatex,
  type AnySnippet,
} from '@features/formula-editor/SnippetStore'
import { setBackslashState } from '@features/formula-editor/BackslashState'

// ── Helpers ──────────────────────────────────────────────────────

function renderKatex(latex: string): string {
  const src = toMathLiveLatex(latex).replace(/#[@?]/g, '')
  try {
    return katex.renderToString(src, { displayMode: false, throwOnError: true, trust: false })
  } catch {
    return `<code>${latex.slice(0, 14)}</code>`
  }
}

function getLabel(s: AnySnippet): string {
  return s.kind === 'builtin' ? s.label : s.name
}

export function getSnippetItems(query: string): AnySnippet[] {
  const all: AnySnippet[] = [...BUILTIN_SNIPPETS, ...userSnippets.value]
  if (!query) return all.slice(0, 28)
  const q = query.toLowerCase()
  return all.filter(s =>
    getLabel(s).toLowerCase().includes(q) || s.latex.toLowerCase().includes(q)
  ).slice(0, 28)
}

// ── Category labels ──────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  frac:    'Fracciones',
  calc:    'Cálculo',
  alg:     'Álgebra lineal',
  logic:   'Lógica',
  rel:     'Relaciones',
  trig:    'Trigonometría',
  anal:    'Análisis',
  greek:   'Letras griegas',
  stats:   'Estadística',
  cmd:     'Comandos',
  menv:    'Entornos',
  classic: 'Clásicas',
  user:    'Míos',
}

function catLabel(cat: string): string {
  return CAT_LABELS[cat] ?? cat
}

// ── Popup ────────────────────────────────────────────────────────

type SuggestionProps = {
  items: AnySnippet[]
  command: (item: AnySnippet) => void
  clientRect?: (() => DOMRect | null) | null
}

export class SnippetPalettePopup {
  private el: HTMLElement
  private items: AnySnippet[]
  private selected = 0
  private onSelect: (item: AnySnippet) => void
  private _ownKeyHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(props: SuggestionProps, standalone = false) {
    this.items = props.items
    this.onSelect = props.command
    this.el = document.createElement('div')
    this.el.className = 'snip-palette'
    document.body.appendChild(this.el)
    this._render()
    this._reposition(props.clientRect?.() ?? null)

    if (standalone) {
      this._ownKeyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.stopPropagation(); this.destroy(); return }
        if (this.onKeyDown(e)) { e.preventDefault(); e.stopPropagation() }
      }
      document.addEventListener('keydown', this._ownKeyHandler, true)
    }
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
    if (event.key === 'Enter' || event.key === 'Tab') {
      const item = this.items[this.selected]
      if (item) this.onSelect(item)
      return true
    }
    return false
  }

  destroy(): void {
    if (this._ownKeyHandler) {
      document.removeEventListener('keydown', this._ownKeyHandler, true)
      this._ownKeyHandler = null
    }
    this.el.remove()
  }

  // ── Private ──────────────────────────────────────────────────────

  private _render(): void {
    this.el.innerHTML = ''

    if (this.items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'snip-palette-empty'
      empty.textContent = 'Sin resultados'
      this.el.appendChild(empty)
      return
    }

    let lastCat = ''

    this.items.forEach((item, i) => {
      const cat = item.kind === 'builtin' ? item.cat : 'user'

      if (cat !== lastCat) {
        const sep = document.createElement('div')
        sep.className = 'snip-palette-group'
        sep.textContent = catLabel(cat)
        this.el.appendChild(sep)
        lastCat = cat
      }

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'snip-palette-item' + (i === this.selected ? ' active' : '')

      const preview = document.createElement('span')
      preview.className = 'spi-preview'
      preview.innerHTML = renderKatex(item.latex)

      const label = document.createElement('span')
      label.className = 'spi-label'
      label.textContent = getLabel(item)

      btn.appendChild(preview)
      btn.appendChild(label)

      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.onSelect(item)
      })
      btn.addEventListener('mousemove', () => {
        if (this.selected !== i) {
          this.selected = i
          this._highlight()
        }
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
    this.el.querySelectorAll<HTMLElement>('.snip-palette-item').forEach((el, i) => {
      el.classList.toggle('active', i === this.selected)
      if (i === this.selected) el.scrollIntoView({ block: 'nearest' })
    })
  }
}

// ── Standalone opener (for use outside TipTap suggestion) ────────

/**
 * Opens the snippet palette anchored to `anchor` rect.
 * Returns a `close()` function. The palette also auto-closes on selection.
 */
export function openSnippetPalette(
  anchor: DOMRect,
  onSelect: (item: AnySnippet) => void,
): () => void {
  let popup: SnippetPalettePopup | null = null

  const wrapped = (item: AnySnippet) => {
    popup?.destroy()
    popup = null
    onSelect(item)
  }

  popup = new SnippetPalettePopup(
    { items: getSnippetItems(''), command: wrapped, clientRect: () => anchor },
    true, // standalone: manages own keyboard handler
  )

  return () => { popup?.destroy(); popup = null }
}

// ── Extension ────────────────────────────────────────────────────

export const SnippetPalette = Extension.create({
  name: 'snippetPalette',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('snippetPalette'),
        editor: this.editor,
        char: '\\',
        startOfLine: false,
        allowSpaces: false,

        command({ editor, range, props }) {
          const item = props as AnySnippet
          recordUsage(item.id)
          const { state, view } = editor
          const { tr, schema } = state
          const { $from } = state.selection
          const parentType = $from.parent.type.name
          const latex = toMathLiveLatex(item.latex).replace(/#[@?]/g, '')

          if (parentType === 'mathInput' || parentType === 'mathDisplayInput') {
            // Inside insitu edit: insert latex text replacing \query
            view.dispatch(tr.insertText(latex, range.from, range.to))
          } else {
            // In regular text: create an editable mathInput so user lands inside
            const textNode = latex ? schema.text(latex) : null
            const inputNode = schema.nodes['mathInput']!.create(null, textNode)
            tr.replaceWith(range.from, range.to, inputNode)
            // Cursor at end of the input content
            tr.setSelection(TextSelection.create(tr.doc, range.from + 1 + latex.length))
            view.dispatch(tr)
          }
        },

        items({ query }) {
          return getSnippetItems(query)
        },

        render() {
          return {
            onStart(props) {
              setBackslashState(props.query, (item) => props.command(item))
            },
            onUpdate(props) {
              setBackslashState(props.query, (item) => props.command(item))
            },
            onKeyDown() {
              return false
            },
            onExit() {
              setBackslashState(null, null)
            },
          }
        },
      }),
    ]
  },
})
