import { useState } from 'react'
import { ChevronLeft, Plus } from '@/components/icons'
import { templates } from '@/features/templates/data'
import type { Template } from '@/features/templates/types'
import type { Exemplar } from '@/features/showcase/types'

/** Cómo se va a editar el documento: en el editor visual o escribiendo LaTeX. */
type EditMode = 'matex' | 'latex'
/** Qué está buscando el usuario: arrancar rápido, o estudiar un documento completo. */
type Intent = 'todo' | 'plantillas' | 'ejemplos'

interface NewDocumentPickerProps {
  onBlank: () => void
  onMatex: () => void
  /** Crear un proyecto desde una plantilla; `asMatex` abre el editor visual. */
  onTemplate: (template: Template, asMatex?: boolean) => void
  exemplars: readonly Exemplar[]
  /** Crear un proyecto a partir de un ejemplar (copia para trabajar sobre él). */
  onUseExemplar: (exemplar: Exemplar, asMatex: boolean) => void
  /** Abrir el **visor de estudio** del ejemplar (fuente comentada + PDF). */
  onStudyExemplar: (id: string) => void
  onCancel: () => void
}

/**
 * **Nuevo documento** (ME-23, vista unificada): un solo lugar para empezar. Reúne las *plantillas*
 * (puntos de partida) y los *ejemplares* de la Galería (documentos completos que se estudian),
 * distinguidos por un filtro de **intención** en vez de por dos secciones separadas de la nav.
 *
 * La elección **Visual (Matex) / LaTeX** es un **toggle global** arriba, no dos botones por tarjeta:
 * la pregunta "¿cómo querés editar?" se responde una vez y vale para todo lo que elijas.
 */
export function NewDocumentPicker({
  onBlank,
  onMatex,
  onTemplate,
  exemplars,
  onUseExemplar,
  onStudyExemplar,
  onCancel,
}: NewDocumentPickerProps) {
  const [mode, setMode] = useState<EditMode>('matex')
  const [intent, setIntent] = useState<Intent>('todo')
  const wantsMatex = mode === 'matex'
  const showTemplates = intent === 'todo' || intent === 'plantillas'
  const showExemplars = intent === 'todo' || intent === 'ejemplos'

  return (
    <div className="h-full overflow-auto bg-(--color-surface-muted)">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver"
            title="Volver"
            className="rounded-md p-1 text-(--color-ink-muted) hover:bg-(--color-surface) hover:text-(--color-ink)"
          >
            <ChevronLeft />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-(--color-ink)">Nuevo documento</h1>
            <p className="mt-0.5 text-sm text-(--color-ink-muted)">
              Elegí cómo querés editar y empezá desde una plantilla o desde un ejemplo completo.
            </p>
          </div>
        </div>

        {/* Decisión única: editor visual o LaTeX. Vale para todo lo que se elija abajo. */}
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <span className="text-sm font-medium text-(--color-ink)">¿Cómo querés editar?</span>
          <div className="inline-flex overflow-hidden rounded-md border border-(--color-border)" role="group" aria-label="Modo de edición">
            {(
              [
                ['matex', 'Visual (Matex)'],
                ['latex', 'LaTeX'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={[
                  'px-3 py-1.5 text-sm',
                  mode === value ? 'bg-(--color-primary) font-medium text-(--color-primary-ink)' : 'text-(--color-ink-muted) hover:bg-(--color-surface-muted)',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-(--color-ink-muted)">
            {wantsMatex
              ? 'Escribís como en un procesador; el LaTeX se genera solo.'
              : 'Editás el .tex a mano, con autocompletado y errores clicables.'}
          </span>
        </div>

        {/* Filtro de intención: arrancar rápido vs estudiar un documento hecho. */}
        <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Qué estás buscando">
          {(
            [
              ['todo', 'Todo'],
              ['plantillas', 'Empezar rápido'],
              ['ejemplos', 'Estudiar un ejemplo'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setIntent(value)}
              aria-pressed={intent === value}
              className={[
                'rounded-full border px-3 py-1 text-xs',
                intent === value
                  ? 'border-(--color-primary) bg-(--color-primary) font-medium text-(--color-primary-ink)'
                  : 'border-(--color-border) bg-(--color-surface) text-(--color-ink-muted) hover:border-(--color-primary)',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Empezar de cero, según el modo elegido. */}
          <button
            type="button"
            onClick={wantsMatex ? onMatex : onBlank}
            className="flex flex-col items-start rounded-lg border border-(--color-primary) bg-(--color-surface) p-4 text-left hover:opacity-90"
          >
            <span className="mb-2 inline-flex size-8 items-center justify-center rounded-md bg-(--color-primary) text-(--color-primary-ink)">
              <Plus />
            </span>
            <span className="font-semibold text-(--color-ink)">{wantsMatex ? 'Documento en blanco (visual)' : 'Documento en blanco (LaTeX)'}</span>
            <span className="mt-1 text-sm text-(--color-ink-muted)">
              {wantsMatex ? 'Empezá a escribir; se guarda solo.' : 'Un documento LaTeX mínimo para escribir a mano.'}
            </span>
          </button>

          {showTemplates &&
            templates.map((template) => (
              <Card
                key={`t-${template.id}`}
                badge={template.category}
                kind="Plantilla"
                title={template.title}
                description={template.description}
                available={!wantsMatex || !!template.matex}
                onPrimary={() => onTemplate(template, wantsMatex)}
              />
            ))}

          {showExemplars &&
            exemplars.map((exemplar) => (
              <Card
                key={`e-${exemplar.id}`}
                badge={exemplar.docType}
                kind="Ejemplo"
                title={exemplar.title}
                description={exemplar.description}
                available={!wantsMatex || !!exemplar.matex}
                onPrimary={() => onUseExemplar(exemplar, wantsMatex)}
                onStudy={() => onStudyExemplar(exemplar.id)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

interface CardProps {
  badge: string
  /** «Plantilla» (punto de partida) o «Ejemplo» (documento completo para estudiar). */
  kind: 'Plantilla' | 'Ejemplo'
  title: string
  description: string
  /** ¿Existe en el modo elegido? Si no, la tarjeta queda deshabilitada y lo explica. */
  available: boolean
  onPrimary: () => void
  /** Solo los ejemplares: abre el visor de estudio (fuente comentada + PDF). */
  onStudy?: () => void
}

function Card({ badge, kind, title, description, available, onPrimary, onStudy }: CardProps) {
  return (
    <div
      className={[
        'flex flex-col rounded-lg border bg-(--color-surface)',
        available ? 'border-(--color-border) hover:border-(--color-primary)' : 'border-(--color-border) opacity-60',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onPrimary}
        disabled={!available}
        className="flex flex-1 flex-col items-start p-4 text-left disabled:cursor-not-allowed"
      >
        <span className="mb-2 inline-flex items-center gap-1.5">
          <span className="rounded-full bg-(--color-surface-muted) px-2 py-0.5 text-[11px] font-medium text-(--color-ink-muted)">{kind}</span>
          <span className="rounded-full border border-(--color-border) px-2 py-0.5 text-[11px] text-(--color-ink-muted)">{badge}</span>
        </span>
        <span className="font-semibold text-(--color-ink)">{title}</span>
        <span className="mt-1 text-sm text-(--color-ink-muted)">{description}</span>
        {!available && <span className="mt-2 text-xs text-amber-600">Solo disponible en LaTeX.</span>}
      </button>
      {onStudy && (
        <div className="border-t border-(--color-border) px-4 py-2">
          <button type="button" onClick={onStudy} className="rounded-md px-2 py-1 text-xs text-(--color-ink-muted) underline hover:text-(--color-ink)">
            Ver por dentro (fuente + PDF)
          </button>
        </div>
      )}
    </div>
  )
}
