# Export Override

> **What this is:** Specification for per-export configuration patches applied on top of a resolved manifest.
> **What this is not:** A new profile or a new manifest — overrides are ephemeral and never persisted.

---

## Motivation

Most customization needs are too minor to justify creating a new profile or manifest, but they
legitimately affect the output of a specific export: adjusting margins for a submission, changing
paper size, disabling a normalizer rule for one document. An `ExportOverride` captures these
as a transparent, non-destructive patch.

---

## TypeScript Interface

```typescript
interface ExportOverride {
  // Override document class options (e.g. "letterpaper" instead of "a4paper")
  classOptions?:    string[]

  // Override geometry settings for this export
  geometry?:        Partial<GeometryConfig>

  // Override the normalizer mode for this export
  normalizerMode?:  NormalizerMode

  // Disable specific normalizer rules for this export
  disabledRules?:   string[]                   // e.g. ["DisplayThreshold"]

  // Add or override macros (name → LaTeX definition)
  extraMacros?:     Record<string, string>

  // Inject arbitrary preamble lines after all generated preamble
  preambleAppend?:  string[]
}

interface GeometryConfig {
  left:   string    // e.g. "2.5cm"
  right:  string
  top:    string
  bottom: string
}
```

---

## How It Is Applied

The `ExportOverride` is applied by `ManifestEngine.buildEffectiveConfig()` at export time.
It patches the `ResolvedManifest` without mutating the base manifest or profile.

```typescript
function exportToTex(
  doc:      LtxjDocument,
  override: ExportOverride = {}
): string {
  const profile  = ManifestEngine.resolveProfile(doc.profile)
  const manifest = ManifestEngine.loadManifest(doc.profile + '-latex')
  const config   = ManifestEngine.buildEffectiveConfig(profile, manifest, override)
  return TexSerializer.serialize(doc, config)
}
```

The resulting `EffectiveConfig` is what the `TexSerializer` actually uses. It is never stored.

---

## Boundary Rule: When an Override Becomes a New Manifest or Profile

An `ExportOverride` is the right tool when the change is:
- Cosmetic (margins, font size, paper size)
- Mode-level (normalizer mode, disabled rules)
- Additive (extra macros, extra preamble lines)

An override is **not** the right tool when the change affects:
- Which node types are valid in the `.ltxj` → new **Profile**
- The structural mapping of any node type to LaTeX → new **Manifest**
- Package load order or mandatory package set → new **Manifest**
- Counter configuration or `\newtheorem` declarations → new **Profile** + **Manifest**

If you reach for `ExportOverride` to change node mappings, stop and create a proper manifest.

---

## Example: Submission Override

A document normally uses `a4paper` and 2.5cm margins. For an arXiv submission
requiring `letterpaper` and 1-inch margins:

```typescript
const arxivOverride: ExportOverride = {
  classOptions: ["12pt", "letterpaper"],
  geometry: {
    left: "1in", right: "1in",
    top:  "1in", bottom: "1in"
  },
  preambleAppend: [
    "% arXiv submission — do not include hyperref color links",
    "\\hypersetup{colorlinks=false}"
  ]
}

const tex = exportToTex(doc, arxivOverride)
```

The base `article-pro` profile and `article-pro-latex` manifest are untouched.

---

## UI Exposure

| User level | Sees |
|---|---|
| Novice | Nothing — default export with no overrides |
| Intermediate | "Export options" panel (geometry, paper size, lang) |
| Advanced | Full `ExportOverride` JSON editor + diff against base manifest |

The advanced view should display the **effective configuration** — the result of applying the
override on top of the resolved manifest — so the user sees exactly what will be serialized.
