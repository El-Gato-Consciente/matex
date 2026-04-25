import katex from 'katex'
import { createSnippet, updateSnippet, forkSnippet, type AnySnippet, type UserSnippet, toMathLiveLatex } from './SnippetStore'

/* ─────────────────────────────────────────────────────────────────
   SnippetModal — create / edit user snippets
   Opens as a native <dialog> overlay.
   ───────────────────────────────────────────────────────────────── */

type Mode =
  | { type: 'create' }
  | { type: 'edit';   snippet: UserSnippet }
  | { type: 'fork';   source:  AnySnippet  }

export class SnippetModal {
  private _dialog: HTMLDialogElement
  private _mode: Mode
  private _onDone?: (snippet: UserSnippet) => void

  private _nameInput!: HTMLInputElement
  private _latexInput!: HTMLTextAreaElement
  private _tagsInput!: HTMLInputElement
  private _preview!: HTMLDivElement
  private _error!: HTMLSpanElement

  constructor(mode: Mode, onDone?: (snippet: UserSnippet) => void) {
    this._mode = mode
    this._onDone = onDone
    this._dialog = this._build()
    document.body.appendChild(this._dialog)
    this._dialog.showModal()
    this._nameInput.focus()
  }

  private _title(): string {
    if (this._mode.type === 'create') return 'Nuevo snippet'
    if (this._mode.type === 'fork')   return 'Copiar snippet'
    return 'Editar snippet'
  }

  private _initialName(): string {
    if (this._mode.type === 'create') return ''
    if (this._mode.type === 'fork')   {
      const base = this._mode.source.kind === 'builtin'
        ? this._mode.source.label : this._mode.source.name
      return `${base} (copia)`
    }
    return this._mode.snippet.name
  }

  private _initialLatex(): string {
    if (this._mode.type === 'create') return ''
    if (this._mode.type === 'fork')   return this._mode.source.latex
    return this._mode.snippet.latex
  }

  private _initialTags(): string {
    if (this._mode.type === 'create') return ''
    if (this._mode.type === 'fork') {
      const s = this._mode.source
      return s.kind === 'builtin' ? s.cat : s.tags.join(', ')
    }
    return this._mode.snippet.tags.join(', ')
  }

  private _build(): HTMLDialogElement {
    const dialog = document.createElement('dialog')
    dialog.className = 'snip-modal'

    dialog.innerHTML = `
      <form method="dialog" class="snip-modal-form">
        <h2 class="snip-modal-title"></h2>

        <label class="snip-modal-label">
          Nombre
          <input class="snip-modal-input" name="name" type="text"
            placeholder="Ej: Integral de Riemann" autocomplete="off" />
        </label>

        <label class="snip-modal-label">
          LaTeX
          <span class="snip-modal-hint">
            Usa <code>$1</code> para el cursor principal, <code>$2</code>… para tabulaciones
          </span>
          <textarea class="snip-modal-tex" name="latex" rows="3"
            placeholder="\\int_{$2}^{$3} $1 \\,d$2" spellcheck="false"></textarea>
        </label>

        <div class="snip-modal-preview-wrap">
          <div class="snip-modal-preview-label">Vista previa</div>
          <div class="snip-modal-preview"></div>
          <span class="snip-modal-error"></span>
        </div>

        <label class="snip-modal-label">
          Etiquetas <span class="snip-modal-hint">(separadas por coma)</span>
          <input class="snip-modal-input" name="tags" type="text"
            placeholder="calc, mis-favoritos" autocomplete="off" />
        </label>

        <div class="snip-modal-actions">
          <button type="button" class="snip-modal-cancel snip-modal-btn">Cancelar</button>
          <button type="submit" class="snip-modal-save snip-modal-btn snip-modal-btn--primary">Guardar</button>
        </div>
      </form>
    `

    dialog.querySelector<HTMLElement>('.snip-modal-title')!.textContent = this._title()

    this._nameInput  = dialog.querySelector<HTMLInputElement>('[name="name"]')!
    this._latexInput = dialog.querySelector<HTMLTextAreaElement>('[name="latex"]')!
    this._tagsInput  = dialog.querySelector<HTMLInputElement>('[name="tags"]')!
    this._preview    = dialog.querySelector<HTMLDivElement>('.snip-modal-preview')!
    this._error      = dialog.querySelector<HTMLSpanElement>('.snip-modal-error')!

    this._nameInput.value  = this._initialName()
    this._latexInput.value = this._initialLatex()
    this._tagsInput.value  = this._initialTags()

    this._renderPreview(this._latexInput.value)

    this._latexInput.addEventListener('input', () => {
      this._renderPreview(this._latexInput.value)
    })

    dialog.querySelector('.snip-modal-cancel')!.addEventListener('click', () => this.close())

    dialog.querySelector<HTMLFormElement>('.snip-modal-form')!
      .addEventListener('submit', (e) => {
        e.preventDefault()
        this._save()
      })

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) this.close()
    })

    return dialog
  }

  private _renderPreview(raw: string) {
    const mlLatex = toMathLiveLatex(raw)
    // Strip MathLive placeholders for KaTeX render
    const display = mlLatex.replace(/#[@?]/g, '\\square')
    try {
      this._preview.innerHTML = katex.renderToString(display, {
        displayMode: true,
        throwOnError: true,
        trust: false,
      })
      this._error.textContent = ''
    } catch (err: unknown) {
      this._preview.innerHTML = ''
      this._error.textContent = err instanceof Error ? err.message : String(err)
    }
  }

  private _save() {
    const name  = this._nameInput.value.trim()
    const latex = this._latexInput.value.trim()
    const tags  = this._tagsInput.value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    if (!name)  { this._nameInput.focus();  return }
    if (!latex) { this._latexInput.focus(); return }

    let result: UserSnippet

    if (this._mode.type === 'edit') {
      updateSnippet(this._mode.snippet.id, { name, latex, tags })
      result = { ...this._mode.snippet, name, latex, tags }
    } else if (this._mode.type === 'fork') {
      result = forkSnippet(this._mode.source)
      // Override with what the user typed (forkSnippet already saved it; update again)
      updateSnippet(result.id, { name, latex, tags })
      result = { ...result, name, latex, tags }
    } else {
      result = createSnippet({ name, latex, tags })
    }

    this._onDone?.(result)
    this.close()
  }

  close() {
    this._dialog.close()
    this._dialog.remove()
  }

  // ── Static convenience openers ────────────────────────────────

  static open(mode: Mode, onDone?: (s: UserSnippet) => void): SnippetModal {
    return new SnippetModal(mode, onDone)
  }

  static create(onDone?: (s: UserSnippet) => void): SnippetModal {
    return SnippetModal.open({ type: 'create' }, onDone)
  }

  static edit(snippet: UserSnippet, onDone?: (s: UserSnippet) => void): SnippetModal {
    return SnippetModal.open({ type: 'edit', snippet }, onDone)
  }

  static fork(source: AnySnippet, onDone?: (s: UserSnippet) => void): SnippetModal {
    return SnippetModal.open({ type: 'fork', source }, onDone)
  }
}
