/**
 * **Tema de estilo por rol semántico (ME-38).** Una curva declara *qué es* (`role`) y este módulo
 * resuelve *cómo se ve* —color, grosor, guion— de forma **coherente en los 3 backends** (SVG/HTML y
 * pgfplots). Es la tesis de Matex aplicada al estilo: se declara la intención, el compilador la
 * materializa. Precedencia: **override explícito (`color`/`style`) › rol (tema) › default por índice**
 * → el rol es puramente aditivo (nunca pisa lo que el usuario fijó a mano).
 */
import type { PlotLineStyle, PlotLineWidth, PlotRole } from './ast'
import { plotColor, plotColorByName, type PlotColor } from './plotColors'

export type { PlotRole } from './ast'

/** Roles en orden de presentación (para el selector del editor). */
export const PLOT_ROLES: readonly PlotRole[] = ['primary', 'secondary', 'derivative', 'auxiliary', 'highlight', 'region']

/** Etiqueta legible de cada rol (editor). */
export const PLOT_ROLE_LABEL: Record<PlotRole, string> = {
  primary: 'principal',
  secondary: 'secundaria',
  derivative: 'derivada',
  auxiliary: 'auxiliar (asíntota/tangente)',
  highlight: 'destacada',
  region: 'región',
}

// Colores **fuera** del ciclo de la paleta, para roles con color fijo.
const MUTED: PlotColor = { name: 'muted', pgf: 'black!45', hex: '#8a8f98' } // auxiliar: neutro
const ACCENT: PlotColor = { name: 'accent', pgf: 'magenta!85!black', hex: '#d6336c' } // destacada: acento

interface RoleStyle {
  /** De dónde sale el color: el ciclo por índice, el neutro, o el acento. */
  colorSource: 'index' | 'muted' | 'accent'
  /** Grosor del trazo en px (backend SVG). */
  strokeWidth: number
  /** Palabra clave de grosor de pgfplots (`''` = grosor por defecto). */
  pgfWidth: string
  dash: PlotLineStyle
}

const THEME: Record<PlotRole, RoleStyle> = {
  primary: { colorSource: 'index', strokeWidth: 2.0, pgfWidth: 'thick', dash: 'solid' },
  secondary: { colorSource: 'index', strokeWidth: 1.6, pgfWidth: 'semithick', dash: 'solid' },
  derivative: { colorSource: 'index', strokeWidth: 1.3, pgfWidth: 'thin', dash: 'solid' },
  auxiliary: { colorSource: 'muted', strokeWidth: 1.2, pgfWidth: 'thin', dash: 'dashed' },
  highlight: { colorSource: 'accent', strokeWidth: 2.2, pgfWidth: 'very thick', dash: 'solid' },
  region: { colorSource: 'index', strokeWidth: 1.6, pgfWidth: 'semithick', dash: 'solid' },
}

/** Estilo sin rol: réplica del comportamiento previo (color por índice, trazo 1.6px, continuo). */
const DEFAULT: RoleStyle = { colorSource: 'index', strokeWidth: 1.6, pgfWidth: '', dash: 'solid' }

/** Grosor explícito (override) → px (SVG) + keyword pgfplots. Gana sobre el del rol. */
const WIDTH_MAP: Record<PlotLineWidth, { strokeWidth: number; pgfWidth: string }> = {
  xthin: { strokeWidth: 0.7, pgfWidth: 'very thin' },
  thin: { strokeWidth: 1.1, pgfWidth: 'thin' },
  normal: { strokeWidth: 1.6, pgfWidth: 'semithick' },
  thick: { strokeWidth: 2.4, pgfWidth: 'thick' },
  xthick: { strokeWidth: 3.2, pgfWidth: 'very thick' },
}

/** Estilo **efectivo** de una curva, ya resuelto para todos los backends. */
export interface EffectivePlotStyle {
  color: PlotColor
  /** px para `stroke-width` del SVG. */
  strokeWidth: number
  /** keyword pgfplots (`''` si no aplica opción de grosor). */
  pgfWidth: string
  dash: PlotLineStyle
}

/**
 * Resuelve el estilo efectivo combinando override explícito › rol › default por índice.
 * @param o.color estilo explícito de color (nombre de paleta) — gana sobre el rol.
 * @param o.style estilo explícito de trazo — gana sobre el guion del rol.
 * @param o.role  rol semántico — resuelto por el tema si no hay override.
 * @param o.index posición de la curva (para el color cíclico).
 */
export function resolvePlotStyle(o: { color?: string | undefined; style?: PlotLineStyle | undefined; width?: PlotLineWidth | undefined; role?: PlotRole | undefined; index: number }): EffectivePlotStyle {
  const rs = o.role ? THEME[o.role] : DEFAULT
  const roleColor = rs.colorSource === 'muted' ? MUTED : rs.colorSource === 'accent' ? ACCENT : plotColor(o.index)
  const wm = o.width ? WIDTH_MAP[o.width] : null // grosor explícito pisa el del rol
  return {
    color: plotColorByName(o.color) ?? roleColor,
    strokeWidth: wm ? wm.strokeWidth : rs.strokeWidth,
    pgfWidth: wm ? wm.pgfWidth : rs.pgfWidth,
    dash: o.style ?? rs.dash,
  }
}
