import { effect } from '@preact/signals-core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { footnoteMap, scrollToFootnoteBlock } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   FootnoteRefView — inline superscript [N].
   Click scrolls to the corresponding footnoteBlock.
   ───────────────────────────────────────────────────────────────── */

export class FootnoteRefView {
  dom: HTMLElement
  private _node: PmNode
  private _disposes: (() => void)[] = []

  constructor(node: PmNode, _getPos: () => number | undefined) {
    this._node = node

    this.dom = document.createElement('sup')
    this.dom.className = 'fn-marker'
    this.dom.contentEditable = 'false'

    this._disposes.push(
      effect(() => {
        const entry = footnoteMap.value.get(this._node.attrs['id'])
        this.dom.textContent = entry ? `[${entry.num}]` : '[?]'
      }),
    )

    this.dom.addEventListener('mousedown', e => e.preventDefault())
    this.dom.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()
      scrollToFootnoteBlock(this._node.attrs['id'])
    })
  }

  update(node: PmNode): boolean {
    this._node = node
    return true
  }

  destroy(): void {
    this._disposes.forEach(d => d())
  }
}
