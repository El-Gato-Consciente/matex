import { effect } from '@preact/signals-core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { footnoteMap, deleteFootnote, scrollToFootnoteRef } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   FootnoteBlockView — editable footnote block at end of document.
   Shows [N] label + delete button; contentDOM holds the body.
   ───────────────────────────────────────────────────────────────── */

export class FootnoteBlockView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private _node: PmNode
  private _numEl: HTMLButtonElement
  private _disposes: (() => void)[] = []

  constructor(node: PmNode, _getPos: () => number | undefined) {
    this._node = node

    this.dom = document.createElement('div')
    this.dom.className = 'fn-block'
    this.dom.setAttribute('data-fn-id', node.attrs['id'])

    // ── Header (non-editable) ──────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'fn-block-header'
    header.contentEditable = 'false'

    this._numEl = document.createElement('button')
    this._numEl.className = 'fn-block-num'
    this._numEl.textContent = '[?]'
    this._numEl.title = 'Volver a la referencia en el texto'
    this._numEl.addEventListener('mousedown', e => e.preventDefault())
    this._numEl.addEventListener('click', () => scrollToFootnoteRef(this._node.attrs['id']))
    header.appendChild(this._numEl)

    const del = document.createElement('button')
    del.className = 'fn-block-del'
    del.textContent = '✕'
    del.title = 'Eliminar nota al pie'
    del.addEventListener('mousedown', e => e.preventDefault())
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteFootnote(this._node.attrs['id'])
    })
    header.appendChild(del)

    this.dom.appendChild(header)

    // ── Content area (editable) ────────────────────────────────────
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'fn-block-content'
    this.dom.appendChild(this.contentDOM)

    // ── Reactive number ────────────────────────────────────────────
    this._disposes.push(
      effect(() => {
        const entry = footnoteMap.value.get(this._node.attrs['id'])
        this._numEl.textContent = entry ? `[${entry.num}]` : '[?]'
      }),
    )
  }

  update(node: PmNode): boolean {
    this._node = node
    return true
  }

  // Prevent clicks on header buttons from being interpreted by PM
  stopEvent(event: Event): boolean {
    return (event.target as HTMLElement)?.closest('.fn-block-header') !== null
  }

  ignoreMutation(mutation: { type: string; target: globalThis.Node }): boolean {
    if (mutation.type === 'selection') return true
    return (mutation.target as HTMLElement).closest?.('.fn-block-header') !== null
  }

  destroy(): void {
    this._disposes.forEach(d => d())
  }
}
