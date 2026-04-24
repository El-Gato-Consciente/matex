import type { Node, Fragment } from '@tiptap/pm/model'
import { getLatexSerializer, type LatexSerializerContext } from './LatexSerializerRegistry'
import type { DocMeta } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   TexSerializer — Phase 1
   Converts a ProseMirror document tree to a compilable .tex string.
   Preamble is hardcoded (article-pro minimal).
   Phase 4 will replace this with ManifestEngine-driven generation.
   ───────────────────────────────────────────────────────────────── */

export class TexSerializer {

  serialize(doc: Node, meta?: Partial<DocMeta>): string {
    const body = this._serializeFragment(doc.content)
    return this._wrapDocument(body, meta)
  }

  // ── Document wrapper ────────────────────────────────────────────

  private _wrapDocument(body: string, meta?: Partial<DocMeta>): string {
    const lang = meta?.language ?? 'es'
    const isEs = lang === 'es'

    // Theorem environment names
    const T = isEs
      ? { theorem: 'Teorema', lemma: 'Lema', proposition: 'Proposición', corollary: 'Corolario',
          definition: 'Definición', example: 'Ejemplo', exercise: 'Ejercicio',
          remark: 'Observación', note: 'Nota' }
      : { theorem: 'Theorem', lemma: 'Lemma', proposition: 'Proposition', corollary: 'Corollary',
          definition: 'Definition', example: 'Example', exercise: 'Exercise',
          remark: 'Remark', note: 'Note' }

    // Author block — append email as \thanks{} and institution as \\ line
    let authorBlock = ''
    if (meta?.author) {
      authorBlock = this._escapeLatex(meta.author)
      if (meta?.email) authorBlock += `\\thanks{\\texttt{${this._escapeLatex(meta.email)}}}`
      if (meta?.institution) authorBlock += `\\\\\n\\small ${this._escapeLatex(meta.institution)}`
    }

    const metaLines: string[] = []
    if (meta?.title)  metaLines.push(`\\title{${this._escapeLatex(meta.title)}}`)
    if (authorBlock)  metaLines.push(`\\author{${authorBlock}}`)
    if (meta?.date)   metaLines.push(`\\date{${this._escapeLatex(meta.date)}}`)
    else if (meta?.title) metaLines.push('\\date{\\today}')
    const hasMaketitle = metaLines.length > 0

    const bodyLines: string[] = []
    if (hasMaketitle) bodyLines.push('\\maketitle', '')
    if (meta?.abstract?.trim()) {
      bodyLines.push('\\begin{abstract}', meta.abstract.trim(), '\\end{abstract}', '')
    }
    if (meta?.keywords?.trim()) {
      const kwLabel = isEs ? 'Palabras clave' : 'Keywords'
      bodyLines.push(`\\noindent\\textbf{${kwLabel}:} ${this._escapeLatex(meta.keywords)}`, '', '')
    }
    bodyLines.push(body.trim())

    return [
      '\\documentclass{article}',
      '\\usepackage[utf8]{inputenc}',
      '\\usepackage[T1]{fontenc}',
      `\\usepackage[${isEs ? 'spanish' : 'english'}]{babel}`,
      '\\usepackage{amsmath,amssymb,amsthm}',
      '\\usepackage{mathtools}',
      '\\usepackage{hyperref}',
      '',
      '% Theorem environments',
      '\\theoremstyle{plain}',
      `\\newtheorem{theorem}{${T.theorem}}`,
      `\\newtheorem{lemma}[theorem]{${T.lemma}}`,
      `\\newtheorem{proposition}[theorem]{${T.proposition}}`,
      `\\newtheorem{corollary}[theorem]{${T.corollary}}`,
      '\\theoremstyle{definition}',
      `\\newtheorem{definition}[theorem]{${T.definition}}`,
      `\\newtheorem{example}[theorem]{${T.example}}`,
      `\\newtheorem{exercise}[theorem]{${T.exercise}}`,
      '\\theoremstyle{remark}',
      `\\newtheorem*{remark}{${T.remark}}`,
      `\\newtheorem*{note}{${T.note}}`,
      '',
      ...metaLines,
      '',
      '\\begin{document}',
      '',
      ...bodyLines,
      '',
      '\\end{document}',
    ].join('\n')
  }

  // ── Fragment serialization ──────────────────────────────────────

  private _serializeFragment(fragment: Fragment): string {
    const parts: string[] = []
    fragment.forEach(node => {
      parts.push(this._serializeNode(node))
    })
    return parts.join('\n')
  }

  private _ctx(): LatexSerializerContext {
    return {
      serializeFragment: (f) => this._serializeFragment(f),
      serializeInline:   (f) => this._serializeInlineContent(f),
      serializeNode:     (n) => this._serializeNode(n),
    }
  }

  private _serializeNode(node: Node): string {
    const custom = getLatexSerializer(node.type.name)
    if (custom) return custom(node, this._ctx())

    switch (node.type.name) {
      case 'doc':         return this._serializeFragment(node.content)
      case 'paragraph':   return this._serializeParagraph(node)
      case 'heading':     return this._serializeHeading(node)
      case 'bulletList':  return this._serializeList(node, false)
      case 'orderedList': return this._serializeList(node, true)
      case 'listItem':    return this._serializeListItem(node)
      case 'blockquote':  return this._serializeBlockquote(node)
      case 'hardBreak':   return '\\\\'
      default:
        return this._serializeInlineContent(node.content)
    }
  }

  // ── Block nodes ─────────────────────────────────────────────────

  private _serializeParagraph(node: Node): string {
    const text = this._serializeInlineContent(node.content)
    return text ? `${text}\n` : ''
  }

  private _serializeHeading(node: Node): string {
    const level   = node.attrs['level'] as number
    const content = this._serializeInlineContent(node.content)
    const cmds    = ['\\section', '\\subsection', '\\subsubsection']
    const cmd     = cmds[level - 1] ?? '\\paragraph'
    return `${cmd}{${content}}\n`
  }

  private _serializeList(node: Node, ordered: boolean): string {
    const env   = ordered ? 'enumerate' : 'itemize'
    const items = this._serializeFragment(node.content)
    return `\\begin{${env}}\n${items}\\end{${env}}\n`
  }

  private _serializeListItem(node: Node): string {
    const content = this._serializeFragment(node.content).trim()
    return `  \\item ${content}\n`
  }

  private _serializeBlockquote(node: Node): string {
    const content = this._serializeFragment(node.content).trim()
    return `\\begin{quote}\n${content}\n\\end{quote}\n`
  }

  // ── Inline content ──────────────────────────────────────────────

  private _serializeInlineContent(fragment: Fragment): string {
    const parts: string[] = []
    fragment.forEach(node => {
      parts.push(this._serializeInlineNode(node))
    })
    return parts.join('')
  }

  private _serializeInlineNode(node: Node): string {
    const custom = getLatexSerializer(node.type.name)
    if (custom) return custom(node, this._ctx())
    if (node.type.name === 'hardBreak') return '\\\\\n'
    if (node.isText) return this._serializeTextWithMarks(node)
    return ''
  }

  private _serializeTextWithMarks(node: Node): string {
    let text = this._escapeLatex(node.text ?? '')

    // Apply marks inside-out: innermost first (last in array = innermost in spec)
    const marks = [...node.marks].reverse()
    for (const mark of marks) {
      switch (mark.type.name) {
        case 'bold':   text = `\\textbf{${text}}`; break
        case 'italic': text = `\\textit{${text}}`; break
        case 'code':   text = `\\texttt{${text}}`; break
      }
    }
    return text
  }

  // ── LaTeX escaping for plain text ───────────────────────────────

  private _escapeLatex(text: string): string {
    return text
      .replace(/\\/g,  '\\textbackslash{}')
      .replace(/&/g,   '\\&')
      .replace(/%/g,   '\\%')
      .replace(/\$/g,  '\\$')
      .replace(/#/g,   '\\#')
      .replace(/_/g,   '\\_')
      .replace(/\{/g,  '\\{')
      .replace(/\}/g,  '\\}')
      .replace(/~/g,   '\\textasciitilde{}')
      .replace(/\^/g,  '\\textasciicircum{}')
  }
}
