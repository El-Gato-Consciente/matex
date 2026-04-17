import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import { activeFormulaError } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   StatusBar — thin footer bar that shows KaTeX parse errors.
   When a formula is being edited and the LaTeX is invalid,
   FloatingFormulaEditor writes to activeFormulaError and this
   component displays it. Cleared when the editor closes.
   ───────────────────────────────────────────────────────────────── */

@customElement('fp-status-bar')
export class StatusBar extends LitElement {

  @state() private _error: string | null = null

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this._disposes.push(
      effect(() => {
        this._error = activeFormulaError.value
        this.requestUpdate()
      })
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  override render() {
    if (this._error) {
      return html`<span class="sb-error"><span class="sb-error-icon">⚠</span>${this._error}</span>`
    }
    return html`<span class="sb-idle">Formalia</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-status-bar': StatusBar }
}
