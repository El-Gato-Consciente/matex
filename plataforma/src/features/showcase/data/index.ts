import { exemplarSchema, type Exemplar } from '../types'
import { apunte } from './apunte'
import { beamer } from './beamer'
import { carta } from './carta'
import { cv } from './cv'
import { examen } from './examen'
import { koma } from './koma'
import { libro } from './libro'
import { monografia } from './monografia'
import { paper } from './paper'
import { poster } from './poster'
import { tesina } from './tesina'

/** Galería de ejemplares, validados con zod al cargar (fail-fast). */
export const exemplars: Exemplar[] = [
  monografia,
  tesina,
  paper,
  apunte,
  beamer,
  libro,
  koma,
  carta,
  examen,
  cv,
  poster,
].map((entry) => exemplarSchema.parse(entry))

export function findExemplar(id: string): Exemplar | undefined {
  return exemplars.find((entry) => entry.id === id)
}
