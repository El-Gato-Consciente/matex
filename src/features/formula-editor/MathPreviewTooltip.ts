import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import katex from 'katex'
import { activeMathInputText, activeMathInputRect } from '@core/editor/EditorStore'

@customElement('fp-math-preview-tooltip')
export class MathPreviewTooltip extends LitElement {
  
  override createRenderRoot() { return this }

  @state() private _latex: string | null = null
  @state() private _rect: DOMRect | null = null

  private _disposes: (() => void)[] = []

  override connectedCallback() {
    super.connectedCallback()
    this._disposes.push(
      effect(() => {
        this._latex = activeMathInputText.value
        this._rect  = activeMathInputRect.value
      })
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  override render() {
    if (this._latex === null || this._rect === null) {
      this.style.visibility = 'hidden'
      return html``
    }

    // Position tooltip above the center of the text node
    this.style.visibility = 'visible'
    this.style.left = `${this._rect.left + (this._rect.width / 2)}px`
    this.style.top  = `${this._rect.top}px`

    if (!this._latex.trim()) {
      return html`<div class="tooltip-body empty">fórmula vacía</div>`
    }

    try {
      katex.renderToString(this._latex, { throwOnError: true })
      return html`<div class="tooltip-body katex-container"></div>`
    } catch (e) {
      const errStr = (e as Error).message.replace(/^KaTeX parse error: /, '')
      return html`<div class="tooltip-body has-error">${errStr}</div>`
    }
  }

  override updated() {
    if (this._latex && this._rect) {
      const container = this.renderRoot.querySelector('.katex-container')
      if (container && this._latex.trim()) {
        try {
          const htmlStr = katex.renderToString(this._latex, { throwOnError: true, displayMode: true })
          container.innerHTML = htmlStr
        } catch {
          // Fallback to error handled in render
        }
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-math-preview-tooltip': MathPreviewTooltip }
}
