import type { Node } from '@tiptap/pm/model'
import katex from 'katex'
import { activateNode } from '../EditorStore'

/* ─────────────────────────────────────────────────────────────────
   MathDisplayView — ProseMirror NodeView for mathDisplay nodes.
   Block-level, display mode KaTeX render.
   ───────────────────────────────────────────────────────────────── */

export class MathDisplayView {
  readonly dom: HTMLElement

  private _node: Node
  private _getPos: () => number | undefined

  constructor(node: Node, getPos: () => number | undefined) {
    this._node   = node
    this._getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'math-display'
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
    if (node.type.name !== 'mathDisplay') return false
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
      this.dom.innerHTML = '<span class="math-empty">empty formula — click to edit</span>'
      this.dom.classList.remove('has-error')
      return
    }

    try {
      katex.render(latex, this.dom, {
        throwOnError: true,
        displayMode:  true,
        output:       'html',
        strict:       false,
      })
      this.dom.classList.remove('has-error')
    } catch {
      this.dom.innerHTML = `<span class="math-errstr">${this._escape(latex)}</span>`
      this.dom.classList.add('has-error')
    }
  }

  private _escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
