import type { Node } from '@tiptap/pm/model'
import katex from 'katex'
import { effect } from '@preact/signals-core'
import { activateNode, pendingActivationSignal, triggerSource, activeNodePos } from '../EditorStore'
import { renderableLatex } from '@core/math/latexUtils'

/* ─────────────────────────────────────────────────────────────────
   MathDisplayView — ProseMirror NodeView for mathDisplay nodes.
   Block-level, display mode KaTeX render.
   Click or Enter opens the floating formula editor.
   ───────────────────────────────────────────────────────────────── */

export class MathDisplayView {
  readonly dom: HTMLElement

  private _node: Node
  private _getPos: () => number | undefined
  private _lastValidHtml: string | null = null
  private _disposeEffect: (() => void) | null = null

  constructor(node: Node, getPos: () => number | undefined) {
    this._node   = node
    this._getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'math-display'
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
      activeNodePos.value
      this._render()
    })
  }

  update(node: Node): boolean {
    if (node.type.name !== 'mathDisplay') return false
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
      this.dom.innerHTML = '<span class="math-empty">fórmula vacía — click para editar</span>'
      this.dom.classList.remove('has-error')
      return
    }

    const pos = this._getPos()
    const isActive = pos !== undefined && pos === activeNodePos.value

    try {
      const htmlStr = katex.renderToString(latex, {
        throwOnError: true,
        displayMode:  true,
        output:       'html',
        strict:       false,
      })
      this.dom.innerHTML = htmlStr
      this._lastValidHtml = htmlStr
      this.dom.classList.remove('math-node-error', 'has-error')
    } catch {
      // Dual-mode logic: memory while editing, explicit error highlight after.
      if (isActive && this._lastValidHtml) {
        this.dom.innerHTML = this._lastValidHtml
        this.dom.classList.remove('math-node-error', 'has-error')
      } else {
        this.dom.innerHTML = `<span class="math-errstr">${this._escape(latex)}</span>`
        this.dom.classList.add('math-node-error')
        this.dom.classList.remove('has-error')
      }
    }
  }

  private _escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
