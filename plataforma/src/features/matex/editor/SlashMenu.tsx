import { useEffect, useRef } from 'react'
import type { InsertItem } from './insertItems'

/** Alto máximo del menú; si no entra debajo del cursor, se abre hacia arriba. */
const MENU_MAX_H = 340

export interface SlashAnchor {
  /** Coordenadas de la `/` en la ventana (de `view.coordsAtPos`). */
  readonly left: number
  readonly top: number
  readonly bottom: number
}

interface SlashMenuProps {
  items: readonly InsertItem[]
  query: string
  active: number
  anchor: SlashAnchor
  onPick: (item: InsertItem) => void
  onHover: (index: number) => void
}

/**
 * Menú **`/`**: aparece al escribir `/` en el texto y filtra mientras se tipea (`/teo` → Teorema).
 * Es solo presentación: el teclado (↑ ↓ Enter Esc) lo maneja el workspace desde el editor, para
 * que el foco nunca salga del texto.
 */
export function SlashMenu({ items, query, active, anchor, onPick, onHover }: SlashMenuProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const below = anchor.bottom + 6 + MENU_MAX_H <= window.innerHeight
  const position = below ? { top: anchor.bottom + 6 } : { bottom: window.innerHeight - anchor.top + 6 }
  const left = Math.min(anchor.left, window.innerWidth - 300)

  return (
    <div
      role="listbox"
      aria-label="Insertar"
      className="matex-slash-menu fixed z-50 flex w-[290px] flex-col overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) shadow-2xl"
      style={{ left, ...position, maxHeight: MENU_MAX_H }}
      // Que el clic no le saque el foco al editor antes de insertar.
      onMouseDown={(event) => event.preventDefault()}
    >
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-(--color-ink-muted)">
            Nada coincide con «{query}».
          </p>
        ) : (
          items.map((item, index) => (
            <div key={item.id}>
              {(index === 0 || items[index - 1]!.group !== item.group) && (
                <div className="px-2 pt-2 pb-1 text-[10.5px] font-semibold tracking-wide text-(--color-ink-muted) uppercase">
                  {item.group}
                </div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                data-active={index === active ? '' : undefined}
                onClick={() => onPick(item)}
                onMouseEnter={() => onHover(index)}
                className={[
                  'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left',
                  index === active ? 'bg-(--color-primary)/15' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'grid size-8 shrink-0 place-items-center rounded-md border text-[13px] font-semibold',
                    index === active
                      ? 'border-(--color-primary) text-(--color-ink)'
                      : 'border-(--color-border) text-(--color-ink-muted)',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {item.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-(--color-ink)">{item.label}</span>
                  <span className="block truncate text-xs text-(--color-ink-muted)">{item.description}</span>
                </span>
                {item.hint && (
                  <kbd className="shrink-0 rounded border border-(--color-border) px-1.5 font-mono text-[11px] text-(--color-ink-muted)">
                    {item.hint}
                  </kbd>
                )}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-(--color-border) px-3 py-1.5 text-[11px] text-(--color-ink-muted)">
        ↑↓ para moverte · Enter para insertar · Esc para cerrar
      </div>
    </div>
  )
}
