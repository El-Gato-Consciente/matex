import type { Node } from '@tiptap/pm/model'
import katex from 'katex'
import { activateNode } from '../EditorStore'

/* ─────────────────────────────────────────────────────────────────
   MathInlineView — ProseMirror NodeView for mathInline nodes.
   Vanilla TypeScript (no Lit, no Shadow DOM).
   Renders KaTeX; click activates the formula in EditorStore.
   ───────────────────────────────────────────────────────────────── */

export class MathInlineView {
  readonly dom: HTMLElement

  private _node: Node
  private _getPos: () => number | undefined

  constructor(node: Node, getPos: () => number | undefined) {
    this._node   = node
    this._getPos = getPos

    this.dom = document.createElement('span')
    this.dom.className = 'math-inline'
    this.dom.setAttribute('contenteditable', 'false')

    this._render()

    this.dom.addEventListener('click', () => {
      const pos = this._getPos()
      if (pos !== undefined) {
        activateNode(pos, this._node.attrs['latex'] as string)
      }
    })
  }

  update(node: Node): boolean {
    if (node.type.name !== 'mathInline') return false
    this._node = node
    this._render()
    return true
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode')
    const pos = this._getPos()
    if (pos !== undefined) {
      activateNode(pos, this._node.attrs['latex'] as string)
    }
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  destroy(): void {
    // no cleanup needed
  }

  private _render(): void {
    const latex = (this._node.attrs['latex'] as string) ?? ''

    if (!latex.trim()) {
      this.dom.innerHTML = '<span class="math-empty">·</span>'
      this.dom.classList.remove('has-error')
      return
    }

    try {
      katex.render(latex, this.dom, {
        throwOnError: true,
        displayMode:  false,
        output:       'html',
        strict:       false,
      })
      this.dom.classList.remove('has-error')
    } catch {
      this.dom.textContent = latex
      this.dom.classList.add('has-error')
    }
  }
}
