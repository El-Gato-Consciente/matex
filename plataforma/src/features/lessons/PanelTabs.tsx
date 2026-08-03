interface PanelTabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  /** Pares [valor, etiqueta]. */
  options: ReadonlyArray<readonly [T, string]>
}

/** Control segmentado para alternar el contenido de un panel (p. ej. Explicación | Archivos). */
export function PanelTabs<T extends string>({ value, onChange, options }: PanelTabsProps<T>) {
  return (
    <div className="flex rounded-md border border-(--color-border) p-0.5 text-xs">
      {options.map(([val, label]) => {
        const active = value === val
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={[
              'flex-1 rounded px-3 py-1 font-medium',
              active
                ? 'bg-(--color-primary) text-(--color-primary-ink)'
                : 'text-(--color-ink-muted) hover:text-(--color-ink)',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
