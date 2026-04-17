import type { Node as PmNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import type { TheoremEnvType } from '@core/math/types'

/* ─────────────────────────────────────────────────────────────────
   TheoremEnvView — ProseMirror NodeView for theoremEnv nodes.

   Has contentDOM so TipTap manages the body content.
   The header (type selector + optional title) is rendered by the
   view and is NOT part of contentDOM — it is interactive but lives
   outside ProseMirror's managed tree.

   stopEvent() returns true for events inside the header so that
   ProseMirror ignores them and lets the browser handle the native
   select / contenteditable behaviour.
   ───────────────────────────────────────────────────────────────── */

const ENV_TYPES: { value: string; label: string }[] = [
  { value: 'theorem',     label: 'Theorem'     },
  { value: 'lemma',       label: 'Lemma'       },
  { value: 'proposition', label: 'Proposition' },
  { value: 'corollary',   label: 'Corollary'   },
  { value: 'definition',  label: 'Definition'  },
  { value: 'remark',      label: 'Remark'      },
  { value: 'example',     label: 'Example'     },
  { value: 'note',        label: 'Note'        },
  { value: 'exercise',    label: 'Exercise'    },
  { value: 'proof',       label: 'Proof'       },
]

export class TheoremEnvView {
  readonly dom:        HTMLElement
  readonly contentDOM: HTMLElement

  private _node:       PmNode
  private _getPos:     () => number | undefined
  private _editor:     Editor
  private _header:     HTMLElement
  private _typeSelect: HTMLSelectElement
  private _titleSpan:  HTMLElement

  constructor(node: PmNode, getPos: () => number | undefined, editor: Editor) {
    this._node   = node
    this._getPos = getPos
    this._editor = editor

    // ── Outer container ──────────────────────────────────────────
    this.dom = document.createElement('div')
    this.dom.className = 'theorem-env'
    this.dom.dataset['env'] = node.attrs['envType'] as string

    // ── Header ───────────────────────────────────────────────────
    this._header = document.createElement('div')
    this._header.className = 'theorem-env-header'

    // Type selector — styled to look like a label, but clickable
    this._typeSelect = document.createElement('select')
    this._typeSelect.className = 'theorem-env-type'
    ENV_TYPES.forEach(({ value, label }) => {
      const opt = document.createElement('option')
      opt.value = value
      opt.textContent = label
      this._typeSelect.appendChild(opt)
    })
    this._typeSelect.addEventListener('change', () => this._onTypeChange())
    this._typeSelect.addEventListener('mousedown', e => e.stopPropagation())

    // Number placeholder (Phase 4 will populate this)
    const numSpan = document.createElement('span')
    numSpan.className = 'theorem-env-number'

    // Title — inline contenteditable span
    this._titleSpan = document.createElement('span')
    this._titleSpan.className = 'theorem-env-title'
    this._titleSpan.contentEditable = 'true'
    this._titleSpan.spellcheck = false
    this._titleSpan.dataset['placeholder'] = 'título...'
    this._titleSpan.addEventListener('keydown',  e => this._onTitleKeyDown(e))
    this._titleSpan.addEventListener('blur',     ()  => this._onTitleBlur())
    this._titleSpan.addEventListener('mousedown', e => e.stopPropagation())
    // Prevent paste from injecting HTML
    this._titleSpan.addEventListener('paste', e => {
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain') ?? ''
      document.execCommand('insertText', false, text)
    })

    this._header.appendChild(this._typeSelect)
    this._header.appendChild(numSpan)
    this._header.appendChild(this._titleSpan)
    this.dom.appendChild(this._header)

    // ── Body — managed by ProseMirror ────────────────────────────
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'theorem-env-body'
    this.dom.appendChild(this.contentDOM)

    this._syncHeader()
  }

  // ── NodeView interface ────────────────────────────────────────

  update(node: PmNode): boolean {
    if (node.type.name !== 'theoremEnv') return false
    this._node = node
    this.dom.dataset['env'] = node.attrs['envType'] as string
    // Only sync UI elements that are not currently being edited
    if (document.activeElement !== this._typeSelect) {
      this._typeSelect.value = node.attrs['envType'] as string
    }
    if (document.activeElement !== this._titleSpan) {
      this._titleSpan.textContent = (node.attrs['envTitle'] as string) || ''
    }
    return true
  }

  /** Prevent ProseMirror from handling events fired inside the header. */
  stopEvent(event: Event): boolean {
    return this._header.contains(event.target as Node)
  }

  destroy(): void { /* nothing to clean up */ }

  // ── Private helpers ───────────────────────────────────────────

  private _syncHeader(): void {
    this._typeSelect.value  = this._node.attrs['envType'] as string
    this._titleSpan.textContent = (this._node.attrs['envTitle'] as string) || ''
  }

  private _dispatch(attrs: Record<string, unknown>): void {
    const pos = this._getPos()
    if (pos === undefined) return
    const { state } = this._editor
    this._editor.view.dispatch(
      state.tr.setNodeMarkup(pos, undefined, { ...this._node.attrs, ...attrs })
    )
  }

  private _onTypeChange(): void {
    const envType = this._typeSelect.value as TheoremEnvType
    this.dom.dataset['env'] = envType
    this._dispatch({ envType })
  }

  private _onTitleBlur(): void {
    const envTitle = (this._titleSpan.textContent ?? '').trim()
    // Normalise: empty string if whitespace-only
    this._titleSpan.textContent = envTitle
    if (envTitle === ((this._node.attrs['envTitle'] as string) ?? '')) return
    this._dispatch({ envTitle })
  }

  private _onTitleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLElement).blur()
    }
    if (e.key === 'Escape') {
      this._titleSpan.textContent = (this._node.attrs['envTitle'] as string) || ''
      ;(e.target as HTMLElement).blur()
    }
    // Prevent newlines from being pasted via Shift+Enter etc.
    if (e.key === 'Enter') e.preventDefault()
  }
}
