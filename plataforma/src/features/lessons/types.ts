import { z } from 'zod'

/**
 * Modelo de la ruta de aprendizaje. Las lecciones son **datos** (no código), así
 * que autorar contenido nunca toca la lógica de la app. Validados con zod al
 * cargar para fallar temprano si una lección está mal escrita.
 *
 * El contenido de cada lección es una secuencia de **bloques** tipados, para
 * poder explicar en detalle: prosa, ejemplos de código, listas de comandos y
 * avisos (tips/advertencias).
 */

/** Párrafo(s) de explicación en Markdown (admite **negrita**, `código`, listas, enlaces). */
const proseBlock = z.object({
  kind: z.literal('prose'),
  markdown: z.string(),
})

/** Fragmento de código LaTeX ilustrativo (no necesariamente el ejemplo cargable). */
const codeBlock = z.object({
  kind: z.literal('code'),
  caption: z.string().optional(),
  latex: z.string(),
})

/** Tabla de comandos clave: comando → qué hace. */
const commandsBlock = z.object({
  kind: z.literal('commands'),
  title: z.string().optional(),
  items: z.array(z.object({ cmd: z.string(), desc: z.string() })),
})

/** Aviso destacado: tip, advertencia o nota. */
const calloutBlock = z.object({
  kind: z.literal('callout'),
  tone: z.enum(['tip', 'warning', 'note']),
  markdown: z.string(),
})

export const lessonBlockSchema = z.discriminatedUnion('kind', [
  proseBlock,
  codeBlock,
  commandsBlock,
  calloutBlock,
])

export const challengeSchema = z.object({
  prompt: z.string(),
  /** Código inicial que se carga en el editor al empezar el desafío. */
  starter: z.string(),
  /** La fuente del alumno debe incluir todos estos fragmentos para aprobar. */
  mustInclude: z.array(z.string()).default([]),
  /** Pistas progresivas, opcionales. */
  hints: z.array(z.string()).default([]),
  /** Solución de referencia (debe aprobar la verificación). Si falta, se usa el ejemplo. */
  solution: z.string().optional(),
})

export const lessonSchema = z.object({
  id: z.string(),
  /** Nivel 0 = "supervivencia"; con el básico ya se producen documentos de calidad. */
  level: z.number().int().min(0),
  title: z.string(),
  /** Capa del ecosistema a la que pertenece (pedagogía de Matex: separar planos). */
  capa: z.enum(['semantica', 'carpinteria', 'infraestructura']),
  /** Módulo temático dentro del nivel (para agrupar en el selector). */
  module: z.string().optional(),
  /** Qué va a poder hacer el alumno al terminar (una frase, en infinitivo). */
  objective: z.string(),
  /** Ids de lecciones recomendadas antes de esta. */
  prerequisites: z.array(z.string()).default([]),
  /** Explicación detallada, como secuencia de bloques. */
  content: z.array(lessonBlockSchema),
  /** Ejemplo autodemostrativo: código LaTeX que el alumno puede cargar y compilar. */
  example: z.string(),
  /**
   * Archivos **acompañantes** del proyecto (multi-archivo real). El contenido del
   * archivo principal es `example` (o el `starter`/`solution` del desafío); estos
   * son los demás (p. ej. `secciones/intro.tex`, `refs.bib`) que se compilan junto.
   */
  files: z
    .array(z.object({ path: z.string(), content: z.string(), encoding: z.enum(['utf8', 'base64']).optional() }))
    .default([]),
  /** Nombre del archivo principal a compilar. */
  mainFile: z.string().default('main.tex'),
  challenge: challengeSchema.optional(),
  /** Referencias / próximos pasos (texto libre). */
  seeAlso: z.array(z.string()).default([]),
})

export const levelSchema = z.object({
  level: z.number().int().min(0),
  title: z.string(),
  summary: z.string(),
  lessons: z.array(lessonSchema),
})

export type Capa = Lesson['capa']
export type LessonBlock = z.infer<typeof lessonBlockSchema>
export type Challenge = z.infer<typeof challengeSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type Level = z.infer<typeof levelSchema>

/** Tipo de **entrada** (antes de aplicar defaults): para autorar contenido
 * pudiendo omitir campos como `prerequisites`, `seeAlso` o `hints`. */
export type LevelInput = z.input<typeof levelSchema>
