import type { CSSProperties, ReactNode } from 'react'
import type { WikiAnimationProps } from './types'

const TABS = ['PDF', 'HTML', 'LaTeX', 'AST'] as const

const phase = (index: number) => ({ '--d': `${index * 2.5}s`, '--cycle': '10s' }) as CSSProperties

/**
 * El panel de vista previa del editor: el mismo documento visto como PDF, HTML,
 * LaTeX y AST. El indicador de la pestaña se desliza (`.wiki-vp-indicator`) y cada
 * vista entra en su fase (`.wiki-phase`, ciclo de 10 s).
 */
export function VistaPrevia(_: WikiAnimationProps) {
  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface-muted) shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-(--color-border) bg-(--color-surface) px-3 py-2">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs text-(--color-ink-muted)">Funciones continuas — Matex</span>
        </div>

        <div className="grid min-h-[220px] grid-cols-[1fr_1.15fr]">
          {/* Editor visual */}
          <div className="flex flex-col gap-2 border-r border-(--color-border) bg-(--color-surface) p-4 text-[13px]">
            <div className="text-base font-semibold">Funciones continuas</div>
            <p className="leading-relaxed text-(--color-ink-muted)">
              Sea <span className="wiki-serif italic text-(--color-ink)">f</span> continua en{' '}
              <span className="wiki-serif italic text-(--color-ink)">[a, b]</span>.
            </p>
            <div className="rounded-md border border-(--color-border) px-2 py-1.5">
              <span className="font-semibold text-indigo-300">Teorema 1.</span>{' '}
              <span className="text-(--color-ink-muted)">Alcanza su máximo.</span>
              <span className="wiki-int-caret" />
            </div>
          </div>

          {/* Vista previa */}
          <div className="flex min-w-0 flex-col">
            <div className="relative grid grid-cols-4 border-b border-(--color-border) text-center text-xs">
              {TABS.map((tab) => (
                <span key={tab} className="py-1.5 text-(--color-ink-muted)">
                  {tab}
                </span>
              ))}
              <span className="wiki-vp-indicator absolute bottom-0 left-0 h-0.5 w-1/4 bg-(--color-primary)" />
            </div>
            <div className="relative flex-1">
              <View index={0} first>
                <div className="mx-auto flex h-full max-w-[150px] flex-col gap-1.5 rounded-sm bg-[#fbfaf7] p-3 text-neutral-800 shadow-lg">
                  <span className="wiki-serif text-center text-[11px]">Funciones continuas</span>
                  <span className="wiki-serif text-[8px]">
                    Sea <i>f</i> continua en [<i>a</i>, <i>b</i>].
                  </span>
                  <span className="wiki-serif text-[8px]">
                    <b>Teorema 1.</b> <i>Alcanza su máximo.</i>
                  </span>
                  {[90, 80, 95].map((w) => (
                    <span key={w} className="h-[3px] rounded-full bg-neutral-300" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </View>
              <View index={1}>
                <div className="flex h-full flex-col gap-1.5 text-[12px]">
                  <span className="font-semibold">Funciones continuas</span>
                  <span className="text-(--color-ink-muted)">
                    Sea <i>f</i> continua en [<i>a</i>, <i>b</i>].
                  </span>
                  <span className="rounded border-l-2 border-indigo-400 bg-indigo-400/10 px-2 py-1">
                    <b>Teorema 1.</b> Alcanza su máximo.
                  </span>
                  <span className="mt-1 text-[10px] text-(--color-ink-muted)">se adapta al ancho · sliders vivos</span>
                </div>
              </View>
              <View index={2}>
                <pre className="font-mono text-[10.5px] leading-[1.6] text-(--color-ink-muted)">
                  <span className="text-indigo-300">\section</span>{'{Funciones continuas}\nSea $f$ continua en $[a,b]$.\n'}
                  <span className="text-indigo-300">\begin</span>
                  {'{theorem}\n  Alcanza su máximo.\n'}
                  <span className="text-indigo-300">\end</span>
                  {'{theorem}'}
                </pre>
              </View>
              <View index={3}>
                <pre className="font-mono text-[10.5px] leading-[1.6] text-(--color-ink-muted)">
                  {'{ '}
                  <span className="text-sky-300">"type"</span>
                  {': "doc",\n  '}
                  <span className="text-sky-300">"content"</span>
                  {': [\n    { "type": "heading", … },\n    { "type": "paragraph", … },\n    { "type": "theorem", … }\n  ] }'}
                </pre>
              </View>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function View({ index, first = false, children }: { index: number; first?: boolean; children: ReactNode }) {
  return (
    <div
      className={['wiki-phase absolute inset-0 p-3', first ? 'wiki-phase--first' : ''].join(' ')}
      style={phase(index)}
    >
      {children}
    </div>
  )
}
