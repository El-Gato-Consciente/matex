import { Markdown } from '@/components/Markdown'
import { useLessonHost } from './LessonHost'
import type { LessonBlock } from './types'

type DestinationsBlockProps = Omit<Extract<LessonBlock, { kind: 'destinations' }>, 'kind'>

/** Bloque `destinations`: tarjetas que llevan a otras partes de la app. */
export function DestinationsBlock({ title, items }: DestinationsBlockProps) {
  const { navigate } = useLessonHost()
  return (
    <section className="flex flex-col gap-3">
      {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <article
            key={`${item.to}-${item.title}`}
            className="flex flex-col gap-1.5 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4 transition-colors hover:border-(--color-primary)"
          >
            <h3 className="font-semibold text-(--color-ink)">{item.title}</h3>
            <div className="text-sm leading-relaxed text-(--color-ink-muted)">
              <Markdown>{item.description}</Markdown>
            </div>
            <button
              type="button"
              onClick={() => navigate(item.to)}
              className="mt-auto self-start pt-1 text-sm font-medium text-(--color-primary) hover:underline"
            >
              {item.cta} →
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
