# Spec — Editor visual de documentos

> **Estado:** propuesta de diseño (2026-07-01, act. tras feedback), para aprobar
> antes de prototipar. Es la **compuerta del nivel B** de [la visión](../01-vision/)
> (el WYSIWYG que estaba diferido). Relacionado con `matex-vision`, LE-01/LE-02/LE-03.
>
> **Definido tras feedback:** (1) la **fuente de verdad se persiste en Matex**
> (AST-JSON), **no** en LaTeX — reconstruir desde `.tex` es imposible; LaTeX es
> export. Sin lenguaje textual todavía (puerta abierta a `.mtex` como proyección
> futura). (2) **Matex core PURO**: modelo + compilador Matex→LaTeX, sin DOM ni
> frameworks, *headless*; el editor visual es una capa **aparte** que depende de
> Matex, nunca al revés (Matex **no** es "un documento de TipTap"). (3) **DECIDIDO:**
> la capa de edición usa **TipTap/ProseMirror a distancia** (framework interno,
> aislado tras un borde doc↔AST); el core no lo importa.

## Objetivo

Sumar una **segunda vista** para trabajar un documento, sin sacar la actual:

1. **Tradicional** (ya existe): CodeMirror (escribís LaTeX) → compilás → PDF.
2. **Visual** (nueva): editás el documento **como se ve** (WYSIWYG), y a la
   derecha un **CodeMirror de solo lectura** muestra el código que se genera en
   vivo. Más dinámica, ideal para redactar y estructurar.

## La decisión central (y qué es Matex acá)

Un editor visual puede construirse de dos maneras muy distintas:

- **(A) Sobre LaTeX** — el documento *es* LaTeX; el editor lo parsea y lo
  regenera. **Descartado:** LaTeX es un lenguaje de macros Turing-completo; no se
  puede round-trip de forma fiel, y la sincronización con código escrito a mano es
  inmanejable.
- **(B) Sobre un modelo semántico** — el documento es un **AST** tipado (título,
  párrafo, énfasis, matemática, lista, teorema, figura…). El WYSIWYG edita el AST;
  el LaTeX es una **proyección de salida** (una dirección). **Elegido.**

**Conclusión:** para ser un buen editor visual, la vista nueva **es la primera
rebanada real de Matex** — el *modelo semántico* del que hablan los documentos de
`matex/`. LaTeX pasa a ser **un backend de salida** del modelo (mañana podría haber
otro: HTML, Typst).

**Sobre "el lenguaje que compila a LaTeX" (matiz del usuario):** el panel derecho
hoy muestra **LaTeX**. La arquitectura deja la puerta abierta a que, más adelante,
exista una **sintaxis textual Matex** como *otra proyección* del mismo AST. Pero
**hoy no se inventa gramática** (es el peor ROI, según la visión): el activo es el
**modelo**, no el lenguaje. El "lenguaje Matex" es un futuro opcional, no este paso.

**Persistir Matex ≠ inventar `.mtex` textual (son separables):**
- **Persistir el modelo (necesario):** la fuente de verdad es el **AST**, y su forma
  en disco puede ser simplemente **JSON** (el proyecto guarda el AST). Reconstruible,
  sin gramática. *Por qué:* si guardáramos solo LaTeX, no se podría **reconstruir** el
  documento para reabrirlo en el editor visual (LaTeX es de una sola vía). El `.tex`
  es un **export** para compilar/compartir.
- **Sintaxis textual `.mtex` (opcional, más adelante):** un lenguaje legible/diffeable,
  *otra proyección* del mismo AST. Es "el lenguaje nuevo" — mayor compromiso (diseñar
  sintaxis); no hace falta para el primer paso (con AST-JSON alcanza).

## Principios (no-goals incluidos)

- **Fuente de verdad = el AST, persistido en Matex.** El proyecto guarda el AST
  (JSON); el LaTeX es *derivado y read-only* (export). Quien quiera escribir LaTeX
  crudo usa la **vista tradicional**.
- **Matex core PURO.** El modelo (AST) y el compilador **Matex→LaTeX** no dependen
  del DOM ni de ningún framework de edición; son *headless*, testeables y podrían
  correr del lado del servidor. **Matex no es "un documento de TipTap".**
- **Separación estricta.** El editor visual es una **capa aparte que depende de
  Matex**, nunca al revés. Si esa capa usa un framework, es un detalle **interno**
  de ella, aislado tras un borde limpio (convierte framework↔AST); el core nunca lo
  importa.
- **Sin round-trip de LaTeX arbitrario.** No parseamos LaTeX hecho a mano hacia el
  AST (salvo, más adelante, un import best-effort acotado).
- **Escape hatch:** un nodo `rawLatex` (bloque de LaTeX crudo que se pasa tal cual a
  la salida y se muestra como código en el editor). Resuelve la cobertura parcial
  sin bloquear al usuario.
- **Reusar lo que ya hay:** KaTeX (preview de matemática, ya integrado), el **canon
  de preámbulo** (`features/latex/canon.ts`) para el LaTeX generado, y la pipeline de
  compilación (el doc Matex se **exporta** a `.tex` y compila a PDF con lo existente).

## Arquitectura: core puro + capa de edición

Dos módulos con dependencia en un solo sentido:

- **`matex-core` (puro):** el **AST** (tipos propios) + el **compilador Matex→LaTeX**
  + (de)serialización del AST (JSON). Cero DOM, cero frameworks, *headless*,
  testeable. Es "el activo": mañana puede sumar más backends (HTML, Typst) o una
  sintaxis textual `.mtex`, todo sin tocar la UI.
- **`editor-visual` (capa de UI):** depende de `matex-core`. Lee un AST y lo deja
  editar visualmente; en cada cambio actualiza el AST (fuente de verdad) y proyecta
  el LaTeX read-only a la derecha.

**Decisión (tomada): framework a distancia con TipTap/ProseMirror.** El
`editor-visual` usa TipTap (ProseMirror) **internamente** como superficie de edición,
convirtiendo su doc ↔ **AST Matex** en el borde (el AST es la fuente de verdad; el
doc de TipTap es efímero). Editor probado, menos trabajo. **Regla dura:** `matex-core`
**no importa** TipTap/ProseMirror ni el DOM — la dependencia va solo `editor-visual →
matex-core`. El mapeo doc↔AST vive en `editor-visual` y se mantiene chico junto con el
schema. (Se descartó el editor 100% propio por costo/riesgo; queda como alternativa si
el mapeo se volviera un problema.)

## Schema mínimo (piloto)

Nodos: `doc`, `heading` (niveles), `paragraph`, `text` con marcas
`strong`/`emph`/`code`, `bulletList`/`orderedList` + `listItem`, `mathInline`,
`mathDisplay`, y `rawLatex` (escape hatch). Extensión temprana probable:
`theorem`/`proof`, `figure` (imagen + caption), `codeBlock`, `table`.

Cada nodo define **cómo se renderiza** (HTML/React, con KaTeX para matemática) y
**cómo se serializa a LaTeX** (usando el canon para el preámbulo según qué nodos
aparecen: si hay matemática → `amsmath`/`mathtools`, si hay figura → `graphicx`,
etc. — el preámbulo se **infiere del contenido**, fiel a PISO/EXTRA).

## Cómo encaja en la app

- **Dos tipos de documento** conviven:
  - **Matex** (nuevo): su contenido **canónico es el AST (JSON)**. El `.tex` se
    **genera** para compilar/descargar/compartir, pero **no** es la fuente. Reabrir =
    cargar el AST → editor visual. (Se puede cachear el `.tex` derivado, pero la
    verdad es el AST.)
  - **LaTeX tradicional** (`.tex`, como hoy): vista CodeMirror + PDF.
- **Por qué el AST y no el `.tex`:** desde LaTeX **no se puede reconstruir** el
  documento para el editor visual (una sola vía). Guardar Matex es lo que permite ir
  y volver del modo visual.
- El `ProjectStore` ya guarda proyectos; se extiende para distinguir el **kind**
  (`matex` | `latex`) y guardar el AST cuando es Matex. Un doc Matex puede
  **exportarse** a un proyecto `.tex` (para la vista tradicional), pero no al revés.
- Entrada: desde **Mis Proyectos**, "Nuevo documento (visual/Matex)" además del
  actual en blanco / desde plantilla.
- La toolbar única (`HeaderSlot`) ya está lista para alojar los controles de
  formato del editor visual.

## Escalabilidad y cobertura (por qué no morirá de inanición)

Matex solo tiene sentido si **escala sin reescrituras** a los features necesarios
(multi-archivo, imágenes del proyecto, export/import zip, y a futuro tablas, gráficos,
figuras, referencias, bibliografía…). Cinco decisiones hacen que cada feature sea
**aditivo**:

1. **Registro de nodos (open/closed).** Cada tipo de nodo es un módulo con su forma
   (JSON), su `toLatex(node, ctx)` y qué **preámbulo requiere**. Sumar un feature =
   **registrar un nodo**; los existentes no se tocan. La UI del editor se agrega por
   separado para ese nodo.
2. **Preámbulo composicional.** Cada nodo declara sus paquetes (figura→`graphicx`,
   teorema→`amsthm`, tabla→`booktabs`, unidades→`siunitx`). El compilador junta la
   **unión** de lo presente y arma el preámbulo con el **canon** (PISO + EXTRA justos).
   No hay lista central que editar; sigue cumpliendo el canon (compila limpio).
3. **Recursos por referencia, reusando la infra existente** (clave anti-inanición). Un
   proyecto Matex = **AST + los mismos `ProjectFile[]`** que ya manejamos (texto/base64,
   multi-archivo, subida de imágenes, `.bib`, datos). Los nodos referencian archivos por
   path. → **imágenes** (nodo `figure`→asset base64→`\includegraphics`, reusa la subida
   ya hecha), **multi-archivo** (nodo `include`→`main.tex`+`capitulos/*.tex` al exportar,
   reusa el multi-archivo real), **zip** (AST-JSON+assets con `buildProjectZip`; y el
   export a `.tex` ya es un proyecto zippable/compilable). Gran parte del "escalar" **ya
   está construida** en la capa de proyecto; Matex se apoya encima.
4. **Escape hatch (`rawLatex`) = nunca callejón sin salida.** Cubre lo que el schema aún
   no modela; permite **lanzar con cobertura parcial y crecer** sin bloquear al usuario.
5. **AST versionado + migración** (como localStorage v1→v2): los docs viejos sobreviven
   a la evolución del schema.
6. **Capas de presentación** (lo extra-semántico). Lo que no es semántica pura pero
   tampoco estética global (p. ej. líneas verticales de una tabla) va como **atributo
   enum agnóstico con default = canon**, no como estilo crudo. **Regla dura: si no mapea
   a varios backends, no entra** (va a `rawLatex`). Detalle y test decisivo en la
   [Referencia del modelo v1 §5](../03-modelo-semantico/referencia-v1.md#5-lo-extra-semántico-las-4-capas-decisión).

**Mapa de cobertura (feature → cómo se suma):** multi-archivo = nodo `include` +
`ProjectFile[]`; imágenes = nodo `figure/image` → asset base64; zip = AST-JSON+assets /
export a `.tex`; **tablas** = nodo `table` → booktabs (+tabularx/siunitx por opciones;
TipTap tiene tablas); **gráficos** = `rawLatex` primero, luego nodo `plot`
(función+dominio) → pgfplots; **figuras** = imagen/plot + `\caption`+`\label`; refs/bib =
nodos `ref`/`cite` + registro de labels y `.bib` asset (pickers); tipos de documento =
nodo `meta` (clase/título/autor), `report` habilita capítulos.

**Cómo se construye para crecer:** un nodo = un módulo que co-localiza `toLatex`+preámbulo
(core) y schema TipTap+UI (editor). **El compilador lidera; la UI sigue** (un nodo puede
compilar antes de tener edición rica; mientras tanto se edita como `rawLatex`). **Golden
tests por nodo** (AST→LaTeX esperado) + `verify-content` (compila) aseguran calidad.

## Piloto (vertical slice) y compuerta go/no-go

Alcance del prototipo, para decidir con evidencia:

1. `matex-core`: el **AST** (schema mínimo de arriba) + compilador **Matex→LaTeX** +
   (de)serialización JSON. Puro y con tests (comparando LaTeX esperado).
2. Una vista nueva WYSIWYG con **TipTap** (doc↔AST en el borde) sobre ese AST.
3. Matemática con **KaTeX** (inline y display), editable.
4. Panel derecho: **CodeMirror read-only** con el **LaTeX proyectado en vivo**.
5. **Un** tipo de documento (p. ej. una *resolución de práctica* o un *informe*
   corto). Persistir el **AST**; **exportar** a `.tex` y compilar a PDF con la
   pipeline actual. Reabrir desde el AST.
6. `rawLatex` como válvula de escape.

**Criterio go/no-go (nivel B):** si editar en visual se siente natural **y** el
LaTeX generado es de **calidad** (cumple el canon, compila limpio), escalamos
(más nodos, más tipos de documento). Si no, aprendimos barato y seguimos con la
vista tradicional como principal.

## Riesgos

- **Cobertura**: el schema cubre un subconjunto de LaTeX; siempre faltará algo →
  mitigado por `rawLatex` y por empezar acotado.
- **Calidad del LaTeX generado**: debe ser legible y canónico, no "código
  máquina" → el serializador se cuida y se testea (comparando salida esperada).
- **Alcance**: es un feature grande; el riesgo es que crezca sin fin → se gobierna
  con la compuerta y el "un tipo de documento" del piloto.

## Qué NO hace este paso

- No inventa sintaxis/lenguaje Matex textual (futuro opcional).
- No importa LaTeX arbitrario al AST.
- No reemplaza la vista tradicional (conviven).
