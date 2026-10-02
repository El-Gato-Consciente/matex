import type { CSSProperties } from 'react'
import type { OutlineBlock, ProjectOutline } from './projectOutline'

/**
 * **Miniatura de un proyecto**: una hoja dibujada a partir de su esqueleto (`projectOutline`),
 * no una captura. El título y las secciones son texto real; párrafos, fórmulas, figuras y
 * teoremas son trazos en el orden en que aparecen, con el diseño (estándar / clásico / moderno)
 * y el acento del documento. Es decorativa: el nombre accesible lo da la tarjeta.
 */
export function MiniSheet({ outline }: { outline: ProjectOutline }) {
  const modern = outline.style === 'modern'
  const classic = outline.style === 'classic'
  return (
    <div
      aria-hidden="true"
      className={[
        'mini-sheet flex flex-col gap-[5px] overflow-hidden rounded-[3px] bg-[#fbfaf7] p-[9%] text-neutral-800 shadow-lg ring-1 ring-black/30',
        // Verticales: por alto (si no, una A4 se sale del recuadro 4:3); apaisadas: por ancho.
        outline.landscape ? 'aspect-[16/10] w-[86%]' : 'aspect-[1/1.414] h-[88%]',
        modern ? 'font-sans' : 'mini-sheet--serif',
      ].join(' ')}
      style={{ '--accent': outline.accent } as CSSProperties}
    >
      {modern ? (
        <div className="mb-[3px] border-l-2 pl-1.5" style={{ borderColor: outline.accent }}>
          <p className="truncate text-[8.5px] leading-tight font-bold" style={{ color: outline.accent }}>
            {outline.title}
          </p>
        </div>
      ) : (
        <p
          className={[
            'mb-[3px] truncate text-center text-[8.5px] leading-tight',
            classic ? 'border-y border-neutral-400 py-[2px] text-[7px] tracking-[0.12em] uppercase' : '',
          ].join(' ')}
        >
          {outline.title}
        </p>
      )}
      {outline.blocks.map((block, index) => (
        <Block key={index} block={block} modern={modern} />
      ))}
    </div>
  )
}

function Block({ block, modern }: { block: OutlineBlock; modern: boolean }) {
  switch (block.kind) {
    case 'heading':
      return (
        <p className="mt-[2px] truncate text-[6.5px] leading-tight font-bold" style={modern ? { color: 'var(--accent)' } : undefined}>
          {block.text}
        </p>
      )
    case 'text':
      return (
        <div className="flex flex-col gap-[2.5px]">
          {Array.from({ length: block.lines }, (_, i) => (
            <span
              key={i}
              className="h-[2.5px] rounded-full bg-neutral-300"
              style={{ width: i === block.lines - 1 && block.lines > 1 ? '62%' : '100%' }}
            />
          ))}
        </div>
      )
    case 'math':
      return <span className="mx-auto my-[1px] h-[3px] w-[42%] rounded-full bg-neutral-500" />
    case 'figure':
      return (
        <svg viewBox="0 0 60 26" className="mx-auto w-[70%] rounded-[2px] bg-neutral-100">
          <path d="M4 22 H56 M6 24 V3" stroke="#a3a3a3" strokeWidth="0.8" fill="none" />
          <path d="M6 20 C 18 4, 26 4, 32 13 S 46 22, 56 6" stroke="var(--accent)" strokeWidth="1.4" fill="none" />
        </svg>
      )
    case 'box':
      return (
        <div className="flex flex-col gap-[2px] rounded-[1px] border-l-2 bg-neutral-100 py-[3px] pl-1" style={{ borderColor: 'var(--accent)' }}>
          <span className="h-[2.5px] w-[30%] rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="h-[2.5px] w-[85%] rounded-full bg-neutral-300" />
        </div>
      )
  }
}
