import type { Node, Fragment } from '@tiptap/pm/model'
import { getLatexSerializer, type LatexSerializerContext } from './LatexSerializerRegistry'

/* ─────────────────────────────────────────────────────────────────
   TexSerializer — Phase 1
   Converts a ProseMirror document tree to a compilable .tex string.
   Preamble is hardcoded (article-pro minimal).
   Phase 4 will replace this with ManifestEngine-driven generation.
   ───────────────────────────────────────────────────────────────── */

export class TexSerializer {

  serialize(doc: Node): string {
    const body = this._serializeFragment(doc.content)
    return this._wrapDocument(body)
  }

  // ── Document wrapper ────────────────────────────────────────────

  private _wrapDocument(body: string): string {
    return [
      '\\documentclass{article}',
      '\\usepackage[utf8]{inputenc}',
      '\\usepackage[T1]{fontenc}',
      '\\usepackage{amsmath,amssymb,amsthm}',
      '\\usepackage{mathtools}',
      '\\usepackage{hyperref}',
      '',
      '% Theorem environments',
      '\\theoremstyle{plain}',
      '\\newtheorem{theorem}{Theorem}',
      '\\newtheorem{lemma}[theorem]{Lemma}',
      '\\newtheorem{proposition}[theorem]{Proposition}',
      '\\newtheorem{corollary}[theorem]{Corollary}',
      '\\theoremstyle{definition}',
      '\\newtheorem{definition}[theorem]{Definition}',
      '\\newtheorem{example}[theorem]{Example}',
      '\\newtheorem{exercise}[theorem]{Exercise}',
      '\\theoremstyle{remark}',
      '\\newtheorem*{remark}{Remark}',
      '\\newtheorem*{note}{Note}',
      '',
      '\\begin{document}',
      '',
      body.trim(),
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
