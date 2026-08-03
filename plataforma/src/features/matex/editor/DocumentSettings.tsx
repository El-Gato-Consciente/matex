import { documentFamily, letterMeta, examMeta, cvMeta, posterMeta, type AccentColor, type DocFamily, type DocKind, type DocMeta, type DocStyle, type LetterMeta } from '../core'

/**
 * **Modal "Documento"** (QA-06 slice 4 + ME-47). Estructura/diseño/acento/columnas del documento
 * **y** la elección + edición de la **familia** (documento normal · presentación · carta · examen
 * · CV · póster). Antes solo se podía tildar "presentación": las demás familias tenían metadata en
 * el modelo pero **cero UI** para crearlas o editarlas — un documento carta solo existía si se
 * cargaba de una plantilla. Extraído del God component `MatexWorkspace`.
 */
export interface DocumentSettingsProps {
  readonly meta: DocMeta
  readonly onPatch: (patch: Partial<DocMeta>) => void
  /** Aplica estructura + portada-en-página-propia de forma coherente (el compilador deriva la clase). */
  readonly onApplyDocClass: (kind: DocKind, titlePage: boolean) => void
}

const SELECT = 'rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-1 text-(--color-ink) outline-none focus:border-(--color-primary)'
const FAMILY_OPTIONS: { value: DocFamily; label: string }[] = [
  { value: 'document', label: 'Documento normal' },
  { value: 'presentation', label: 'Presentación (beamer)' },
  { value: 'letter', label: 'Carta' },
  { value: 'exam', label: 'Examen' },
  { value: 'cv', label: 'Currículum (CV)' },
  { value: 'poster', label: 'Póster' },
]

export function DocumentSettings({ meta, onPatch, onApplyDocClass }: DocumentSettingsProps) {
  const family = documentFamily(meta)
  const isPlainDoc = family === 'document'

  // Cambiar de familia REEMPLAZA la anterior (son excluyentes). Si el `kind` no cambia, se
  // preserva la metadata (para no borrarla al reabrir el modal).
  const setFamily = (kind: DocFamily) => {
    if (kind === family) return
    if (kind === 'document') onPatch({ family: undefined })
    else if (kind === 'presentation') onPatch({ family: { kind: 'presentation' } })
    else if (kind === 'letter') onPatch({ family: { kind: 'letter', letter: {} } })
    else if (kind === 'exam') onPatch({ family: { kind: 'exam', exam: {} } })
    else if (kind === 'cv') onPatch({ family: { kind: 'cv', cv: {} } })
    else onPatch({ family: { kind: 'poster', poster: {} } })
  }
  const patchLetter = (patch: Partial<LetterMeta>) => onPatch({ family: { kind: 'letter', letter: { ...letterMeta(meta), ...patch } } })

  return (
    <div className="flex flex-col gap-3 text-xs">
      <label className="flex flex-col gap-1 text-(--color-ink-muted)">
        Familia
        <select value={family} onChange={(e) => setFamily(e.target.value as DocFamily)} className={SELECT}>
          {FAMILY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      {/* Campos propios de la familia elegida (ME-47). */}
      {family === 'letter' && <LetterFields letter={letterMeta(meta) ?? {}} onPatch={patchLetter} />}
      {family === 'exam' && (
        <FieldArea label="Consigna del examen" value={examMeta(meta)?.instructions ?? ''} onChange={(v) => onPatch({ family: { kind: 'exam', exam: { instructions: v || undefined } } })} />
      )}
      {family === 'cv' && (
        <div className="flex flex-col gap-2 border-l-2 border-(--color-border) pl-2">
          <Field label="Subtítulo" value={cvMeta(meta)?.subtitle ?? ''} onChange={(v) => onPatch({ family: { kind: 'cv', cv: { ...cvMeta(meta), subtitle: v || undefined } } })} />
          <Field label="Email" value={cvMeta(meta)?.email ?? ''} onChange={(v) => onPatch({ family: { kind: 'cv', cv: { ...cvMeta(meta), email: v || undefined } } })} />
          <Field label="Dirección" value={cvMeta(meta)?.address ?? ''} onChange={(v) => onPatch({ family: { kind: 'cv', cv: { ...cvMeta(meta), address: v || undefined } } })} />
        </div>
      )}
      {family === 'poster' && (
        <label className="flex flex-col gap-1 text-(--color-ink-muted)">
          Columnas de la grilla
          <select value={posterMeta(meta)?.columns ?? 2} onChange={(e) => onPatch({ family: { kind: 'poster', poster: { columns: Number(e.target.value) } } })} className={SELECT}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      {family === 'presentation' && (
        <p className="pl-2 text-(--color-ink-muted)">El aspecto de las diapositivas sale de <strong>Diseño</strong> y <strong>Acento</strong>, abajo.</p>
      )}

      <div className="mt-1 border-t border-(--color-border) pt-2" />

      <label className="flex flex-col gap-1 text-(--color-ink-muted)">
        Estructura
        <select value={meta.docKind ?? 'article'} onChange={(e) => onApplyDocClass(e.target.value as DocKind, meta.titlePage ?? false)} className={SELECT}>
          <option value="article">Artículo — secciones (por defecto)</option>
          <option value="report">Informe — capítulos</option>
          <option value="book">Libro — capítulos y partes</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-(--color-ink-muted)">
        Diseño
        <select value={meta.style ?? 'standard'} onChange={(e) => onPatch({ style: e.target.value === 'standard' ? undefined : (e.target.value as DocStyle) })} className={SELECT}>
          <option value="standard">Estándar — sobrio (por defecto)</option>
          <option value="classic">Clásico — con filetes y contrastes</option>
          <option value="modern">Moderno — limpio, sans</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-(--color-ink-muted)">
        Acento
        <select value={meta.accent ?? ''} onChange={(e) => onPatch({ accent: (e.target.value || undefined) as AccentColor | undefined })} className={SELECT}>
          <option value="">Del diseño (por defecto)</option>
          <option value="blue">Azul</option>
          <option value="green">Verde</option>
          <option value="orange">Naranja</option>
          <option value="red">Rojo</option>
          <option value="purple">Violeta</option>
          <option value="grey">Gris</option>
          <option value="black">Negro</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-(--color-ink-muted)">
        Márgenes
        <select value={meta.margin ?? ''} onChange={(e) => onPatch({ margin: e.target.value || undefined })} className={SELECT}>
          <option value="">De la clase (por defecto)</option>
          <option value="3.5cm">Amplio (3.5 cm)</option>
          <option value="2.5cm">Normal (2.5 cm)</option>
          <option value="2cm">Estrecho (2 cm)</option>
        </select>
      </label>
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
        <input type="checkbox" checked={meta.toc ?? false} onChange={(e) => onPatch({ toc: e.target.checked })} />
        Índice general (tabla de contenidos)
      </label>
      <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
        <input type="checkbox" checked={meta.titlePage === true} onChange={(e) => onApplyDocClass(meta.docKind ?? 'article', e.target.checked)} />
        Portada en página propia
      </label>
      {isPlainDoc && (
        <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="El texto fluye en dos columnas en el PDF final (estilo paper). El editor y el HTML se ven en una columna.">
          <input type="checkbox" checked={meta.columns === 2} onChange={(e) => onPatch({ columns: e.target.checked ? 2 : undefined })} />
          Dos columnas (en la salida)
        </label>
      )}
    </div>
  )
}

/** Campos de una carta: remitente/destinatario (con dirección multilínea), saludo, firma, adjuntos. */
function LetterFields({ letter, onPatch }: { letter: LetterMeta; onPatch: (patch: Partial<LetterMeta>) => void }) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-(--color-border) pl-2">
      <Field label="Remitente" value={letter.from ?? ''} onChange={(v) => onPatch({ from: v || undefined })} />
      <FieldArea label="Dirección del remitente" value={letter.fromAddress ?? ''} onChange={(v) => onPatch({ fromAddress: v || undefined })} />
      <Field label="Destinatario" value={letter.to ?? ''} onChange={(v) => onPatch({ to: v || undefined })} />
      <FieldArea label="Dirección del destinatario" value={letter.toAddress ?? ''} onChange={(v) => onPatch({ toAddress: v || undefined })} />
      <Field label="Saludo" value={letter.opening ?? ''} onChange={(v) => onPatch({ opening: v || undefined })} placeholder="Estimado/a:" />
      <Field label="Despedida" value={letter.closing ?? ''} onChange={(v) => onPatch({ closing: v || undefined })} placeholder="Saludos cordiales," />
      <Field label="Firma" value={letter.signature ?? ''} onChange={(v) => onPatch({ signature: v || undefined })} />
      <Field label="Adjuntos" value={letter.encl ?? ''} onChange={(v) => onPatch({ encl: v || undefined })} />
      <Field label="Copias" value={letter.cc ?? ''} onChange={(v) => onPatch({ cc: v || undefined })} />
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-0.5 text-(--color-ink-muted)">
      {label}
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)" />
    </label>
  )
}

function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-0.5 text-(--color-ink-muted)">
      {label}
      <textarea value={value} rows={2} onChange={(e) => onChange(e.target.value)} className="rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)" />
    </label>
  )
}
