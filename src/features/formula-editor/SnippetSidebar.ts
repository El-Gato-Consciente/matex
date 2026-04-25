import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import katex from 'katex'
import {
  activeNodePos, activeMathInputText, insertNewFormulaAndActivate,
  insertIntoActiveMathInput,
} from '@core/editor/EditorStore'
import {
  BUILTIN_SNIPPETS, userSnippets, favorites, recentlyUsed,
  getFavoriteSnippets, getRecentSnippets, toggleFavorite, recordUsage,
  toMathLiveLatex, CATS,
  type AnySnippet,
} from './SnippetStore'
import { SnippetManager } from './SnippetManager'
import { backslashQuery, backslashSelectedIdx, insertFromBackslash, updateBackslashNav } from './BackslashState'

const CLASSIC_IDS = [
  'frac/fraccion',
  'frac/raiz-cuad',
  'frac/potencia',
  'calc/int-def',
  'calc/suma',
  'calc/prod',
  'calc/limite',
  'calc/parcial',
  'alg/mat2',
  'frac/paren',
]

const CLASSICS: AnySnippet[] = CLASSIC_IDS
  .map(id => BUILTIN_SNIPPETS.find(s => s.id === id))
  .filter((s): s is NonNullable<typeof s> => s != null)

/* ─────────────────────────────────────────────────────────────────
   SnippetSidebar — Phase 5 redesign
   Visual icon grid for quick insertion.
   Management via SnippetManager popup.
   ───────────────────────────────────────────────────────────────── */

const SB_KEY = 'formalia:sidebar:collapsed'

function renderKatexIcon(latex: string, fallback?: string): string {
  // Replace placeholders with □ so the structure is visible (empty args render as blank)
  const display = toMathLiveLatex(latex).replace(/#[@?]/g, '\\square')
  try {
    return katex.renderToString(display, { displayMode: false, throwOnError: true, trust: false })
  } catch {
    return `<span class="sb-icon-text">${fallback ?? latex.slice(0, 6)}</span>`
  }
}

function insertSnippet(s: AnySnippet): void {
  recordUsage(s.id)
  const latex = s.latex
  const ml    = toMathLiveLatex(latex)

  if (insertIntoActiveMathInput(ml.replace(/#[@?]/g, ''))) return

  const mf = document.querySelector<any>('fp-floating-formula math-field:not(.ff-hidden)')
  if (mf) { mf.insert(ml); mf.focus(); return }

  const ta = document.querySelector<HTMLTextAreaElement>(
    'fp-floating-formula .ff-textarea:not(.ff-hidden)'
  )
  if (ta) {
    const clean = ml.replace(/#[@?]/g, '')
    const s2 = ta.selectionStart, e = ta.selectionEnd
    ta.value = ta.value.substring(0, s2) + clean + ta.value.substring(e)
    ta.selectionStart = ta.selectionEnd = s2 + clean.length
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    ta.focus()
    return
  }

  // Not in any math editor → create new inline formula
  const clean = toMathLiveLatex(latex).replace(/#[@?]/g, '')
  insertNewFormulaAndActivate(clean, false)
}

// ── Component ─────────────────────────────────────────────────────

@customElement('fp-snippet-sidebar')
export class SnippetSidebar extends LitElement {

  @state() private _collapsed     = localStorage.getItem(SB_KEY) === '1'
  @state() private _search        = ''
  @state() private _activeCat     = 'favs'
  @state() private _formulaActive = false
  @state() private _insituActive  = false
  @state() private _favIds        = new Set<string>()
  @state() private _recentLen     = 0
  @state() private _bsQuery: string | null = null
  @state() private _bsSelected = -1

  // Current items shown in backslash mode — kept in sync so updated() can register them
  private _bsItems: AnySnippet[] = []

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this.parentElement?.classList.toggle('collapsed', this._collapsed)
    this.addEventListener('mousedown', (e) => this._onMousedown(e as MouseEvent))

    this._disposes.push(
      effect(() => { this._formulaActive = activeNodePos.value !== null }),
      effect(() => { this._insituActive  = activeMathInputText.value !== null }),
      effect(() => { this._favIds = new Set(favorites.value) }),
      effect(() => { this._recentLen = recentlyUsed.value.length }),
      effect(() => { userSnippets.value; this.requestUpdate() }),
      effect(() => { this._bsQuery    = backslashQuery.value }),
      effect(() => { this._bsSelected = backslashSelectedIdx.value }),
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  private _toggle() {
    this._collapsed = !this._collapsed
    localStorage.setItem(SB_KEY, this._collapsed ? '1' : '0')
    this.parentElement?.classList.toggle('collapsed', this._collapsed)
  }

  private _onSnipClick(s: AnySnippet) {
    if (this._bsQuery !== null) {
      insertFromBackslash(s)
    } else {
      insertSnippet(s)
    }
  }

  private _onMousedown(e: MouseEvent) {
    if (this._insituActive || this._formulaActive) e.preventDefault()
  }

  override updated() {
    if (this._bsQuery !== null) {
      const items = this._bsItems
      const sel   = this._bsSelected
      updateBackslashNav(items.length, () => {
        const item = items[sel]
        if (item) this._onSnipClick(item)
      })
      // Scroll selected item into view
      if (sel >= 0) {
        this.querySelectorAll<HTMLElement>('.sb-icon-wrap')[sel]
          ?.scrollIntoView({ block: 'nearest' })
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────

  override render() {
    return this._collapsed ? this._renderCollapsed() : this._renderExpanded()
  }

  private _renderCollapsed() {
    const bsActive = this._bsQuery !== null

    if (bsActive) {
      const results = ([...BUILTIN_SNIPPETS, ...userSnippets.value] as AnySnippet[])
        .filter(s => {
          const label = s.kind === 'builtin' ? s.label : s.name
          const q = this._bsQuery!.toLowerCase()
          return label.toLowerCase().includes(q) || s.latex.toLowerCase().includes(q)
        })
        .slice(0, 10)
      this._bsItems = results

      return html`
        <div class="sb-header">
          <button class="sb-toggle" title="Expandir panel" @click="${this._toggle}">‹</button>
        </div>
        <div class="sb-col-label sb-col-label--bs">\\</div>
        <div class="sb-col">
          ${results.length > 0
            ? results.map((s, i) => this._renderIconBtn(s, true, i))
            : html`<span class="sb-col-empty">–</span>`
          }
        </div>
        <div class="sb-col-sep"></div>
        <button class="sb-manage-collapsed"
          title="Gestionar snippets"
          @mousedown="${(e: Event) => e.preventDefault()}"
          @click="${() => SnippetManager.open()}">⚙</button>
      `
    }

    const favSnips    = getFavoriteSnippets().slice(0, 8)
    const recentSnips = getRecentSnippets().filter(s => !this._favIds.has(s.id)).slice(0, 6)
    // classics filtered to exclude what's already in favs/recents
    const shownIds    = new Set([...favSnips, ...recentSnips].map(s => s.id))
    const classics    = CLASSICS.filter(s => !shownIds.has(s.id))

    return html`
      <div class="sb-header">
        <button class="sb-toggle" title="Expandir panel" @click="${this._toggle}">‹</button>
      </div>

      ${favSnips.length > 0 ? html`
        <div class="sb-col-label">★</div>
        <div class="sb-col">
          ${favSnips.map(s => this._renderIconBtn(s, true))}
        </div>
      ` : ''}

      ${recentSnips.length > 0 ? html`
        <div class="sb-col-sep"></div>
        <div class="sb-col-label">↑</div>
        <div class="sb-col">
          ${recentSnips.map(s => this._renderIconBtn(s, true))}
        </div>
      ` : ''}

      ${classics.length > 0 ? html`
        <div class="sb-col-sep"></div>
        <div class="sb-col-label">∫</div>
        <div class="sb-col">
          ${classics.map(s => this._renderIconBtn(s, true))}
        </div>
      ` : ''}

      <div class="sb-col-sep"></div>
      <button class="sb-manage-collapsed"
        title="Gestionar snippets"
        @mousedown="${(e: Event) => e.preventDefault()}"
        @click="${() => SnippetManager.open()}">⚙</button>
    `
  }

  private _getFiltered(): AnySnippet[] {
    const q = (this._bsQuery ?? this._search).trim().toLowerCase()
    if (q) {
      return ([...BUILTIN_SNIPPETS, ...userSnippets.value] as AnySnippet[]).filter(s => {
        const label = s.kind === 'builtin' ? s.label : s.name
        return label.toLowerCase().includes(q) || s.latex.toLowerCase().includes(q)
      })
    }
    switch (this._activeCat) {
      case 'favs': return getFavoriteSnippets()
      case 'top':  return getRecentSnippets()
      case 'user': return [...userSnippets.value]
      default:     return BUILTIN_SNIPPETS.filter(s => s.cat === this._activeCat)
    }
  }

  private _renderExpanded() {
    const bsActive  = this._bsQuery !== null
    const q         = bsActive ? this._bsQuery! : this._search.trim().toLowerCase()
    const searching = !bsActive && q.length > 0
    const filtered  = this._getFiltered()
    if (bsActive) this._bsItems = filtered

    const SB_CATS = [
      { id: 'favs', label: '★ Favs'                                             },
      { id: 'top',  label: `↑ Usados${this._recentLen > 0 ? ` (${this._recentLen})` : ''}` },
      ...CATS,
    ]

    return html`
      <div class="sb-header">
        <span class="sb-header-title">Snippets</span>
        <div class="sb-header-actions">
          <button class="sb-manage-btn"
            title="Gestionar snippets"
            @mousedown="${(e: Event) => e.preventDefault()}"
            @click="${() => SnippetManager.open()}">⚙</button>
          <button class="sb-toggle" title="Colapsar" @click="${this._toggle}">›</button>
        </div>
      </div>

      <!-- Búsqueda -->
      <div class="sb-search-row">
        <input class="sb-search" type="text" placeholder="Buscar snippet…"
          .value="${this._search}"
          ?disabled="${bsActive}"
          @input="${(e: Event) => { this._search = (e.target as HTMLInputElement).value }}" />
        ${searching ? html`
          <button class="sb-search-clear"
            @mousedown="${(e: Event) => e.preventDefault()}"
            @click="${() => { this._search = '' }}">×</button>
        ` : ''}
      </div>

      <!-- Indicador de modo backslash -->
      ${bsActive ? html`
        <div class="sb-bs-indicator">\\${this._bsQuery}</div>
      ` : ''}

      <!-- Categorías (siempre visibles, desactivadas durante búsqueda o backslash) -->
      <div class="sb-cats">
        ${SB_CATS.map(c => html`
          <button
            class="sb-cat${!searching && !bsActive && this._activeCat === c.id ? ' active' : ''}${searching || bsActive ? ' sb-cat--dim' : ''}"
            data-cat="${c.id}"
            ?disabled="${searching || bsActive}"
            @click="${() => { this._activeCat = c.id }}">
            ${c.label}
          </button>
        `)}
      </div>

      <!-- Grid principal (scroll) -->
      <div class="sb-grid sb-grid--cat">
        ${searching ? html`<p class="sb-empty sb-empty--search">Buscando en todos los snippets</p>` : ''}
        ${bsActive && filtered.length === 0 ? html`<p class="sb-empty">Sin resultados para \\${this._bsQuery}</p>` : ''}
        ${!bsActive && filtered.length === 0
          ? html`<p class="sb-empty">${
              this._activeCat === 'favs' ? 'Sin favoritos aún. Marcá snippets con ★.' :
              this._activeCat === 'top'  ? 'Todavía no usaste ningún snippet.' :
              this._activeCat === 'user' ? 'Ningún snippet personal. Creá uno desde ⚙.' :
              'Sin snippets.'
            }</p>`
          : filtered.map((s, i) => this._renderIconBtn(s, false, bsActive ? i : -1))
        }
      </div>
    `
  }

  private _renderIconBtn(s: AnySnippet, compact: boolean, bsIdx = -1) {
    const label     = s.kind === 'builtin' ? s.label : s.name
    const isFav     = this._favIds.has(s.id)
    const iconHtml  = renderKatexIcon(s.latex)
    const isKbFocus = bsIdx >= 0 && this._bsSelected === bsIdx

    return html`
      <div class="sb-icon-wrap${compact ? ' sb-icon-wrap--sm' : ''}${isKbFocus ? ' sb-icon-wrap--focus' : ''}">
        <button
          class="sb-icon-btn"
          title="${label}"
          @mousedown="${(e: Event) => e.preventDefault()}"
          @click="${() => this._onSnipClick(s)}">
          <span class="sb-icon-preview" .innerHTML="${iconHtml}"></span>
          <span class="sb-icon-label">${label}</span>
        </button>
        <button
          class="sb-icon-fav${isFav ? ' is-fav' : ''}"
          title="${isFav ? 'Quitar favorito' : 'Agregar a favoritos'}"
          @mousedown="${(e: Event) => e.preventDefault()}"
          @click="${() => toggleFavorite(s.id)}">
          ${isFav ? '★' : '☆'}
        </button>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-snippet-sidebar': SnippetSidebar }
}
