import type { CSSProperties } from 'react'
import type { WikiAnimationProps } from './types'

const LATEX = [
  '\\begin{theorem}[Valor extremo]',
  '  Toda función continua en $[a,b]$',
  '  alcanza un máximo y un mínimo.',
  '\\end{theorem}',
]

const HTML = [
  '<section class="theorem">',
  '  <h4>Teorema 1 (Valor extremo)</h4>',
  '  <p>Toda función continua…</p>',
  '</section>',
]

/**
 * «Intención, no formato»: el autor marca *qué* es (un Teorema) y cada salida lo
 * escribe a su manera. Las líneas se tipean con `steps()` sobre `ch` (monoespaciada).
 */
export function Intencion(_: WikiAnimationProps) {
  return (
    <div className="wiki-int grid gap-4 p-5 md:grid-cols-[1fr_auto_1.15fr]">
      <div className="flex flex-col gap-2">
        <Label>Lo que escribís</Label>
        <div className="wiki-int-block rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-(--color-primary)/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
              Teorema 1
            </span>
            <span className="text-sm text-(--color-ink-muted)">Valor extremo</span>
          </div>
          <p className="text-[15px] leading-relaxed">
            Toda función continua en <span className="wiki-serif italic">[a, b]</span> alcanza un máximo y un
            mínimo.<span className="wiki-int-caret" />
          </p>
        </div>
        <p className="text-xs text-(--color-ink-muted)">Elegís <strong className="text-(--color-ink)">qué es</strong>. Nada de fuentes ni márgenes.</p>
      </div>

      <div className="hidden items-center md:flex" aria-hidden="true">
        <svg viewBox="0 0 60 120" className="h-28 w-12">
          <path d="M4 60 C 30 60, 30 20, 56 20" className="wiki-svg-wire" />
          <path d="M4 60 C 30 60, 30 100, 56 100" className="wiki-svg-wire" />
          <path d="M4 60 C 30 60, 30 20, 56 20" pathLength={100} className="wiki-int-flow" />
          <path d="M4 60 C 30 60, 30 100, 56 100" pathLength={100} className="wiki-int-flow" style={{ animationDelay: '0.9s' }} />
        </svg>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <CodePane label="LaTeX · para el PDF" lines={LATEX} start={0.6} />
        <CodePane label="HTML · para la web" lines={HTML} start={2.2} />
      </div>
    </div>
  )
}

function Label({ children }: { children: string }) {
  return <span className="text-[11px] font-semibold tracking-wide text-(--color-ink-muted) uppercase">{children}</span>
}

function CodePane({ label, lines, start }: { label: string; lines: readonly string[]; start: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      <pre className="overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-3 font-mono text-[12px] leading-[1.7]">
        {lines.map((line, index) => (
          <span
            key={line}
            className="wiki-int-line"
            style={{ '--n': line.length, '--d': `${start + index * 0.4}s` } as CSSProperties}
          >
            {line}
          </span>
        ))}
      </pre>
    </div>
  )
}
