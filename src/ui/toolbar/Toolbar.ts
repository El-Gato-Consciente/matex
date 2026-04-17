import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import {
  editorFmtState,
  toggleBold, toggleItalic, toggleCode,
  setHeading, toggleBulletList, toggleOrderedList,
  undo, redo,
  insertNewFormula, insertTheoremEnv,
  loadExample, clearDocument,
} from '@core/editor/EditorStore'
import { LocalStorageAdapter } from '@features/documents/LocalStorageAdapter'

/* ─────────────────────────────────────────────────────────────────
   Toolbar — Phase 1
   Two-row toolbar. Reacts to editorFmtState signal for active states.
   Row 1: text formatting + undo/redo + export + theme
   Row 2: math insertion + theorem env types
   ───────────────────────────────────────────────────────────────── */

const storage = new LocalStorageAdapter()

@customElement('fp-toolbar')
export class Toolbar extends LitElement {

  @state() private _fmt     = editorFmtState.value
  @state() private _isDark  = storage.loadTheme() === 'dark'

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this._disposes.push(
      effect(() => {
        this._fmt = editorFmtState.value
        this.requestUpdate()
      })
    )
    // Apply persisted theme on boot
    this._applyTheme(this._isDark)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  // ── Render ──────────────────────────────────────────────────────

  override render() {
    const f = this._fmt
    return html`
      <!-- Row 1: text formatting -->
      <div id="toolbar-row-1" class="toolbar-row">

        <button class="tbtn ${f.bold   ? 'active' : ''}" @click="${toggleBold}"
          title="Bold (Ctrl+B)"><b>B</b></button>
        <button class="tbtn ${f.italic ? 'active' : ''}" @click="${toggleItalic}"
          title="Italic (Ctrl+I)"><em>I</em></button>
        <button class="tbtn ${f.code   ? 'active' : ''}" @click="${toggleCode}"
          title="Code"><code style="font-size:11px">{ }</code></button>

        <div class="sep"></div>

        <button class="tbtn ${f.h1 ? 'active' : ''}" @click="${() => setHeading(1)}"
          title="Heading 1">H1</button>
        <button class="tbtn ${f.h2 ? 'active' : ''}" @click="${() => setHeading(2)}"
          title="Heading 2">H2</button>
        <button class="tbtn ${f.h3 ? 'active' : ''}" @click="${() => setHeading(3)}"
          title="Heading 3">H3</button>

        <div class="sep"></div>

        <button class="tbtn ${f.bulletList  ? 'active' : ''}" @click="${toggleBulletList}"
          title="Bullet list">• —</button>
        <button class="tbtn ${f.orderedList ? 'active' : ''}" @click="${toggleOrderedList}"
          title="Numbered list">1.</button>

        <div class="sep"></div>

        <button class="tbtn" ?disabled="${!f.canUndo}" @click="${undo}"  title="Undo (Ctrl+Z)">↩</button>
        <button class="tbtn" ?disabled="${!f.canRedo}" @click="${redo}"  title="Redo (Ctrl+Y)">↪</button>

        <div class="sep push"></div>

        <button class="tbtn" @click="${this._export}" title="Export LaTeX (.tex)">
          Export .tex
        </button>
        <div class="sep"></div>
        <button class="tbtn" @click="${this._toggleTheme}" title="Toggle dark mode"
          style="font-size:16px; min-width:32px">
          ${this._isDark ? '☀' : '☾'}
        </button>

      </div>

      <!-- Row 2: math + theorem environments -->
      <div id="toolbar-row-2" class="toolbar-row">

        <button class="tbtn math" @click="${() => insertNewFormula('', false)}"
          title="Insert inline formula ($)">$ inline</button>
        <button class="tbtn math" @click="${() => insertNewFormula('', true)}"
          title="Insert display formula ($$)">$$ display</button>

        <div class="sep"></div>

        <button class="tbtn" @click="${() => insertTheoremEnv('theorem')}"
          title="Insert Theorem" style="color: var(--thm-theorem)">Thm</button>
        <button class="tbtn" @click="${() => insertTheoremEnv('definition')}"
          title="Insert Definition" style="color: var(--thm-definition)">Def</button>
        <button class="tbtn" @click="${() => insertTheoremEnv('example')}"
          title="Insert Example" style="color: var(--thm-example)">Ex</button>
        <button class="tbtn" @click="${() => insertTheoremEnv('remark')}"
          title="Insert Remark" style="color: var(--thm-remark)">Rmk</button>
        <button class="tbtn" @click="${() => insertTheoremEnv('lemma')}"
          title="Insert Lemma" style="color: var(--thm-lemma)">Lem</button>
        <button class="tbtn" @click="${() => insertTheoremEnv('proof')}"
          title="Insert Proof" style="color: var(--thm-proof)">Proof</button>

        <div class="sep push"></div>

        <button class="tbtn" @click="${loadExample}"
          title="Cargar documento de ejemplo con todos los elementos">
          Ejemplo
        </button>
        <button class="tbtn" @click="${this._confirmClear}"
          title="Borrar todo el contenido del documento"
          style="color: var(--error)">
          Limpiar
        </button>

      </div>
    `
  }

  // ── Handlers (arrow class fields so `this` is always the component) ──

  private _export = () => {
    window.dispatchEvent(new CustomEvent('formalia:export'))
  }

  private _toggleTheme = () => {
    this._isDark = !this._isDark
    this._applyTheme(this._isDark)
    storage.saveTheme(this._isDark)
  }

  private _confirmClear = () => {
    if (confirm('¿Borrar todo el contenido del documento?')) {
      clearDocument()
    }
  }

  private _applyTheme(dark: boolean) {
    document.body.classList.toggle('dark', dark)
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-toolbar': Toolbar }
}
