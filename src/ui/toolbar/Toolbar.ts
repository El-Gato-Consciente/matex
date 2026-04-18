import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import {
  editorFmtState,
  toggleBold, toggleItalic, toggleCode,
  setHeading, toggleBulletList, toggleOrderedList,
  undo, redo,
  insertNewFormulaAndActivate, insertTheoremEnv,
  loadExample, clearDocument,
} from '@core/editor/EditorStore'
import { LocalStorageAdapter } from '@features/documents/LocalStorageAdapter'

/* ─────────────────────────────────────────────────────────────────
   Toolbar — single minimal row with collapsible groups.
   Heading types and theorem environments collapse into dropdowns
   to maximise canvas space.
   ───────────────────────────────────────────────────────────────── */

const storage = new LocalStorageAdapter()

@customElement('fp-toolbar')
export class Toolbar extends LitElement {

  @state() private _fmt            = editorFmtState.value
  @state() private _isDark         = storage.loadTheme() === 'dark'
  @state() private _openDropdown: string | null = null

  private _disposes: (() => void)[] = []
  private _closeHandler: (e: Event) => void = () => {}

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this._disposes.push(
      effect(() => {
        this._fmt = editorFmtState.value
        this.requestUpdate()
      })
    )
    this._applyTheme(this._isDark)

    // Close any open dropdown when clicking outside the toolbar
    this._closeHandler = (e: Event) => {
      if (this._openDropdown && !this.contains(e.target as Node)) {
        this._openDropdown = null
      }
    }
    document.addEventListener('click', this._closeHandler)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
    document.removeEventListener('click', this._closeHandler)
  }

  // ── Render ──────────────────────────────────────────────────────

  override render() {
    const f = this._fmt
    const hActive = f.h1 || f.h2 || f.h3
    const hLabel  = f.h1 ? 'H1' : f.h2 ? 'H2' : f.h3 ? 'H3' : 'H'

    return html`
      <div id="toolbar-row-1" class="toolbar-row">

        <!-- Text format -->
        <button class="tbtn ${f.bold   ? 'active':''}" @click="${toggleBold}"   title="Bold (Ctrl+B)"><b>B</b></button>
        <button class="tbtn ${f.italic ? 'active':''}" @click="${toggleItalic}" title="Italic (Ctrl+I)"><em>I</em></button>
        <button class="tbtn ${f.code   ? 'active':''}" @click="${toggleCode}"   title="Inline code"><code style="font-size:11px">{}</code></button>

        <div class="sep"></div>

        <!-- Headings dropdown -->
        <div class="tbtn-drop">
          <button class="tbtn ${hActive ? 'active':''}"
            @click="${(e: Event) => this._toggleDropdown('heading', e)}"
            title="Headings">${hLabel} ▾</button>
          ${this._openDropdown === 'heading' ? html`
            <div class="tbtn-menu">
              <button class="tbtn ${f.h1 ? 'active':''}" @click="${() => { setHeading(1); this._openDropdown = null }}">H1</button>
              <button class="tbtn ${f.h2 ? 'active':''}" @click="${() => { setHeading(2); this._openDropdown = null }}">H2</button>
              <button class="tbtn ${f.h3 ? 'active':''}" @click="${() => { setHeading(3); this._openDropdown = null }}">H3</button>
            </div>
          ` : ''}
        </div>

        <div class="sep"></div>

        <!-- Lists -->
        <button class="tbtn ${f.bulletList  ? 'active':''}" @click="${toggleBulletList}"  title="Bullet list">• —</button>
        <button class="tbtn ${f.orderedList ? 'active':''}" @click="${toggleOrderedList}" title="Numbered list">1.</button>

        <div class="sep"></div>

        <!-- Undo / redo -->
        <button class="tbtn" ?disabled="${!f.canUndo}" @click="${undo}" title="Undo (Ctrl+Z)">↩</button>
        <button class="tbtn" ?disabled="${!f.canRedo}" @click="${redo}" title="Redo (Ctrl+Y)">↪</button>

        <div class="sep"></div>

        <!-- Math insert -->
        <button class="tbtn math" @click="${() => insertNewFormulaAndActivate('', false)}"
          title="Insert inline formula (Ctrl+M)">$ inline</button>
        <button class="tbtn math" @click="${() => insertNewFormulaAndActivate('', true)}"
          title="Insert display formula (Ctrl+Shift+M)">$$ display</button>

        <div class="sep"></div>

        <!-- Theorem environments dropdown -->
        <div class="tbtn-drop">
          <button class="tbtn"
            @click="${(e: Event) => this._toggleDropdown('env', e)}"
            title="Theorem environments">Env ▾</button>
          ${this._openDropdown === 'env' ? html`
            <div class="tbtn-menu">
              <button class="tbtn" style="color:var(--thm-theorem)"     @click="${() => { insertTheoremEnv('theorem');     this._openDropdown = null }}">Thm</button>
              <button class="tbtn" style="color:var(--thm-definition)"  @click="${() => { insertTheoremEnv('definition');  this._openDropdown = null }}">Def</button>
              <button class="tbtn" style="color:var(--thm-lemma)"       @click="${() => { insertTheoremEnv('lemma');       this._openDropdown = null }}">Lem</button>
              <button class="tbtn" style="color:var(--thm-proposition)" @click="${() => { insertTheoremEnv('proposition'); this._openDropdown = null }}">Prop</button>
              <button class="tbtn" style="color:var(--thm-corollary)"   @click="${() => { insertTheoremEnv('corollary');   this._openDropdown = null }}">Cor</button>
              <button class="tbtn" style="color:var(--thm-example)"     @click="${() => { insertTheoremEnv('example');     this._openDropdown = null }}">Ex</button>
              <button class="tbtn" style="color:var(--thm-exercise)"    @click="${() => { insertTheoremEnv('exercise');    this._openDropdown = null }}">Exr</button>
              <button class="tbtn" style="color:var(--thm-remark)"      @click="${() => { insertTheoremEnv('remark');      this._openDropdown = null }}">Rmk</button>
              <button class="tbtn" style="color:var(--thm-note)"        @click="${() => { insertTheoremEnv('note');        this._openDropdown = null }}">Note</button>
              <button class="tbtn" style="color:var(--thm-proof)"       @click="${() => { insertTheoremEnv('proof');       this._openDropdown = null }}">Proof</button>
            </div>
          ` : ''}
        </div>

        <!-- Push right -->
        <div class="sep push"></div>

        <button class="tbtn" @click="${loadExample}" title="Load example document">Ejemplo</button>
        <button class="tbtn" @click="${this._confirmClear}" title="Clear document" style="color:var(--error)">Limpiar</button>
        <div class="sep"></div>
        <button class="tbtn" @click="${this._export}" title="Export LaTeX (.tex)">Export .tex</button>
        <div class="sep"></div>
        <button class="tbtn" @click="${this._toggleTheme}" title="Toggle dark mode"
          style="font-size:16px; min-width:32px">${this._isDark ? '☀' : '☾'}</button>

      </div>
    `
  }

  // ── Handlers ────────────────────────────────────────────────────

  private _toggleDropdown = (name: string, e: Event) => {
    e.stopPropagation()
    this._openDropdown = this._openDropdown === name ? null : name
  }

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
