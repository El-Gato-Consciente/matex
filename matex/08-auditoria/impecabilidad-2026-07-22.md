# Plan de impecabilidad — cerrar cabos sueltos (2026-07-22)

> Barrido final tras ejecutar el [plan de acción](plan-de-accion-2026-07.md) (fases 0-4) + ME-46,
> FIX-21, ME-47 y QA-06 (slices 1-5). Objetivo: que **no queden cabos sueltos** — código
> consistente, docs que no mienten, y el refactor del editor cerrado. Derivado de un barrido con
> evidencia (grep), no de memoria.

## A · Consistencia de código

- **A1 — Literales de versión.** `App.tsx` (docs de muestra) y `MatexWorkspace` (`EMPTY_DOC`) usan
  `version: 3` hardcodeado. → usar la constante `MATEX_AST_VERSION` para que **nunca** vuelvan a
  quedar viejos al subir la versión.
- **A2 — QA-06 slice 6.** Cerrar el split del editor: agrupar las ~15 `insert*` en
  `insertActions.ts`. Completa el refactor (el componente queda solo orquestando).

## B · Documentación al día (docs que no mienten)

- **B1 — `referencia-v1.md`.** Documentar el nodo **`part`** (ME-46) y **`meta.columns`** (FIX-21).
  El propio doc manda: *"agregar un nodo = actualizar esta tabla"* — hoy no están.
- **B2 — Auditoría `2026-07-21`.** Pasada de estado: marcar qué findings se resolvieron (A-1/FIX-18,
  A-2/AR-09, A-3/AR-10, A-4/AR-11, O-1/RB-09, C-1/QA-06…) con su commit, para que un lector futuro
  no los crea abiertos.
- **B3 — `CLAUDE.md` + backlog.** Verificar que reflejen v4 / familias / columnas / partes, y
  refrescar la sección "Cómo decidir qué sigue".

## C · Verificación final total

`npm test` (front + back) · `npm run build` · `npm run lint` · `verify:content` · `verify:numbering`
— **todo verde**.

## Fuera de alcance (deuda declarada, no cabo suelto)

- **F-1** (clasificar los 45 campos de `PlotSpec` en intención/receta/presentación): L, y el propio
  plan lo puso *después* de tocar `PlotEditor` — queda como ítem consciente, no como olvido.
- **F-3** (representación de la matemática, pre-LE-06): es una **decisión de producto**, no un cabo
  de prolijidad. Va antes de LE-06.
