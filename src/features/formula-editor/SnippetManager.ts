import katex from 'katex'
import { effect } from '@preact/signals-core'
import {
  BUILTIN_SNIPPETS, userSnippets, favorites, recentlyUsed,
  toggleFavorite, createSnippet, updateSnippet, deleteSnippet, forkSnippet,
  toMathLiveLatex, CATS,
  type AnySnippet, type UserSnippet,
} from './SnippetStore'

/* ─────────────────────────────────────────────────────────────────
   SnippetManager — large popup for browsing, managing, and
   editing all snippets (built-in + user).
   ───────────────────────────────────────────────────────────────── */

function renderKatex(latex: string): string {
  const display = toMathLiveLatex(latex).replace(/#[@?]/g, '\\square')
  try {
    return katex.renderToString(display, { displayMode: true, throwOnError: true, trust: false })
  } catch {
    return `<span class="sm-tex-err">${latex.slice(0, 60)}</span>`
  }
}

export class SnippetManager {
  private _backdrop: HTMLDivElement
  private _el: HTMLDivElement
  private _disposes: (() => void)[] = []

  // State
  private _search   = ''
  private _activeCat = 'all'
  private _selected: AnySnippet | null = null
  private _editing  = false          // right panel in edit mode
  private _editName = ''
  private _editLatex = ''
  private _editTags  = ''
  private _editError = ''

  constructor() {
    this._backdrop = document.createElement('div')
    this._backdrop.className = 'sm-backdrop'
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this.close()
    })

    this._el = document.createElement('div')
    this._el.className = 'sm-popup'
    this._backdrop.appendChild(this._el)
    document.body.appendChild(this._backdrop)

    this._render()

    // Re-render on store changes
    this._disposes.push(
      effect(() => { userSnippets.value; this._render() }),
      effect(() => { favorites.value;    this._render() }),
      effect(() => { recentlyUsed.value; this._render() }),
    )

    // Close on Escape
    this._onKey = this._onKey.bind(this)
    document.addEventListener('keydown', this._onKey)
  }

  private _onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close()
  }

  close() {
    this._disposes.forEach(d => d())
    document.removeEventListener('keydown', this._onKey)
    this._backdrop.remove()
  }

  static open(): SnippetManager {
    return new SnippetManager()
  }

  // ── Render ───────────────────────────────────────────────────────

  private _render() {
    const q          = this._search.trim().toLowerCase()
    const searching  = q.length > 0
    const isUserTab  = this._activeCat === 'user'
    const isAllTab   = this._activeCat === 'all'

    const allItems: AnySnippet[] = [...BUILTIN_SNIPPETS, ...userSnippets.value]
    const filtered: AnySnippet[] = searching
      ? allItems.filter(s => {
          const label = s.kind === 'builtin' ? s.label : s.name
          return label.toLowerCase().includes(q) || s.latex.toLowerCase().includes(q)
        })
      : isAllTab   ? allItems
      : isUserTab  ? [...userSnippets.value]
      : BUILTIN_SNIPPETS.filter(s => s.cat === this._activeCat)

    const favSet = favorites.value

    this._el.innerHTML = `
      <div class="sm-header">
        <span class="sm-title">Snippets LaTeX</span>
        <button class="sm-close">✕</button>
      </div>
      <div class="sm-body">
        <div class="sm-left">
          <div class="sm-search-row">
            <input class="sm-search" type="text" placeholder="Buscar en todos los snippets…"
              value="${this._escape(this._search)}" />
            ${searching ? `<button class="sm-search-clear">×</button>` : ''}
          </div>
          <div class="sm-cats">
            ${[{ id: 'all', label: 'Todos' }, ...CATS].map(c => `
              <button class="sm-cat${this._activeCat === c.id ? ' active' : ''}" data-cat="${c.id}">
                ${c.label}
              </button>
            `).join('')}
          </div>
          <div class="sm-list">
            ${isUserTab ? `<button class="sm-new-btn">+ Nuevo snippet</button>` : ''}
            ${filtered.length === 0
              ? `<p class="sm-empty">${searching ? 'Sin resultados.' : isUserTab ? 'Ningún snippet personal aún.' : 'Sin resultados.'}</p>`
              : filtered.map(s => this._renderRow(s, favSet)).join('')
            }
          </div>
        </div>
        <div class="sm-right">
          ${this._editing
            ? this._renderDetail(this._selected, favSet)
            : this._selected
              ? this._renderDetail(this._selected, favSet)
              : this._renderPlaceholder()}
        </div>
      </div>
    `

    this._bindEvents()
  }

  private _renderRow(s: AnySnippet, favSet: Set<string>): string {
    const id    = s.id
    const label = s.kind === 'builtin' ? s.label : s.name
    const isFav = favSet.has(id)
    const isSelected = this._selected?.id === id
    return `
      <div class="sm-row${isSelected ? ' sm-row--sel' : ''}" data-id="${id}">
        <div class="sm-row-info">
          <span class="sm-row-label">${this._escape(label)}</span>
          ${s.kind === 'builtin' ? `<span class="sm-row-cat">${s.cat}</span>` : `<span class="sm-row-cat sm-row-cat--user">mío</span>`}
        </div>
        <div class="sm-row-actions">
          <button class="sm-row-fav${isFav ? ' is-fav' : ''}" data-fav="${id}" title="${isFav ? 'Quitar favorito' : 'Favorito'}">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
      </div>
    `
  }

  private _renderDetail(s: AnySnippet | null, favSet: Set<string>): string {
    const label  = s ? (s.kind === 'builtin' ? s.label : s.name) : ''
    const isFav  = s ? favSet.has(s.id) : false
    const isUser = s?.kind === 'user'
    const editTitle = !s ? 'Nuevo snippet' : isUser ? 'Editar snippet' : 'Copiar y editar'

    if (this._editing) {
      return `
        <div class="sm-detail sm-detail--edit">
          <div class="sm-detail-header">
            <span class="sm-detail-title">${editTitle}</span>
          </div>
          <label class="sm-field-label">Nombre
            <input class="sm-field-input" id="sm-edit-name"
              value="${this._escape(this._editName)}" placeholder="Nombre del snippet" />
          </label>
          <label class="sm-field-label">LaTeX
            <span class="sm-field-hint">Usa <code>$1</code> para cursor principal, <code>$2</code>… para tabulaciones</span>
            <textarea class="sm-field-tex" id="sm-edit-latex" rows="4">${this._escape(this._editLatex)}</textarea>
          </label>
          <div class="sm-preview-wrap">
            <div class="sm-preview-label">Vista previa</div>
            <div class="sm-preview" id="sm-preview">${renderKatex(this._editLatex)}</div>
            ${this._editError ? `<span class="sm-preview-err">${this._escape(this._editError)}</span>` : ''}
          </div>
          <label class="sm-field-label">Etiquetas
            <input class="sm-field-input" id="sm-edit-tags"
              value="${this._escape(this._editTags)}" placeholder="calc, mis-favoritos" />
          </label>
          <div class="sm-edit-actions">
            <button class="sm-btn" id="sm-cancel-edit">Cancelar</button>
            <button class="sm-btn sm-btn--primary" id="sm-save-edit">Guardar</button>
          </div>
        </div>
      `
    }

    if (!s) return this._renderPlaceholder()

    return `
      <div class="sm-detail">
        <div class="sm-detail-header">
          <span class="sm-detail-title">${this._escape(label)}</span>
          <button class="sm-detail-fav${isFav ? ' is-fav' : ''}" data-fav="${s.id}">
            ${isFav ? '★ Favorito' : '☆ Favorito'}
          </button>
        </div>
        <div class="sm-detail-preview">${renderKatex(s.latex)}</div>
        <div class="sm-detail-latex"><code>${this._escape(s.latex)}</code></div>
        ${s.kind === 'builtin' ? `<div class="sm-detail-meta">Categoría: <strong>${s.cat}</strong></div>` : ''}
        ${s.kind === 'user' && s.tags.length > 0 ? `
          <div class="sm-detail-meta">Etiquetas: ${s.tags.map(t => `<span class="sm-tag">${this._escape(t)}</span>`).join('')}</div>
        ` : ''}
        <div class="sm-detail-actions">
          ${isUser ? `
            <button class="sm-btn" id="sm-edit-btn">✎ Editar</button>
            <button class="sm-btn sm-btn--danger" id="sm-delete-btn">✕ Eliminar</button>
          ` : `
            <button class="sm-btn" id="sm-fork-btn">⎘ Copiar y editar</button>
          `}
        </div>
      </div>
    `
  }

  private _renderPlaceholder(): string {
    return `
      <div class="sm-placeholder">
        <div class="sm-placeholder-icon">∫</div>
        <p>Seleccioná un snippet para ver sus detalles, editarlo o marcarlo como favorito.</p>
      </div>
    `
  }

  // ── Event binding ─────────────────────────────────────────────────

  private _bindEvents() {
    // Close
    this._el.querySelector('.sm-close')?.addEventListener('click', () => this.close())

    // Search
    const searchInput = this._el.querySelector<HTMLInputElement>('.sm-search')
    searchInput?.addEventListener('input', () => {
      this._search = searchInput.value
      this._render()
    })
    this._el.querySelector('.sm-search-clear')?.addEventListener('click', () => {
      this._search = ''
      this._render()
    })

    // Category tabs
    this._el.querySelectorAll<HTMLButtonElement>('.sm-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeCat = btn.dataset['cat'] ?? 'all'
        this._search = ''
        this._render()
      })
    })

    // New snippet
    this._el.querySelector('#sm-new-btn, .sm-new-btn')?.addEventListener('click', () => {
      this._selected = null
      this._startEdit(null)
    })

    // Row click → select
    this._el.querySelectorAll<HTMLElement>('.sm-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-fav]')) return
        const id = row.dataset['id']
        if (!id) return
        const found = [...BUILTIN_SNIPPETS, ...userSnippets.value].find(s => s.id === id)
        if (!found) return
        this._selected = found
        this._editing  = false
        this._render()
      })
    })

    // Fav toggles (in rows)
    this._el.querySelectorAll<HTMLButtonElement>('[data-fav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = btn.dataset['fav']
        if (id) toggleFavorite(id)
        // render() called by effect
      })
    })

    // Detail actions
    this._el.querySelector('#sm-edit-btn')?.addEventListener('click', () => {
      if (this._selected?.kind === 'user') this._startEdit(this._selected)
    })
    this._el.querySelector('#sm-fork-btn')?.addEventListener('click', () => {
      if (!this._selected) return
      const forked = forkSnippet(this._selected)
      this._selected = forked
      this._startEdit(forked)
    })
    this._el.querySelector('#sm-delete-btn')?.addEventListener('click', () => {
      if (!this._selected) return
      const name = this._selected.kind === 'user' ? this._selected.name : ''
      if (!confirm(`¿Eliminar "${name}"?`)) return
      deleteSnippet(this._selected.id)
      this._selected = null
      this._editing  = false
      // render() called by effect
    })
    this._el.querySelector('#sm-detail-fav, .sm-detail-fav')?.addEventListener('click', () => {
      if (this._selected) toggleFavorite(this._selected.id)
    })

    // Edit form
    if (this._editing) {
      const nameEl  = this._el.querySelector<HTMLInputElement>('#sm-edit-name')
      const latexEl = this._el.querySelector<HTMLTextAreaElement>('#sm-edit-latex')
      const tagsEl  = this._el.querySelector<HTMLInputElement>('#sm-edit-tags')
      const preview = this._el.querySelector<HTMLElement>('#sm-preview')

      latexEl?.addEventListener('input', () => {
        this._editLatex = latexEl.value
        if (preview) preview.innerHTML = renderKatex(this._editLatex)
      })
      nameEl?.addEventListener('input',  () => { this._editName  = nameEl.value  })
      tagsEl?.addEventListener('input',  () => { this._editTags  = tagsEl.value  })

      this._el.querySelector('#sm-cancel-edit')?.addEventListener('click', () => {
        this._editing = false
        this._render()
      })
      this._el.querySelector('#sm-save-edit')?.addEventListener('click', () => {
        this._saveEdit()
      })
    }
  }

  private _startEdit(s: UserSnippet | null) {
    this._editing   = true
    this._editError = ''
    if (s) {
      this._editName  = s.name
      this._editLatex = s.latex
      this._editTags  = s.tags.join(', ')
    } else {
      this._editName  = ''
      this._editLatex = ''
      this._editTags  = ''
    }
    this._render()
    setTimeout(() => {
      this._el.querySelector<HTMLInputElement>('#sm-edit-name')?.focus()
    }, 0)
  }

  private _saveEdit() {
    const name  = this._editName.trim()
    const latex = this._editLatex.trim()
    const tags  = this._editTags.split(',').map(t => t.trim()).filter(Boolean)

    if (!name || !latex) {
      this._editError = !name ? 'El nombre es obligatorio.' : 'El LaTeX es obligatorio.'
      this._render()
      return
    }

    if (this._selected?.kind === 'user') {
      updateSnippet(this._selected.id, { name, latex, tags })
      this._selected = { ...this._selected, name, latex, tags }
    } else {
      const created = createSnippet({ name, latex, tags })
      this._selected = created
    }
    this._editing = false
    // render() called by effect
  }

  private _escape(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }
}
