import type { AccentColor } from '../ast'

/**
 * **Política compartida del acento**: qué color concreto es cada `AccentColor` semántico. Antes
 * vivía escrito adentro del CSS del backend HTML; la usan también el lienzo del editor y las
 * miniaturas de la galería, y si cada uno tuviera su tabla, «naranja» sería tres naranjas.
 */
export const ACCENT_HEX: Readonly<Record<AccentColor, string>> = {
  blue: '#1a5fb4',
  green: '#2a9d3a',
  orange: '#c96a12',
  red: '#c01c28',
  purple: '#7239a8',
  grey: '#5a5a5a',
  black: '#1a1a1a',
}

/** Acento cuando el documento no elige uno («Del diseño»). Es el de los temas del HTML. */
export const DEFAULT_ACCENT_HEX = ACCENT_HEX.green

export function accentHex(accent: AccentColor | undefined): string {
  return accent ? ACCENT_HEX[accent] : DEFAULT_ACCENT_HEX
}

/** Las clases `.mx-accent-*` del backend HTML, generadas desde la tabla. */
export function accentCss(): string {
  return Object.entries(ACCENT_HEX)
    .map(([name, hex]) => `.mx-accent-${name} { --mx-accent:${hex}; }`)
    .join('\n')
}
