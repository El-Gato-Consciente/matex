/**
 * Paleta de colores de los gráficos, **compartida** por el compilador (nombre pgfplots)
 * y el preview SVG (hex) → las curvas se ven del mismo color en el editor y en el PDF.
 * Se asigna por **índice** de función (auto-ciclo), sin ensuciar el modelo.
 */
export interface PlotColor {
  /** Nombre estable (clave que se persiste en `PlotFunction.color`). */
  name: string
  /** Color en sintaxis xcolor/pgfplots. */
  pgf: string
  /** Color hex para el SVG. */
  hex: string
}

export const PLOT_COLORS: readonly PlotColor[] = [
  { name: 'blue', pgf: 'blue', hex: '#3b6fe0' },
  { name: 'red', pgf: 'red', hex: '#e0553a' },
  { name: 'green', pgf: 'green!60!black', hex: '#2f9e44' },
  { name: 'orange', pgf: 'orange', hex: '#e08a2f' },
  { name: 'violet', pgf: 'violet', hex: '#9a55d0' },
  { name: 'teal', pgf: 'teal', hex: '#159a9a' },
]

/** Color de la `i`-ésima función (cicla si hay más funciones que colores). */
export function plotColor(i: number): PlotColor {
  return PLOT_COLORS[((i % PLOT_COLORS.length) + PLOT_COLORS.length) % PLOT_COLORS.length]!
}

/** Busca un color por su `name`, o `undefined` si no está en la paleta. */
export function plotColorByName(name: string | undefined): PlotColor | undefined {
  return name ? PLOT_COLORS.find((c) => c.name === name) : undefined
}

/** Color efectivo de una función: el elegido (`color`) o el automático por índice. */
export function resolvePlotColor(color: string | undefined, i: number): PlotColor {
  return plotColorByName(color) ?? plotColor(i)
}
