# Reglas del modelo — dónde vive cada decisión

> **Fase 1 del [plan de acción](../08-auditoria/plan-de-accion-2026-07.md).** Cuatro reglas que
> definen *dónde cae* cada cosa, para que las decisiones futuras tengan un lugar en vez de
> dispersarse. Es papel a propósito: escribir esto cuesta una tarde y cambia la forma de los
> refactors que siguen.
>
> **Por qué existe.** El proyecto acumuló decisiones sin un criterio de dónde ponerlas: LE-02
> encontró vocabulario de LaTeX dentro del "modelo semántico"; el contra-informe encontró la
> numeración implementada tres veces y divergiendo; y una revisión encontró `showSolutions`
> —una decisión de *ocasión*— persistida como si fuera del documento. Los tres son el mismo
> problema: **no había un lugar declarado para cada tipo de decisión, así que caían donde fuera.**

---

## Regla 1 · Alcance — qué es Matex, y qué profundidad le debe a cada cosa

**Matex es un sistema de documentos técnicos con profundidad en lo matemático.**

No es "un editor de cualquier documento" (eso no tiene ventaja sobre Word ni Typst), ni es
"solo matemática" (las familias de documento ya existen y funcionan). Es un punto medio con una
jerarquía **explícita de profundidad**:

- **Corazón (1ª clase, se profundiza):** el razonamiento matemático. `theorem`/`proof` con la
  relación `proves`, `derivation`, `reasoning`, `mathDisplay`, los gráficos por intención, las
  referencias cruzadas. Es lo que **ninguna otra herramienta hace bien** y es el norte (LE-06).
- **Familias de documento (1ª clase en su *estructura*):** presentación, carta, examen, CV,
  póster. Son **ciudadanas**, no cortesías: su estructura se modela con la misma seriedad que el
  resto. Pero "ciudadana" no significa "todo va al AST" — significa que **su estructura** va al
  AST y se le aplica la Regla 2 como a todo lo demás.

> **Corrección de rumbo.** [`01-vision/vision-y-alcance.md`](../01-vision/vision-y-alcance.md)
> §6 decía *«cartas, CVs y pósters quedan fuera del wedge»*, y ME-23 los construyó igual. Esa
> contradicción se resuelve **acá y a favor de tenerlos**: son parte del producto. Pero se
> declara la jerarquía de profundidad para que "tenerlos" no signifique "deberles el mismo
> esfuerzo de I+D que a las pruebas matemáticas".

**Consecuencia operativa:** un pedido de feature sobre el corazón se pondera distinto que uno
sobre una familia. Profundizar `derivation` con verificación (LE-06) es estratégico; agregar
una tercera variante de layout de póster es cortesía. Ambos válidos, distinta prioridad.

---

## Regla 2 · Los cuatro lugares — dónde vive una configuración

Toda decisión sobre cómo se ve o se comporta un documento cae en **exactamente uno** de cuatro
lugares. Dos preguntas lo determinan:

- **¿Quién lo decide?** El **autor** (mientras escribe) o el **sistema** (una vez, al diseñar).
- **¿Viaja con el documento?** Sí (persiste en el `.mtex`) o no (efímero, por emisión).

|  | Lo decide el **autor** | Lo decide el **sistema** |
|---|---|---|
| **Viaja con el doc** | **① AST** (`meta`, nodos)<br>`docKind`, `style`, `accent`, `toc`; y **la estructura**: `SlideNode`, `ExamQuestionNode`, `LetterMeta.to`… | **② Política compartida**<br>teoremas por sección, tablas sin verticales, índice en página propia |
| **No viaja** | **③ Ocasión de emisión** (`opts`)<br>`theme: dark`, `standalone`, **`showSolutions`** | **④ Recursos del entorno** (`opts`)<br>`images`, `bibFile` |

**El *cuándo* se deduce del lugar, y es lo más útil:**

- **①** se decide al **autorar** → persiste; cambiar su forma pide **migración** (`MATEX_AST_VERSION`).
- **②** se decide al **diseñar el producto** → vive en el repo, versionada, **con tests de
  equivalencia** (Regla 3). Es la capa que faltaba y donde nació el bug de numeración.
- **③** se decide en **cada llamada** → efímero, nunca persiste. El mismo documento se ve claro
  u oscuro, con soluciones o sin ellas, según quién y cómo lo emita.
- **④** no es configuración: es **inyección de dependencias**. El núcleo es puro y no lee
  archivos; el llamador le pasa lo que necesita.

### El caso que enseña la regla: `showSolutions`

Hoy vive en `meta.exam.showSolutions` (lugar ①, persistido). Pero decide entre **dos versiones
del mismo documento** —la del alumno y la del docente— y su propio comentario admite que *«el
mismo AST da las dos»*. Si el mismo AST da las dos, **cuál emitir no es una propiedad del
documento**: es lugar ③, una ocasión de emisión, exactamente como `theme: dark`.

Está mal ubicado. El arreglo (cuando se toque examen, fase 3): mover `showSolutions` de `meta` a
`opts`. El documento guarda **ambas** versiones latentes; el emisor elige cuál materializa.

> **Guía rápida para clasificar un campo nuevo:** si dos personas razonables podrían querer
> emitir el **mismo** documento con valores distintos de ese campo (uno lo quiere oscuro, otro
> claro; uno con soluciones, otro sin), es lugar **③**, no ①. Si el valor *define qué es el
> documento* (una carta con otro destinatario es otra carta), es ①.

---

## Regla 3 · Política compartida — lo que los backends deben decidir IGUAL

Hay decisiones que **no están en el AST** (las toma el sistema) pero que **todos los backends
deben honrar idénticamente**. Son el lugar ②. La prueba para saber si algo es política
compartida es una sola pregunta:

> **Si dos backends la resuelven distinto, ¿es un bug o una feature?**

- **Bug** → es política compartida (②). *La numeración*: si el PDF dice «Teorema 1.1» y el HTML
  «Teorema 3», eso es un defecto, no una diferencia de medio.
- **Feature** → es proyección por-backend (③/materialización). *El tema visual*: el PDF sobre
  papel y el HTML sobre pantalla **deben** poder verse distinto; forzarlos iguales sería el bug.

### La tabla de política compartida (v1)

Filtrada de la tabla de decisiones de [`referencia-v1.md`](referencia-v1.md) §4 por «¿es
agnóstica del backend?». Estas decisiones **deben producir el mismo resultado** en LaTeX, HTML y
en el editor visual, y **QA-08** las verifica:

| Decisión | Política | Hoy |
|----------|----------|-----|
| **Numeración de secciones** | jerárquica 1 / 1.1 / 1.1.1 | ✅ coincide |
| **Numeración de teoremas** | **por sección**, contador compartido; `proof` y `remark` **sin número** | ❌ el HTML numera global y numera `remark` (FIX-18) |
| **Numeración de ecuaciones** | contador continuo; una por fila numerada | ✅ coincide |
| **Numeración de figuras/tablas** | solo las que tienen caption; contadores separados | ⚠️ sin verificar cruzado |
| **Texto de una referencia** | "Teorema 1.1" / "figura 2" / "ecuación (3)" — derivado del número | ❌ hereda el error de numeración |
| **Qué es referenciable** | secciones, teoremas (no proof), filas de ecuación numeradas, figuras/tablas con caption | ⚠️ sin verificar cruzado |
| **Anidado de marcas** | strong › emph › code | ✅ (misma regla en ambos) |
| **Qué hace una escotilla en HTML** | `rawLatex`/`include` **avisan**, no fingen | ✅ |

> El **editor visual es un tercer backend** para esta tabla, no "la UI". Su numeración
> (`editor/numbering.ts`) es una proyección de esta política sobre ProseMirror, y es **la única
> que el autor ve mientras escribe** — por eso su divergencia sería la peor. Que hoy sea la
> única de las tres que numera bien es un accidente afortunado, no una garantía: sin la política
> unificada, nada impide que la próxima edición la separe.

**Dónde vive el código:** cada política que hoy está duplicada baja a un módulo puro en
`core/policy/`. `numbering.ts` es el primero (AR-08).

> **② no es solo *decisiones*, también *cómputo*.** La numeración es una regla barata; pero el
> mismo casillero ② aloja **cálculo compartido** —encontrar raíces, integrar, derivar (tangente),
> intersecar— que hoy vive enredado en el backend SVG y debería estar arriba de los backends por
> la misma prueba (si dos backends computaran raíces distintas, sería un bug). El pipeline completo
> (① AST → ② resolución → ③ backends → ④ editor), el principio *"el AST guarda intención, los
> hechos derivados se computan"*, y el análisis de si el AST del plot debería re-expresarse como
> **operaciones componibles**, están en [computo-y-capas.md](computo-y-capas.md).

---

## Regla 4 · Admisión — qué debe contestar un campo para entrar al AST

Antes de agregar un campo a `meta`, a un nodo, o un nodo nuevo al modelo, tiene que contestar
**las cuatro**. Si falla una, no entra al AST — va a otro de los cuatro lugares, o no va.

1. **¿Qué carpintería le ahorra al autor?** Si la respuesta es "ninguna, es una perilla de
   ajuste fino", probablemente sea presentación (capa 2 dentro del AST, o lugar ③), no
   estructura. *Un campo que no ahorra decisión al autor no es semántico.*
2. **¿Lo pueden honrar los dos backends?** Si solo tiene sentido en LaTeX, es materialización y
   no va al AST (es la lección de LE-02: `metropolis`, `banking` eran esto).
3. **Si un backend no puede, ¿avisa o miente?** Una escotilla que avisa (`rawLatex` en HTML) es
   admisible. Una que finge coincidencia es deuda.
4. **¿Es lugar ① o ③?** Si dos personas podrían querer el mismo documento con valores distintos
   (Regla 2), es ③ (`opts`), no ① (`meta`). *`showSolutions` falló esta y por eso está mal.*

> **Esta es la única regla que rechaza cosas.** Las otras tres organizan; esta frena. Sin ella,
> la disciplina depende de que alguien se acuerde — y la historia del proyecto (45 campos en
> `PlotSpec`, cuatro familias como flags sueltos, vocabulario de paquete en `meta`) muestra que
> "acordarse" no alcanza. La filosofía de un modelo se mide por lo que **no** deja entrar.

---

## Cómo esto reordena el backlog

- **AR-08 / FIX-18** dejan de ser "unificar código duplicado" y pasan a ser **"construir la
  capa ② y poner la numeración como su primer inquilino"**. Módulo `core/policy/numbering.ts`.
- **QA-08** tiene ahora su insumo exacto: **la tabla de la Regla 3**. Los tests de equivalencia
  verifican esa tabla, fila por fila, sobre los tres backends.
- **AR-09** (familias) se guía por la Regla 1 (son ciudadanas: se modelan bien) y la Regla 2 (su
  estructura al AST; `showSolutions` a `opts`). La unión discriminada resuelve además los
  estados imposibles (A-2).
- **F-1** (`PlotSpec` con 45 campos) se resuelve clasificando cada campo por la Regla 2:
  intención (①-estructura), presentación (①-capa 2) o receta de construcción. No hay que
  rehacer los gráficos; hay que **ordenarlos** según un criterio que ahora existe.
- La columna "Configurable sí/no" de [`referencia-v1.md`](referencia-v1.md) §4 se reemplaza por
  **"quién puede cambiarlo"**: *el autor* (①, se nombra el campo) · *el que emite* (③, se nombra
  la opción) · *nadie* (②, es política del producto).
