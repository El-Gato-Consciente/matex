import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import katex from 'katex'
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

/* ─────────────────────────────────────────────────────────────────
   FloatingFormulaEditor
   A small floating LaTeX textarea that appears near the active
   formula node.  Uses position:fixed — zero layout shift.

   Opens when activeNodePos is set (click on formula, Enter on
   a selected formula, or Ctrl+M insert shortcut).

   Root cause of the "focus stealing" bug and its fix
   ──────────────────────────────────────────────────
   While a NodeSelection is active in ProseMirror, every call to
   view.dispatch() (including our own setNodeMarkup) causes
   ProseMirror to call window.getSelection().addRange() to re-assert
   the selection on the formula DOM element.  That addRange call
   refocuses the editor, steals focus from our textarea, and sends
   subsequent keystrokes to TipTap (which replaces the selected node).

   Fix: as soon as the floating editor opens, we call
   releaseFormulaSelection() which switches ProseMirror to a
   TextSelection after the formula.  From that point on dispatching
   setNodeMarkup has no NodeSelection to re-assert and focus stays
   in the textarea.
   ───────────────────────────────────────────────────────────────── */

@customElement('fp-floating-formula')
export class FloatingFormulaEditor extends LitElement {

  @state() private _active = false

  private _prevActive = false
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

    // Close when focus leaves this component entirely (user clicked elsewhere)
    this.addEventListener('focusout', (e: FocusEvent) => {
      if (!this._active) return
      const going = e.relatedTarget as Element | null
      if (!going || !this.contains(going)) {
        deactivateNode()
      }
    })
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  /**
   * After each render:
   * - On first activation: release NodeSelection, populate textarea, focus it.
   * - Every activation: position the panel over the formula.
   */
  override updated() {
    if (!this._active) {
      this._prevActive = false
      return
    }

    const panel = this.querySelector<HTMLElement>('.ff-panel')
    if (!panel) return

    this._positionPanel(panel)

    if (!this._prevActive) {
      // ── Critical: release NodeSelection BEFORE focusing the textarea ──
      // This prevents ProseMirror from re-asserting the selection (via
      // addRange) on every setNodeMarkup dispatch, which would steal focus.
      releaseFormulaSelection()

      const ta = panel.querySelector<HTMLTextAreaElement>('.ff-textarea')
      if (ta) {
        ta.value = activeFormula.value
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }
    }

    this._prevActive = this._active
  }

  private _positionPanel(panel: HTMLElement): void {
    const formulaEl = getActiveFormulaDOM()
    if (!formulaEl) return

    const rect   = formulaEl.getBoundingClientRect()
    const vw     = window.innerWidth
    const vh     = window.innerHeight
    const panelH = 96

    const panelW = Math.min(Math.max(300, rect.width + 48), vw - 16)
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
    return html`
      <div class="ff-panel" style="visibility:hidden">
        <textarea
          class="ff-textarea"
          placeholder="\\frac{a}{b}"
          rows="2"
          @input="${this._onInput}"
          @keydown="${this._onKeyDown}"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
        <div class="ff-hint">
          <kbd>Enter</kbd> confirmar &nbsp;·&nbsp;
          <kbd>Esc</kbd> cancelar &nbsp;·&nbsp;
          <kbd>Shift+Enter</kbd> nueva línea
        </div>
      </div>
    `
  }

  // ── Event handlers ───────────────────────────────────────────────

  private _onInput = (e: Event) => {
    const latex = (e.target as HTMLTextAreaElement).value
    updateActiveFormula(latex)

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
