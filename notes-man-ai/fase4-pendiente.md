# Fase 4 — Ítems pendientes (postergados)

Estos ítems estaban en la Fase 4 original del plan de implementación pero se postergaron
porque representan over-engineering para el estado actual del producto.
Revisarlos cuando haya múltiples usuarios reales o un caso de uso concreto que lo justifique.

---

## ManifestEngine

`src/core/manifests/ManifestEngine.ts`

Sistema de perfiles JSON para generar preámbulos LaTeX dinámicamente.

```typescript
// buildEffectiveConfig(profileId: string, override?: ExportOverride): EffectiveConfig
// Lee profile.json + manifest.json de src/core/manifests/profiles/<id>/
// Aplica ExportOverride si existe
// Retorna EffectiveConfig (plain serializable object)
```

Conectar al TexSerializer: reemplaza el wrapper hardcodeado actual por uno dinámico
que genera el preamble según `manifest.json → packages` + `profile.json → macros`
+ `profile.json → theoremDefs`.

Los archivos `article-pro/profile.json` y `article-pro/manifest.json` ya están
especificados en `docs/03-engine-specs/`. Solo falta implementar el engine.

**Por qué se postergó:** el preámbulo hardcodeado funciona bien para el único
perfil existente (`article-pro`). Agregar esta capa antes de tener múltiples perfiles
es over-engineering. Retomar cuando aparezca un segundo perfil concreto (ej. `physics-paper`).

---

## Template selector

`src/features/templates/TemplateSelector.ts`

Pantalla de inicio (cuando no hay documento en localStorage) con selección de template:

| Template | Estructura inicial |
|---|---|
| Guía de ejercicios | Heading + 3 TheoremEnv(exercise) |
| Apunte de clase | Heading + def + example + remark |
| Resolución de TP | Heading + paragraphs con display math |
| Resumen de teoría | Heading + lista de defs |
| Documento en blanco | Solo heading |

**Por qué se postergó:** útil para onboarding, pero requiere diseñar una pantalla
de inicio y los templates en sí. No es urgente mientras el usuario sepa qué quiere escribir.
Retomar cuando se piense en experiencia de usuario nueva / onboarding.

---

## ExportOverride UI

`src/features/export/ExportOverridePanel.ts`

Panel colapsable en el modal de export para usuarios intermedios:
- Toggle por paquete (amsmath, mathtools, etc.)
- Campo de macros adicionales

Depende del ManifestEngine — no tiene sentido implementarlo antes.
Ver spec completa en `docs/03-engine-specs/export-override.md`.

**Por qué se postergó:** depende del ManifestEngine. Bloqueado hasta que ese
engine exista.
