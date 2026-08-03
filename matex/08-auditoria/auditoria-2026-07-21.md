# Auditoría del proyecto — 2026-07-21

> Barrido completo de código, arquitectura, modelo semántico y riesgos operativos, hecho
> después de cerrar la fase de calidad (commits `18b3337` · `57040db` · `e7ba7e7` · `e3826dc`).
> Estado del árbol auditado: **597 tests de frontend + 48 de backend, build y lint limpios,
> 154 compilaciones a PDF real OK**.

> ⚠️ **Este informe fue revisado y corregido.** Ver el
> [contra-informe](contra-informe-2026-07-21.md), que verificó cada afirmación ejecutándola:
> confirma la mayoría, **rebaja F-1** (el «51%» estaba inflado por comentarios; el real es 33%),
> **reencuadra A-2**, y sobre todo descubre que **A-1 no es un riesgo hipotético sino un bug
> presente** — la numeración del HTML ya contradice a la del PDF (FIX-18).

**Cómo leer este informe.** Cada hallazgo lleva tres marcas:

- **Severidad** — 🔴 alta (rompe o va a romper algo que importa) · 🟡 media (deuda que se
  cobra intereses) · ⚪ baja (mejora, no urgencia).
- **Esfuerzo** — **XS** (minutos) · **S** (horas) · **M** (días) · **L** (semanas).
- **Confianza** — **medido** (sale de un comando reproducible, ver anexo) · **inferido**
  (deducido del código, no ejercitado) · **juicio** (opinión de diseño, discutible).

La última importa: separa lo que *es* de lo que *me parece*.

---

## 1. Resumen ejecutivo

El proyecto está **estructuralmente sano y con una disciplina de tipos superior a la media**:
cero `any`, cero `@ts-ignore`, `strict` + `noUncheckedIndexedAccess` +
`exactOptionalPropertyTypes`, y 9 marcadores TODO/FIXME en todo el código (8 de ellos son
texto de lecciones). El núcleo semántico es puro de verdad y los puertos se respetan.

Los problemas reales son **tres**, y ninguno es de prolijidad:

1. **La numeración del documento está implementada tres veces** sin módulo compartido ni test
   que verifique que coinciden. Es la promesa central del editor («lo que ves es lo que
   compila») sostenida por duplicación.
2. **El modelo permite estados imposibles**: las seis familias de documento son flags
   independientes, y la exclusión mutua vive en una cadena de `if/else` que el tipo no declara.
3. **El editor visual —la mitad del código de producto— tiene 6% de la cobertura del núcleo**,
   concentrado en tres archivos de más de 1.600 líneas.

Y hay una **decisión estratégica no tomada** (§4.4): el proyecto ya convive con dos
representaciones incompatibles de la matemática, y LE-06 choca de frente con eso.

---

## 2. Cuadro de hallazgos ponderados

> **Estado al 2026-07-22** (pasada tras ejecutar el plan de acción + el barrido de impecabilidad).
> Los **cinco 🔴/🟡 estructurales** están cerrados; lo que queda es deuda **declarada y consciente**
> (F-1, A-4/AR-11, F-3) o baja prioridad operativa (O-2, O-3, C-3). La columna **Est.** lo fija para
> que un lector futuro no crea abierto lo que ya se resolvió.

| # | Hallazgo | Sev. | Esf. | Confianza | Est. |
|---|----------|:----:|:----:|-----------|------|
| A-1 | Numeración implementada 3× sin fuente única ni test cruzado | 🔴 | S/M | medido | ✅ `1e893b4` (política `core/policy/numbering.ts` + FIX-18 + QA-08) |
| A-2 | Las 6 familias de documento admiten estados imposibles | 🔴 | M | medido | ✅ `930c7d4` (familia = unión discriminada, AR-09, migración v3→v4) |
| O-1 | Vulnerabilidad `high` en dependencia de producción del backend | 🔴 | XS | medido | ✅ `508dcef` (fase 0, `npm audit fix`) |
| C-1 | El editor visual (8.846 líneas) con cobertura 0.06 | 🟡 | L | medido | ✅ **completo**: los 3 God-files partidos — QA-06 (`MatexWorkspace`) · QA-09 (`PlotEditor` 1.686→889) · QA-10 (`nodes.ts` 2.151→1.536). Módulos puros con tests donde había 0 |
| A-3 | `core/compile.ts` importa `features/latex/canon` (dirección invertida) | 🟡 | S | medido | ✅ `1e893b4` (canon a `core/latex/`; `core/` ya no importa hacia afuera, AR-10) |
| A-4 | JavaScript emitido como sopa de strings en `html.ts` | 🟡 | M | medido | ✅ AR-11 (controlador → `__mxInitPlot` en el runtime bundleado; `PLOT_VIEW` fuente única) |
| F-1 | El 51% del AST es un panel de configuración de gráficos | 🟡 | L | juicio | ⏳ deuda declarada (real 33%, ver contra-informe; antes de tocar `PlotEditor`) |
| F-2 | Nodos de familia contaminan la unión global de bloques | 🟡 | M | medido | ✅ `930c7d4` (resuelto con A-2) |
| F-3 | Dos representaciones incompatibles de la matemática | 🟡 | — | juicio | ⏳ decisión de producto (pre-LE-06) |
| O-2 | Bundle de 2.5 MB en un solo chunk | 🟡 | S | medido | ⏳ abierto (baja prioridad) |
| C-2 | El job de contenido no corre en pull requests | ⚪ | XS | medido | ⏳ abierto |
| O-3 | Accesibilidad: widgets propios no operables por teclado | ⚪ | M | inferido | ⏳ abierto (AR-02) |
| C-3 | `showcase`/`templates` con cobertura 0.02 (solo anti-bitrot) | ⚪ | S | medido | ⏳ abierto (baja prioridad) |

---

## 3. Salud del código (medido)

### 3.1 Tamaño y cobertura por área

| área | código | test | ratio |
|---|---:|---:|---:|
| `matex/core` | 8.926 | 3.032 | 0.34 |
| `features/latex` | 382 | 176 | 0.46 |
| `srs` · `progress` · `lib` | 381 | 171 | ~0.45 |
| **`matex/editor`** | **8.846** | **549** | **0.06** |
| `lessons` | 6.873 | 206 | 0.03 |
| `showcase` · `templates` | 3.427 | 71 | 0.02 |
| `workspace` · `preview` · `components` | 696 | 0 | 0.00 |
| `backend/src` | 361 | 486 | 1.35 |

**Lectura.** La cobertura sigue la línea de lo que es fácil de testear (funciones puras), no la
de lo que es riesgoso. `matex/editor` es tan grande como el núcleo y tiene **una sexta parte**
de su cobertura relativa. `lessons` y `showcase`/`templates` son en su mayoría **datos**, y su
verificación real es `verify:content` (compilar de verdad), que es la adecuada — su ratio bajo
no es alarmante. `workspace`/`preview`/`components` en 0.00 sí lo es menos por tamaño (696
líneas) que por ser la costura donde todo se junta.

### 3.2 Archivos grandes (sin contar datos de contenido)

| líneas | archivo |
|---:|---|
| 2.138 | `matex/editor/nodes.ts` (23 node views de TipTap) |
| 2.064 | `matex/editor/MatexWorkspace.tsx` (32 hooks, 3 modales) |
| 1.686 | `matex/editor/PlotEditor.tsx` |
| 1.222 | `matex/core/ast.ts` |
| 1.063 | `matex/core/graphics/relationSvg.ts` |
| 968 | `matex/core/html.ts` |
| 923 | `matex/core/compile.ts` |

### 3.3 Disciplina de tipos — **el punto más fuerte del proyecto**

| patrón | ocurrencias |
|---|---:|
| `: any` | **0** |
| `as any` | **0** |
| `@ts-ignore` / `@ts-expect-error` | **0** |
| `as unknown as` | 3 |
| `eslint-disable` | 3 |
| TODO/FIXME/HACK reales | **1** (los otros 8 son texto de lecciones) |

Con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noUnusedLocals`, `noUnusedParameters` y `verbatimModuleSyntax` activos. **No hay nada que
corregir acá.** Se registra porque conviene saber qué no hay que tocar.

---

## 4. Arquitectura

### A-1 · La numeración está implementada tres veces 🔴 S/M · medido

Hay **tres** implementaciones independientes de la misma regla semántica:

| dónde | cómo |
|---|---|
| Backend LaTeX | delegada a TeX (`\label`/`\cref`) — la autoridad de hecho |
| Backend HTML | `buildHtmlRefs()` en `html.ts`, pre-pasada propia |
| Editor visual | `editor/numbering.ts`, plugin de ProseMirror |

El comentario de `numbering.ts` lo dice sin eufemismos: *«espejo de la política de LaTeX (para
que lo que se ve = lo que compila)»*. Es decir, **una duplicación deliberada y consciente**, sin
módulo compartido y **sin ningún test que verifique que las tres coinciden**.

**Por qué es 🔴.** Es exactamente la clase de problema que tenía el reparto en columnas del
póster antes de extraer `core/poster.ts`, pero por triplicado y sobre algo mucho más visible: si
divergen, el editor **miente** sobre lo que va a compilar, que es justo la promesa que lo
justifica. Y la divergencia sería silenciosa: nada la detecta.

**Arreglo.** Un módulo puro `core/numbering.ts` como única política (secciones jerárquicas,
teoremas por sección con contador compartido, ecuaciones continuas, figuras y tablas),
consumido por `html.ts` y por el plugin del editor; el backend LaTeX sigue delegando en TeX,
pero un test compara **su salida contra la política** para el mismo documento. El test que
importa es el cruzado: *«los tres numeran igual este documento»*.

### A-2 · Las seis familias admiten estados imposibles 🔴 M · medido

`presentation`, `letter`, `exam`, `cv` y `poster` son **flags independientes y opcionales** en
`DocMeta` (`ast.ts` 1189-1197). Nada en el tipo impide:

```ts
meta: { presentation: true, letter: {…}, cv: {…} }   // representable, sin sentido
```

La exclusión mutua existe solo como **precedencia implícita** en una cadena de `if` del
compilador (`compile.ts` 292-297), no declarada en ningún lado y no documentada.

Entraron las cuatro últimas familias **en un solo commit** (ME-23 fase C) y nadie volvió a
mirar la forma resultante.

**Arreglo.** Unión discriminada: `meta.family?: {kind:'letter', …} | {kind:'exam', …} | …`.
Hace irrepresentables los estados ilegales, documenta la precedencia en el tipo, y abre la
puerta a acotar qué bloques valen en cada familia (ver F-2). Requiere migración v3→v4 — el
mecanismo ya está probado dos veces (v1→v2, v2→v3).

### A-3 · El núcleo importa hacia afuera 🟡 S · medido

`core/compile.ts` importa `../../latex/canon`. Es la **única** violación de dirección de
dependencias del proyecto (el resto de `core/` solo importa `zod` y `katex`), pero contradice
la declaración del propio módulo: *«import relativo a propósito: mantiene `matex-core`
portable / headless, importable también fuera del bundler»*. Es la razón por la que
`verify-content.ts` tiene que importar media aplicación para compilar un AST.

**Arreglo.** O el canon se mueve dentro de `core/` (es, de hecho, parte del backend LaTeX), o
`compileToLatex` recibe el constructor de preámbulo por parámetro.

### A-4 · JavaScript emitido como sopa de strings 🟡 M · medido

`html.ts` líneas 428-448 y 873-877: controladores completos de widget escritos como
concatenación de strings. Sin lint, sin tipos, sin tests, sin resaltado, imposibles de depurar.

Lo llamativo es que **el patrón correcto ya existe en el repo**: `plotRuntime.entry.ts` +
`scripts/build-plot-runtime.mjs` compilan un runtime de verdad que se embebe una sola vez.
Media solución está bien resuelta y la otra media quedó como texto.

**Arreglo.** Mover los controladores al runtime construido (ya se embebe igual), dejando en el
HTML solo la llamada parametrizada.

---

## 5. La filosofía del AST

Esta sección es **juicio de diseño**, no medición. Se separa a propósito.

### Lo que la filosofía logra

El modelo de documento es **genuinamente semántico**, con decisiones finas que conviene no
perder de vista:

- **`mathDisplay.aligned`** guarda la *intención* (¿alineo en `&` o centro?) y el compilador
  deriva el entorno (`equation` / `align` / `gather`). El AST se negó a guardar el nombre del
  entorno de LaTeX. Es el patrón correcto, aplicado antes de que LE-02 lo formalizara.
- **`theorem.proves`** modela una **relación entre objetos** («esta demostración prueba aquel
  teorema»), no una referencia tipográfica. De ahí salen el encabezado numerado y el link en
  los dos backends, gratis.
- **`derivation` y `reasoning`** son nodos que **no existen en LaTeX**: formas de razonamiento
  matemático que el modelo inventó y que cada backend materializa. Es el proyecto en su mejor
  versión — el AST agregando valor, no traduciendo.
- **Escalado aditivo real**: 19 tipos de bloque acumulados sin romper los previos.
- **Escotillas honestas y acotadas**: `rawLatex` e `include` **avisan** en HTML en vez de
  fingir. Una escotilla que miente es peor que no tenerla.
- **Versionado con migraciones**: v1→v2 y v2→v3, idempotentes y conservadoras, con test de que
  lo viejo sigue produciendo lo mismo.

### F-1 · El modelo tiene dos mitades con filosofías distintas 🟡 L · juicio

**623 de las 1.222 líneas de `ast.ts` — el 51% — son el modelo de gráficos.** `PlotSpec` tiene
**26 campos opcionales**; `PlotFunction`, **19**.

Entre ellos: `samples`, `hideTicks`, `piTicks`, `equalAxes`, `endLabel`, `featureCoords`,
`markRoots`, `markExtrema`, `markInflections`, `markAsymptotes`, `markYIntercept`, `shade`,
`inverse`.

Para la prosa, el AST **se niega** a guardar «negrita 12pt» porque es presentación. Para un
gráfico guarda `samples: 200` y `hideTicks: true`. La mitad de gráficos, mirada de frente, **no
es un modelo semántico: es un panel de configuración con unas 45 perillas** — muy bien
construido, modularizado por familia, con sus dos emisores co-localizados, pero de otra
naturaleza que la primera mitad.

**El contraejemplo está dentro del propio modelo.** `PlotRole` —declarar que una curva *es* la
función, su derivada o una asíntota— sí es semántico, y de ahí se derivan color y estilo
automáticamente. Ese es el camino que los otros 40 campos no tomaron.

La pregunta de fondo, que el proyecto todavía no se hizo: **¿un gráfico es un objeto semántico
(«mostrá f(x)=x² destacando sus raíces») o un lienzo con perillas?** Hoy es lo segundo con el
vocabulario del primero.

*No se propone arreglo.* Es una tensión de diseño legítima —los gráficos quizá **son**
irreductiblemente más configurables que la prosa— pero conviene que sea una decisión y no un
accidente. Si se decide que está bien, corresponde escribirlo en la doc del modelo.

### F-2 · Nodos de familia en la unión global 🟡 M · medido

`SlideNode`, `ColumnsNode`, `ExamQuestionNode`, `CvEntryNode` y `PosterBlockNode` viven en el
mismo `BlockNode` que `ParagraphNode`. **5 de los 19 tipos de bloque solo tienen sentido dentro
de una familia**, y el modelo no puede expresarlo: un `cvEntry` dentro de una diapositiva
dentro de una carta es un documento válido para el tipo.

Se resuelve junto con A-2: con la familia como unión discriminada, se puede tipar qué bloques
admite cada una.

### F-3 · Dos representaciones incompatibles de la matemática 🟡 · juicio

| dónde | representación |
|---|---|
| Prosa (`mathInline.tex`, `EquationRow.tex`, `derivation.steps[].tex`) | **cadena opaca** de LaTeX |
| Gráficos (`plotExpr.ts`) | **AST parseado**, con evaluador y conversión ASCII↔LaTeX |

El modelo semántico del documento trata la matemática como texto opaco; el módulo de gráficos
la trata como estructura. Son **dos representaciones de lo mismo, sin puente**.

La `tex` opaca está admitida por diseño y se defiende bien (es lingua franca; KaTeX/MathJax la
llevan a MathML). Pero tiene consecuencias que hoy no se pagan y mañana sí:

- El AST **no puede analizar** su propia matemática.
- El editor no puede manipularla estructuralmente.
- Un tercer backend no-TeX (DOCX, por ejemplo) necesitaría un parser de TeX.
- **LE-06 (cómputo declarativo, `verify` numérico) choca de frente con esto**: para verificar
  que un paso de una derivación es correcto hay que *entender* la matemática, y en
  `derivation.steps[].tex` no hay estructura que entender.

**Recomendación: tomar esta decisión antes de empezar LE-06, no durante.** Las opciones son
reconocibles: (a) la matemática de la prosa se queda opaca y `verify` se limita a lo que se
declare por separado en campos estructurados; (b) el AST de expresiones que ya existe en
gráficos se promueve a ciudadano de primera en todo el documento, con `tex` como *fallback*.
Es una decisión de producto, no técnica.

---

## 6. Cobertura y verificación

### C-1 · El editor visual, con 6% de la cobertura del núcleo 🟡 L · medido

8.846 líneas, 549 de test, concentradas en `mapping`, `numbering` y `mathAutocomplete`. Sin
cobertura directa: **`nodes.ts` (2.138)**, **`MatexWorkspace.tsx` (2.064)**, **`PlotEditor.tsx`
(1.686)** — 5.888 líneas, el 67% del área.

**Matiz importante:** el problema no es «faltan tests», es que esos tres archivos **no son
testeables como están**. `MatexWorkspace` es un God component con 32 hooks y 3 modales que
mezcla estado del documento, orquestación de compilación, gestión de archivos y UI. Escribir
tests contra eso produce tests frágiles que se rompen con cada cambio cosmético.

**El orden correcto es refactor → test, igual que en QA-05**, donde extraer `paths.ts` y
`outcome.ts` fue lo que hizo posible testear el backend. Hacerlo al revés produce cobertura
que estorba.

### C-2 · El job de contenido no corre en pull requests ⚪ XS · medido

`.github/workflows/ci.yml`: `if: github.event_name != 'pull_request'`. Razonable por costo (el
job levanta un contenedor de TeX Live completo), pero significa que **un PR puede romper la
compilación de contenido sin que CI lo diga**. Mitigación barata: correr `verify:content` con
`MATEX_LIMIT=1` en PRs (smoke), y el completo en main.

### C-3 · `showcase` / `templates` con ratio 0.02 ⚪ S · medido

Es en su mayoría **datos**, y su verificación adecuada es compilar de verdad — que ya ocurre
(los 23 documentos Matex entraron a `verify:content` en esta fase). El ratio bajo no es
alarmante; se registra para que no se lo confunda con un hueco real.

---

## 7. Riesgos operativos

### O-1 · Vulnerabilidad `high` en producción del backend 🔴 XS · medido

```
fast-uri  3.0.0 - 3.1.2   (transitiva de fastify)
Severity: high — host confusion via failed IDN canonicalization
GHSA-4c8g-83qw-93j6 · fix disponible con npm audit fix
```

El frontend está limpio (0 vulnerabilidades). Es un `high` **en el servicio que va a quedar
expuesto a internet** (RB-02/RB-03). Costo del arreglo: un comando.

### O-2 · Bundle de 2.5 MB en un solo chunk 🟡 S · medido

`dist/assets/index-*.js` = **2.500 KB** (PDF.js ya está separado, 416 KB). El build lo viene
avisando en cada corrida y nadie lo atendió. Candidatos obvios a `import()` diferido: el editor
visual completo (TipTap + node views + PlotEditor), KaTeX, JSZip.

Pesa más cuando haya usuarios reales con conexiones reales; hoy es una molestia teórica.

### O-3 · Accesibilidad: los widgets propios no son operables por teclado ⚪ M · inferido

**Corrección de una lectura apresurada:** el conteo crudo sugería un panorama peor del real.
Hay **114 `aria-label`** y **42 referencias a foco/Escape**, o sea que los modales manejan
teclado y los controles están etiquetados. No hay `<img>` en la UI, así que la ausencia de
`alt` **no es un hallazgo**.

El hueco real es más acotado: los **widgets propios** —el gráfico SVG con zoom/pan por rueda y
arrastre, y los 23 node views de TipTap— son operables solo con mouse (`tabIndex` 0,
`onKeyDown` 2 en toda la app). Corresponde a **AR-02**, que sigue siendo válido pero debería
reencuadrarse: no es «un pase general de accesibilidad», es «los widgets propios necesitan
equivalente de teclado».

---

## 8. Lo que está bien (y no hay que tocar)

Se registra explícitamente para no invitar a la sobre-corrección:

- **Disciplina de tipos** (§3.3) — mejor que la media con holgura.
- **Pureza del núcleo** — cero React/DOM en `core/`, verificado.
- **Ports & adapters** — `LatexCompiler`, `ProjectStore`, `ProgressStore` con adaptadores y una
  única composición (`createCompiler`).
- **Co-localización de emisores** por familia de gráfico (10 pares LaTeX/SVG).
- **Backend** — tras QA-05, ratio 1.35 y las reglas críticas en módulos puros.
- **Migraciones del AST** — mecanismo probado, idempotente y conservador.
- **Cultura de bitácora** — el backlog documenta decisiones y gotchas, no solo estados. Es un
  activo real: buena parte de esta auditoría se apoyó en él.

---

## 9. Secuencia recomendada

1. **O-1** (XS) — `npm audit fix` en el backend. Es un `high` en lo que se va a exponer.
2. **A-1** (S/M) — unificar la numeración en `core/numbering.ts` + test cruzado de los tres
   backends. Barato y elimina una clase entera de bugs silenciosos sobre la promesa central del
   editor.
3. **A-2 + F-2** (M) — familias como unión discriminada, con migración v3→v4. Vuelve
   irrepresentables los estados ilegales y ordena el vocabulario de bloques.
4. **A-3, A-4** (S/M) — dirección de dependencias del núcleo y los controladores de string al
   runtime construido. Baratos, aislados.
5. **C-1** (L) — partir `MatexWorkspace.tsx` y `PlotEditor.tsx`, **y recién entonces** testear.
   Después de 2 y 3, porque esos cambios tocan las estructuras que el editor consume.
6. **F-3** (decisión, no código) — resolver la cuestión de la matemática **antes** de LE-06.
7. Diferibles hasta que haya usuarios: **O-2** (bundle), **O-3/AR-02** (teclado en widgets),
   **C-2** (smoke de contenido en PRs, aunque es XS y se puede hacer en cualquier momento).

---

## Anexo · Reproducir las mediciones

```bash
# Cobertura por área (código vs test)
find features/<área> -name '*.ts' -o -name '*.tsx' | grep -v '\.test\.' | xargs wc -l | tail -1

# Disciplina de tipos
grep -rn ": any\|as any\|@ts-ignore\|@ts-expect-error" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'

# Pureza del núcleo
grep -rn "document\.\|window\.\|useState\|from 'react'" features/matex/core --include='*.ts' | grep -v '\.test\.'

# Dirección de dependencias del núcleo
grep -rn "^import" features/matex/core/*.ts | grep -v "from '\./"

# Proporción de gráficos en el AST
awk 'NR>=258 && NR<=880' features/matex/core/ast.ts | wc -l   # 623 de 1222

# Vulnerabilidades de producción
cd backend && npm audit --omit=dev

# Bundle
cd plataforma && npm run build && ls -la dist/assets/*.js
```
