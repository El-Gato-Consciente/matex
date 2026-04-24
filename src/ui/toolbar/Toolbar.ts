import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import {
  editorFmtState,
  toggleBold, toggleItalic, toggleCode,
  setHeading, toggleBulletList, toggleOrderedList,
  undo, redo,
  insertTheoremEnv,
  loadExample, clearDocument,
} from '@core/editor/EditorStore'
import { LocalStorageAdapter } from '@features/documents/LocalStorageAdapter'

/* ─────────────────────────────────────────────────────────────────
   Toolbar — single minimal row with collapsible groups.
   Heading types and theorem environments collapse into dropdowns
   to maximise canvas space.
   ───────────────────────────────────────────────────────────────── */

const storage = new LocalStorageAdapter()

const ZOOM_KEY   = 'formalia:zoom'
const ZOOM_MIN   = 0.5
const ZOOM_MAX   = 2.0
const ZOOM_STEP  = 0.1
const ZOOM_DEF   = 1.0

function loadZoom(): number {
  const v = parseFloat(localStorage.getItem(ZOOM_KEY) ?? '')
  return isNaN(v) ? ZOOM_DEF : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v))
}

@customElement('fp-toolbar')
export class Toolbar extends LitElement {

  @state() private _fmt            = editorFmtState.value
  @state() private _isDark         = storage.loadTheme() === 'dark'
  @state() private _highlight      = storage.loadHighlight()
  @state() private _thmStyle       = storage.loadThmStyle()
  @state() private _openDropdown: string | null = null
  @state() private _zoom           = loadZoom()

  private _disposes: (() => void)[] = []
  private _closeHandler: (e: Event) => void = () => {}
  private _keyHandler:   (e: KeyboardEvent) => void = () => {}

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
    this._applyHighlight(this._highlight)
    this._applyThmStyle(this._thmStyle)
    this._applyZoom(this._zoom)

    this._closeHandler = (e: Event) => {
      if (this._openDropdown && !this.contains(e.target as Node)) {
        this._openDropdown = null
      }
    }
    document.addEventListener('click', this._closeHandler)

    this._keyHandler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === '=' || e.key === '+') { e.preventDefault(); this._zoomIn() }
      if (e.key === '-')                  { e.preventDefault(); this._zoomOut() }
      if (e.key === '0')                  { e.preventDefault(); this._zoomReset() }
    }
    document.addEventListener('keydown', this._keyHandler)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
    document.removeEventListener('click', this._closeHandler)
    document.removeEventListener('keydown', this._keyHandler)
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

        <!-- Lists dropdown -->
        <div class="tbtn-drop">
          <button class="tbtn ${f.bulletList || f.orderedList ? 'active':''}"
            @click="${(e: Event) => this._toggleDropdown('list', e)}"
            title="Listas">≡ ▾</button>
          ${this._openDropdown === 'list' ? html`
            <div class="tbtn-menu">
              <button class="tbtn ${f.bulletList  ? 'active':''}" @click="${() => { toggleBulletList();  this._openDropdown = null }}" title="Lista con viñetas">• Lista</button>
              <button class="tbtn ${f.orderedList ? 'active':''}" @click="${() => { toggleOrderedList(); this._openDropdown = null }}" title="Lista numerada">1. Numerada</button>
            </div>
          ` : ''}
        </div>

        <div class="sep"></div>

        <!-- Undo / redo -->
        <button class="tbtn" ?disabled="${!f.canUndo}" @click="${undo}" title="Undo (Ctrl+Z)">↩</button>
        <button class="tbtn" ?disabled="${!f.canRedo}" @click="${redo}" title="Redo (Ctrl+Y)">↪</button>

        <div class="sep"></div>

        <!-- Theorem environments dropdown -->
        <div class="tbtn-drop">
          <button class="tbtn"
            @click="${(e: Event) => this._toggleDropdown('env', e)}"
            title="Theorem environments">Env ▾</button>
          ${this._openDropdown === 'env' ? html`
            <div class="tbtn-menu tbtn-menu--env">
              ${([
                { env: 'theorem',     label: 'Teorema',      color: 'var(--thm-theorem)',     kbd: '/thm'   },
                { env: 'definition',  label: 'Definición',   color: 'var(--thm-definition)',  kbd: '/def'   },
                { env: 'lemma',       label: 'Lema',         color: 'var(--thm-lemma)',       kbd: '/lem'   },
                { env: 'proposition', label: 'Proposición',  color: 'var(--thm-proposition)', kbd: '/prop'  },
                { env: 'corollary',   label: 'Corolario',    color: 'var(--thm-corollary)',   kbd: '/cor'   },
                { env: 'example',     label: 'Ejemplo',      color: 'var(--thm-example)',     kbd: '/ex'    },
                { env: 'exercise',    label: 'Ejercicio',    color: 'var(--thm-exercise)',    kbd: '/exr'   },
                { env: 'remark',      label: 'Observación',  color: 'var(--thm-remark)',      kbd: '/rmk'   },
                { env: 'note',        label: 'Nota',         color: 'var(--thm-note)',        kbd: '/note'  },
                { env: 'proof',       label: 'Demostración', color: 'var(--thm-proof)',       kbd: '/proof' },
              ] as const).map(({ env, label, color, kbd }) => html`
                <button class="tbtn env-row" @click="${() => { insertTheoremEnv(env); this._openDropdown = null }}">
                  <span class="env-label" style="color:${color}">${label}</span>
                  <kbd class="lm-kbd">${kbd}</kbd>
                </button>
              `)}
            </div>
          ` : ''}
        </div>

        <!-- Push right -->
        <div class="sep push"></div>

        <!-- Zoom -->
        <button class="tbtn" ?disabled="${this._zoom <= ZOOM_MIN}" @click="${this._zoomOut}" title="Zoom out (Ctrl+−)">−</button>
        <button class="tbtn zoom-label" @click="${this._zoomReset}" title="Restablecer zoom (Ctrl+0)">${Math.round(this._zoom * 100)}%</button>
        <button class="tbtn" ?disabled="${this._zoom >= ZOOM_MAX}" @click="${this._zoomIn}"  title="Zoom in (Ctrl+=)">+</button>

        <div class="sep"></div>

        <!-- Archivo dropdown -->
        <div class="tbtn-drop">
          <button class="tbtn"
            @click="${(e: Event) => this._toggleDropdown('archivo', e)}"
            title="Archivo">Archivo ▾</button>
          ${this._openDropdown === 'archivo' ? html`
            <div class="tbtn-menu" style="right:0;left:auto;min-width:160px">
              <button class="tbtn" @click="${() => { this._newDocument();   this._openDropdown = null }}">Nuevo</button>
              <button class="tbtn" @click="${() => { loadExample();         this._openDropdown = null }}">Cargar ejemplo</button>
              <div class="tbtn-menu-sep"></div>
              <button class="tbtn" @click="${() => { this._export();        this._openDropdown = null }}">Exportar .tex</button>
              <div class="tbtn-menu-sep"></div>
              <button class="tbtn" style="color:var(--error)" @click="${() => { this._confirmClear(); this._openDropdown = null }}">Limpiar</button>
            </div>
          ` : ''}
        </div>
        <div class="sep"></div>
        <!-- Appearance dropdown -->
        <div class="tbtn-drop">
          <button class="tbtn" title="Apariencia"
            @click="${(e: Event) => this._toggleDropdown('appearance', e)}">Ap ▾</button>
          ${this._openDropdown === 'appearance' ? html`
            <div class="tbtn-menu" style="right:0;left:auto;min-width:180px">
              <button class="tbtn" @click="${this._cycleHighlight}"
                style="color:#4f46e5">
                ${{ strong: '●', soft: '◎', none: '○' }[this._highlight]}
                Fórmulas: ${{ strong: 'fuerte', soft: 'suave', none: 'sin resaltado' }[this._highlight]}
              </button>
              <button class="tbtn" @click="${this._cycleThmStyle}"
                style="color:#059669">
                ${{ strong: '●', soft: '◎', none: '○' }[this._thmStyle]}
                Entornos: ${{ strong: 'caja', soft: 'suave', none: 'solo barra' }[this._thmStyle]}
              </button>
              <button class="tbtn" @click="${this._toggleTheme}">
                ${this._isDark ? '☀ Modo claro' : '☾ Modo oscuro'}
              </button>
            </div>
          ` : ''}
        </div>

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

  private _newDocument = () => {
    window.dispatchEvent(new CustomEvent('formalia:new'))
  }

  private _toggleTheme = () => {
    this._isDark = !this._isDark
    this._applyTheme(this._isDark)
    storage.saveTheme(this._isDark)
  }

  private _cycleHighlight = () => {
    const next = this._highlight === 'strong' ? 'soft' : this._highlight === 'soft' ? 'none' : 'strong'
    this._highlight = next
    this._applyHighlight(next)
    storage.saveHighlight(next)
  }

  private _cycleThmStyle = () => {
    const next = this._thmStyle === 'strong' ? 'soft' : this._thmStyle === 'soft' ? 'none' : 'strong'
    this._thmStyle = next
    this._applyThmStyle(next)
    storage.saveThmStyle(next)
  }

  private _confirmClear = () => {
    if (confirm('¿Borrar todo el contenido del documento?')) {
      clearDocument()
    }
  }

  private _zoomIn = () => {
    this._setZoom(Math.min(ZOOM_MAX, parseFloat((this._zoom + ZOOM_STEP).toFixed(1))))
  }
  private _zoomOut = () => {
    this._setZoom(Math.max(ZOOM_MIN, parseFloat((this._zoom - ZOOM_STEP).toFixed(1))))
  }
  private _zoomReset = () => { this._setZoom(ZOOM_DEF) }

  private _setZoom(z: number) {
    this._zoom = z
    localStorage.setItem(ZOOM_KEY, String(z))
    this._applyZoom(z)
  }

  private _applyZoom(z: number) {
    const el = document.getElementById('editor')
    if (el) (el.style as any).zoom = String(z)
  }

  private _applyTheme(dark: boolean) {
    document.body.classList.toggle('dark', dark)
  }

  private _applyHighlight(mode: 'strong' | 'soft' | 'none') {
    document.body.classList.toggle('highlight-soft', mode === 'soft')
    document.body.classList.toggle('highlight-none', mode === 'none')
  }

  private _applyThmStyle(mode: 'strong' | 'soft' | 'none') {
    document.body.classList.toggle('thm-soft', mode === 'soft')
    document.body.classList.toggle('thm-none', mode === 'none')
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-toolbar': Toolbar }
}
