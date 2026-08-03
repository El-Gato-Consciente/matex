import { PanelResizeHandle } from 'react-resizable-panels'

interface ResizeHandleProps {
  /** Dirección del grupo de paneles. Horizontal ⇒ divisor vertical, y viceversa. */
  direction: 'horizontal' | 'vertical'
}

/**
 * Divisor arrastrable entre paneles. Línea fina que se resalta en hover/drag,
 * con un área de agarre más ancha. Se orienta según la dirección del grupo.
 */
export function ResizeHandle({ direction }: ResizeHandleProps) {
  const isVerticalLine = direction === 'horizontal'

  return (
    <PanelResizeHandle
      className={[
        'group relative shrink-0 bg-(--color-border) outline-none',
        isVerticalLine ? 'w-px' : 'h-px',
      ].join(' ')}
    >
      <div
        className={[
          'absolute z-10',
          isVerticalLine ? 'inset-y-0 -left-1.5 -right-1.5' : 'inset-x-0 -top-1.5 -bottom-1.5',
        ].join(' ')}
      />
      <div
        className={[
          'absolute bg-(--color-primary) opacity-0 transition-opacity',
          'group-data-[resize-handle-state=drag]:opacity-100 group-data-[resize-handle-state=hover]:opacity-100',
          isVerticalLine ? 'inset-y-0 -left-px -right-px' : 'inset-x-0 -top-px -bottom-px',
        ].join(' ')}
      />
    </PanelResizeHandle>
  )
}
