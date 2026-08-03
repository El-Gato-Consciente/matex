import { foldService } from '@codemirror/language'

/** Jerarquía de seccionado: menor número = más alto en la estructura. */
const SECTION_LEVEL: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
}

function sectionLevel(lineText: string): number | null {
  const m = lineText.match(/^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\b/)
  return m ? SECTION_LEVEL[m[1]!]! : null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Plegado LaTeX (por el margen, sin atajos): pliega bloques `\begin{env}…\end{env}`
 * (respetando anidamiento) y **secciones** (`\section`, `\subsection`, `\chapter`…)
 * hasta la próxima de igual o mayor jerarquía, `\end{document}` o el final.
 */
export const latexFolding = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart)
  const text = line.text

  // \begin{env} ... \end{env} (con anidamiento del mismo entorno).
  const begin = text.match(/\\begin\{([^}]+)\}/)
  if (begin) {
    const env = begin[1]!
    const re = new RegExp(`\\\\(begin|end)\\{${escapeRegExp(env)}\\}`, 'g')
    const rest = state.doc.sliceString(line.to)
    let depth = 1
    let match: RegExpExecArray | null
    while ((match = re.exec(rest))) {
      depth += match[1] === 'begin' ? 1 : -1
      if (depth === 0) {
        const endPos = line.to + match.index
        return endPos > line.to ? { from: line.to, to: endPos } : null
      }
    }
    return null
  }

  // Sección: pliega hasta la próxima de igual/mayor jerarquía (o fin del documento).
  const level = sectionLevel(text)
  if (level != null) {
    for (let n = line.number + 1; n <= state.doc.lines; n++) {
      const l = state.doc.line(n)
      const lv = sectionLevel(l.text)
      if ((lv != null && lv <= level) || /\\end\{document\}/.test(l.text)) {
        const prevEnd = state.doc.line(n - 1).to
        return prevEnd > line.to ? { from: line.to, to: prevEnd } : null
      }
    }
    const end = state.doc.line(state.doc.lines).to
    return end > line.to ? { from: line.to, to: end } : null
  }

  return null
})
