# Contribution Guide

---

## Commit Convention

```
feat(formula-panel): add debounced live render to textarea input
fix(math-inline): prevent ProseMirror event conflict on nodeView click
refactor(serializer): extract preamble generation to PreambleBuilder
docs(data-model): add crossRef node schema
test(normalizer): add false-positive guard for TextInMath rule
```

Format: `type(scope): description`

Types: `feat` · `fix` · `refactor` · `docs` · `test` · `chore`

---

## Code Standards

- **TypeScript strict mode.** `strict: true` in `tsconfig.json`. No `any` without a `// reason:` comment.
- **One responsibility per file.** Files > 300 lines → split.
- **Public functions** have JSDoc with `@param` and `@returns`.
- **CSS:** all colors, spacing, and radii via CSS custom properties from `tokens.css`. No hardcoded hex values outside that file. No Tailwind.
- **Interfaces over Types** for objects with methods.
- **`readonly`** by default on state interface properties.

---

## Naming

| Context | Convention | Example |
|---|---|---|
| Classes, interfaces, types | PascalCase | `NormalizerRule`, `MathDisplayNode` |
| Variables, functions, methods | camelCase | `applyRule`, `canonicalLatex` |
| Module constants | UPPER_SNAKE | `DEFAULT_NORMALIZER_MODE` |
| Files, CSS ids, HTML attributes | kebab-case | `ast-parser.ts`, `formula-panel` |

---

## Spec-First Rule

If an implementation decision contradicts a spec document in `docs/`, update
the spec before merging. The spec is the contract — code follows spec, never
the reverse.

When adding a new `.ltxj` node type:
1. Document it in `docs/02-architecture/data-model.md` first.
2. Add the TypeScript interface to `src/core/math/MathAST.ts`.
3. Add the serialization rule to `src/core/serializer/TexSerializer.ts`.
4. Update the supported node list in `docs/03-engine-specs/article-pro/manifesto.md`.
