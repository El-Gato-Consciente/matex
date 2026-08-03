# Matex

**El activo del proyecto no es un lenguaje, es el modelo semántico del documento.**
El autor describe *qué* quiere expresar (teorema, demostración, derivación, gráfico de
una función); el sistema decide *cómo* construirlo y lo emite a varios backends.

Esa tesis **ya está probada**: un mismo AST (`matex-core`) compila a **PDF** (LaTeX),
**HTML** y **SVG**, sin una línea de sintaxis nueva. Matex **no** es un lenguaje con
gramática propia y **no** compite con Typst como lenguaje: la superficie de autoría es el
**editor visual**, y el AST *es* el lenguaje.

## El producto, en tres patas

Una app web (`plataforma/` acá + el compilador en el repo `lambdas`) con:

1. **Curso** — 51 lecciones (niveles 0–4) para aprender LaTeX real, cada una con tres
   vistas (Aprender · Ejemplo · Practicar), quiz y repaso espaciado.
2. **Taller LaTeX** — proyectos multi-archivo con carpetas, editor CodeMirror 6,
   compilación real y preview PDF.
3. **Matex** — el editor visual sobre el AST semántico, con módulo de gráficos
   (funciones, datos, implícitas, cónicas, estadística, diagramas) y salida a PDF/HTML.

## Dónde está cada cosa

| Ruta | Qué es |
|------|--------|
| `plataforma/` | Frontend (Vite + React + TS strict + Tailwind v4). **Acá vive el producto.** |
| `plataforma/src/features/matex/core/` | **`matex-core`**: `ast.ts` (el modelo, sin imports), `compile.ts` (→LaTeX), `html.ts` (→HTML), `graphics/` (→pgfplots + SVG). **Módulos puros, sin DOM.** |
| `plataforma/src/features/matex/editor/` | Editor visual (TipTap) sobre el AST. |
| `docker-compose.yml` | Stack local (frontend estático + compilador), en paridad con AWS. Construye el compilador desde `../lambdas/` → **los dos repos tienen que estar clonados como hermanos.** |
| `matex/` | **Documentación del proyecto.** El hub es [`matex/README.md`](matex/README.md). |
| `matex/06-backlog/backlog.md` | **Inventario único** de lo hecho y lo pendiente, con IDs estables (PL/CO/RB/FE/DOC/QA/AR/LE/ME). Es también la **bitácora**: cada ítem hecho documenta decisiones y gotchas. Empezá por su sección final, **"Cómo decidir qué sigue"**. |
| `latex/` | Suite de documentos *sobre* LaTeX + `TEMARIO.md`. Insumo del curso, no producto. |
| `actividades/`, `libro-logica-informal/` | Material de cursada del usuario. **No son parte del producto.** |

## Correr y verificar

```bash
cd plataforma
npm run dev        # app en desarrollo
npm run build      # tsc -b + vite build  ← EL TYPECHECK AUTORITATIVO
npm test           # vitest
npm run lint       # oxlint

npm run verify:content    # compila TODAS las lecciones/ejemplares/plantillas (anti-bitrot).
                          # Necesita el compilador arriba: `docker compose up compiler`.
npm run verify:numbering  # QA-08: la numeración de la política vs. la que asigna TeX.
                          # Único script que pide `latexmk` en el PATH (necesita el .aux).

cd ..
docker compose up --build   # stack local completo: front en :8080, compilador en :8787
```

Para que `npm run dev` compile de verdad: `VITE_COMPILE_API_URL=http://localhost:8787` en
`plataforma/.env.local`, y el compilador arriba (`docker compose up compiler`).

> **El compilador NO vive en este repo.** Es una lambda: su código está en
> `lambdas/matex/compiler/` (repo `lambdas`) y lo despliega el pipeline de `iac` como **imagen
> de contenedor**. Acá solo se lo consume: el `docker-compose.yml` lo construye por ruta
> relativa (`../lambdas/…`), así que **los dos repos tienen que estar clonados como hermanos**.
> Sus tests y su typecheck corren en su repo.

> **Los verificadores de contenido viven en `plataforma/scripts/`.** Verifican *contenido del
> producto* (lecciones, ejemplares, plantillas, AST de Matex) y consumen el compilador por el
> puerto `LatexCompiler` **vía HTTP** — así corren contra la **imagen que va a producción**, y el
> compilador queda libre para desplegarse solo. `verify:numbering` es la excepción: necesita el
> `.aux`, que la API no expone, así que pide `latexmk` en el PATH.

> **`npm run build` es el typecheck autoritativo, no `tsc --noEmit`.** El caché
> incremental de `tsc -b` puede ocultar errores de `exactOptionalPropertyTypes`; el build
> completo los destapa.

## Cómo se trabaja acá

- **Calidad y refactor son prioridad máxima, por encima de features nuevas.** Front y back.
- **Código modular y mantenible, sin parches.** Ports & adapters: toda dependencia externa
  (compilador, almacenamiento) vive detrás de un puerto con sus adaptadores.
- **El núcleo es puro.** `core/` son datos y funciones: sin DOM, sin frameworks, testeable
  sin jsdom. Si un emisor necesita el DOM, está mal ubicado.
- **El LaTeX que emitimos sigue best practices**: `biblatex`+`biber`, `mathtools`,
  `booktabs`, `siunitx`, `cleveref`. Es un producto que enseña LaTeX: la salida es el ejemplo.
- **Nada se marca hecho sin compilar.** Todo ejemplo/lección/ejemplar se verifica contra el
  backend real (`verify:content`), y los cambios de salida se comprueban con un PDF real.
- **No subdimensionar la documentación**: cuando algo se cierra, se documenta en el backlog
  con su decisión y sus gotchas.
- El AST es **agnóstico del backend** y hay que mantenerlo así (LE-02, cerrado). No guarda
  vocabulario de LaTeX: el diseño se expresa con `docKind`/`style`/`accent`/`paperSize`/
  `baseFontSize`/`columns`, y **cada backend traduce** (`compile.ts` arma la línea
  `\documentclass`; `html.ts` la vuelve CSS). Divergencias **por diseño**: `columns: 2` es
  `twocolumn` en PDF pero **una columna** reflowable en HTML (la web no pagina, ver FIX-21).
  La familia del documento (presentación/carta/examen/CV/póster) es una **unión discriminada**
  en `meta.family` (AR-09): los estados imposibles no se pueden representar. Si aparece la
  tentación de guardar el nombre de un paquete o de un tema, es la señal de que falta modelar la
  intención. Escotillas admitidas y por diseño: la matemática como `tex` crudo (lingua franca),
  `rawLatex` e `include` (file-based).
- **Un cambio de campo persistido pide migración.** `MATEX_AST_VERSION` (hoy **4**) + su paso en
  `parse.ts` (v1→v2, v2→v3 diseño, v3→v4 familia son los precedentes): idempotente, conservadora
  (nunca pisa lo que ya está en forma nueva) y con test de que lo viejo sigue produciendo lo mismo.
- **Antes de agregar un campo al AST, pasá las 4 reglas** de
  [matex/03-modelo-semantico/reglas-del-modelo.md](matex/03-modelo-semantico/reglas-del-modelo.md):
  ¿en cuál de los 4 lugares vive (AST · política compartida · ocasión de emisión · recursos)?
  Si dos personas querrían el mismo documento con ese valor distinto, es **ocasión de emisión**
  (`opts`), no AST. Si dos backends que lo resuelven distinto es un **bug**, es **política
  compartida** (`core/policy/`), no del AST ni de un backend.
