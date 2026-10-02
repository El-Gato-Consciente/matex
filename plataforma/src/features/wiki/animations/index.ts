import type { ComponentType } from 'react'
import { Arbol } from './Arbol'
import { Diseno } from './Diseno'
import { Grafico } from './Grafico'
import { Intencion } from './Intencion'
import { TresSalidas } from './TresSalidas'
import type { WikiAnimationProps } from './types'
import { VistaPrevia } from './VistaPrevia'

/** Registro de animaciones: las páginas las piden por id (ver `WikiBlock`). */
export const WIKI_ANIMATIONS = {
  'tres-salidas': TresSalidas,
  intencion: Intencion,
  arbol: Arbol,
  grafico: Grafico,
  diseno: Diseno,
  'vista-previa': VistaPrevia,
} satisfies Record<string, ComponentType<WikiAnimationProps>>

export type WikiAnimationId = keyof typeof WIKI_ANIMATIONS
