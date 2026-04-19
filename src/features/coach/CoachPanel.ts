import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import {
  activeFormulaError,
  activeFormulaType,
  activeNodePos,
  docStats,
} from '@core/editor/EditorStore'

const CP_KEY = 'formalia:coach:collapsed'

@customElement('fp-coach-panel')
export class CoachPanel extends LitElement {

  @state() private _error:     string | null = null
  @state() private _type:      'inline' | 'display' | null = null
  @state() private _active:    boolean = false
  @state() private _stats =    { words: 0, mathInline: 0, mathDisplay: 0, theoremEnv: 0 }
  @state() private _collapsed = localStorage.getItem(CP_KEY) === '1'

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this.parentElement?.classList.toggle('collapsed', this._collapsed)
    this._disposes.push(
      effect(() => { this._error  = activeFormulaError.value;    this.requestUpdate() }),
      effect(() => { this._type   = activeFormulaType.value;     this.requestUpdate() }),
      effect(() => { this._active = activeNodePos.value !== null; this.requestUpdate() }),
      effect(() => { this._stats  = docStats.value;              this.requestUpdate() }),
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  private _toggle() {
    this._collapsed = !this._collapsed
    localStorage.setItem(CP_KEY, this._collapsed ? '1' : '0')
    this.parentElement?.classList.toggle('collapsed', this._collapsed)
  }

  override render() {
    if (this._collapsed) return this._renderCollapsed()
    return html`
      <div class="cp-header">
        <span>Coach</span>
        <button class="cp-toggle" title="Colapsar" @click="${this._toggle}">›</button>
      </div>
      <div class="cp-body">
        ${this._active ? this._renderFormulaSection() : ''}
        ${this._renderStatsSection()}
        ${this._renderShortcutsSection()}
      </div>
    `
  }

  private _renderCollapsed() {
    const hasError = this._active && this._error
    return html`
      <div class="cp-collapsed">
        <button class="cp-toggle" title="Expandir" @click="${this._toggle}">‹</button>
        ${hasError ? html`<span class="cp-collapsed-error" title="${this._error}">⚠</span>` : ''}
      </div>
    `
  }

  private _renderFormulaSection() {
    const label = this._type === 'display' ? 'display' : 'inline'
    if (this._error) {
      return html`
        <div class="cp-section cp-section--error">
          <div class="cp-section-title"><span class="cp-icon">⚠</span> Error LaTeX</div>
          <div class="cp-error-type">Fórmula ${label}</div>
          <div class="cp-error-msg">${this._error}</div>
        </div>
      `
    }
    return html`
      <div class="cp-section cp-section--ok">
        <div class="cp-section-title"><span class="cp-icon">✓</span> Fórmula ${label}</div>
        <div class="cp-ok-msg">LaTeX válido</div>
      </div>
    `
  }

  private _renderStatsSection() {
    const { words, mathInline, mathDisplay, theoremEnv } = this._stats
    const formulas = mathInline + mathDisplay
    return html`
      <div class="cp-section">
        <div class="cp-section-title">Documento</div>
        <div class="cp-stats">
          <div class="cp-stat">
            <span class="cp-stat-val">${words}</span>
            <span class="cp-stat-lbl">palabras</span>
          </div>
          <div class="cp-stat">
            <span class="cp-stat-val">${formulas}</span>
            <span class="cp-stat-lbl">fórmulas</span>
          </div>
          ${mathDisplay > 0 ? html`
          <div class="cp-stat">
            <span class="cp-stat-val">${mathDisplay}</span>
            <span class="cp-stat-lbl">display</span>
          </div>` : ''}
          ${theoremEnv > 0 ? html`
          <div class="cp-stat">
            <span class="cp-stat-val">${theoremEnv}</span>
            <span class="cp-stat-lbl">entornos</span>
          </div>` : ''}
        </div>
      </div>
    `
  }

  private _renderShortcutsSection() {
    const shortcuts = this._active
      ? [
          { key: 'Enter',       desc: 'confirmar' },
          { key: 'Esc',         desc: 'cerrar' },
          { key: 'Shift+Enter', desc: 'nueva línea' },
        ]
      : [
          { key: 'Ctrl+M',  desc: 'fórmula inline' },
          { key: '$$',      desc: 'fórmula display' },
          { key: '/thm',    desc: 'teorema' },
          { key: '/def',    desc: 'definición' },
          { key: '/proof',  desc: 'demostración' },
          { key: '/ex',     desc: 'ejemplo' },
        ]

    return html`
      <div class="cp-section">
        <div class="cp-section-title">Atajos</div>
        <div class="cp-shortcuts">
          ${shortcuts.map(s => html`
            <div class="cp-shortcut">
              <kbd class="cp-kbd">${s.key}</kbd>
              <span class="cp-shortcut-desc">${s.desc}</span>
            </div>
          `)}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-coach-panel': CoachPanel }
}
