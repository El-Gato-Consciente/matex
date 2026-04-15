# Data Model — `.ltxj` Format

> The `.ltxj` format is the Formalia AST — the single source of truth for a document.
> Every serialization target (`.tex`, future `.docx`, future `.html`) is derived from it.
> This file is the **grammar specification** for `.ltxj`.

---

## Core Nodes vs Domain Nodes

The `.ltxj` vocabulary is split into two layers:

**Core nodes** — domain-agnostic. Present in every profile, regardless of subject area.
Any future document family (thesis, philosophy, literature) builds on these.

**Domain nodes** — specific to a subject area. Added by a profile's `supportedNodes`
declaration. The current math domain nodes (`mathInline`, `mathDisplay`, `theoremEnv`)
are the first domain extension, not part of the universal core.

```
CORE (always available)
  Block:  paragraph, heading, bulletList, orderedList, blockquote, rawLatex
  Inline: text, hardBreak, crossRef

MATH DOMAIN (article-pro and variants)
  Block:  mathDisplay, theoremEnv
  Inline: mathInline

PLANNED — not yet implemented
  Block:  footnote, figure, table
  Inline: citation
```

This separation matters for two reasons:
1. It keeps the core stable as new domains are added.
2. It makes clear that LaTeX-specific semantics (`mathInline`, `theoremEnv`) are
   domain choices, not intrinsic to the format.

---

## Top-Level Structure

```typescript
interface LtxjDocument {
  version:    string          // "1.0"
  profile:    string          // profile id, e.g. "article-pro"
  meta:       DocumentMeta
  content:    BlockNode[]     // the document body
}

interface DocumentMeta {
  title:      string
  author:     string
  subject:    string          // course / subtitle
  date:       string          // e.g. "\\today" or "2025-04-15"
  lang:       "english" | "spanish"
  includeToc: boolean
}
```

---

## Core Block Nodes

### `paragraph`

```typescript
interface ParagraphNode {
  type:    "paragraph"
  content: InlineNode[]
}
```

### `heading`

```typescript
interface HeadingNode {
  type:    "heading"
  level:   1 | 2 | 3          // 3 is rare; never use 4+
  label?:  string              // "sec:name" if cross-referenced; omit otherwise
  content: InlineNode[]
}
```

The `label` field follows the `sec:` prefix convention (see Label Prefix Convention).
A heading with no `crossRef` pointing to it has no label.

### `bulletList` / `orderedList`

```typescript
interface ListNode {
  type:  "bulletList" | "orderedList"
  items: ListItemNode[]
}

interface ListItemNode {
  type:    "listItem"
  content: BlockNode[]
}
```

### `blockquote`

```typescript
interface BlockquoteNode {
  type:    "blockquote"
  content: BlockNode[]
}
```

### `rawLatex`

```typescript
interface RawLatexNode {
  type:    "rawLatex"
  content: string             // verbatim — no normalization applied
  reason:  string             // e.g. "unsupported: tikzFigure"
}
```

`rawLatex` is the escape hatch for content that no profile-defined node covers.
It is serialized verbatim. In non-LaTeX manifests, it is dropped with a warning.

---

## Core Inline Nodes

### `text`

```typescript
interface TextNode {
  type:  "text"
  text:  string
  marks: Mark[]
}

type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "code" }
  | { type: "quote" }         // → \enquote{} via csquotes (LaTeX); typographic quotes otherwise
```

### `crossRef`

```typescript
interface CrossRefNode {
  type:     "crossRef"
  refId:    string            // e.g. "thm:bolzano", "eq:euler", "sec:introduction"
  position: "mid" | "start"  // mid-sentence vs sentence-start
}
```

`position` is inferred from text context — the user never sets it manually.
In LaTeX: `"mid"` → `\cref{refId}`, `"start"` → `\Cref{refId}`.
In the editor UI: displays as a chip `[→ Bolzano]`.

### `hardBreak`

```typescript
interface HardBreakNode {
  type: "hardBreak"           // LaTeX: \\   HTML: <br>
}
```

---

## Math Domain Block Nodes

> These nodes are provided by profiles that extend `article-base` or declare them
> in `supportedNodes`. They are not part of the core vocabulary.

### `mathDisplay`

```typescript
interface MathDisplayNode {
  type:     "mathDisplay"
  latex:    string            // canonical LaTeX (always post-normalization)
  numbered: boolean
  aligned:  boolean
  label:    string            // "" if unnumbered; "eq:name" if numbered
}
```

| `numbered` | `aligned` | LaTeX output |
|---|---|---|
| false | false | `\[…\]` |
| true  | false | `\begin{equation}\label{eq:X}…\end{equation}` |
| false | true  | `\begin{align*}…\end{align*}` |
| true  | true  | `\begin{align}…\label{eq:X}\end{align}` |

### `theoremEnv`

```typescript
type TheoremEnvType =
  | "theorem" | "lemma" | "proposition" | "corollary"
  | "definition" | "remark" | "example" | "note"
  | "exercise" | "proof"

interface TheoremEnvNode {
  type:     "theoremEnv"
  envType:  TheoremEnvType
  envTitle: string            // optional title; → \begin{theorem}[title]
  label:    string            // "" if unreferenced
  content:  BlockNode[]
}
```

---

## Math Domain Inline Nodes

### `mathInline`

```typescript
interface MathInlineNode {
  type:  "mathInline"
  latex: string               // canonical LaTeX (post-normalization)
}
```

---

## Planned Nodes (not yet implemented)

These nodes are documented here to inform current design decisions — particularly
`crossRef` semantics and `SemanticLinter` validation — without committing to implementation.

### `footnote` *(planned)*

```typescript
interface FootnoteNode {
  type:    "footnote"
  content: InlineNode[]       // rich text footnote body
}
```

Rendered inline in the editor as a superscript chip; expanded on hover.
LaTeX: `\footnote{...}`. HTML/DOCX: standard footnote.

### `citation` *(planned)*

```typescript
interface CitationNode {
  type:   "citation"
  key:    string              // bibliography key, e.g. "aristotle-nicomachean"
  pages?: string              // e.g. "12–14"
  note?:  string              // optional parenthetical
}
```

Distinct from `crossRef` (which references internal document labels).
`citation` references external bibliographic sources managed outside the document tree.
LaTeX: depends on profile — `\cite{key}`, `\autocite{key}`, `\parencite{key}`, etc.

---

## Label Prefix Convention

| Node type | Prefix | Example |
|---|---|---|
| `heading` (section) | `sec:` | `sec:introduction` |
| `mathDisplay` | `eq:` | `eq:euler` |
| `theoremEnv` theorem | `thm:` | `thm:bolzano` |
| `theoremEnv` definition | `def:` | `def:continuity` |
| `theoremEnv` lemma | `lem:` | `lem:gronwall` |
| `theoremEnv` proposition | `prop:` | `prop:density` |
| `theoremEnv` corollary | `cor:` | `cor:roots` |
| `theoremEnv` exercise | `ex:` | `ex:1` |
| `rawLatex` figure | `fig:` | `fig:diagram` |
| `rawLatex` table | `tab:` | `tab:results` |

---

## Example: Minimal Valid `.ltxj`

```json
{
  "version": "1.0",
  "profile": "article-pro",
  "meta": {
    "title": "Analysis II — Homework 1",
    "author": "Jane Doe",
    "subject": "Mathematical Analysis",
    "date": "\\today",
    "lang": "english",
    "includeToc": false
  },
  "content": [
    {
      "type": "heading",
      "level": 1,
      "content": [{ "type": "text", "text": "Exercise 1", "marks": [] }]
    },
    {
      "type": "theoremEnv",
      "envType": "exercise",
      "envTitle": "",
      "label": "ex:1",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Prove that ", "marks": [] },
            { "type": "mathInline", "latex": "f(x) = x^2" },
            { "type": "text", "text": " is continuous on ", "marks": [] },
            { "type": "mathInline", "latex": "\\R" },
            { "type": "text", "text": ".", "marks": [] }
          ]
        }
      ]
    },
    {
      "type": "mathDisplay",
      "latex": "\\left|f(x) - f(x_0)\\right| = \\left|x^2 - x_0^2\\right|",
      "numbered": false,
      "aligned": false,
      "label": ""
    }
  ]
}
```
