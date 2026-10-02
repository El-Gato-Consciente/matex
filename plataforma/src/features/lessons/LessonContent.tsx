import { Markdown } from '@/components/Markdown'
import { CheckBlock } from './CheckBlock'
import { findLesson } from './content'
import { DestinationsBlock } from './DestinationsBlock'
import { PlaygroundBlock } from './PlaygroundBlock'
import type { Capa, Lesson, LessonBlock } from './types'

const CAPA_META: Record<Capa, { label: string; dot: string }> = {
  semantica: { label: 'Semántica', dot: 'bg-(--color-success)' },
  carpinteria: { label: 'Carpintería', dot: 'bg-sky-400' },
  infraestructura: { label: 'Infraestructura', dot: 'bg-amber-400' },
}

/** Etiqueta de la capa del ecosistema a la que pertenece la lección. */
export function CapaBadge({ capa }: { capa: Capa }) {
  const meta = CAPA_META[capa]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-ink-muted)">
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

/**
 * Render del contenido didáctico de una lección (objetivo, prerrequisitos,
 * bloques y "ver también"). No incluye el desafío ni el título: el contenedor
 * (panel de práctica o lector) decide su tamaño y disposición.
 */
export function LessonContent({ lesson }: { lesson: Lesson }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <CapaBadge capa={lesson.capa} />
        <p className="mt-2 text-(--color-ink-muted)">
          <span className="text-(--color-primary)">Al terminar:</span> {lesson.objective}
        </p>
      </div>

      {lesson.prerequisites.length > 0 && <Prerequisites ids={lesson.prerequisites} />}

      {lesson.content.map((block, index) => (
        <ContentBlock key={`${lesson.id}-${index}`} block={block} lesson={lesson} />
      ))}

      {lesson.files.length > 0 && <ProjectFiles lesson={lesson} />}

      {lesson.seeAlso.length > 0 && (
        <section className="border-t border-(--color-border) pt-3 text-xs text-(--color-ink-muted)">
          <span className="font-semibold">Ver también:</span> {lesson.seeAlso.join(' · ')}
        </section>
      )}
    </div>
  )
}

/** Lista los archivos acompañantes del proyecto de la lección (multi-archivo). */
function ProjectFiles({ lesson }: { lesson: Lesson }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs text-(--color-ink-muted)">
        <span className="font-semibold">Proyecto multi-archivo.</span> Además del principal
        (<code className="font-mono">{lesson.mainFile}</code>), se compilan estos archivos:
      </p>
      {lesson.files.map((file) => (
        <figure key={file.path} className="overflow-hidden rounded-md border border-(--color-border)">
          <figcaption className="border-b border-(--color-border) bg-(--color-surface-muted) px-3 py-1 font-mono text-xs text-(--color-ink-muted)">
            {file.path}
          </figcaption>
          {file.encoding === 'base64' ? (
            <p className="bg-(--color-surface-muted) p-3 text-xs text-(--color-ink-muted)">
              Archivo binario (imagen). Se incluye con <code className="font-mono">\\includegraphics</code>.
            </p>
          ) : (
            <pre className="overflow-x-auto bg-(--color-surface-muted) p-3 font-mono text-xs leading-relaxed">
              {file.content}
            </pre>
          )}
        </figure>
      ))}
    </section>
  )
}

function Prerequisites({ ids }: { ids: readonly string[] }) {
  const titles = ids.map((id) => findLesson(id)?.title ?? id)
  return (
    <p className="rounded-md bg-(--color-surface-muted) px-3 py-2 text-xs text-(--color-ink-muted)">
      <span className="font-semibold">Antes conviene:</span> {titles.join(' · ')}
    </p>
  )
}

function ContentBlock({ block, lesson }: { block: LessonBlock; lesson: Lesson }) {
  switch (block.kind) {
    case 'prose':
      return (
        <div className="leading-relaxed">
          <Markdown>{block.markdown}</Markdown>
        </div>
      )
    case 'code':
      return (
        <figure className="overflow-hidden rounded-md border border-(--color-border)">
          {block.caption && (
            <figcaption className="border-b border-(--color-border) bg-(--color-surface-muted) px-3 py-1 text-xs text-(--color-ink-muted)">
              {block.caption}
            </figcaption>
          )}
          <pre className="overflow-x-auto bg-(--color-surface-muted) p-3 font-mono text-xs leading-relaxed">
            {block.latex}
          </pre>
        </figure>
      )
    case 'commands':
      return (
        <div className="rounded-md border border-(--color-border)">
          {block.title && (
            <div className="border-b border-(--color-border) px-3 py-1.5 text-xs font-semibold text-(--color-ink-muted)">
              {block.title}
            </div>
          )}
          <dl className="divide-y divide-(--color-border)">
            {block.items.map((item) => (
              <div key={item.cmd} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-mono text-xs text-(--color-primary) sm:w-44">{item.cmd}</dt>
                <dd className="text-xs text-(--color-ink-muted)">{item.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      )
    case 'callout':
      return <Callout tone={block.tone} markdown={block.markdown} />
    case 'playground':
      return <PlaygroundBlock caption={block.caption} body={block.body} />
    case 'destinations':
      return <DestinationsBlock title={block.title} items={block.items} />
    case 'check':
      return <CheckBlock lesson={lesson} title={block.title} />
  }
}

const CALLOUT_STYLES = {
  tip: { border: 'border-l-(--color-success)', label: 'Tip' },
  warning: { border: 'border-l-(--color-danger)', label: 'Cuidado' },
  note: { border: 'border-l-(--color-ink-muted)', label: 'Nota' },
} as const

function Callout({ tone, markdown }: { tone: 'tip' | 'warning' | 'note'; markdown: string }) {
  const style = CALLOUT_STYLES[tone]
  return (
    <div className={`rounded-md border border-l-2 border-(--color-border) bg-(--color-surface-muted) p-3 ${style.border}`}>
      <div className="mb-1 text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">
        {style.label}
      </div>
      <div className="text-xs leading-relaxed text-(--color-ink)">
        <Markdown>{markdown}</Markdown>
      </div>
    </div>
  )
}
