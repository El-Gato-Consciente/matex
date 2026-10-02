import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Markdown } from '@/components/Markdown'
import { AnimationFrame } from './AnimationFrame'
import { allPages, findPage, wikiGroups } from './content'
import type { WikiAction, WikiBlock, WikiPage } from './types'
import { useInView } from './useInView'
import './wiki.css'

interface WikiViewProps {
  /** Página a mostrar (viene de la URL). `null` o un id que no existe = la primera. */
  pageId: string | null
  /** Ir a otra página (la app la lleva a la URL: Atrás funciona y cada página tiene link). */
  onSelectPage: (id: string) => void
  /** Crea un documento Matex y lo abre (CTA «Probalo»). */
  onStartMatex: () => void
  onGoProjects: () => void
}

/**
 * «Cómo funciona Matex»: wiki de documentación del producto, para quien lo usa.
 * Índice por grupos a la izquierda (selector en pantallas chicas), la página al
 * centro y anterior/siguiente al pie.
 */
export function WikiView({ pageId, onSelectPage: setPageId, onStartMatex, onGoProjects }: WikiViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const page = (pageId ? findPage(pageId) : undefined) ?? allPages[0]!
  const index = allPages.findIndex((entry) => entry.id === page.id)
  const prev = allPages[index - 1]
  const next = allPages[index + 1]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [page.id])

  const actions: Record<WikiAction, () => void> = { 'start-matex': onStartMatex, projects: onGoProjects }

  return (
    <div className="flex h-full">
      <nav aria-label="Páginas de la wiki" className="hidden w-64 shrink-0 overflow-auto border-r border-(--color-border) bg-(--color-surface-muted) px-3 py-6 md:block">
        {wikiGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-(--color-ink-muted) uppercase">
              {group.title}
            </p>
            {group.pages.map((entry) => {
              const active = entry.id === page.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setPageId(entry.id)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'relative block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                    active
                      ? 'bg-(--color-primary)/12 font-medium text-(--color-ink)'
                      : 'text-(--color-ink-muted) hover:bg-(--color-surface) hover:text-(--color-ink)',
                  ].join(' ')}
                >
                  {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-(--color-primary)" />}
                  {entry.title}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto">
        <article key={page.id} className="wiki-page-in mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10 text-[16px] leading-relaxed sm:px-8">
          <MobileNav current={page.id} onSelect={setPageId} />
          <header>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-(--color-primary) uppercase">
              {wikiGroups.find((group) => group.pages.some((entry) => entry.id === page.id))?.title}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
            <p className="mt-2 text-lg text-(--color-ink-muted)">{page.summary}</p>
          </header>

          {page.blocks.map((block, blockIndex) => (
            <Reveal key={blockIndex}>
              <Block block={block} actions={actions} />
            </Reveal>
          ))}

          <PrevNext prev={prev} next={next} onSelect={setPageId} />
        </article>
      </div>
    </div>
  )
}

function MobileNav({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
  return (
    <select
      value={current}
      onChange={(event) => onSelect(event.target.value)}
      aria-label="Ir a la página"
      className="rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm md:hidden"
    >
      {wikiGroups.map((group) => (
        <optgroup key={group.title} label={group.title}>
          {group.pages.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/** Aparece suave la primera vez que entra en pantalla. */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const revealed = useInView(ref, { once: true, threshold: 0.12 })
  return (
    <div ref={ref} className="wiki-reveal" data-revealed={revealed ? '' : undefined}>
      {children}
    </div>
  )
}

function Block({ block, actions }: { block: WikiBlock; actions: Record<WikiAction, () => void> }) {
  switch (block.kind) {
    case 'prose':
      return <Markdown>{block.markdown}</Markdown>
    case 'callout':
      return <Callout tone={block.tone} markdown={block.markdown} />
    case 'animation':
      return <AnimationFrame id={block.id} caption={block.caption} />
    case 'steps':
      return (
        <ol className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <li key={item.title} className="wiki-step flex gap-4" style={{ '--i': i } as CSSProperties}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-(--color-primary) text-sm font-semibold text-(--color-primary-ink)">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="font-semibold">{item.title}</p>
                <div className="text-[15px] text-(--color-ink-muted)">
                  <Markdown>{item.markdown}</Markdown>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )
    case 'cards':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.items.map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-(--color-primary)"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold">{item.title}</span>
                {item.tag && (
                  <span className="rounded-full border border-(--color-border) px-2 py-0.5 text-[11px] text-(--color-ink-muted)">
                    {item.tag}
                  </span>
                )}
              </div>
              <div className="text-sm text-(--color-ink-muted)">
                <Markdown>{item.markdown}</Markdown>
              </div>
            </div>
          ))}
        </div>
      )
    case 'keys':
      return (
        <div className="overflow-hidden rounded-lg border border-(--color-border)">
          {block.items.map((item) => (
            <div key={item.desc} className="flex flex-col gap-1 border-b border-(--color-border) px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex shrink-0 flex-wrap gap-1 sm:w-48">
                {item.keys.map((key) => (
                  <kbd key={key} className="rounded border border-b-2 border-(--color-border) bg-(--color-surface-muted) px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-sm text-(--color-ink-muted)">{item.desc}</span>
            </div>
          ))}
        </div>
      )
    case 'cta':
      return (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-(--color-primary)/40 bg-(--color-primary)/8 p-5 sm:flex-row sm:items-center sm:justify-between">
          {block.markdown && (
            <div className="text-[15px]">
              <Markdown>{block.markdown}</Markdown>
            </div>
          )}
          <button
            type="button"
            onClick={actions[block.action]}
            className="shrink-0 rounded-md bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-primary-ink) transition-transform hover:-translate-y-0.5 hover:opacity-95"
          >
            {block.label} →
          </button>
        </div>
      )
  }
}

const CALLOUT = {
  tip: { label: 'Tip', accent: 'border-l-(--color-success)' },
  note: { label: 'Nota', accent: 'border-l-(--color-ink-muted)' },
  warning: { label: 'Ojo', accent: 'border-l-amber-400' },
} as const

function Callout({ tone, markdown }: { tone: keyof typeof CALLOUT; markdown: string }) {
  const style = CALLOUT[tone]
  return (
    <div className={`rounded-md border border-l-2 border-(--color-border) bg-(--color-surface-muted) px-4 py-3 ${style.accent}`}>
      <div className="mb-1 text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">{style.label}</div>
      <div className="text-[15px]">
        <Markdown>{markdown}</Markdown>
      </div>
    </div>
  )
}

function PrevNext({ prev, next, onSelect }: { prev: WikiPage | undefined; next: WikiPage | undefined; onSelect: (id: string) => void }) {
  return (
    <nav className="mt-6 grid gap-3 border-t border-(--color-border) pt-6 sm:grid-cols-2" aria-label="Anterior y siguiente">
      {prev ? <PageLink page={prev} direction="prev" onSelect={onSelect} /> : <span />}
      {next && <PageLink page={next} direction="next" onSelect={onSelect} />}
    </nav>
  )
}

function PageLink({ page, direction, onSelect }: { page: WikiPage; direction: 'prev' | 'next'; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(page.id)}
      className={[
        'group rounded-lg border border-(--color-border) p-4 transition-colors hover:border-(--color-primary)',
        direction === 'next' ? 'text-right sm:col-start-2' : 'text-left',
      ].join(' ')}
    >
      <span className="text-xs text-(--color-ink-muted)">{direction === 'next' ? 'Siguiente →' : '← Anterior'}</span>
      <span className="mt-0.5 block font-semibold group-hover:text-(--color-primary)">{page.title}</span>
      <span className="mt-0.5 block text-sm text-(--color-ink-muted)">{page.summary}</span>
    </button>
  )
}
