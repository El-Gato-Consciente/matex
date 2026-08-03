/**
 * Pregunta de opción múltiple. Se guarda la respuesta **correcta** y los
 * **distractores** por separado; las opciones se mezclan en runtime, así la
 * correcta cae en una posición al azar. Pautas de autoría: distractores
 * plausibles y de **largo parejo** al correcto, para que no se pueda adivinar.
 */
export interface Question {
  readonly id: string
  readonly lessonId: string
  readonly level: number
  readonly prompt: string
  readonly answer: string
  readonly distractors: readonly string[]
  /** Explicación profunda de por qué la respuesta es correcta (se muestra al responder). */
  readonly explanation: string
}
