import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import { docMeta, updateDocMeta, type DocMeta } from '@core/editor/EditorStore'

@customElement('fp-doc-header')
export class DocHeader extends LitElement {

  @state() private _meta: DocMeta = { title: '', author: '', email: '', date: '', institution: '', abstract: '', keywords: '', language: 'es' }
  @state() private _expanded = false

  private _dispose: (() => void) | null = null

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this._dispose = effect(() => {
      const m = docMeta.value
      this._meta = { ...m }
      if (m.author || m.email || m.date || m.institution || m.abstract || m.keywords) {
        this._expanded = true
      }
    })
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._dispose?.()
    this._dispose = null
  }

  override render() {
    const { title, author, email, date, institution, abstract, keywords, language } = this._meta

    return html`
      <div class="doc-header">
        <div class="dh-title-row">
          <input
            class="dh-title"
            type="text"
            placeholder="Título del documento"
            .value="${title}"
            @input="${(e: InputEvent) => this._update('title', (e.target as HTMLInputElement).value)}"
            @keydown="${this._onTitleKeydown}"
          />
          <div class="dh-title-controls">
            <button
              class="dh-toggle ${this._expanded ? 'is-open' : ''}"
              title="${this._expanded ? 'Ocultar campos' : 'Mostrar autor, abstract…'}"
              @click="${() => { this._expanded = !this._expanded }}"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        ${this._expanded ? html`
          <div class="dh-secondary">
            ${this._row(language === 'es' ? 'Autor' : 'Author', html`
              <input class="dh-field" type="text" autocomplete="off" placeholder="—"
                .value="${author}"
                @input="${(e: InputEvent) => this._update('author', (e.target as HTMLInputElement).value)}"
              />
            `)}
            ${this._row('Email', html`
              <input class="dh-field" type="text" autocomplete="off" placeholder="—"
                .value="${email}"
                @input="${(e: InputEvent) => this._update('email', (e.target as HTMLInputElement).value)}"
              />
            `)}
            ${this._row(language === 'es' ? 'Fecha' : 'Date', html`
              <input class="dh-field" type="text" autocomplete="off" placeholder="—"
                .value="${date}"
                @input="${(e: InputEvent) => this._update('date', (e.target as HTMLInputElement).value)}"
              />
            `)}
            ${this._row(language === 'es' ? 'Institución' : 'Institution', html`
              <input class="dh-field" type="text" autocomplete="off" placeholder="—"
                .value="${institution}"
                @input="${(e: InputEvent) => this._update('institution', (e.target as HTMLInputElement).value)}"
              />
            `)}
            ${this._row(language === 'es' ? 'Palabras clave' : 'Keywords', html`
              <input class="dh-field" type="text" autocomplete="off" placeholder="—"
                .value="${keywords}"
                @input="${(e: InputEvent) => this._update('keywords', (e.target as HTMLInputElement).value)}"
              />
            `)}
            ${this._row(language === 'es' ? 'Resumen' : 'Abstract', html`
              <textarea class="dh-field dh-abstract" autocomplete="off" rows="3" placeholder="—"
                .value="${abstract}"
                @input="${(e: InputEvent) => this._update('abstract', (e.target as HTMLTextAreaElement).value)}"
              ></textarea>
            `)}
          </div>
        ` : ''}
      </div>
    `
  }

  private _row(label: string, input: unknown) {
    return html`
      <div class="dh-row">
        <span class="dh-label">${label}</span>
        ${input}
      </div>
    `
  }

  private _update(field: keyof DocMeta, value: string) {
    updateDocMeta({ [field]: value } as Partial<DocMeta>)
  }

  private _onTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      this._expanded = true
      this.updateComplete.then(() => {
        this.querySelector<HTMLInputElement>('.dh-field')?.focus()
      })
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-doc-header': DocHeader }
}
