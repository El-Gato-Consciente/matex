# Plataforma Matex

App web con tres patas: **aprender LaTeX** por una ruta de niveles, un **taller** de
proyectos LaTeX reales con compilación y preview, y el **editor visual Matex** sobre el
AST semántico. Es donde vive el producto.

Specs: [`../matex/05-plataforma/`](../matex/05-plataforma/) · orientación general:
[`../CLAUDE.md`](../CLAUDE.md) · estado y pendientes:
[`../matex/06-backlog/backlog.md`](../matex/06-backlog/backlog.md).

## Correr

```bash
npm install
npm run dev      # desarrollo
npm run build    # tsc -b + vite build  ← el typecheck autoritativo
npm test         # vitest
npm run lint     # oxlint
```

Sin configuración la app usa el `MockCompiler` (offline, PDF de marcador). Para compilar
de verdad, levantá el compilador (`docker compose up compiler` desde la raíz — su código vive
en el repo `lambdas`, en `lambdas/matex/compiler/`) y poné en `.env.local`:

```
VITE_COMPILE_API_URL=http://localhost:8787
```

## Stack

Vite + React + TypeScript (strict, `exactOptionalPropertyTypes`) · Tailwind CSS v4 ·
CodeMirror 6 (editor LaTeX) · TipTap/ProseMirror (editor visual Matex) · KaTeX ·
PDF.js (preview) · zod (validación de contenido) · JSZip (export/import).

## Arquitectura (ports & adapters)

Máxima del proyecto: **código modular y mantenible, sin parches.** Toda dependencia
externa vive detrás de un **puerto**, y el núcleo semántico es **puro**.

```
src/
├── features/
│   ├── compiler/       # PUERTO LatexCompiler + MockCompiler / RemoteCompiler
│   │                   # createCompiler.ts = ÚNICA decisión de qué backend usar
│   ├── editor/         # LatexEditor (CodeMirror 6): autocompletado, lint, preview KaTeX
│   ├── preview/        # PdfPreview (PDF.js)
│   ├── workspace/      # Workspace unificado (editor | PDF + barra de errores)
│   ├── lessons/        # curso: modelo (zod) + 51 lecciones + corrector + UI
│   ├── quiz/ srs/      # banco de preguntas y repaso espaciado
│   ├── progress/       # PUERTO ProgressStore + LocalProgressStore
│   ├── documents/      # PUERTO ProjectStore: proyectos multi-archivo, carpetas, zip
│   ├── templates/      # plantillas (punto de partida) — 12, con versión Matex
│   ├── showcase/       # ejemplares de estudio — 11, con versión Matex
│   ├── latex/          # utilidades del lenguaje (parseLog, etc.)
│   └── matex/
│       ├── core/       # matex-core: PURO, sin DOM ni frameworks
│       │   ├── ast.ts          # el modelo semántico (SIN imports)
│       │   ├── compile.ts      # → LaTeX
│       │   ├── html.ts         # → HTML
│       │   ├── parse.ts        # JSON → AST + migraciones de versión
│       │   └── graphics/       # por familia: relation, chart, distribution,
│       │                       # implicit, conic, intersect, tree, diagram…
│       │                       # cada una con su par de emisores LaTeX y SVG
│       └── editor/     # editor visual TipTap sobre el AST (mapping AST↔ProseMirror)
├── components/         # UI compartida
└── lib/                # utilidades puras (files, projectZip, shuffle, buildMinimalPdf)
```

**Reglas que no se negocian:**

- `core/` es **puro**: datos y funciones, sin DOM, testeable sin jsdom. Un emisor que
  necesite `document` está mal ubicado (ver AR-05 en el backlog).
- `ast.ts` **no importa nada** y debe ser agnóstico del backend (ver LE-02).
- Cada familia de gráfico co-localiza sus **dos** emisores (LaTeX y SVG).

## Estado

Vertical completo y maduro: curso (51 lecciones), taller multi-archivo y editor visual
con salida a PDF y HTML, con versión Matex en las 12 plantillas y los 11 ejemplares. El
contenido se verifica compilando contra el backend real (`npm run verify:content`, en CI):
el script recorre los índices validados (`levels`, `exemplars`, `templates`) y compila cada
documento contra la imagen del compilador, por el puerto `LatexCompiler`.

Lo que falta para que exista fuera de esta máquina: deploy, sandbox por compilación y
cuentas (RB-02 · RB-03 · FE-01). Hoy el progreso y los proyectos viven en `localStorage`.
