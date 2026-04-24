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
        this._latex = activeMathInputText.value
        this._rect  = activeMathInputRect.value

        const text = this._latex
        if (text && text.trim()) {
          try {
            this._lastValidHtml = katex.renderToString(text, { throwOnError: true, displayMode: true })
          } catch {
            // keep previous valid HTML
          }
        } else if (!text) {
          this._lastValidHtml = null
        }
      })
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  // render() is pure — no side effects, only HTML structure
  override render() {
    if (!this._latex || this._rect === null) return html``
    if (!this._latex.trim()) return html`<div class="tooltip-body empty">fórmula vacía</div>`
    if (!this._lastValidHtml) return html`<div class="tooltip-body has-error">error de sintaxis</div>`
    return html`<div class="tooltip-body katex-container"></div>`
  }

  // updated() handles all side effects: positioning, visibility, KaTeX injection
  override updated() {
    const visible = this._latex !== null && this._rect !== null
    this.style.visibility = visible ? 'visible' : 'hidden'
    if (!visible || !this._rect) return

    this.style.left = `${this._rect.left + this._rect.width / 2}px`
    this.style.top  = `${this._rect.top}px`

    const container = this.querySelector<HTMLElement>('.katex-container')
    if (container && this._lastValidHtml) {
      container.innerHTML = this._lastValidHtml
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-math-preview-tooltip': MathPreviewTooltip }
}
