import type { Node } from '@tiptap/pm/model'
import katex from 'katex'
import { effect } from '@preact/signals-core'
import { activateNode, pendingActivationSignal, triggerSource, activeNodePos } from '../EditorStore'
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
  private _lastValidHtml: string | null = null
  private _disposeEffect: (() => void) | null = null

  constructor(node: Node, getPos: () => number | undefined) {
    this._node   = node
    this._getPos = getPos

    this.dom = document.createElement('span')
    this.dom.className = 'math-inline'
    this.dom.setAttribute('contenteditable', 'false')

    this._render()

    // SELF-ACTIVATION HANDSHAKE: Only activate if our token matches the pending signal.
    // This prevents greedy neighbor formulas from stealing focus when they re-mount.
    const token = this._node.attrs['activationToken']
    if (token && token === pendingActivationSignal.value) {
      pendingActivationSignal.value = null
      const pos = this._getPos()
      if (pos !== undefined) {
        activateNode(pos, this._node.attrs['latex'] as string, this.dom, triggerSource.value)
      }
    }

    // mousedown → open floating editor immediately.
    this.dom.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const pos = this._getPos()
      if (pos !== undefined) {
        activateNode(pos, this._node.attrs['latex'] as string, this.dom)
      }
    })

    // Listen to global activation changes to trigger dual-mode rendering
    this._disposeEffect = effect(() => {
      // Accessing the signal value to subscribe
      activeNodePos.value
      this._render()
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
    if (this._disposeEffect) this._disposeEffect()
  }

  private _render(): void {
    const latex = renderableLatex((this._node.attrs['latex'] as string) ?? '')

    if (!latex.trim()) {
      this.dom.innerHTML = '<span class="math-empty">·</span>'
      this.dom.classList.remove('has-error')
      return
    }

    const pos = this._getPos()
    const isActive = pos !== undefined && pos === activeNodePos.value

    try {
      const htmlStr = katex.renderToString(latex, {
        throwOnError: true,
        displayMode:  false,
        output:       'html',
        strict:       false,
      })
      this.dom.innerHTML = htmlStr
      this._lastValidHtml = htmlStr
      this.dom.classList.remove('math-node-error', 'has-error')
    } catch {
      // Dual-mode logic: 
      // 1. If currently editing, be silent and show memory if available.
      // 2. If finished editing or no memory, show the explicit red error highlight.
      if (isActive && this._lastValidHtml) {
        this.dom.innerHTML = this._lastValidHtml
        this.dom.classList.remove('math-node-error', 'has-error')
      } else {
        this.dom.textContent = latex
        this.dom.classList.add('math-node-error')
        this.dom.classList.remove('has-error')
      }
    }
  }
}
