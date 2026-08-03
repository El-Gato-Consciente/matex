import type { Template } from '../types'
import { academicos } from './academicos'
import { proyectos } from './proyectos'
import { varios } from './varios'

/** Todas las plantillas: documentos académicos + prácticos/varios + proyectos multi-archivo. */
export const templates: readonly Template[] = [...academicos, ...proyectos, ...varios]
