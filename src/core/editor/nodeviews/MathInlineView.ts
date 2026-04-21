import type { Node } from '@tiptap/pm/model'
import katex from 'katex'
import { activateNode, pendingActivationSignal, triggerSource } from '../EditorStore'
import { renderableLatex } from '@core/math/latexUtils'

/* ─────────────────────────────────────────────────────────────────
   MathInlineView — ProseMirror NodeView for mathInline nodes.
   Vanilla TypeScript (no Lit, no Shadow DOM).
   Renders KaTeX; click or Enter opens the floating formula editor.
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

    // SELF-ACTIVATION: If we were just created via shift+M or toolbar, 
    // activate ourselves immediately so the popover can target our DOM.
    if (pendingActivationSignal.value) {
      pendingActivationSignal.value = false
      const pos = this._getPos()
      if (pos !== undefined) {
        activateNode(pos, this._node.attrs['latex'] as string, this.dom, triggerSource.value)
      }
    }

    // mousedown → open floating editor immediately.
    // By using preventDefault, we stop the editor from grabbing focus.
    this.dom.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const pos = this._getPos()
      if (pos !== undefined) {
        activateNode(pos, this._node.attrs['latex'] as string, this.dom)
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
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode')
    // NOTE: do NOT call deactivateNode() here — the floating editor manages
    // its own lifecycle via focusout and explicit close actions.
  }

  destroy(): void {
    // no cleanup needed
  }

  private _render(): void {
    const latex = renderableLatex((this._node.attrs['latex'] as string) ?? '')

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
