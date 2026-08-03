import {
  snippet,
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import { LATEX_COMMANDS, LATEX_ENVIRONMENTS, LATEX_PACKAGES } from './latexCommands'

/**
 * Si justo después del cursor hay una `}` (p. ej. la que auto-cerró basicSetup al
 * tipear `{`), la incluye en el rango a reemplazar. Evita el `}` de más al
 * autocompletar `\begin{`/`\end{`.
 */
function consumeClosingBrace(view: EditorView, to: number): number {
  return view.state.sliceDoc(to, to + 1) === '}' ? to + 1 : to
}

type EnvApply = (view: EditorView, completion: Completion, from: number, to: number) => void

/** `\end{env}` (o cerrar el abierto): inserta `env}` consumiendo una `}` sobrante. */
function endApply(name: string): EnvApply {
  return (view, _completion, from, to) => {
    view.dispatch({
      changes: { from, to: consumeClosingBrace(view, to), insert: `${name}}` },
      selection: { anchor: from + name.length + 1 },
    })
  }
}

/** `\begin{env}…\end{env}` como snippet, consumiendo la `}` auto-cerrada. */
function beginApply(template: string): EnvApply {
  const run = snippet(template)
  return (view, completion, from, to) => run(view, completion, from, consumeClosingBrace(view, to))
}

// Opciones precomputadas (los comandos con `template` insertan un snippet).
const COMMAND_OPTIONS: Completion[] = LATEX_COMMANDS.map((command) =>
  command.template
    ? snippetCompletion(command.template, { label: command.name, type: 'keyword', detail: command.detail })
    : { label: command.name, type: 'keyword', detail: command.detail },
)

// `\begin{...}` inserta el entorno completo con su `\end`; `\end{...}` solo cierra.
const BEGIN_OPTIONS: Completion[] = LATEX_ENVIRONMENTS.map((env) => ({
  label: env.name,
  type: 'class',
  detail: env.detail,
  apply: beginApply(env.template),
}))
const END_OPTIONS: Completion[] = LATEX_ENVIRONMENTS.map((env) => ({
  label: env.name,
  type: 'class',
  detail: env.detail,
  apply: endApply(env.name),
}))

const PACKAGE_OPTIONS: Completion[] = LATEX_PACKAGES.map((pkg) => ({
  label: pkg.name,
  type: 'namespace',
  detail: pkg.detail,
}))

/** Recolecta el grupo 1 de todas las coincidencias (sin repetir). */
function keysMatching(doc: string, re: RegExp): string[] {
  const out = new Set<string>()
  for (const match of doc.matchAll(re)) if (match[1]) out.add(match[1])
  return [...out]
}

/** Entorno abierto más interno (el que un `\end` debería cerrar) en `text`. */
function innermostOpenEnv(text: string): string | null {
  const stack: string[] = []
  for (const match of text.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
    if (match[1] === 'begin') stack.push(match[2]!)
    else stack.pop()
  }
  return stack.length > 0 ? stack[stack.length - 1]! : null
}

export interface LatexCompletionOptions {
  /** Rutas del proyecto para completar `\input`/`\includegraphics`/etc. */
  getFilePaths?: () => readonly string[]
}

/**
 * Crea la fuente de autocompletado LaTeX: comandos, entornos (con `\end`
 * automático y sugiriendo primero el abierto), `\ref`/`\cite` con las etiquetas y
 * claves del documento, **paquetes** en `\usepackage{}` y **rutas de archivo** del
 * proyecto en `\input`/`\include`/`\includegraphics`/`\addbibresource`.
 */
export function createLatexCompletionSource(
  options: LatexCompletionOptions = {},
): (context: CompletionContext) => CompletionResult | null {
  const { getFilePaths } = options

  return (context: CompletionContext): CompletionResult | null => {
    // \begin{...} / \end{...}
    const env = context.matchBefore(/\\(begin|end)\{[a-zA-Z*]*/)
    if (env) {
      const from = env.from + env.text.indexOf('{') + 1
      if (env.text.startsWith('\\begin')) {
        return { from, options: BEGIN_OPTIONS, validFor: /^[a-zA-Z*]*$/ }
      }
      // \end{: ofrecer primero el entorno abierto sin cerrar.
      const open = innermostOpenEnv(context.state.doc.sliceString(0, env.from))
      const options: Completion[] = open
        ? [{ label: open, type: 'class', detail: 'cerrar el entorno abierto', apply: endApply(open), boost: 99 }, ...END_OPTIONS]
        : END_OPTIONS
      return { from, options, validFor: /^[a-zA-Z*]*$/ }
    }

    // \usepackage[...]{...} / \RequirePackage{...} → nombres de paquete.
    const pkg = context.matchBefore(/\\(usepackage|RequirePackage)(\[[^\]]*\])?\{[^}]*/)
    if (pkg) {
      const sep = Math.max(pkg.text.lastIndexOf('{'), pkg.text.lastIndexOf(','))
      return { from: pkg.from + sep + 1, options: PACKAGE_OPTIONS, validFor: /^[a-zA-Z-]*$/ }
    }

    // \input{...}, \include, \includegraphics, \subfile, \addbibresource → rutas.
    const path = context.matchBefore(/\\(input|include|includegraphics|subfile|addbibresource)(\[[^\]]*\])?\{[^}]*/)
    if (path && getFilePaths) {
      const from = path.from + path.text.lastIndexOf('{') + 1
      const options: Completion[] = getFilePaths().map((p) => ({ label: p, type: 'file' }))
      return { from, options, validFor: /^[^}]*$/ }
    }

    // \ref{...} y parientes → etiquetas \label del documento.
    const ref = context.matchBefore(/\\(ref|eqref|cref|Cref|pageref|autoref)\{[^}\s]*/)
    if (ref) {
      const from = ref.from + ref.text.indexOf('{') + 1
      const labels = keysMatching(context.state.doc.toString(), /\\label\{([^}]+)\}/g)
      return { from, options: labels.map((label) => ({ label, type: 'variable' })), validFor: /^[^}\s]*$/ }
    }

    // \cite{...} y parientes → claves de \bibitem o de un .bib (@type{clave,).
    const cite = context.matchBefore(/\\(cite|textcite|parencite|citep|citet|footcite)\{[^}\s]*/)
    if (cite) {
      const from = cite.from + cite.text.indexOf('{') + 1
      const doc = context.state.doc.toString()
      const keys = [
        ...keysMatching(doc, /\\bibitem\{([^}]+)\}/g),
        ...keysMatching(doc, /@\w+\s*\{\s*([^,\s]+)\s*,/g),
      ]
      return {
        from,
        options: [...new Set(keys)].map((key) => ({ label: key, type: 'variable' })),
        validFor: /^[^}\s]*$/,
      }
    }

    // \comando
    const cmd = context.matchBefore(/\\[a-zA-Z@]*/)
    if (cmd) {
      return { from: cmd.from, options: COMMAND_OPTIONS, validFor: /^\\[a-zA-Z@]*$/ }
    }

    return null
  }
}

/** Fuente por defecto (sin rutas de proyecto). La usa el editor y los tests. */
export const latexCompletionSource = createLatexCompletionSource()
