# 05 · Plataforma de enseñanza (nivel A) — especificación

> Documento **vivo**. Es el **nivel A** del proyecto (ver
> [niveles de ambición](../01-vision/niveles-de-ambicion.md)): una plataforma web
> para **aprender LaTeX** por una **ruta de niveles**, con preview real en el
> navegador. Es el deliverable que **vale por sí solo** y se construye **primero**.

## 1. Objetivo

Una web donde un estudiante aprende LaTeX **escribiendo LaTeX real**, con
**compilación en vivo en el navegador** y una **ruta por niveles** tal que:

> **Al terminar el nivel básico ya "sobrevive": puede crear documentos de calidad
> sin ayuda.** Los niveles siguientes profundizan, no son requisito para producir.

No es un "Duolingo de fórmulas": la gamificación es **la ruta estructurada + el
seguimiento de progreso + varias modalidades de práctica**, no rachas ni ranking
(eso queda como opción futura).

## 2. Decisiones técnicas (cerradas)

| Pieza | Elección | Notas |
|---|---|---|
| Build + lenguaje | **Vite + TypeScript** | frontend-only por ahora; pensado para sumar backend propio después |
| UI | **React** + **Tailwind CSS** + **shadcn/ui** (Radix) | estética premium y robusta; popovers/tooltips accesibles de Radix |
| Editor de código | **CodeMirror 6** | soporta inline widgets, `hoverTooltip`, decorations → habilita edición inline y popovers a futuro sin cambiar de motor |
| Motor LaTeX | **Indefinido — detrás del puerto `LatexCompiler`** | **WASM es la parte más débil del diseño**, así que no nos casamos. Candidato principal: **backend local con Docker + TeX Live completo** (vía HTTP). WASM (SwiftLaTeX) queda como alternativa. **PDF.js** muestra el PDF resultante. |
| Persistencia | **localStorage** (MVP) | progreso done/missing; migrable a backend |

**Por qué CodeMirror y no un "lienzo" WYSIWYG:** la plataforma enseña LaTeX, así
que el alumno **debe ver y escribir el código**. Un WYSIWYG (ProseMirror/TipTap)
lo escondería; eso pertenece a la **capa semántica Matex (nivel B)**, no acá.

**Por qué el compilador queda abierto:** compilar LaTeX en el navegador (WASM) es
frágil —headers COOP/COEP para `SharedArrayBuffer`, decenas de MB de assets,
cobertura parcial de paquetes—. Mantenerlo **detrás de un puerto** nos deja
arrancar con un mock y elegir el backend real (lo más probable: **Docker con la
suite LaTeX completa**) sin reescribir nada del frontend.

## 2b. Principios de ingeniería (innegociables)

> **Código de alta calidad, súper mantenible, muy modular. Nunca parches.**

- **Ports & adapters (hexagonal).** Toda dependencia externa detrás de una
  interfaz. El motor LaTeX es un **puerto** `LatexCompiler`; SwiftLaTeX y un mock
  son **adaptadores** intercambiables. El progreso es un puerto `ProgressStore`
  (localStorage hoy, backend mañana). La UI **nunca** conoce la implementación.
- **Módulos por feature** (vertical slices), no carpetas por tipo de archivo.
- **Contenido como datos**, separado de la lógica de render.
- **TypeScript strict**, funciones puras aisladas en `lib/`, side-effects en los
  bordes.
- Si algo "pide" un parche → se **rediseña la abstracción**, no se apila el hack.

### Arquitectura propuesta

```
plataforma/
├── src/
│   ├── app/                  # composición, layout, routing
│   ├── features/
│   │   ├── editor/           # wrapper CodeMirror 6 + modo LaTeX
│   │   ├── compiler/
│   │   │   ├── LatexCompiler.ts       # PUERTO (interfaz async, transporte-agnóstica)
│   │   │   ├── MockCompiler.ts        # adaptador para arrancar sin backend
│   │   │   ├── RemoteCompiler.ts      # adaptador HTTP → backend Docker + TeX Live (candidato)
│   │   │   └── SwiftLatexCompiler.ts  # adaptador WASM (alternativa)
│   │   ├── preview/          # visor PDF (PDF.js)
│   │   ├── lessons/          # modelo de lección/nivel + render
│   │   └── progress/
│   │       ├── ProgressStore.ts       # PUERTO
│   │       └── LocalProgressStore.ts  # adaptador localStorage
│   ├── content/              # las lecciones como datos (nivel-0/…)
│   ├── components/ui/         # shadcn/ui
│   └── lib/                   # utilidades puras
```

El truco que respeta la máxima: arrancamos con `MockCompiler` (devuelve un PDF de
prueba) para tener la app entera funcionando, y **enchufamos el backend real
(`RemoteCompiler` → Docker, o `SwiftLatexCompiler` → WASM) detrás de la misma
interfaz** sin tocar editor, preview ni lecciones. El puerto es **async y agnóstico
del transporte**, así que sirve igual para HTTP, worker WASM o lo que venga.

## 3. Ruta de aprendizaje por niveles

> ✅ **Implementada** como datos en `plataforma/src/features/lessons/content/`
> (un archivo por nivel, validados con zod). **30 lecciones** integrando el
> **TEMARIO** de `latex/` (amplitud) y la **ontología de 6 capas** de `matex/`
> (cada lección marca su capa: 🟢 semántica · 🔵 carpintería · ⚙️ infraestructura).
> Cada lección: objetivo, prerrequisitos, contenido en **bloques** (prosa MDX,
> comandos, código, *errores comunes* y *buenas prácticas* de `estandares/`),
> ejemplo compilable y desafío con pistas. **Verificado en backend:** babel,
> fontenc, microtype, amsmath, booktabs, amsthm, siunitx, cleveref, enumitem,
> pgfplots, tikz, listings, pgffor, beamer compilan a PDF.

Pedagogía (de `matex/`): **significado → forma → carpintería**. Umbral de
**"supervivencia"** = fin del Nivel 1.

| Nivel | Nombre | Lecciones |
|:-----:|--------|-----------|
| **0** | **Supervivencia** | Cómo pensar un documento · Tu primer documento · Estructura y texto · Listas · Matemática básica · Compilar, errores y el log |
| **1** | **Documento de calidad** *(→ ya producís solo)* | Preámbulo · Idioma y codificación · Tipografía (+microtype) · amsmath · Tablas (+tabularx) · Figuras · Referencias (+cleveref) · Márgenes y página (geometry) |
| **2** | **Intermedio** | Teoremas · Numeración y contadores · Matemática avanzada (+siunitx) · Listas a medida (enumitem) · Bibliografía · Macros |
| **3** | **Docs, gráficos y presentaciones** | Documentos largos · Graficar funciones (pgfplots) · Dibujar con TikZ · Mostrar código (listings) · Beamer |
| **4** | **Avanzado** | Compilación condicional · Programación (foreach/expl3) · Paquetes propios · Flujo reproducible · Publicación (pandoc) |

## 4. Modalidades de enseñanza/memorización (por lección)

Cada lección combina varias, de menor a mayor autonomía:

1. **Concepto** — explicación breve (qué es y para qué).
2. **Ejemplo autodemostrativo** — código → resultado (igual que la suite).
3. **Práctica guiada** — completar huecos / corregir un fragmento.
4. **Desafío libre** — "escribí LaTeX que produzca *esto*" → **autocorregido**
   (comparando salida/estructura, no el texto exacto del código).
5. **Recuerdo espaciado** — flashcards de comandos para **memorizar** (repaso).
6. **Referencia rápida** — cheat sheet integrado siempre a mano.

## 5. Alcance del MVP (primer slice)

Lo mínimo que demuestra la plataforma completa de punta a punta:

- [ ] **Shell de la app** (Vite + React + TS + Tailwind/shadcn): layout lección ↔ editor ↔ preview.
- [ ] **Editor CodeMirror 6** con resaltado LaTeX.
- [ ] **Compilación WASM**: botón "Compilar" → SwiftLaTeX → **PDF (PDF.js)** en panel.
- [ ] **Nivel 0 autorado** (~5–8 lecciones) con: concepto + ejemplo + 1 desafío autocorregido c/u.
- [ ] **Seguimiento de progreso** local: marca de **hecho/pendiente** por lección y % por nivel.

Cuando el Nivel 0 funcione de punta a punta, se replica el patrón para los demás.

## 6. Estado: qué se hizo / qué falta

| Ítem | Estado |
|------|:------:|
| Contenido y niveles (suite `latex/` + TEMARIO) | ✅ existe (fuente) |
| Decisiones de stack/editor/motor | ✅ cerradas |
| Spec de la plataforma (este doc) | ✅ |
| Scaffold de la app (Vite+React+TS+Tailwind v4) | ✅ en `plataforma/` |
| Editor CodeMirror 6 + resaltado LaTeX | ✅ |
| Puerto `LatexCompiler` + `MockCompiler` + `RemoteCompiler` (stub) | ✅ |
| Preview PDF (PDF.js) | ✅ |
| **Ruta completa autorada** (5 niveles, **30 lecciones**, con capa + errores comunes + buenas prácticas) | ✅ |
| Integración de TEMARIO (latex/) + ontología 6 capas (matex/) + estándares | ✅ |
| **Modos Aprender / Practicar** (lectura enfocada vs paneles) | ✅ |
| Motor de progreso done/missing (`ProgressStore` + localStorage) | ✅ |
| Autocorrección de desafíos (declarativa, pura) | ✅ (v1: `mustInclude`) |
| **Backend real de compilación** (`backend/`: Fastify + latexmk, Docker + TeX Live) | ✅ funciona |
| Estética **dark** + **tema CodeMirror a medida** | ✅ |
| **Layout con foco**: switcher contextual + splits redimensionables + lección colapsable | ✅ |
| **PDF multipágina** (ajuste al ancho, ResizeObserver) | ✅ |
| **Responsive** (apila en vertical en pantallas angostas) | ✅ |
| **Quiz multiple-choice** (modo Repasar): opción correcta al azar, distractores parejos, explicación, SRS Leitner, filtro lección/nivel/todas | ✅ |
| Practicar **centrado en la tarea** (desafío protagonista, explicación plegable) | ✅ |
| Flujo: empieza por el desafío · **Ver solución** · al cambiar de lección vuelve a Aprender | ✅ |
| **Plantillas**: 12 documentos completos que combinan temas (panel propio de plantilla; todos verificados compilando) | ✅ |
| Code-splitting de PDF.js (lazy-load: se carga solo en Practicar) | ✅ |
| Sandbox por compilación + rate limiting (producción pública) | ⬜ |

> ✅ **Vertical de punta a punta funcionando:** lección → editor → compilar → PDF
> → desafío autocorregido → progreso. Frontend `tsc -b` + `build` OK; backend
> `tsc` OK y **smoke test real** (`POST /compile` → `200 application/pdf`, 42 KB,
> con `latexmk` + MiKTeX local). El backend vive en [`../../backend`](../../backend).

## 7. Dónde vivirá el código

A definir con el primer build. Propuesta: un folder propio (p. ej. top-level
`plataforma/`) separado de los `.tex`, porque es una app con su propio
`package.json`/build; **consume** `latex/` como fuente de contenido y **realiza**
el nivel A de `matex/`.

## 8. Futuro (no MVP)

- Backend propio (cuentas, progreso en la nube, contenido server-side).
- Gamificación extra: XP, logros, rachas, ranking.
- Editor semántico WYSIWYG (ProseMirror/TipTap) ↔ conecta con **Matex nivel B**.
