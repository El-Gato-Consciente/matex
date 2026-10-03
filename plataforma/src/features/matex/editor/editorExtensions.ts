import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { CvEntry, ExamQuestion, ExamSolution, PosterBlock } from './familyNodes'
import { MatexNumbering } from './numbering'
import {
  Callout,
  Cite,
  Column,
  Columns,
  Derivation,
  Figure,
  Footnote,
  Include,
  MatexBlockAttrs,
  MatexKeymap,
  MatexTable,
  MathDisplay,
  MathInline,
  Part,
  RawLatex,
  Reasoning,
  ReasoningCell,
  ReasoningRow,
  Ref,
  Slide,
  TableCell,
  TableHeader,
  TableRow,
  Theorem,
} from './nodes'

/**
 * **Extensiones del editor visual**: el esquema que define qué puede representar TipTap. Vive
 * fuera de `MatexWorkspace` para que los tests validen las plantillas contra **el mismo** esquema
 * que usa el editor (un nodo del modelo que falte acá hace que el documento abra vacío).
 */
export function matexEditorExtensions({ resolveSrc }: { resolveSrc: (src: string) => string | null }): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      blockquote: false,
      // `codeBlock` habilitado: nodo Matex `codeBlock` (ver mapping + compile con `listings`).
      horizontalRule: false,
      strike: false,
      hardBreak: false,
    }),
    MathInline,
    MathDisplay,
    Derivation,
    Part,
    Reasoning,
    ReasoningRow,
    ReasoningCell,
    RawLatex,
    Ref,
    Cite,
    Footnote,
    Include,
    Callout,
    Slide,
    Columns,
    Column,
    // Bloques de cada familia (examen · CV · póster): sin ellos el editor abría esas
    // plantillas vacías y el autosave las pisaba.
    ExamQuestion,
    ExamSolution,
    CvEntry,
    PosterBlock,
    Theorem,
    MatexTable,
    TableRow,
    TableHeader,
    TableCell,
    Figure.configure({ resolveSrc }),
    MatexBlockAttrs,
    MatexKeymap,
    MatexNumbering,
  ]
}
