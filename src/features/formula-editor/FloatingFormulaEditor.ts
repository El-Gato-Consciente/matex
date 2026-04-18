import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import katex from 'katex'
import 'mathlive'
import {
  activeNodePos,
  activeFormula,
  activeFormulaError,
  updateActiveFormula,
  deactivateNode,
  releaseFormulaSelection,
  focusEditor,
  getActiveFormulaDOM,
} from '@core/editor/EditorStore'

const MODE_KEY = 'formalia:formula-mode'

@customElement('fp-floating-formula')
export class FloatingFormulaEditor extends LitElement {

  @state() private _active = false
  @state() private _editMode: 'visual' | 'code' =
    (localStorage.getItem(MODE_KEY) === 'code' ? 'code' : 'visual')
  @state() private _inLatexMode = false

  private _prevActive = false
  private _skipMfReload = false
  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()

    this._disposes.push(
      effect(() => {
        this._active = activeNodePos.value !== null
        this.requestUpdate()
      })
    )

    // Close when the user clicks outside the panel.
    // e.composedPath() crosses shadow DOM boundaries, so clicks inside
    // math-field's shadow are correctly identified as "inside this".
    // focusout is NOT used — it is unreliable across shadow DOM.
    const onPointerdown = (e: PointerEvent) => {
      if (!this._active) return
      if (e.composedPath().includes(this)) return
      // Clicking a formula node: activateNode() will fire shortly after,
      // reopening the panel. Don't deactivate — avoid the close/reopen flash.
      if ((e.target as Element)?.closest?.('.math-inline, .math-display')) return
      deactivateNode()
    }
    document.addEventListener('pointerdown', onPointerdown, true)
    this._disposes.push(() => document.removeEventListener('pointerdown', onPointerdown, true))
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  override updated() {
    if (!this._active) {
      this._prevActive = false
      this._inLatexMode = false
      return
    }

    const panel = this.querySelector<HTMLElement>('.ff-panel')
    if (!panel) return

    this._positionPanel(panel)

    if (!this._prevActive) {
      releaseFormulaSelection()

      const formula = activeFormula.value
      const ta = panel.querySelector<HTMLTextAreaElement>('.ff-textarea')
      const mf = panel.querySelector<any>('math-field')

      if (ta) ta.value = formula

      if (mf) {
        // Configure on each creation (panel is torn down when inactive)
        mf.menuItems = []
        mf.smartMode = false
        mf.defaultMode = 'math'
        mf.mathVirtualKeyboardPolicy = 'off'
        mf.popoverPolicy = 'auto'

        mf.addEventListener('mode-change', () => {
          this._inLatexMode = mf.mode === 'latex'
        })

        this._skipMfReload = true
        mf.insert(formula, { insertionMode: 'replaceAll', selectionMode: 'after' })
        this._skipMfReload = false
      }

      if (this._editMode === 'visual' && mf) {
        mf.focus()
      } else if (ta) {
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }
    }

    this._prevActive = this._active
  }

  private _onModeBtnMousedown = (e: Event) => {
    e.preventDefault()  // keep focus in math-field / textarea during mode switch
  }

  private _setMode(mode: 'visual' | 'code') {
    const mf = this.querySelector<any>('math-field')
    // Exit latex sub-mode before switching
    if (mf?.mode === 'latex') mf.executeCommand(['complete', 'reject'])
    this._inLatexMode = false
    this._editMode = mode
    localStorage.setItem(MODE_KEY, mode)

    const val = activeFormula.value
    this.updateComplete.then(() => {
      const panel = this.querySelector<HTMLElement>('.ff-panel')
      if (!panel) return
      const ta = panel.querySelector<HTMLTextAreaElement>('.ff-textarea')
      const mf2 = panel.querySelector<any>('math-field')

      if (mode === 'visual' && mf2) {
        this._skipMfReload = true
        mf2.insert(val, { insertionMode: 'replaceAll', selectionMode: 'after' })
        this._skipMfReload = false
        mf2.focus()
      } else if (ta) {
        ta.value = val
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }
    })
  }

  private _activateLatexMode = () => {
    const mf = this.querySelector<any>('math-field')
    if (!mf) return
    mf.executeCommand(['switchMode', 'latex', '', '\\'])
    mf.focus()
  }

  private _positionPanel(panel: HTMLElement): void {
    const formulaEl = getActiveFormulaDOM()
    if (!formulaEl) return

    const rect   = formulaEl.getBoundingClientRect()
    const vw     = window.innerWidth
    const vh     = window.innerHeight
    const panelH = 150

    const panelW = Math.min(Math.max(320, rect.width + 48), vw - 16)
    const idealLeft = rect.left + rect.width / 2 - panelW / 2
    const left = Math.max(8, Math.min(idealLeft, vw - panelW - 8))
    const top  = (vh - rect.bottom >= panelH + 10)
      ? rect.bottom + 8
      : rect.top - panelH - 8

    panel.style.left       = `${left}px`
    panel.style.width      = `${panelW}px`
    panel.style.top        = `${top}px`
    panel.style.visibility = 'visible'
  }

  // ── Render ──────────────────────────────────────────────────────

  override render() {
    if (!this._active) return html``
    const isVisual = this._editMode === 'visual'
    return html`
      <div class="ff-panel" style="visibility:hidden">
        <div class="ff-mode-bar">
          <div class="ff-mode-toggle">
            <button
              class="ff-mode-btn ${isVisual ? 'active' : ''}"
              tabindex="-1"
              @mousedown="${this._onModeBtnMousedown}"
              @click="${() => this._setMode('visual')}"
            >Visual</button>
            <button
              class="ff-mode-btn ${!isVisual ? 'active' : ''}"
              tabindex="-1"
              @mousedown="${this._onModeBtnMousedown}"
              @click="${() => this._setMode('code')}"
            >Código</button>
          </div>
          ${isVisual ? html`
            <button
              class="ff-latex-btn${this._inLatexMode ? ' active' : ''}"
              tabindex="-1"
              title="Modo LaTeX — Enter confirma · Tab autocompleta · Esc cancela"
              @mousedown="${this._onModeBtnMousedown}"
              @click="${this._activateLatexMode}"
            ><span class="ff-bslash">\</span> LaTeX</button>
          ` : ''}
        </div>
        <math-field
          class="ff-mathfield${isVisual ? '' : ' ff-hidden'}${this._inLatexMode ? ' latex-mode' : ''}"
          math-virtual-keyboard-policy="off"
          default-mode="math"
          @input="${this._onMfInput}"
          @keydown="${this._onMfKeyDown}"
        ></math-field>
        <textarea
          class="ff-textarea${isVisual ? ' ff-hidden' : ''}"
          placeholder="\\frac{a}{b}"
          rows="2"
          @input="${this._onInput}"
          @keydown="${this._onKeyDown}"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
        ${this._inLatexMode ? html`
          <div class="ff-latex-hint">
            Modo LaTeX — <kbd>Enter</kbd> confirma &nbsp;·&nbsp;
            <kbd>Tab</kbd> autocompleta &nbsp;·&nbsp; <kbd>Esc</kbd> cancela
          </div>
        ` : html`
          <div class="ff-hint">
            <kbd>Esc</kbd> cerrar
            ${!isVisual ? html`&nbsp;·&nbsp; <kbd>Enter</kbd> confirmar &nbsp;·&nbsp; <kbd>Shift+Enter</kbd> nueva línea` : ''}
          </div>
        `}
      </div>
    `
  }

  // ── Event handlers ───────────────────────────────────────────────

  private _onMfInput = (e: Event) => {
    if (this._skipMfReload) return
    const mf = e.target as any
    const latex = (mf.getValue?.('latex') ?? mf.value ?? '') as string
    const ta = this.querySelector<HTMLTextAreaElement>('.ff-textarea')
    if (ta) ta.value = latex
    updateActiveFormula(latex)
    this._validateLatex(latex)
  }

  private _onMfKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const mf = e.target as any
      if (mf.mode === 'latex') return  // mathlive handles: exits latex sub-mode
      e.preventDefault()
      deactivateNode()
      focusEditor()
    }
  }

  private _onInput = (e: Event) => {
    const latex = (e.target as HTMLTextAreaElement).value
    updateActiveFormula(latex)
    this._validateLatex(latex)
  }

  private _validateLatex(latex: string) {
    if (!latex.trim()) {
      activeFormulaError.value = null
      return
    }
    try {
      katex.renderToString(latex, { throwOnError: true })
      activeFormulaError.value = null
    } catch (err) {
      activeFormulaError.value = (err as Error).message.replace(/^KaTeX parse error: /, '')
    }
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      deactivateNode()
      focusEditor()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      deactivateNode()
      focusEditor()
      return
    }
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
}

declare global {
  interface HTMLElementTagNameMap { 'fp-floating-formula': FloatingFormulaEditor }
}
