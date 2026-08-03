import ReactMarkdown, { type Components } from 'react-markdown'

/** Estilos de los elementos Markdown, alineados con la paleta de la app. */
const components: Components = {
  p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-(--color-ink)">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-(--color-primary) underline">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-(--color-surface-muted) px-1 py-0.5 font-mono text-[0.85em] text-(--color-ink)">
      {children}
    </code>
  ),
}

/** Renderiza Markdown con estilos consistentes. Sin HTML crudo (seguro por defecto). */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>
}
