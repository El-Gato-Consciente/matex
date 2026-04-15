# Data Model — `.ltxj` Format

> The `.ltxj` format is the Formalia AST — the single source of truth for a document.
> Every serialization target (`.tex`, future `.docx`, future `.html`) is derived from it.
> This file is the **grammar specification** for `.ltxj`.

---

## Top-Level Structure

```typescript
interface LtxjDocument {
  version:    string          // "1.0"
  profile:    string          // manifest profile id, e.g. "article-pro"
  meta:       DocumentMeta
  content:    BlockNode[]     // the document body
}

interface DocumentMeta {
  title:    string
  author:   string
  subject:  string            // course / subtitle
  date:     string            // LaTeX date expression, e.g. "\\today"
  lang:     "english" | "spanish"
  includeToc: boolean
}
```

---

## Block Nodes

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
  type:  "heading"
  level: 1 | 2 | 3           // 3 is rare; never use 4+
  content: InlineNode[]
}
```

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

Serialization matrix:

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
  envTitle: string            // optional; → \begin{theorem}[title]
  label:    string            // "" if unreferenced
  content:  BlockNode[]
}
```

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
  content: string             // verbatim LaTeX — no normalization applied
  reason:  string             // why this node exists, e.g. "unsupported: tikzFigure"
}
```

---

## Inline Nodes

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
  | { type: "quote" }         // → \enquote{} via csquotes
```

### `mathInline`

```typescript
interface MathInlineNode {
  type:  "mathInline"
  latex: string               // canonical LaTeX (post-normalization)
}
```

### `crossRef`

```typescript
interface CrossRefNode {
  type:     "crossRef"
  refId:    string            // e.g. "thm:bolzano", "eq:euler"
  position: "mid" | "start"  // mid-sentence vs sentence-start
}
```

Serialization:
```
position "mid"   → \cref{refId}
position "start" → \Cref{refId}
```

The `position` attribute is inferred by the parser from text context — the user
never writes `\cref` or `\Cref` manually. In the editor UI, a `crossRef` node
displays as a chip: `[→ Bolzano]`.

### `hardBreak`

```typescript
interface HardBreakNode {
  type: "hardBreak"           // → \\
}
```

---

## Label Prefix Convention

The `label` field on any node must follow this prefix scheme.
The `SemanticLinter` validates all prefixes on serialization.

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
      "type": "heading",
      "level": 2,
      "content": [{ "type": "text", "text": "Solution", "marks": [] }]
    },
    {
      "type": "mathDisplay",
      "latex": "\\left|f(x) - f(x_0)\\right| = \\left|x^2 - x_0^2\\right| = \\left|x+x_0\\right|\\left|x-x_0\\right|",
      "numbered": false,
      "aligned": false,
      "label": ""
    }
  ]
}
```
