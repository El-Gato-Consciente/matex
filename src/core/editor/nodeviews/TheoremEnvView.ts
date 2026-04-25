import type { Node as PmNode } from '@tiptap/pm/model'
import type { ViewMutationRecord } from '@tiptap/pm/view'
import type { Editor } from '@tiptap/core'
import type { TheoremEnvType } from '@core/math/types'
import { theoremLabels, subscribeToLabels } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   TheoremEnvView — ProseMirror NodeView for theoremEnv nodes.

   Header (type dropdown + number) is built in JS and shielded from
   PM via stopEvent / ignoreMutation.

   The title is now a proper child node (theoremEnvTitle) rendered
   inside contentDOM by TipTap — no custom editing code needed here.
   ───────────────────────────────────────────────────────────────── */

const ENV_TYPES: { value: TheoremEnvType; label: string }[] = [
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

  private _node:         PmNode
  private _getPos:       () => number | undefined
  private _editor:       Editor
  private _header:       HTMLElement
  private _typeBtn:      HTMLButtonElement
  private _typeLabel:    HTMLSpanElement
  private _typeMenu:     HTMLElement
  private _typeWrap:     HTMLElement
  private _numSpan:      HTMLElement
  private _unsubscribeLabels: () => void
  private _outsideClick: (e: Event) => void

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
    this._header.contentEditable = 'false'

    // ── Custom type dropdown ──────────────────────────────────────
    const typeWrap = this._typeWrap = document.createElement('div')
    typeWrap.className = 'tenv-type-wrap'
    typeWrap.addEventListener('mousedown', e => e.stopPropagation())

    this._typeLabel = document.createElement('span')

    this._typeBtn = document.createElement('button')
    this._typeBtn.className = 'tenv-type-btn'
    this._typeBtn.type = 'button'
    this._typeBtn.appendChild(this._typeLabel)
    this._typeBtn.addEventListener('click', () => this._toggleMenu())

    this._typeMenu = document.createElement('div')
    this._typeMenu.className = 'tenv-type-menu'
    this._typeMenu.hidden = true

    ENV_TYPES.forEach(({ value, label }) => {
      const opt = document.createElement('button')
      opt.className = 'tenv-type-opt'
      opt.type = 'button'
      opt.textContent = label
      opt.dataset['value'] = value
      opt.style.color = `var(--thm-${value})`
      opt.addEventListener('click', () => {
        this._setType(value)
        this._closeMenu()
      })
      this._typeMenu.appendChild(opt)
    })

    typeWrap.appendChild(this._typeBtn)
    typeWrap.appendChild(this._typeMenu)

    this._outsideClick = (e: Event) => {
      if (!typeWrap.contains(e.target as Node)) this._closeMenu()
    }

    // ── Number ───────────────────────────────────────────────────
    this._numSpan = document.createElement('span')
    this._numSpan.className = 'theorem-env-number'

    this._header.appendChild(typeWrap)
    this._header.appendChild(this._numSpan)
    this.dom.appendChild(this._header)

    // ── Body (contentDOM — TipTap manages title + body children) ─
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'theorem-env-body'
    this.dom.appendChild(this.contentDOM)

    this._syncHeader()

    // subscribeToLabels fires the callback immediately and on every _syncDocStats update
    this._unsubscribeLabels = subscribeToLabels(() => this._updateNumber())
  }

  // ── NodeView interface ────────────────────────────────────────

  update(node: PmNode): boolean {
    if (node.type.name !== 'theoremEnv') return false
    this._node = node
    this.dom.dataset['env'] = node.attrs['envType'] as string

    if (this._typeMenu.hidden) {
      this._syncTypeBtn(node.attrs['envType'] as TheoremEnvType)
    }
    this._updateNumber()
    return true
  }

  stopEvent(event: Event): boolean {
    return this._header.contains(event.target as Node)
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return this._header.contains(mutation.target)
  }

  destroy(): void {
    this._closeMenu()
    this._unsubscribeLabels()
  }

  // ── Dropdown ──────────────────────────────────────────────────

  private _toggleMenu(): void {
    this._typeMenu.hidden ? this._openMenu() : this._closeMenu()
  }

  private _openMenu(): void {
    const rect = this._typeBtn.getBoundingClientRect()

    // Teleport to body so no ancestor overflow can clip the menu
    document.body.appendChild(this._typeMenu)
    Object.assign(this._typeMenu.style, {
      position: 'fixed',
      left:     `${rect.left}px`,
      top:      `${rect.bottom + 5}px`,
      zIndex:   '9999',
    })
    this._typeMenu.hidden = false
    this._typeBtn.classList.add('open')

    // Adjust if the menu overflows the viewport
    requestAnimationFrame(() => {
      const mb = this._typeMenu.getBoundingClientRect()
      if (mb.bottom > window.innerHeight - 8)
        this._typeMenu.style.top = `${rect.top - mb.height - 5}px`
      if (mb.right > window.innerWidth - 8)
        this._typeMenu.style.left = `${window.innerWidth - mb.width - 8}px`
    })

    document.addEventListener('click', this._outsideClick)
  }

  private _closeMenu(): void {
    // Return menu to its original parent before hiding
    if (this._typeMenu.parentElement === document.body) {
      this._typeWrap.appendChild(this._typeMenu)
    }
    Object.assign(this._typeMenu.style, { position: '', left: '', top: '', zIndex: '' })
    this._typeMenu.hidden = true
    this._typeBtn.classList.remove('open')
    document.removeEventListener('click', this._outsideClick)
  }

  private _setType(envType: TheoremEnvType): void {
    this.dom.dataset['env'] = envType
    this._syncTypeBtn(envType)
    this._dispatch({ envType })
  }

  private _syncTypeBtn(envType: TheoremEnvType): void {
    const found = ENV_TYPES.find(t => t.value === envType)
    this._typeLabel.textContent = found?.label ?? envType
    this._typeBtn.style.color = `var(--thm-${envType})`
    this._typeMenu.querySelectorAll<HTMLElement>('.tenv-type-opt').forEach(el => {
      el.classList.toggle('active', el.dataset['value'] === envType)
    })
  }

  // ── Header sync ───────────────────────────────────────────────

  private _syncHeader(): void {
    this._syncTypeBtn(this._node.attrs['envType'] as TheoremEnvType)
    this._updateNumber()
  }

  private _updateNumber(): void {
    const id    = this._node.attrs['id'] as string
    const entry = id ? theoremLabels.value.get(id) : null
    this._numSpan.textContent = entry ? entry.num : ''
  }

  // ── Dispatch ──────────────────────────────────────────────────

  private _dispatch(attrs: Record<string, unknown>): void {
    const pos = this._getPos()
    if (pos === undefined) return
    const { state } = this._editor
    this._editor.view.dispatch(
      state.tr.setNodeMarkup(pos, undefined, { ...this._node.attrs, ...attrs })
    )
  }
}
