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
import { renderableLatex } from '@core/math/latexUtils'

const MODE_KEY = 'formalia:formula-mode'

@customElement('fp-floating-formula')
export class FloatingFormulaEditor extends LitElement {

  @state() private _active = false
  @state() private _editMode: 'visual' | 'code' =
    (localStorage.getItem(MODE_KEY) === 'code' ? 'code' : 'visual')

  private _lastActivePos: number | null = null
  private _skipMfReload = false
  private _activeFormulaEl: Element | null = null
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
      // Clicking the snippet sidebar inserts into the active formula — keep open.
      if ((e.target as Element)?.closest?.('fp-snippet-sidebar')) return
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
      // Panel just closed — remove editing marker from formula DOM
      this._activeFormulaEl?.classList.remove('is-editing')
      this._activeFormulaEl = null
      this._lastActivePos = null
      return
    }

    const panel = this.querySelector<HTMLElement>('.ff-panel')
    if (!panel) return

    const currentPos = activeNodePos.value
    const isNewNode  = this._lastActivePos !== currentPos

    if (isNewNode) {
      this._lastActivePos = currentPos
      
      // Mark current formula DOM so it stays visually highlighted
      this._activeFormulaEl?.classList.remove('is-editing')
      this._activeFormulaEl = getActiveFormulaDOM()
      this._activeFormulaEl?.classList.add('is-editing')

      // Move TipTap selection to neutralize it
      releaseFormulaSelection()

      // Synchronize values to the new formula's content
      const formula = activeFormula.value
      const ta = panel.querySelector<HTMLTextAreaElement>('.ff-textarea')
      const mf = panel.querySelector<any>('math-field')

      if (ta) {
        ta.value = formula
        this._autoResizeTextarea(ta)
      }

      if (mf) {
        // Cleanup MathLive state for the new formula
        mf.menuItems = []
        mf.smartMode = false
        mf.defaultMode = 'math'
        mf.mathVirtualKeyboardPolicy = 'off'
        mf.popoverPolicy = 'off'

        this._skipMfReload = true
        mf.insert(formula, { insertionMode: 'replaceAll', selectionMode: 'after' })
        this._skipMfReload = false
      }
    }

    // Defer both positioning and focus to the same frame
    requestAnimationFrame(() => {
      const p = this.querySelector<HTMLElement>('.ff-panel')
      if (!p) return

      // 1. Position and make visible
      this._positionPanel(p)

      // 2. Focus
      if (isNewNode) {
        const ta = p.querySelector<HTMLTextAreaElement>('.ff-textarea')
        const mf = p.querySelector<any>('math-field')

        if (this._editMode === 'visual' && mf) {
          mf.focus()
        } else if (this._editMode === 'code' && ta) {
          ta.focus()
          ta.setSelectionRange(ta.value.length, ta.value.length)
        }
      }
    })
  }

  private _onModeBtnMousedown = (e: Event) => {
    e.preventDefault()  // keep focus in math-field / textarea during mode switch
  }

  private _setMode(mode: 'visual' | 'code') {
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
        this._autoResizeTextarea(ta)
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }
      
      // Let layout catch up before positioning
      requestAnimationFrame(() => this._positionPanel(panel))
    })
  }

  private _measureCtx: CanvasRenderingContext2D | null = null

  /** Measure the pixel width of the longest line in a text string */
  private _measureTextWidth(text: string): number {
    if (!this._measureCtx) {
      const canvas = document.createElement('canvas')
      this._measureCtx = canvas.getContext('2d')!
    }
    this._measureCtx.font = '13px "JetBrains Mono", "Fira Code", monospace'
    const lines = text.split('\n')
    return Math.max(40, ...lines.map(l => this._measureCtx!.measureText(l).width))
  }

  private _positionPanel(panel: HTMLElement): void {
    const formulaEl = getActiveFormulaDOM()
    if (!formulaEl) return

    const rect = formulaEl.getBoundingClientRect()
    const vw   = window.innerWidth
    const vh   = window.innerHeight

    // For code mode: size textarea to its text content
    if (this._editMode === 'code') {
      const ta = this.querySelector<HTMLTextAreaElement>('.ff-textarea')
      if (ta) {
        const textW = this._measureTextWidth(ta.value)
        ta.style.width = `${Math.ceil(textW) + 14}px` // +padding
      }
    }

    // Viewport cap
    panel.style.maxWidth = `${vw - 16}px`

    // Measure actual rendered size (panel is fit-content)
    const panelRect = panel.getBoundingClientRect()
    const panelW = panelRect.width
    const panelH = panelRect.height

    const idealLeft = rect.left + rect.width / 2 - panelW / 2
    const left = Math.max(8, Math.min(idealLeft, vw - panelW - 8))
    const top  = (vh - rect.bottom >= panelH + 10)
      ? rect.bottom + 8
      : rect.top - panelH - 8

    panel.style.left       = `${left}px`
    panel.style.top        = `${top}px`
    panel.style.visibility = 'visible'
  }

  // ── Render ──────────────────────────────────────────────────────

  override render() {
    if (!this._active) return html``
    const isVisual = this._editMode === 'visual'
    return html`
      <div class="ff-panel" style="visibility:hidden">
        <div class="ff-body">
          <math-field
            class="ff-mathfield${isVisual ? '' : ' ff-hidden'}"
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
        </div>
        <div class="ff-mode-toggle">
          <button
            class="ff-mode-btn ${isVisual ? 'active' : ''}"
            title="Vista visual"
            tabindex="-1"
            @mousedown="${this._onModeBtnMousedown}"
            @click="${() => this._setMode('visual')}"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button
            class="ff-mode-btn ${!isVisual ? 'active' : ''}"
            title="Código LaTeX"
            tabindex="-1"
            @mousedown="${this._onModeBtnMousedown}"
            @click="${() => this._setMode('code')}"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          </button>
        </div>
      </div>
    `
  }

  // ── Event handlers ───────────────────────────────────────────────

  private _onMfInput = (e: Event) => {
    if (this._skipMfReload) return
    const mf = e.target as any
    const raw = (mf.getValue?.('latex') ?? mf.value ?? '') as string
    const ta = this.querySelector<HTMLTextAreaElement>('.ff-textarea')
    if (ta) ta.value = raw
    updateActiveFormula(raw)
    this._validateLatex(renderableLatex(raw))
  }

  private _onMfKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault()
      deactivateNode()
      focusEditor()
      return
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      ;(e.target as any).insert?.('\\\\')
    }
  }

  private _onInput = (e: Event) => {
    const ta = e.target as HTMLTextAreaElement
    const latex = ta.value
    this._autoResizeTextarea(ta)
    // Re-measure width and reposition panel
    const textW = this._measureTextWidth(latex)
    ta.style.width = `${Math.ceil(textW) + 14}px`
    const panel = this.querySelector<HTMLElement>('.ff-panel')
    if (panel) this._positionPanel(panel)
    updateActiveFormula(latex)
    this._validateLatex(latex)
  }

  /** Fit textarea height to its content so the popover auto-sizes */
  private _autoResizeTextarea(ta: HTMLTextAreaElement) {
    ta.style.height = '0'
    ta.style.height = `${ta.scrollHeight}px`
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
