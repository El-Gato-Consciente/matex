import type { ReactNode } from 'react'
import { documentFamily, letterMeta, examMeta, cvMeta, posterMeta, type AccentColor, type DocFamily, type DocKind, type DocMeta, type DocStyle, type LetterMeta } from '../core'
import { ACCENT_HEX, accentHex, DEFAULT_ACCENT_HEX } from '../core/policy/accent'

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
  /** Vista en vivo del documento (la mini hoja), que se redibuja con cada elección. */
  readonly preview?: ReactNode
}

export function DocumentSettings({ meta, onPatch, onApplyDocClass, preview }: DocumentSettingsProps) {
  const family = documentFamily(meta)
  const isPlainDoc = family === 'document'
  const accent = accentHex(meta.accent)

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
    <div className="grid gap-5 text-xs md:grid-cols-[170px_1fr]">
      {/* Vista en vivo: el documento abierto, redibujado con cada elección. */}
      {preview && (
        <div className="hidden md:block">
          <div className="sticky top-0 flex flex-col items-center gap-2">
            <div className="grid aspect-[3/4] w-full place-items-center rounded-lg border border-(--color-border) bg-(--color-surface-muted)">
              {preview}
            </div>
            <span className="text-[11px] text-(--color-ink-muted)">Vista en vivo</span>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4">
        <Section label="Familia">
          <div className="grid grid-cols-3 gap-1.5">
            {FAMILY_OPTIONS.map((option) => (
              <Tile key={option.value} selected={family === option.value} onClick={() => setFamily(option.value)} title={option.hint}>
                <FamilyGlyph family={option.value} />
                <span>{option.label}</span>
              </Tile>
            ))}
          </div>
        </Section>

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
          <Section label="Columnas de la grilla">
            <Segmented
              value={String(posterMeta(meta)?.columns ?? 2)}
              options={['1', '2', '3', '4'].map((n) => ({ value: n, label: n }))}
              onChange={(n) => onPatch({ family: { kind: 'poster', poster: { columns: Number(n) } } })}
            />
          </Section>
        )}
        {family === 'presentation' && (
          <p className="text-(--color-ink-muted)">El aspecto de las diapositivas sale de <strong className="text-(--color-ink)">Diseño</strong> y <strong className="text-(--color-ink)">Acento</strong>, abajo.</p>
        )}

        <Section label="Estructura">
          <Segmented
            value={meta.docKind ?? 'article'}
            options={[
              { value: 'article', label: 'Artículo', hint: 'secciones' },
              { value: 'report', label: 'Informe', hint: 'capítulos' },
              { value: 'book', label: 'Libro', hint: 'capítulos y partes' },
            ]}
            onChange={(kind) => onApplyDocClass(kind as DocKind, meta.titlePage ?? false)}
          />
        </Section>

        <Section label="Diseño">
          <div className="grid grid-cols-3 gap-1.5">
            {STYLE_OPTIONS.map((option) => (
              <Tile
                key={option.value}
                selected={(meta.style ?? 'standard') === option.value}
                onClick={() => onPatch({ style: option.value === 'standard' ? undefined : option.value })}
                title={option.hint}
              >
                <StyleSample style={option.value} accent={accent} />
                <span>{option.label}</span>
              </Tile>
            ))}
          </div>
        </Section>

        <Section label="Acento">
          <div className="flex flex-wrap items-center gap-1.5">
            <Swatch selected={!meta.accent} label="Del diseño" onClick={() => onPatch({ accent: undefined })} color={DEFAULT_ACCENT_HEX} auto />
            {ACCENT_OPTIONS.map((option) => (
              <Swatch
                key={option.value}
                selected={meta.accent === option.value}
                label={option.label}
                color={ACCENT_HEX[option.value]}
                onClick={() => onPatch({ accent: option.value })}
              />
            ))}
          </div>
        </Section>

        <Section label="Márgenes">
          <div className="grid grid-cols-4 gap-1.5">
            {MARGIN_OPTIONS.map((option) => (
              <Tile key={option.label} selected={(meta.margin ?? '') === option.value} onClick={() => onPatch({ margin: option.value || undefined })}>
                <MarginGlyph inset={option.inset} />
                <span>{option.label}</span>
              </Tile>
            ))}
          </div>
        </Section>

        <div className="flex flex-col gap-1 border-t border-(--color-border) pt-3">
          <Toggle checked={meta.toc ?? false} onChange={(checked) => onPatch({ toc: checked })}>
            Índice general
          </Toggle>
          <Toggle checked={meta.titlePage === true} onChange={(checked) => onApplyDocClass(meta.docKind ?? 'article', checked)}>
            Portada en página propia
          </Toggle>
          {isPlainDoc && (
            <Toggle
              checked={meta.columns === 2}
              onChange={(checked) => onPatch({ columns: checked ? 2 : undefined })}
              hint="Solo en el PDF: la web y el editor van en una columna."
            >
              Dos columnas
            </Toggle>
          )}
        </div>
      </div>
    </div>
  )
}

const FAMILY_OPTIONS: { value: DocFamily; label: string; hint: string }[] = [
  { value: 'document', label: 'Documento', hint: 'Informe, apunte, tesis, paper…' },
  { value: 'presentation', label: 'Presentación', hint: 'Diapositivas (beamer)' },
  { value: 'letter', label: 'Carta', hint: 'Remitente, destinatario y firma' },
  { value: 'exam', label: 'Examen', hint: 'Con consigna' },
  { value: 'cv', label: 'CV', hint: 'Currículum' },
  { value: 'poster', label: 'Póster', hint: 'Bloques en grilla' },
]

const STYLE_OPTIONS: { value: DocStyle; label: string; hint: string }[] = [
  { value: 'standard', label: 'Estándar', hint: 'Sobrio, el de siempre' },
  { value: 'classic', label: 'Clásico', hint: 'Con filetes y versalitas' },
  { value: 'modern', label: 'Moderno', hint: 'Limpio, sin serifa, con color' },
]

const ACCENT_OPTIONS: { value: AccentColor; label: string }[] = [
  { value: 'blue', label: 'Azul' },
  { value: 'green', label: 'Verde' },
  { value: 'orange', label: 'Naranja' },
  { value: 'red', label: 'Rojo' },
  { value: 'purple', label: 'Violeta' },
  { value: 'grey', label: 'Gris' },
  { value: 'black', label: 'Negro' },
]

/** `inset` = cuánto margen dibuja el pictograma (en px de su caja de 22×30). */
const MARGIN_OPTIONS: { value: string; label: string; inset: number }[] = [
  { value: '', label: 'De la clase', inset: 4.5 },
  { value: '3.5cm', label: 'Amplio', inset: 6 },
  { value: '2.5cm', label: 'Normal', inset: 4 },
  { value: '2cm', label: 'Estrecho', inset: 2.5 },
]

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-(--color-ink-muted) uppercase">{label}</span>
      {children}
    </div>
  )
}

/** Opción elegible con dibujo: familias, diseños, márgenes. */
function Tile({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={[
        'flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2 text-[11px] transition-colors',
        selected
          ? 'border-(--color-primary) bg-(--color-primary)/12 text-(--color-ink)'
          : 'border-(--color-border) text-(--color-ink-muted) hover:border-(--color-ink-muted) hover:text-(--color-ink)',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string; hint?: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex rounded-lg border border-(--color-border) p-0.5" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={[
            'flex flex-1 flex-col items-center rounded-md px-2 py-1.5 transition-colors',
            value === option.value ? 'bg-(--color-primary) text-(--color-primary-ink)' : 'text-(--color-ink-muted) hover:text-(--color-ink)',
          ].join(' ')}
        >
          <span className="text-xs font-medium">{option.label}</span>
          {option.hint && <span className="text-[10px] opacity-75">{option.hint}</span>}
        </button>
      ))}
    </div>
  )
}

function Swatch({ selected, label, color, onClick, auto = false }: { selected: boolean; label: string; color: string; onClick: () => void; auto?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={[
        'grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-(--color-surface) transition-shadow',
        selected ? 'ring-2 ring-(--color-ink)' : 'hover:ring-1 hover:ring-(--color-ink-muted)',
      ].join(' ')}
    >
      <span
        className="size-5 rounded-full border border-white/15"
        // «Del diseño»: mitad del color por defecto, mitad neutro, para que se lea como «automático».
        style={{ background: auto ? `linear-gradient(135deg, ${color} 50%, #9ca3af 50%)` : color }}
      />
    </button>
  )
}

function Toggle({ checked, onChange, hint, children }: { checked: boolean; onChange: (checked: boolean) => void; hint?: string; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-(--color-surface-muted)" title={hint}>
      <span className="flex flex-col">
        <span className="text-xs text-(--color-ink)">{children}</span>
        {hint && <span className="text-[10.5px] text-(--color-ink-muted)">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-4 w-7 shrink-0 rounded-full bg-(--color-border) transition-colors peer-checked:bg-(--color-primary) peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-primary) after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-3"
      />
    </label>
  )
}

/** Pictogramas de familia: una hoja con lo que la distingue. */
function FamilyGlyph({ family }: { family: DocFamily }) {
  const page = family === 'presentation' ? 'M3 7 H33 V25 H3 Z' : family === 'poster' ? 'M9 2 H27 V30 H9 Z' : 'M8 2 H28 V30 H8 Z'
  return (
    <svg viewBox="0 0 36 32" className="h-7 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d={page} />
      {family === 'document' && <path d="M12 8 H24 M12 12 H24 M12 16 H21 M12 20 H24" opacity=".7" />}
      {family === 'presentation' && <path d="M8 12 H22 M8 16 H28 M8 20 H18" opacity=".7" />}
      {family === 'letter' && <path d="M12 7 H18 M20 11 H24 M12 16 H24 M12 19 H24 M18 25 H24" opacity=".7" />}
      {family === 'exam' && <path d="M12 8 H15 M17 8 H24 M12 14 H15 M17 14 H24 M12 20 H15 M17 20 H22" opacity=".7" />}
      {family === 'cv' && <><circle cx="14" cy="9" r="2.5" opacity=".7" /><path d="M19 8 H24 M19 11 H23 M12 17 H24 M12 21 H24 M12 25 H20" opacity=".7" /></>}
      {family === 'poster' && <path d="M12 6 H24 M12 10 H17 V18 H12 Z M19 10 H24 V18 H19 Z M12 21 H24 V26 H12 Z" opacity=".7" />}
    </svg>
  )
}

/** Muestra tipográfica de cada diseño, con el acento elegido. */
function StyleSample({ style, accent }: { style: DocStyle; accent: string }) {
  if (style === 'modern') {
    return (
      <span className="flex h-7 items-center gap-1 font-sans text-[15px] font-bold" style={{ color: accent }}>
        <span className="h-4 w-0.5 rounded" style={{ background: accent }} />
        Aa
      </span>
    )
  }
  if (style === 'classic') {
    return (
      <span className="flex h-7 flex-col items-center justify-center border-y border-current px-1 text-[11px] tracking-[0.15em] uppercase" style={{ fontFamily: SERIF }}>
        Aa
      </span>
    )
  }
  return (
    <span className="flex h-7 items-center text-[17px]" style={{ fontFamily: SERIF }}>
      Aa
    </span>
  )
}

const SERIF = "'Matex Serif', 'Latin Modern Roman', Georgia, serif"

/** Pictograma de márgenes: una hoja con el área de texto según el margen. */
function MarginGlyph({ inset }: { inset: number }) {
  return (
    <svg viewBox="0 0 22 30" className="h-7 w-5" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="0.6" y="0.6" width="20.8" height="28.8" rx="1.5" />
      <rect x={inset} y={inset} width={22 - 2 * inset} height={30 - 2 * inset} fill="currentColor" opacity=".25" stroke="none" />
    </svg>
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
