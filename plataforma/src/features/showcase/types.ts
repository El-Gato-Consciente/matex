import { z } from 'zod'
import type { MatexDoc } from '../matex/core'

/**
 * **Ejemplar** de la Galería: un documento real y completo (no de juguete) que
 * desarrolla un tema con las mejores técnicas para su tipo de documento. Se
 * estudia (fuente comentada + PDF) y se puede copiar para arrancar un proyecto.
 *
 * Es **dato** validado con zod al cargar (fail-fast). Cada `source` se verifica
 * compilando contra el backend real antes de publicarse.
 */
export const exemplarSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Tipo/clase de documento que ejemplifica (Monografía, Paper, Presentación…). */
  docType: z.string(),
  /** Una o dos frases: de qué trata y por qué es un buen modelo. */
  description: z.string(),
  /** Técnicas/paquetes destacados que muestra (para los tags de la tarjeta). */
  techniques: z.array(z.string()).default([]),
  /** Fuente LaTeX del archivo **principal**, comentada. */
  source: z.string(),
  /** Archivos acompañantes (proyecto multi-archivo): capítulos, `refs.bib`, imágenes… */
  files: z
    .array(z.object({ path: z.string(), content: z.string(), encoding: z.enum(['utf8', 'base64']).optional() }))
    .default([]),
  /** Nombre del archivo principal. */
  mainFile: z.string().default('main.tex'),
  /**
   * **Versión Matex** (AST) del mismo documento, autorada a mano (ME-EPIC-1 / ME-23). Si está,
   * la galería ofrece "Abrir en Matex" (editor visual) además de LaTeX. Solo la tienen los tipos
   * que el modelo Matex expresa (prosa académica clase `article`); beamer/póster/CV/etc. no.
   */
  matex: z.custom<MatexDoc>().optional(),
})

export type Exemplar = z.infer<typeof exemplarSchema>
export type ExemplarInput = z.input<typeof exemplarSchema>
