import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import {
  docMeta,
  docStats,
  docOutline,
  scrollToHeading,
  updateDocMeta,
} from '@core/editor/EditorStore'
import type { DocMeta, OutlineItem } from '@core/editor/EditorStore'

const COLLAPSED_KEY = 'formalia:docpanel:collapsed'
const NUM_KEY = 'formalia:docpanel:numbering'

function loadNumbering(): { h1: boolean; h2: boolean; h3: boolean } {
  try {
    const raw = localStorage.getItem(NUM_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { h1: false, h2: false, h3: false }
}

function saveNumbering(n: { h1: boolean; h2: boolean; h3: boolean }) {
  localStorage.setItem(NUM_KEY, JSON.stringify(n))
  document.body.classList.toggle('num-h1', n.h1)
  document.body.classList.toggle('num-h2', n.h2)
  document.body.classList.toggle('num-h3', n.h3)
}

/* ─────────────────────────────────────────────────────────────────
   DocPanel — left sidebar.
   Shows: document metadata summary, live stats, keyboard shortcuts.
   Collapsible. Future: document list / file management.
   ───────────────────────────────────────────────────────────────── */

@customElement('fp-doc-panel')
export class DocPanel extends LitElement {

  @state() private _meta: DocMeta = { title: '', author: '', email: '', date: '', institution: '', abstract: '', keywords: '', language: 'es' }
  @state() private _stats = { words: 0, mathInline: 0, mathDisplay: 0, theoremEnv: 0 }
  @state() private _outline: OutlineItem[] = []
  @state() private _collapsed = localStorage.getItem(COLLAPSED_KEY) === '1'
  @state() private _numbering = loadNumbering()

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this.parentElement?.classList.toggle('collapsed', this._collapsed)
    saveNumbering(this._numbering)
    this._disposes.push(
      effect(() => { this._meta         = { ...docMeta.value };          this.requestUpdate() }),
      effect(() => { this._stats         = docStats.value;                this.requestUpdate() }),
      effect(() => { this._outline = docOutline.value; this.requestUpdate() }),
    )
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  private _toggle() {
    this._collapsed = !this._collapsed
    localStorage.setItem(COLLAPSED_KEY, this._collapsed ? '1' : '0')
    this.parentElement?.classList.toggle('collapsed', this._collapsed)
  }

  override render() {
    if (this._collapsed) {
      return html`
        <div class="dp-collapsed">
          <button class="dp-toggle" title="Expandir" @click="${this._toggle}">›</button>
        </div>
      `
    }

    return html`
      <div class="dp-header">
        <span class="dp-header-title">Documento</span>
        <button class="dp-toggle" title="Colapsar" @click="${this._toggle}">‹</button>
      </div>
      <div class="dp-body">
        ${this._renderMeta()}
        ${this._renderOutline()}
        ${this._renderStats()}
        ${this._renderNumbering()}
      </div>
    `
  }

  private _renderMeta() {
    const { title, author, date, institution, language } = this._meta
    const hasAny = title || author || date || institution
    return html`
      <div class="dp-section">
        <div class="dp-section-title">
          Info
          <div class="dp-lang-row">
            <button class="dp-lang-btn ${language === 'es' ? 'is-active' : ''}"
              @click="${() => updateDocMeta({ language: 'es' })}">ES</button>
            <button class="dp-lang-btn ${language === 'en' ? 'is-active' : ''}"
              @click="${() => updateDocMeta({ language: 'en' })}">EN</button>
          </div>
        </div>
        ${hasAny ? html`
          <div class="dp-meta-list">
            ${title       ? html`<div class="dp-meta-row"><span class="dp-meta-key">Título</span><span class="dp-meta-val">${title}</span></div>` : ''}
            ${author      ? html`<div class="dp-meta-row"><span class="dp-meta-key">Autor</span><span class="dp-meta-val">${author}</span></div>` : ''}
            ${date        ? html`<div class="dp-meta-row"><span class="dp-meta-key">Fecha</span><span class="dp-meta-val">${date}</span></div>` : ''}
            ${institution ? html`<div class="dp-meta-row"><span class="dp-meta-key">Inst.</span><span class="dp-meta-val">${institution}</span></div>` : ''}
          </div>
        ` : html`<div class="dp-meta-empty">Sin título aún</div>`}
      </div>
    `
  }

  private _renderOutline() {
    if (this._outline.length === 0) return ''
    const { h1, h2, h3 } = this._numbering
    const showNum = (level: 1 | 2 | 3) => (level === 1 && h1) || (level === 2 && h2) || (level === 3 && h3)
    return html`
      <div class="dp-section dp-section--outline">
        <div class="dp-section-title">Índice</div>
        <nav class="dp-outline">
          ${this._outline.map(item => html`
            <button
              class="dp-outline-item dp-outline-h${item.level}"
              title="${item.text}"
              @click="${() => scrollToHeading(item.pos)}"
            >${showNum(item.level) ? html`<span class="dp-outline-num">${item.num}</span>` : ''}${item.text}</button>
          `)}
        </nav>
      </div>
    `
  }

  private _renderStats() {
    const { words, mathInline, mathDisplay, theoremEnv } = this._stats
    const formulas = mathInline + mathDisplay
    return html`
      <div class="dp-section">
        <div class="dp-section-title">Estadísticas</div>
        <div class="dp-stats">
          <div class="dp-stat"><span class="dp-stat-val">${words}</span><span class="dp-stat-lbl">palabras</span></div>
          <div class="dp-stat"><span class="dp-stat-val">${formulas}</span><span class="dp-stat-lbl">fórmulas</span></div>
          ${mathDisplay > 0 ? html`<div class="dp-stat"><span class="dp-stat-val">${mathDisplay}</span><span class="dp-stat-lbl">display</span></div>` : ''}
          ${theoremEnv  > 0 ? html`<div class="dp-stat"><span class="dp-stat-val">${theoremEnv}</span><span class="dp-stat-lbl">entornos</span></div>` : ''}
        </div>
      </div>
    `
  }

  private _renderNumbering() {
    const { h1, h2, h3 } = this._numbering
    const toggle = (level: 'h1' | 'h2' | 'h3') => {
      const next = { ...this._numbering, [level]: !this._numbering[level] }
      this._numbering = next
      saveNumbering(next)
    }
    return html`
      <div class="dp-section dp-section--numbering">
        <div class="dp-section-title">Numeración</div>
        <div class="dp-num-row">
          <button class="dp-num-btn ${h1 ? 'is-active' : ''}" @click="${() => toggle('h1')}" title="Numerar secciones">§</button>
          <button class="dp-num-btn ${h2 ? 'is-active' : ''}" @click="${() => toggle('h2')}" title="Numerar subsecciones">§.§</button>
          <button class="dp-num-btn ${h3 ? 'is-active' : ''}" @click="${() => toggle('h3')}" title="Numerar subsubsecciones">§.§.§</button>
        </div>
        <p class="dp-num-note">En la exportación LaTeX la numeración siempre está presente.</p>
      </div>
    `
  }

}

declare global {
  interface HTMLElementTagNameMap { 'fp-doc-panel': DocPanel }
}
