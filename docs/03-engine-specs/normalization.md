# Normalization Engine — Rules Reference

> This file documents the normalizer as an **AST mutation specification**.
> It intentionally contains no UI or DOM references — only tree operations.
> This design allows the engine to be ported to non-web environments.

---

## Architecture

```typescript
interface NormalizerRule {
  readonly id:          string
  readonly description: string
  readonly severity:    'required' | 'preferred' | 'opinionated'
  applies(ast: MathAST, manifest: ResolvedManifest): boolean
  transform(ast: MathAST, manifest: ResolvedManifest): NormalizerResult
}

interface NormalizerResult {
  ast:     MathAST
  changes: NormalizerChange[]
}

interface NormalizerChange {
  ruleId:       string
  description:  string    // human-readable, shown in Coach Panel
  justification: string
  before:       string    // LaTeX before transform
  after:        string    // LaTeX after transform
  reversible:   boolean
}

type NormalizerMode = 'strict' | 'mixed' | 'suggestion'
```

## Mode Behaviour

| Mode | `required` | `preferred` | `opinionated` |
|---|---|---|---|
| `strict` | auto-apply | auto-apply | auto-apply |
| `mixed` *(default)* | auto-apply | auto-apply | suggest only |
| `suggestion` | suggest only | suggest only | suggest only |

---

## Rule: `AutoDelimiters`

**Severity:** `required`

**Trigger:** A delimiter node (`(`, `[`, `\|`) that directly wraps a subtree
containing any of: `\frac`, `\dfrac`, `\sum` with limits, `\prod` with limits,
`\int` with limits.

**Transform:** Replace the delimiter with `\left(…\right)`, `\left[…\right]`,
or `\left\|…\right\|`.

**Exception:** If a manual `\big`, `\Big`, `\bigg`, or `\Bigg` is already present
as the delimiter node → do not override. The user's explicit sizing choice is
respected.

```
(\frac{a}{b})^2        →  \left(\frac{a}{b}\right)^2
[\sum_{i=1}^{n} a_i]   →  \left[\sum_{i=1}^{n} a_i\right]
```

---

## Rule: `DxSpacing`

**Severity:** `required`

**Trigger:** An integral node (`\int`, `\iint`, `\iiint`, `\oint`) where the
differential `d` is not preceded by a thin-space node (`\,`).

**Transform:** Insert `\,` immediately before any `d` + variable token that follows
an integral's integrand.

```
\int f(x) dx          →  \int f(x)\,dx
\iint_D f(x,y) dA     →  \iint_D f(x,y)\,dA
\oint_C F \cdot dr    →  \oint_C F \cdot\,dr
```

---

## Rule: `TextInMath`

**Severity:** `preferred`

**Trigger:** A sequence of two or more consecutive alphabetic characters inside
a math node that:
- does not match a known command (`\sin`, `\cos`, `\log`, `\lim`, `\sup`, `\inf`,
  `\max`, `\min`, `\det`, `\dim`, `\ker`, `\gcd`, `\deg`, `\exp`, …),
- does not match any registered macro from the active manifest,
- is not a single letter (single letters are variables, never text).

**Transform:** Wrap the sequence with `\text{…}`.

**False-positive guard:** Never wrap single letters. `f`, `x`, `n`, `A` are
always variables.

```
f(x) = 0 \quad para todo x    →  f(x) = 0 \quad \text{para todo } x
```

---

## Rule: `MacroExpansion`

**Severity:** `required`

**Trigger:** Any occurrence of an expanded form that has a registered macro
in the active manifest (e.g. `\mathbb{R}` when `\R` is defined).

**Transform:** Replace the expanded form with the macro shorthand.

**Scope:** Applied to all `mathInline` and `mathDisplay` nodes in the document.

```
x \in \mathbb{R}      →  x \in \R
f: \mathbb{Z} \to \mathbb{N}   →  f: \Z \to \N
```

---

## Rule: `AlignedSteps`

**Severity:** `preferred`

**Trigger:** A `mathDisplay` node (non-aligned) whose LaTeX string contains two
or more `=` signs on separate lines, indicating a multi-step derivation.

**Transform:** Suggest converting to `align*` with `&` alignment point before
each `=`.

**Note:** Never auto-applies in `mixed` mode — always a Coach suggestion.

```
\[
  f(x+h) - f(x) = \Delta f \\
  \Delta f / h = \text{avg rate}
\]
→ suggest: \begin{align*}
    f(x+h) - f(x) &= \Delta f \\
    \Delta f / h  &= \text{avg rate}
  \end{align*}
```

---

## Rule: `DisplayThreshold`

**Severity:** `opinionated`

**Trigger:** A `mathInline` node whose LaTeX contains `\frac` with explicit
numerator/denominator, or `\sum`/`\prod`/`\int` with limit notation (`_` and `^`).

**Transform:** Suggest promoting the node to a `mathDisplay` node.

```
$\int_a^b f(x)\,dx$    →  suggest display mode
$\sum_{i=1}^{n} a_i$   →  suggest display mode
$\frac{d^2y}{dx^2}$    →  suggest display mode
```

---

## Rule: `ForbiddenSyntax`

**Severity:** `required` — **blocks serialization**

**Trigger:** Any of the following appear in an AST math node:
- `$$…$$` (forbidden display syntax)
- `{\bf …}` or `{\it …}` (obsolete font commands)
- `\eqnarray` or `\begin{eqnarray}` (deprecated environment)

**Transform:** Linter error — document cannot be serialized until resolved.

| Forbidden | Canonical replacement |
|---|---|
| `$$…$$` | `\[…\]` |
| `{\bf text}` | `\textbf{text}` |
| `{\it text}` | `\textit{text}` |
| `\eqnarray` | `align*` |

---

## Adding a New Rule

1. Create `src/core/math/normalizer/rules/MyRule.ts` implementing `NormalizerRule`.
2. Register in `src/core/math/normalizer/Normalizer.ts` (import + add to rule list).
3. Add an entry to the `normalizerRules` object in the relevant `profile.json`.
4. Write unit tests in `tests/normalizer/MyRule.test.ts` — at minimum:
   - a case where `applies()` returns true and the transform is correct,
   - a case where `applies()` returns false (the false-positive guard),
   - a case that tests the exception condition (if any).
