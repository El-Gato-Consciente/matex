import type { BlockNode, DocStyle, InlineNode, MatexDoc } from '@/features/matex/core/ast'
import { accentHex } from '@/features/matex/core/policy/accent'
import { mainContent, type Project } from './types'

/**
 * **El esqueleto de un proyecto, para dibujar su miniatura** en la galería. No se compila nada:
 * se lee lo que el documento ya dice —su título, sus secciones, dónde hay fórmulas, figuras o
 * teoremas— y la miniatura lo dibuja en ese orden. Así cada tarjeta se parece a *su* documento,
 * sin pedirle nada al compilador ni guardar imágenes.
 *
 * Puro: sirve igual para proyectos Matex (lee el AST) y LaTeX (lee el `.tex` principal).
 */

export type OutlineBlock =
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'text'; readonly lines: number }
  | { readonly kind: 'math' }
  | { readonly kind: 'figure' }
  | { readonly kind: 'box' }

export interface ProjectOutline {
  readonly title: string
  /** Presentaciones: hoja apaisada (16:10) en vez de A4. */
  readonly landscape: boolean
  readonly style: DocStyle
  /** Color del acento (el mismo que usa el HTML exportado). */
  readonly accent: string
  readonly blocks: readonly OutlineBlock[]
}

/** Más bloques no entran en la miniatura: el resto queda «debajo del pliegue». */
const MAX_BLOCKS = 8

export function projectOutline(project: Project): ProjectOutline {
  return project.kind === 'matex' && project.ast ? matexOutline(project) : latexOutline(project)
}

function matexOutline(project: Project): ProjectOutline {
  return docOutline(project.ast!, project.name)
}

/**
 * Esqueleto de un documento Matex suelto (sin proyecto alrededor). Lo usa también la vista en
 * vivo de la ventana Documento, que muestra el documento abierto mientras se elige el diseño.
 */
export function docOutline(ast: MatexDoc, fallbackTitle: string): ProjectOutline {
  const meta = ast.meta ?? {}
  return {
    title: meta.title?.trim() || fallbackTitle,
    landscape: meta.family?.kind === 'presentation',
    style: meta.style ?? 'standard',
    accent: accentHex(meta.accent),
    blocks: flattenBlocks(ast.content).slice(0, MAX_BLOCKS),
  }
}

/** Recorre el contenido en orden; diapositivas y columnas aportan lo que tienen adentro. */
function flattenBlocks(blocks: readonly BlockNode[]): OutlineBlock[] {
  const out: OutlineBlock[] = []
  for (const block of blocks) {
    if (out.length >= MAX_BLOCKS) break
    switch (block.type) {
      case 'heading':
        out.push({ kind: 'heading', text: inlineText(block.content) })
        break
      case 'paragraph':
        out.push({ kind: 'text', lines: Math.min(4, Math.max(1, Math.ceil(inlineText(block.content).length / 70))) })
        break
      case 'bulletList':
      case 'orderedList':
        out.push({ kind: 'text', lines: Math.min(4, block.items.length) })
        break
      case 'mathDisplay':
      case 'derivation':
      case 'reasoning':
        out.push({ kind: 'math' })
        break
      case 'figure':
      case 'table':
        out.push({ kind: 'figure' })
        break
      case 'theorem':
      case 'callout':
      case 'codeBlock':
        out.push({ kind: 'box' })
        break
      case 'slide':
        if (block.title) out.push({ kind: 'heading', text: block.title })
        out.push(...flattenBlocks(block.content))
        break
      case 'columns':
        out.push(...flattenBlocks(block.columns.flatMap((column) => column.content)))
        break
      default:
        out.push({ kind: 'text', lines: 2 })
    }
  }
  return out
}

function inlineText(content: readonly InlineNode[]): string {
  return content.map((node) => (node.type === 'text' ? node.text : node.type === 'mathInline' ? '∗' : '')).join('').trim()
}

/* ── LaTeX: una lectura aproximada del .tex (para la miniatura alcanza) ───────────────────── */

const SECTION_RE = /\\(?:chapter|section|subsection|frametitle)\*?\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/
const MATH_RE = /\\\[|\\begin\{(?:equation|align|gather|multline)\*?\}|\$\$/
const FIGURE_RE = /\\begin\{(?:figure|table|tabular|tikzpicture|axis)\}|\\includegraphics/
const BOX_RE = /\\begin\{(?:theorem|lemma|proposition|corollary|definition|proof|example|remark|lstlisting|minted|verbatim|tcolorbox)\*?\}/

function latexOutline(project: Project): ProjectOutline {
  const source = mainContent(project)
  const title = cleanTex(/\\title\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/.exec(source)?.[1] ?? '') || project.name
  const beginAt = source.indexOf('\\begin{document}')
  const body = (beginAt >= 0 ? source.slice(beginAt + '\\begin{document}'.length) : source).replace(/(^|[^\\])%.*$/gm, '$1')

  const blocks: OutlineBlock[] = []
  for (const chunk of body.split(/\n\s*\n/)) {
    if (blocks.length >= MAX_BLOCKS) break
    const text = chunk.trim()
    if (!text || /^\\(?:maketitle|tableofcontents|end\{document\}|newpage|clearpage)/.test(text)) continue
    const section = SECTION_RE.exec(text)
    if (section) {
      blocks.push({ kind: 'heading', text: cleanTex(section[1] ?? '') })
      const rest = text.slice((section.index ?? 0) + section[0].length).trim()
      if (rest) blocks.push(classifyChunk(rest))
      continue
    }
    blocks.push(classifyChunk(text))
  }

  return {
    title,
    landscape: /\\documentclass\s*(?:\[[^\]]*\])?\s*\{beamer\}/.test(source),
    style: 'standard',
    accent: accentHex(undefined),
    blocks: blocks.slice(0, MAX_BLOCKS),
  }
}

function classifyChunk(text: string): OutlineBlock {
  if (FIGURE_RE.test(text)) return { kind: 'figure' }
  if (BOX_RE.test(text)) return { kind: 'box' }
  if (MATH_RE.test(text)) return { kind: 'math' }
  return { kind: 'text', lines: Math.min(4, Math.max(1, Math.ceil(text.length / 70))) }
}

/** Saca comandos y llaves de un fragmento de LaTeX para mostrarlo como texto. */
function cleanTex(text: string): string {
  return text
    .replace(/\\\\/g, ' ')
    .replace(/\\[a-zA-Z]+\*?/g, '')
    .replace(/[{}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
