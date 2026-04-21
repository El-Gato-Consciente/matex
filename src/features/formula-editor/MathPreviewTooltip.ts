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
  @state() private _lastValidHtml: string | null = null

  private _disposes: (() => void)[] = []

  override connectedCallback() {
    super.connectedCallback()
    this._disposes.push(
      effect(() => {
        const text = activeMathInputText.value
        this._latex = text
        this._rect  = activeMathInputRect.value

        // Update memory immediately if valid
        if (text && text.trim()) {
          try {
            const htmlStr = katex.renderToString(text, { throwOnError: true, displayMode: true })
            this._lastValidHtml = htmlStr
          } catch {
            // Keep previous valid HTML
          }
        }
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

    let isValid = true
    try {
      katex.renderToString(this._latex, { throwOnError: true })
    } catch {
      isValid = false
    }

    // If invalid, we show from memory. NO extra styles like 'is-stale'
    if (!isValid && !this._lastValidHtml) {
      // Fallback to error message only if we have NO memory at all
      const errStr = 'error de sintaxis' 
      return html`<div class="tooltip-body has-error">${errStr}</div>`
    }

    return html`
      <div class="tooltip-body katex-container"></div>
    `
  }

  override updated() {
    if (this._rect) {
      const container = this.renderRoot.querySelector('.katex-container')
      if (container) {
        let isValid = true
        let currentHtml: string | null = null
        try {
          if (this._latex) {
            currentHtml = katex.renderToString(this._latex, { throwOnError: true, displayMode: true })
          }
        } catch {
          isValid = false
        }

        const htmlToShow = isValid ? currentHtml : this._lastValidHtml
        if (htmlToShow) {
          container.innerHTML = htmlToShow
        }
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-math-preview-tooltip': MathPreviewTooltip }
}
