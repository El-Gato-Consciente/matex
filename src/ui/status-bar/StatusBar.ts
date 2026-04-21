import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import {
  activeFormulaError,
  activeFormulaType,
  activeNodePos,
  activeMathInputText,
  docStats,
} from '@core/editor/EditorStore'

@customElement('fp-status-bar')
export class StatusBar extends LitElement {

  @state() private _error:  string | null = null
  @state() private _type:   'inline' | 'display' | null = null
  @state() private _active: boolean = false
  @state() private _stats = { words: 0, mathInline: 0, mathDisplay: 0, theoremEnv: 0 }

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this._disposes.push(
      effect(() => { this._error  = activeFormulaError.value;    this.requestUpdate() }),
      effect(() => { this._type   = activeFormulaType.value;     this.requestUpdate() }),
      effect(() => { this._active = (activeNodePos.value !== null || activeMathInputText.value !== null); this.requestUpdate() }),
      effect(() => { this._stats  = docStats.value;              this.requestUpdate() }),
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  override render() {
    if (this._active) return this._renderActiveFormula()
    return this._renderIdle()
  }

  private _renderIdle() {
    const { words, mathInline, mathDisplay, theoremEnv } = this._stats
    const formulas = mathInline + mathDisplay
    const parts: string[] = [`${words} pal.`]
    if (formulas > 0) parts.push(`${formulas} fórmulas`)
    if (theoremEnv > 0) parts.push(`${theoremEnv} entornos`)
    return html`<span class="sb-idle">${parts.join(' · ')}</span>`
  }

  private _renderActiveFormula() {
    const label = this._type === 'display' ? 'display' : 'inline'
    if (this._error) {
      return html`
        <span class="sb-error">
          <span class="sb-error-icon">⚠</span>
          fórmula ${label} · ${this._error}
        </span>
      `
    }
    return html`<span class="sb-formula-ok">fórmula ${label} · ✓</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-status-bar': StatusBar }
}
