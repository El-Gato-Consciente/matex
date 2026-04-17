import type { Node } from '@tiptap/pm/model'
import type { TheoremEnvType } from '@core/math/types'

/* ─────────────────────────────────────────────────────────────────
   TheoremEnvView — ProseMirror NodeView for theoremEnv nodes.

   Has contentDOM so TipTap manages the body content.
   The header (type label + optional title) is rendered by the view
   and is NOT editable via ProseMirror (it derives from node attrs).
   ───────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  theorem:     'Theorem',
  lemma:       'Lemma',
  proposition: 'Proposition',
  corollary:   'Corollary',
  definition:  'Definition',
  remark:      'Remark',
  example:     'Example',
  note:        'Note',
  exercise:    'Exercise',
  proof:       'Proof',
}

export class TheoremEnvView {
  readonly dom:        HTMLElement
  readonly contentDOM: HTMLElement

  private _node:     Node
  private _typeSpan: HTMLElement
  private _numSpan:  HTMLElement
  private _titleEl:  HTMLElement

  constructor(node: Node, _getPos: () => number | undefined) {
    this._node = node

    // Outer container
    this.dom = document.createElement('div')
    this.dom.className = 'theorem-env'
    this.dom.dataset['env'] = node.attrs['envType'] as string

    // Header
    const header = document.createElement('div')
    header.className = 'theorem-env-header'

    this._typeSpan = document.createElement('span')
    this._typeSpan.className = 'theorem-env-type'

    this._numSpan = document.createElement('span')
    this._numSpan.className = 'theorem-env-number'

    this._titleEl = document.createElement('span')
    this._titleEl.className = 'theorem-env-title'

    header.appendChild(this._typeSpan)
    header.appendChild(this._numSpan)
    header.appendChild(this._titleEl)
    this.dom.appendChild(header)

    // Body — managed by ProseMirror
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'theorem-env-body'
    this.dom.appendChild(this.contentDOM)

    this._updateHeader()
  }

  update(node: Node): boolean {
    if (node.type.name !== 'theoremEnv') return false
    this._node = node
    this.dom.dataset['env'] = node.attrs['envType'] as string
    this._updateHeader()
    return true
  }

  destroy(): void {
    // no cleanup needed
  }

  private _updateHeader(): void {
    const envType = this._node.attrs['envType'] as TheoremEnvType
    const title   = (this._node.attrs['envTitle'] as string) ?? ''

    this._typeSpan.textContent = TYPE_LABELS[envType] ?? envType

    // Number is computed from document context in Phase 4.
    // Phase 1: omit the number (rendered by LaTeX \newtheorem).
    this._numSpan.textContent = ''

    if (title) {
      this._titleEl.textContent = title
      this._titleEl.style.display = ''
    } else {
      this._titleEl.style.display = 'none'
    }
  }
}
