import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import katex from 'katex'
import {
  activeFormula,
  activeNodePos,
  updateActiveFormula,
  insertNewFormula,
  deactivateNode,
} from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   FormulaPanel — Phase 1 (Código mode only)
   Always-visible panel above the editor that shows the active formula.
   Phase 2 will add MathLive visual mode and the Visual/Código toggle.

   Uses light DOM (createRenderRoot returns this) so global CSS applies.
   ───────────────────────────────────────────────────────────────── */

@customElement('fp-formula-panel')
export class FormulaPanel extends LitElement {

  @state() private _latex     = ''
  @state() private _hasActive = false
  @state() private _preview   = ''
  @state() private _hasError  = false

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this._disposes.push(
      effect(() => {
        this._latex     = activeFormula.value
        this._hasActive = activeNodePos.value !== null
        this._renderPreview(activeFormula.value)
        this.requestUpdate()
      })
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  // ── Render ──────────────────────────────────────────────────────

  override render() {
    return this._hasActive ? this._renderActive() : this._renderInactive()
  }

  private _renderActive() {
    return html`
      <div class="fp-left">
        <div class="fp-label">LaTeX</div>
        <textarea
          class="fp-textarea ${this._hasError ? 'fp-error' : ''}"
          .value="${this._latex}"
          placeholder="\\frac{a}{b}"
          rows="2"
          @input="${this._onInput}"
          @keydown="${this._onKeyDown}"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
      </div>
      <div class="fp-right">
        <div class="fp-label">Preview</div>
        <div class="fp-preview ${this._hasError ? 'fp-preview-error' : ''}">
          ${this._hasError
            ? html`<span class="fp-err-msg">syntax error</span>`
            : html`<span class="fp-rendered" .innerHTML="${this._preview}"></span>`
          }
        </div>
      </div>
      <div class="fp-actions">
        <button class="tbtn" title="Deselect formula (Escape)" @click="${this._deselect}">
          ✕
        </button>
      </div>
    `
  }

  private _renderInactive() {
    return html`
      <div class="fp-hint">
        Click a formula to edit it, or insert a new one:
      </div>
      <div class="fp-insert-btns">
        <button class="tbtn math" @click="${() => this._insert(false)}" title="Insert inline formula">
          $ inline
        </button>
        <button class="tbtn math" @click="${() => this._insert(true)}" title="Insert display formula">
          $$ display
        </button>
      </div>
    `
  }

  // ── Event handlers (arrow class fields so `this` is always the component) ──

  private _onInput = (e: Event) => {
    const latex = (e.target as HTMLTextAreaElement).value
    updateActiveFormula(latex)
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      this._deselect()
    }
    // Tab: insert two spaces (useful for aligned environments)
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta  = e.target as HTMLTextAreaElement
      const s   = ta.selectionStart
      const end = ta.selectionEnd
      ta.value  = ta.value.substring(0, s) + '  ' + ta.value.substring(end)
      ta.selectionStart = ta.selectionEnd = s + 2
      updateActiveFormula(ta.value)
    }
  }

  private _deselect = () => {
    deactivateNode()
  }

  private _insert = (displayMode: boolean) => {
    insertNewFormula('', displayMode)
  }

  // ── KaTeX preview ───────────────────────────────────────────────

  private _renderPreview(latex: string) {
    if (!latex.trim()) {
      this._preview  = ''
      this._hasError = false
      return
    }
    try {
      this._preview  = katex.renderToString(latex, {
        throwOnError: true,
        displayMode:  true,
        output:       'html',
        strict:       false,
      })
      this._hasError = false
    } catch {
      this._preview  = ''
      this._hasError = true
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-formula-panel': FormulaPanel }
}
