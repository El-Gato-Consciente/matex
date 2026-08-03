# Proyecto Matex multi-archivo — diseño robusto (ME-12)

> **Estado:** diseño (2026-07). Define cómo Matex pasa de **un AST único** a un **proyecto**:
> varios documentos (`.mtex`), recursos (imágenes, `.bib`, `.tex`, datos) y **referencias por
> ruta** entre ellos, con referencias cruzadas robustas. Implementación **por fases**. No
> reinventa: reusa el modelo de archivos que la plataforma **ya tiene** (`ProjectStore.files[]`).

## 0. Principios (para no caer en LaTeX-envy)

- En LaTeX se parte en archivos por **dolor de LaTeX** (docs enormes, compilar lento, colaborar).
  En Matex editás un **AST**: ese dolor **no existe** → partir NO es automáticamente necesario.
- Las razones **reales** de multi-archivo en Matex son: **(a) interop** (incluir LaTeX crudo como
  archivo, `.bib` real, exportar un proyecto LaTeX de verdad) y **(b) composición** de obras
  grandes (tesis/libro) cuando el usuario *quiere* separar.
- Regla: **el default sigue siendo un solo AST.** Los capítulos-como-archivos son **opt-in**; el
  editor no obliga a manejar archivos. La UX de obras grandes se resuelve mejor con un
  **navegador/outline** sobre un AST, no partiéndolo (Fase 3).

## 0.5 La ponderación decisiva: ¿hace falta partir el `.mtex`? (probablemente NO)

Antes de diseñar sub-documentos conviene preguntarse si los necesitamos. Sopesado en serio:

**Razones por las que en LaTeX se parte — y por qué NO aplican a Matex:**

| Motivo de partir en LaTeX | ¿Aplica a Matex? |
|---|---|
| Compilar capítulos por separado (`\includeonly`), doc lento | **No.** El AST compila rápido; el `latexmk` tarda lo mismo lo partas o no. |
| Manejar un `.tex` gigante en el editor | **No.** Un AST grande se edita bien; navegar = **outline**, no archivos. |
| Colaborar (cada quien un archivo) | **No (aún).** Single-user localStorage; multi-file-para-colaborar es moot hasta que haya cuentas/tiempo real. |
| Reusar un capítulo/apéndice entre docs | Sí, pero es **avanzado y raro**; y se resuelve con `include` de un recurso, no con sub-documentos completos. |

**Lo que sí aporta valor real (y NO requiere partir el documento):**
- **`.bib` real**, **incluir un `.tex` crudo como archivo**, **imágenes** → *referencias a recursos*.
- Exportar un proyecto LaTeX multi-archivo → nicho (quien está en Matex comparte el `.mtex` o el PDF).

**Costo de partir (sub-documentos):** reintroduce **justo el file-juggling que Matex existe para
eliminar**, y cuesta mucha robustez — **RefContext global**, detección de ciclos, numeración
multi-doc en vivo — a cambio de poco.

> **Conclusión:** **el default es NO partir.** ME-12 se reduce a **referencias a recursos**
> (`.bib` real + incluir `.tex` + imágenes), que es lo valioso y de bajo riesgo. Los
> **sub-documentos `.mtex` quedan diseñados pero NO se implementan** salvo que aparezca una
> necesidad concreta (una obra realmente grande y colaborativa). Para navegar obras grandes, la
> respuesta es un **outline sobre un AST** (Fase 3), no archivos. Esto mantiene la filosofía
> Matex: **un documento semántico, sin gestionar archivos.**

## 1. La idea central: el proyecto es un árbol de archivos (reusa la infra)

La plataforma **ya** modela proyectos como `files: [{path, content, encoding}]` + `mainFile`
(`ProjectStore`, usado por los proyectos LaTeX). **Matex adopta lo mismo**, con estas convenciones
de extensión:

| Archivo | Es | Rol |
|---|---|---|
| `main.mtex` | **documento** (AST en JSON) | raíz del proyecto (`mainFile`) |
| `capitulos/intro.mtex` | documento (sub-AST) | capítulo incluido (opt-in) |
| `figuras/tikz1.tex` | LaTeX crudo | escotilla file-based (`\input`) |
| `refs.bib` | bibliografía | `.bib` real (mejora de ME-10) |
| `images/diagrama.png` | binario | imagen (ya existe) |
| `datos.csv` | datos | `\addplot table` (futuro) |

**Beneficios de unificar por ruta:** reusa `ProjectStore`, el panel de archivos (`MatexFiles`),
el zip, subir/renombrar/borrar; y el `.tex` compilado sale como **proyecto multi-archivo real**
(idéntico a como se ve un proyecto LaTeX). El backend **ya** compila `{files, mainFile}` (DOC-01).

## 2. El primitivo de composición: `IncludeNode`

Un nodo **bloque** que incluye otro archivo **por ruta**:

```ts
interface IncludeNode {
  type: 'include'
  target: string          // ruta a un archivo del proyecto
}
```

El compilador resuelve `target` según su tipo:
- **`.mtex`** → sub-documento: parsea su AST, lo compila y lo emite como `<target>.tex` con
  `\input{…}` (proyecto multi-archivo de verdad), participando del **preámbulo global** y las
  **refs cruzadas** (ver §3).
- **`.tex`** → LaTeX crudo: `\input{target}`; el archivo viaja en el bundle. Es el hermano
  *file-based* de `rawLatex` (para un TikZ complejo, un preámbulo compartido, etc.).

Uniforme y LaTeX-fiel: **incluir = por ruta**, como `\input`/`\include`.

## 3. Referencias entre archivos (el núcleo de la robustez)

Es lo más delicado: `ref`/`cite`/`label` deben resolver **a través de** los documentos incluidos.

- El compilador hoy arma un `RefContext` **por documento**. Multi-archivo → un **`RefContext`
  global**: una primera pasada recorre la raíz **y todos los `.mtex` incluidos** (siguiendo los
  `IncludeNode`), junta todos los referenciables, y recién después compila cada doc con ese
  contexto compartido. Así `\cref`/`\label` cruzan archivos sin romperse.
- **Pureza:** `compileToLatex` no toca el sistema de archivos. Se introduce un nivel arriba:
  `compileProject({ files, mainFile })` que (i) parsea los `.mtex`, (ii) resuelve el árbol de
  includes (con **detección de ciclos**), (iii) arma el RefContext global + los `Requirements`
  globales (preámbulo), (iv) compila cada doc y (v) devuelve `{ files: [main.tex, capitulos/*.tex,
  refs.bib, images/*…], mainFile: 'main.tex' }` listo para el backend.
- `compileToLatex(doc)` **se mantiene** para el caso single-doc (compat + tests).

## 4. Bibliografía como `.bib` real (mejora de ME-10)

Hoy la biblioteca (`doc.references: BibEntry[]`) se emite con `filecontents` embebido. Con el
proyecto multi-archivo:
- La biblioteca **sigue siendo estructurada** (fuente de verdad, editada en el modal) — no cambia.
- Al compilar, **emite un `refs.bib` real** en `files[]` + `\addbibresource{refs.bib}` (en vez de
  `filecontents`). Salida más limpia y estándar; `filecontents` queda solo como fallback single-doc.
- Bonus: **importar** desde un `.bib` del proyecto (ya tenemos `parseBibtex`).

## 5. Persistencia y portabilidad

- **`.mtex`** sigue siendo **un AST** (JSON) — el documento simple, portable. No cambia.
- **El proyecto** = `files[]` (como los proyectos LaTeX). El **bundle `.zip`** (ME-05) pasa a ser
  el formato de proyecto completo: `main.mtex` + sub-`.mtex` + recursos. `packMatexBundle` se
  generaliza (hoy: AST + `images/`; mañana: todos los archivos).
- **Migración:** un proyecto Matex actual (1 AST + imágenes) **ya es** `main.mtex` + `images/*` →
  cero fricción. `IncludeNode` es aditivo (docs viejos no lo tienen).

## 6. El workspace (de single-doc a proyecto)

Cambio de mayor peso en UI. Hoy `MatexWorkspace` tiene **un `ast`** + `imageFiles`. Objetivo:
- El **panel de archivos** (`MatexFiles`, ya existe) lista `.mtex` (documentos) + recursos.
- Editás el **`.mtex` activo** en el editor visual; cambiar de archivo cambia el AST en edición
  (como el file switcher de los proyectos LaTeX, DOC-01).
- Insertar → **"Incluir archivo"** (elige/crea un `.mtex` sub-documento o un `.tex`).
- Compilar arma el proyecto entero (`compileProject`) y muestra el PDF de `main`.
- Reusa lo de los proyectos LaTeX (multi-archivo ya resuelto ahí).

## 7. Plan por fases

- **Fase 1 — Recursos + interop (bajo riesgo, valor concreto).** *Sin sub-documentos todavía.*
  (a) Generalizar recursos: el proyecto guarda `.tex`/`.bib` junto a las imágenes (reusa
  `MatexFiles`). (b) **`IncludeNode` para `.tex`** (`\input`, escotilla file-based). (c)
  **Bibliografía → `refs.bib` real** en la salida. → cierra la mejora de ME-10 y da la escotilla +
  export multi-archivo, con el modelo listo para la Fase 2.
- **Fase 2 — Sub-documentos (`.mtex`).** `IncludeNode` a otro `.mtex`; **`compileProject`** con
  **RefContext global** + preámbulo global + detección de ciclos; workspace multi-documento
  (editar el `.mtex` activo); salida multi-archivo real. *Es el grueso.*
- **Fase 3 — UX de obras grandes.** Navegador/**outline** sobre un AST (capítulos sin archivos)
  — la experiencia "un documento continuo" para tesis/libro, alineada con la filosofía Matex.

**Orden recomendado:** Fase 1 ya (concreto, reusa infra), con el **modelo de la Fase 2 diseñado**
(este doc) para que entre sin refactor. Fase 2 cuando se confirme que hace falta partir de verdad.

## 8. Decisiones abiertas / riesgos

- **`\input` vs `\include`** para sub-docs: `\include` da salto de página + `\includeonly`
  (compilar parcial), pero solo a nivel `\chapter`. Default `\input` (sin restricción); `\include`
  como opción cuando la clase es `report`/`book`.
- **Preámbulo global:** los `Requirements` (math/tablas/gráficos/biblatex…) deben juntarse de
  **todos** los docs incluidos, no solo la raíz. `compileProject` lo centraliza.
- **Numeración/refs en vivo en el editor** cuando hay includes: el plugin de numeración hoy es
  por-documento; multi-doc en vivo es complejo → v1 puede numerar por-documento en el editor y
  dejar la numeración global **al compilar** (el PDF es la verdad). Aceptable.
- **Ciclos de include** (A→B→A): detección obligatoria (como en `functionRefs`).
