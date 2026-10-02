import type { CSSProperties, ReactNode } from 'react'
import type { WikiAnimationProps } from './types'

type Variant = 'estandar' | 'clasico' | 'moderno' | 'dos-columnas'

/** Fases de 3 s: cada capa de la hoja y cada opción del panel se prenden en la suya. */
const PHASES: ReadonlyArray<{ variant: Variant }> = [
  { variant: 'estandar' },
  { variant: 'clasico' },
  { variant: 'moderno' },
  { variant: 'dos-columnas' },
]

const phase = (index: number, span = 1) =>
  ({ '--d': `${index * 3}s`, animationName: span === 2 ? 'wiki-phase-2' : 'wiki-phase-1' }) as CSSProperties

/**
 * «El mismo contenido, otro diseño»: la hoja pasa por Estándar, Clásico y Moderno
 * (con acento naranja) y termina a dos columnas, mientras el panel de «Documento»
 * marca la opción activa. El contenido no cambia: solo cómo se presenta.
 */
export function Diseno(_: WikiAnimationProps) {
  return (
    <div className="grid items-center gap-6 p-5 md:grid-cols-[1fr_auto]">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px]">
        {PHASES.map((p, index) => (
          <div
            key={p.variant}
            className={['wiki-phase absolute inset-0', index === 0 ? 'wiki-phase--first' : ''].join(' ')}
            style={phase(index)}
          >
            <Page variant={p.variant} />
          </div>
        ))}
      </div>

      <div className="flex min-w-[220px] flex-col gap-4 rounded-lg border border-(--color-border) bg-(--color-surface) p-4 text-sm">
        <span className="text-[11px] font-semibold tracking-wide text-(--color-ink-muted) uppercase">Documento</span>
        <Field label="Diseño">
          <Chip style={phase(0)} first>
            Estándar
          </Chip>
          <Chip style={phase(1)}>Clásico</Chip>
          <Chip style={phase(2, 2)}>Moderno</Chip>
        </Field>
        <Field label="Acento">
          <Dot color="var(--color-ink-muted)" title="Del diseño" style={phase(0, 2)} first />
          <Dot color="#3b82f6" title="Azul" />
          <Dot color="#22c55e" title="Verde" />
          <Dot color="#f97316" title="Naranja" style={{ ...phase(2, 2) }} />
          <Dot color="#a855f7" title="Violeta" />
        </Field>
        <label className="flex items-center gap-2 text-(--color-ink-muted)">
          <span className="relative inline-grid size-4 place-items-center rounded border border-(--color-border)">
            <span className="wiki-phase absolute inset-0 grid place-items-center rounded bg-(--color-primary) text-[10px] text-white" style={phase(3)}>
              ✓
            </span>
          </span>
          Dos columnas
        </label>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-(--color-ink-muted)">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ children, style, first = false }: { children: string; style: CSSProperties; first?: boolean }) {
  return (
    <span className="relative overflow-hidden rounded-md border border-(--color-border) px-2.5 py-1 text-xs text-(--color-ink-muted)">
      <span className={['wiki-phase absolute inset-0 bg-(--color-primary)', first ? 'wiki-phase--first' : ''].join(' ')} style={style} />
      <span className="relative">{children}</span>
    </span>
  )
}

function Dot({ color, title, style, first = false }: { color: string; title: string; style?: CSSProperties; first?: boolean }) {
  return (
    <span title={title} className="relative grid size-5 place-items-center">
      {style && (
        <span
          className={['wiki-phase absolute inset-0 rounded-full ring-2 ring-(--color-ink)', first ? 'wiki-phase--first' : ''].join(' ')}
          style={style}
        />
      )}
      <span className="size-3.5 rounded-full" style={{ background: color }} />
    </span>
  )
}

const LINES = [100, 94, 97, 70]

/** La hoja (como el PDF): cambia tipografía, alineación, color de acento y columnas. */
function Page({ variant }: { variant: Variant }) {
  const modern = variant === 'moderno' || variant === 'dos-columnas'
  const accent = modern ? '#f97316' : '#1f2937'
  const paragraph = (
    <div className="flex flex-col gap-[5px]">
      {LINES.map((width, i) => (
        <span key={i} className="h-[4px] rounded-full bg-neutral-300" style={{ width: `${width}%` }} />
      ))}
    </div>
  )
  return (
    <div
      className={[
        'flex h-full flex-col gap-3 rounded-sm bg-[#fbfaf7] p-6 text-neutral-800 shadow-2xl ring-1 ring-black/40',
        modern ? 'font-sans' : 'wiki-serif',
      ].join(' ')}
    >
      {modern ? (
        <div className="border-l-4 pl-2.5" style={{ borderColor: accent }}>
          <div className="text-[17px] leading-tight font-bold" style={{ color: accent }}>
            Funciones continuas
          </div>
          <div className="text-[9px] text-neutral-500">Ana Pérez · 2026</div>
        </div>
      ) : (
        <div className={['text-center', variant === 'clasico' ? 'border-y border-neutral-400 py-1.5' : ''].join(' ')}>
          <div className={['text-[17px] leading-tight', variant === 'clasico' ? 'tracking-[0.12em] uppercase text-[13px]' : ''].join(' ')}>
            Funciones continuas
          </div>
          <div className="mt-0.5 text-[9px] text-neutral-500 italic">Ana Pérez</div>
        </div>
      )}

      <div className={['text-[11px] font-bold', variant === 'clasico' ? 'text-center tracking-[0.1em] uppercase text-[9px]' : ''].join(' ')} style={{ color: accent }}>
        1 Introducción
      </div>

      {variant === 'dos-columnas' ? (
        <div className="grid grid-cols-2 gap-3">
          {paragraph}
          {paragraph}
        </div>
      ) : (
        paragraph
      )}

      <div className="wiki-serif py-1 text-center text-[13px] italic">f(c) ≥ f(x), ∀x ∈ [a, b]</div>

      {variant === 'dos-columnas' ? (
        <div className="grid grid-cols-2 gap-3">
          {paragraph}
          {paragraph}
        </div>
      ) : (
        paragraph
      )}

      <div
        className={['mt-auto rounded-sm border-l-2 px-2 py-1 text-[9px]', modern ? '' : 'italic'].join(' ')}
        style={{ borderColor: accent, background: modern ? '#fff1e6' : 'transparent' }}
      >
        <span className="font-bold" style={{ color: accent }}>
          Teorema 1.
        </span>{' '}
        Toda función continua alcanza su máximo.
      </div>
    </div>
  )
}
