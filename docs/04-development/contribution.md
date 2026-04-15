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
- **`ResolvedProfile` and `EffectiveConfig` must remain plain serializable objects.** No methods — these objects must be passable to Web Workers.

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

---

## Where to Add What: Profile vs Manifest

This distinction is the most important one to get right before editing engine-specs:

| Change | Where it goes |
|---|---|
| New `.ltxj` node type | `data-model.md` → `profile.json → supportedNodes` → `TexSerializer` → `manifesto.md §A` + `§C` |
| New theorem environment type | `profile.json → environments` → `manifest.json → environmentStyles` → `manifesto.md §A.4` + `§C.5` |
| New normalizer rule | `normalization.md` → `normalization-rules.json` → `profile.json → normalizerRules` |
| New LaTeX package | `manifest.json → packages` → `manifesto.md §C.1` |
| New macro | `profile.json → macros` (also used by Normalizer) → `manifesto.md §A.6` + `§C.4` |
| New geometry/layout option | `manifest.json` → `export-override.md` (if it should be overridable) |
| New linter error/warning | `semantic-linter.md` → `glossary.md` |

**Rule of thumb:** if the change affects *what can exist in a `.ltxj`* or *how formulas are
normalized*, it belongs in `profile.json`. If it affects *how the `.tex` output looks*,
it belongs in `manifest.json`.

---

## Adding a New `.ltxj` Node Type

1. Document it in `docs/02-architecture/data-model.md` first.
2. Add the TypeScript interface to `src/core/math/MathAST.ts`.
3. Add to `supportedNodes` in `docs/03-engine-specs/<family>/profile.json`.
4. Add the serialization rule to `src/core/serializer/TexSerializer.ts`.
5. Update the supported node list in `docs/03-engine-specs/<family>/manifesto.md §A.2` and `§C.7`.

## Adding a New Normalizer Rule

1. Document it in `docs/03-engine-specs/normalization.md`.
2. Add entry to `docs/03-engine-specs/normalization-rules.json`.
3. Add to `normalizerRules` in relevant `profile.json` files.
4. Create `src/core/math/normalizer/rules/MyRule.ts` implementing `NormalizerRule`.
5. Register in `src/core/math/normalizer/Normalizer.ts`.
6. Write unit tests in `tests/normalizer/MyRule.test.ts` — at minimum:
   - a case where `applies()` returns true and the transform is correct,
   - a case where `applies()` returns false (the false-positive guard),
   - a case that tests the exception condition (if any).

## Adding a New Document Family (Profile + Manifest)

1. Create `docs/03-engine-specs/<family>/profile.json` — document schema and normalization policy.
2. Create `docs/03-engine-specs/<family>/manifest.json` — serialization contract, with `"profile": "<family>"`.
3. Create `docs/03-engine-specs/<family>/manifesto.md` — human-readable companion.
4. Add corresponding JSON files under `src/core/manifests/profiles/<family>/`.
5. Register the profile and manifest in `ManifestEngine`.
