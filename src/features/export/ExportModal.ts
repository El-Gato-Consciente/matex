import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { TexSerializer } from '@core/serializer/TexSerializer'
import { getEditorDoc, docMeta } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   ExportModal — Phase 1
   Shows the .tex export of the current document.
   Uses a native <dialog> element. Opened programmatically via
   the static open() method or by dispatching 'formalia:export'.
   ───────────────────────────────────────────────────────────────── */

@customElement('fp-export-modal')
export class ExportModal extends LitElement {

  @state() private _tex     = ''
  @state() private _copied  = false

  private _dialog!: HTMLDialogElement
  private _serializer = new TexSerializer()

  override createRenderRoot() { return this }

  override firstUpdated() {
    this._dialog = this.querySelector('dialog')!
    window.addEventListener('formalia:export', () => this.open())
  }

  // ── Public API ──────────────────────────────────────────────────

  open() {
    const doc = getEditorDoc()
    this._tex    = doc ? this._serializer.serialize(doc, docMeta.value) : '% (empty document)'
    this._copied = false
    this._dialog?.showModal()
  }

  // ── Render ──────────────────────────────────────────────────────

  override render() {
    return html`
      <dialog class="export-dialog" @click="${this._onBackdropClick}">
        <div class="export-inner" @click="${(e: Event) => e.stopPropagation()}">

          <div class="export-header">
            <div class="export-title">Export — LaTeX (.tex)</div>
            <button class="tbtn" @click="${this._close}" title="Close (Escape)">✕</button>
          </div>

          <pre class="export-pre"><code>${this._tex}</code></pre>

          <div class="export-footer">
            <button class="tbtn" @click="${this._copy}">
              ${this._copied ? '✓ Copied!' : 'Copy'}
            </button>
            <button class="tbtn" @click="${this._download}">
              Download .tex
            </button>
          </div>

        </div>
      </dialog>
    `
  }

  // ── Event handlers (arrow class fields so `this` is always the component) ──

  private _close = () => {
    this._dialog?.close()
  }

  private _onBackdropClick = () => {
    this._close()
  }

  private _copy = async () => {
    await navigator.clipboard.writeText(this._tex)
    this._copied = true
    setTimeout(() => { this._copied = false }, 2000)
  }

  private _download = () => {
    const blob = new Blob([this._tex], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'document.tex'
    a.click()
    URL.revokeObjectURL(url)
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-export-modal': ExportModal }
}
