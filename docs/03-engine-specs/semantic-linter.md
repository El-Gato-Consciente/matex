# Semantic Linter

> **Module:** `src/core/linter/SemanticLinter.ts`
> **What this is:** Specification for the validation layer that runs before serialization.
> **What this is not:** The normalizer (which transforms AST) — the linter only validates and reports.

---

## Role in the Pipeline

The `SemanticLinter` runs between the `Normalizer` and the `TexSerializer`.
It inspects the post-normalization `.ltxj` AST for structural problems that would
cause the serializer to produce invalid or semantically broken `.tex`.

```
Normalizer output (MathAST)
        ↓
SemanticLinter.validate(doc, profile)
        ↓ produces { errors: LinterError[], warnings: LinterWarning[] }

If errors.length > 0:
    → block serialization
    → surface errors in UI as blocking cards

If warnings.length > 0:
    → allow serialization
    → surface warnings in Coach Panel as non-blocking cards
```

---

## Interface

```typescript
interface LinterError {
  code:     string          // e.g. "E001"
  message:  string          // human-readable description
  nodeId?:  string          // the offending node, if locatable
  fix?:     string          // suggested canonical replacement
}

interface LinterWarning {
  code:     string          // e.g. "W001"
  message:  string
  nodeId?:  string
}

class SemanticLinter {
  validate(doc: LtxjDocument, profile: ResolvedProfile): LinterResult
}

interface LinterResult {
  errors:   LinterError[]
  warnings: LinterWarning[]
  valid:    boolean          // true iff errors.length === 0
}
```

---

## Error Codes (Blocking)

These conditions prevent `.tex` export until resolved.

| Code | Name | Trigger | Suggested fix |
|---|---|---|---|
| `E001` | `forbidden-display-syntax` | `$$…$$` found in any AST math node | Replace with `\[…\]` |
| `E002` | `obsolete-font-command` | `{\bf …}` or `{\it …}` found in AST | Replace with `\textbf{}` / `\textit{}` |
| `E003` | `forbidden-environment` | `\eqnarray` or `\begin{eqnarray}` found | Replace with `align*` |
| `E004` | `orphan-cross-reference` | `crossRef` node whose `refId` has no matching `label` anywhere in the document | Add a label to the target node, or remove the cross-reference |
| `E005` | `proof-without-theorem` | `theoremEnv` of type `proof` appears without a preceding `theorem`, `lemma`, `proposition`, or `corollary` in scope | Move the proof after a theorem environment |

**Note:** `E001`, `E002`, and `E003` are also the output codes of the `ForbiddenSyntax`
normalizer rule. If the normalizer runs before the linter (which it always does), these
errors should never appear in `strict` or `mixed` mode because the normalizer blocks the
pipeline first. They can appear in `suggestion` mode if the user dismisses the suggestion.

---

## Warning Codes (Non-Blocking)

These conditions produce Coach Panel cards but do not block serialization.

| Code | Name | Trigger |
|---|---|---|
| `W001` | `text-in-math` | Two or more consecutive alphabetic characters in math mode without `\text{}` |
| `W002` | `consider-align` | `mathDisplay` node with multiple `=` signs on separate lines, not using `align*` |
| `W003` | `consider-display` | `mathInline` node containing `\int`, `\sum`, or `\prod` with limit notation |
| `W004` | `deep-nesting` | A `heading` node at level 3 (`\subsubsection`) is used |
| `W005` | `missing-toc` | Document has more than 2 pages worth of content and `includeToc` is `false` |

**Note:** `W001`–`W003` mirror the Coach suggestions produced by the `TextInMath`,
`AlignedSteps`, and `DisplayThreshold` normalizer rules. The linter fires them as
warnings when the normalizer ran in `suggestion` mode and the user did not accept the
suggestion.

---

## Label Prefix Validation

The linter validates that all `label` fields in the document follow the prefix
convention defined by the profile. A `crossRef` whose `refId` does not match any
`label` in the document produces `E004`.

| Node type | Required prefix |
|---|---|
| `heading` | `sec:` |
| `mathDisplay` | `eq:` |
| `theoremEnv` theorem | `thm:` |
| `theoremEnv` definition | `def:` |
| `theoremEnv` lemma | `lem:` |
| `theoremEnv` proposition | `prop:` |
| `theoremEnv` corollary | `cor:` |
| `theoremEnv` exercise | `ex:` |
| `rawLatex` figure | `fig:` |
| `rawLatex` table | `tab:` |

---

## Relationship to the Normalizer

The linter and the normalizer are distinct layers with distinct responsibilities:

| | Normalizer | SemanticLinter |
|---|---|---|
| **What it does** | Transforms AST (fixes problems) | Validates AST (reports problems) |
| **When it runs** | On every formula edit | On export trigger |
| **Output** | New `MathAST` + `NormalizerChange[]` | `LinterError[]` + `LinterWarning[]` |
| **Can block pipeline?** | Only `ForbiddenSyntax` rule | Yes — any `LinterError` |
| **Reversible?** | Yes, via Revert in Coach Panel | N/A — validation only |
