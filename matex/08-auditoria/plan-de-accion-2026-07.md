# Plan de acción — orden de ejecución

> Secuencia derivada de la [auditoría](auditoria-2026-07-21.md) y su
> [contra-informe](contra-informe-2026-07-21.md). El criterio de ordenamiento **no es la
> severidad**: es **qué habilita qué**. Un ítem urgente que hay que rehacer después no va
> primero.

**Principio rector.** Los pasos baratos que *cambian la forma* de los pasos caros van antes.
Escribir dos páginas de reglas cuesta una tarde y puede achicar un refactor de días — o
evitarlo. Al revés, refactorizar antes de decidir significa refactorizar dos veces.

**Las tres cadenas duras** (lo que no se puede reordenar):

```
alcance declarado ──────────► AR-09 (familias)      el alcance define su tamaño
tabla de política ──► AR-08 (numeración) ──► QA-08 (equivalencia)
AR-08 + AR-09 ──────────────► QA-06 (partir el editor)   consume lo que ambos cambian
```

---

## Fase 0 · Parar el sangrado

**Cuándo:** ya. **Esfuerzo:** minutos. **Depende de:** nada.

| # | Ítem | Qué |
|---|---|---|
| 0.1 | **RB-09** | `npm audit fix` en `backend/` — vulnerabilidad `high` en dependencia de producción |
| 0.2 | **FIX-19** | Guarda en el checkbox «Modo presentación»: deshabilitarlo, con explicación, si el documento ya es carta/examen/CV/póster |

**Por qué primero:** son independientes de todo lo demás y uno de ellos **destruye documentos
hoy** (dos clics convierten una carta en beamer y descartan destinatario, saludo y firma).
Arreglarlo no requiere ninguna decisión de diseño; esperar al modelado correcto (AR-09) sería
dejar la pérdida de datos abierta semanas por elegancia.

**Hecho cuando:** `npm audit --omit=dev` limpio · abrir la plantilla «carta formal» y no poder
convertirla en presentación sin aviso.

---

## Fase 1 · Escribir las reglas (papel, no código) — ✅ HECHA (2026-07-21)

**Resultado:** [`03-modelo-semantico/reglas-del-modelo.md`](../03-modelo-semantico/reglas-del-modelo.md)
con las cuatro reglas. **Alcance decidido:** las familias son **ciudadanas de primera en su
estructura** (no cortesías) — AR-09 va completo. **Hallazgo de la fase:** `showSolutions` está
mal ubicado (es ocasión de emisión, no propiedad del documento) → **FIX-20**, dentro de AR-09.

**Cuándo:** antes de tocar nada estructural. **Esfuerzo:** 1-2 sesiones. **Depende de:** nada.

| # | Documento | Qué decide |
|---|---|---|
| 1.1 | **Declaración de alcance** | ¿Matex es un sistema de documentos, o un sistema de razonamiento matemático que además emite documentos? Y en consecuencia: qué es **ciudadano** (se profundiza) y qué es **cortesía** (se mantiene, no se profundiza) |
| 1.2 | **Matriz de los cuatro lugares** | Dónde vive cada configuración: AST · política compartida · ocasión de emisión · recursos del entorno |
| 1.3 | **Tabla de política compartida** | Qué decisiones deben ser **idénticas** en los tres backends. Sale casi entera de filtrar la tabla actual de `referencia-v1.md` por «¿es agnóstica?» |
| 1.4 | **Regla de admisión** | Las tres preguntas que un campo nuevo debe contestar para entrar al AST |

**Por qué antes de los refactors, y no después:**

- **1.1 puede achicar AR-09.** Si carta/CV/póster/examen se declaran *cortesías*, quizá no
  haga falta una unión discriminada completa con migración v3→v4: puede alcanzar con la guarda
  de la fase 0 más validación en runtime. Eso convierte un ítem **M** en uno **S**. Decidir
  primero puede ahorrar días.
- **1.2 y 1.3 definen qué es AR-08.** Sin ellas, unificar la numeración es «mover código
  duplicado». Con ellas, es «crear la capa que falta, y la numeración es su primer inquilino» —
  que es lo que impide que el próximo caso vuelva a dispersarse.
- **1.3 es literalmente el insumo de QA-08.** No se pueden escribir tests de equivalencia sin
  la lista de lo que debe ser equivalente.
- **1.4 es lo único que rechaza cosas.** Sin regla de admisión, la disciplina depende de que
  alguien se acuerde.

> **Nota:** el proyecto ya escribió, antes de LE-03, que la política agnóstica *«debería subir a
> una capa de política compartida, y solo la proyección ser por-backend, para no re-decidir
> distinto en cada uno»* — y dio como ejemplo *«teoremas numerados por sección»*, que es
> exactamente donde después divergió. **Esta fase es ejecutar lo que ya estaba escrito.**

**Hecho cuando:** las cuatro cosas están en `03-modelo-semantico/`, y la columna «Configurable
sí/no» de la tabla existente fue reemplazada por **«quién puede cambiarlo»** con tres valores
posibles: *el autor* (y se nombra el campo) · *el que emite* (y se nombra la opción) · *nadie*
(es política del producto).

---

## Fase 2 · Construir la capa que falta — ✅ HECHA (2026-07-21)

**Resultado:** `core/` autocontenido (el canon se movió a `core/latex/`, AR-10); `core/policy/numbering.ts`
como fuente única de la numeración, consumida por HTML y editor (FIX-18 cerrado por construcción,
AR-08); y **QA-08** en dos capas: equivalencia editor↔HTML en vitest + `verify:numbering` que
compila LaTeX y compara la política contra el `.aux` (la política **coincide con LaTeX real**,
incluido el `0.1` que era el corazón del bug). CI corre las dos. 613 tests frontend + 48 backend.

**Cuándo:** después de la fase 1. **Esfuerzo:** S + S/M + M. **Depende de:** 1.2, 1.3.

| # | Ítem | Qué | Por qué en este orden |
|---|---|---|---|
| 2.1 | **AR-10** | `core/` deja de importar `features/latex/canon` | Deja el núcleo **realmente portable**; los tests de 2.3 pueden importar `core` sola, sin arrastrar media app |
| 2.2 | **AR-08 + FIX-18** | `core/policy/numbering.ts` como primer inquilino de la capa 2. El HTML se corrige **tomando la política del editor como referencia** (es la que espeja el canon). Se corrige también `html.test.ts:96`, que hoy fija el número equivocado | Es el bug vivo **y** el caso de prueba de que la capa 2 funciona |
| 2.3 | **QA-08** | Tests de equivalencia: los mismos documentos, comparando entre backends la numeración, el texto que resuelve cada `ref` y qué objetos son referenciables | **Es la compuerta.** Sin esto, todo lo anterior se puede volver a romper en silencio |

**Por qué 2.2 no se hace en la fase 0 aunque sea un bug vivo:** arreglar solo `html.ts` deja las
tres implementaciones en pie y obliga a tocar el mismo archivo dos veces. El bug afecta la salida
HTML (secundaria) y el proyecto no tiene usuarios: la diferencia entre arreglarlo hoy o en dos
pasos es baja, y hacerlo bien la primera vez vale más.

**Cuidado con 2.2:** `html.test.ts:96` afirma `'Teorema 1 (Pitágoras).'` para un documento sin
sección, donde LaTeX numera **0.1** (compilado y verificado). Ese test **se va a poner en rojo al
corregir el bug** — es correcto que se ponga en rojo. No es una regresión.

**Hecho cuando:** un documento con secciones, teoremas, observaciones, ecuaciones, figuras y
tablas produce **los mismos números** en PDF, HTML y editor, y hay un test que lo verifica y que
falla si alguien los separa.

---

## Fase 3 · Ordenar el modelo — ✅ HECHA (2026-07-22)

**Resultado:** las 5 flags de familia (`presentation`/`letter`/`exam`/`cv`/`poster`) se unificaron
en **`meta.family`** (unión discriminada) → el estado imposible `{letter, presentation}` **ya no
se puede escribir** (A-2 cerrado en el tipo, no en runtime). `showSolutions` pasó de `meta.exam` a
`opts` (FIX-20): es ocasión de emisión, el mismo AST da alumno/docente. Migración v3→v4
(`migrateFamily`) con precedencia y descarte de `showSolutions`; QA-08 protegió el cambio (la
numeración no se movió). 618 tests + 48 backend + PDFs reales de las 6 familias.

**Cuándo:** después de 1.1 y de la fase 2. **Esfuerzo:** S o M, según 1.1. **Depende de:** el
alcance declarado; y de que QA-08 ya exista.

| # | Ítem | Qué |
|---|---|---|
| 3.1 | **AR-09 + F-2** | Familias de documento: de flags sueltos a lo que 1.1 haya decidido (unión discriminada con migración v3→v4, o validación más liviana si son cortesías) |

**Por qué después de la fase 2:** vas a tocar `meta` y el compilador. Con QA-08 ya en su lugar,
si el cambio altera la numeración o las referencias, **el build te lo dice**. Sin QA-08, estarías
haciendo el refactor más delicado del modelo a ciegas.

**Si sale migración v3→v4:** aprovechar y meter en **la misma migración** cualquier otro cambio
de esquema pendiente. Dos migraciones del mismo esquema en dos semanas es peor que una.

---

## Fase 3.5 · ME-46 — jerarquía de libro (insertada 2026-07-22)

**Cuándo:** después de la fase 3, **antes** de la fase 4. **Esfuerzo:** M. **Depende de:** la
numeración centralizada (fase 2) y QA-08.

| # | Ítem | Qué |
|---|---|---|
| 3.5 | **ME-46** | Nodo `part` (`\part{}`, romanos), para que un libro tenga parte → capítulo → sección → subsección. Sin migración (nodo nuevo opcional). |

**Por qué se insertó acá, y antes de la fase 4** (reporte del usuario: "elijo libro y no puedo
crear partes/capítulos"). Tres razones de proceso:

1. **Evita tocar el editor dos veces.** La fase 4 parte `nodes.ts`/`MatexWorkspace.tsx` — donde
   vive la UI de encabezados. Hacer ME-46 *después* del split modificaría código recién partido;
   hacerlo *antes* deja que el split contemple el nodo nuevo de una vez.
2. **Es la primera prueba de carga real de la infra recién construida.** Fuerza a
   `core/policy/numbering.ts` (hoy 3 niveles fijos) a generalizar y pasa por la compuerta de
   QA-08 (el nuevo nivel debe numerar igual en los 3 backends). Mejor validar las abstracciones
   con una feature acotada ahora que después de un refactor L.
3. **Es acotada y user-facing**, mientras el refactor grande espera.

**Diseño (decidido, no-breaking):** un **nodo `part`** nuevo en vez de remapear niveles (que
rompería los libros existentes donde nivel 1 = capítulo). Subsubsection y front/main/backmatter
quedan como mejoras separadas — no bloquean el caso reportado.

---

## Fase 4 · El editor

**Cuándo:** después de las fases 2, 3 y 3.5. **Esfuerzo:** L. **Depende de:** AR-08, AR-09 y ME-46.

| # | Ítem | Qué |
|---|---|---|
| 4.1 | **QA-06** | Partir `MatexWorkspace.tsx` (2.064), `PlotEditor.tsx` (1.686) y `nodes.ts` (2.138) — **refactor primero, tests después**, como en QA-05 |

**Por qué al final:** el editor consume el modelo (`meta`, que cambia en 3.1) y la numeración
(que cambia en 2.2). Partirlo antes significa partirlo y volver a acomodarlo.

**El orden interno importa:** extraer primero lo que es **lógica pura** (estado del documento,
orquestación de compilación, gestión de archivos) y recién después testear. Escribir tests contra
el God component actual produce tests frágiles que se rompen con cada cambio cosmético — es la
lección de QA-05, donde extraer `paths.ts` y `outcome.ts` fue lo que hizo testeable el backend.

---

## Fase 5 · Diferibles y decisiones

Sin dependencias entre sí; se hacen cuando convenga.

| # | Ítem | Cuándo tiene sentido |
|---|---|---|
| 5.1 | **QA-07** | Smoke de contenido en PRs (`MATEX_LIMIT=1`). XS, en cualquier momento |
| 5.2 | **AR-11** | JS emitido como strings → al runtime construido. Toca `html.ts`; conviene **junto o después de 2.2** para no abrirlo dos veces |
| 5.3 | **RB-10** | Bundle de 2.5 MB. Rinde **cuando haya usuarios**, no antes |
| 5.4 | **AR-02** | Teclado en los widgets propios. Ídem |
| 5.5 | **F-1** | Clasificar `PlotSpec` en intención / receta / presentación. **Después de 4.1**, porque toca `PlotEditor.tsx` — hacerlo mientras ese archivo tiene 1.686 líneas y cero tests es riesgo innecesario |
| 5.6 | **F-3** | **Decisión, no código**: qué pasa con la matemática opaca. **Antes de empezar LE-06**, no durante |

---

## Qué NO hacer todavía, y por qué

| Tentación | Por qué esperar |
|---|---|
| Arreglar `html.ts` y listo (FIX-18 suelto) | Deja tres implementaciones en pie y toca el archivo dos veces. Va en 2.2 |
| Empezar por partir el editor (es lo más grande) | Consume estructuras que cambian en 2.2 y 3.1 → se hace dos veces |
| Reorganizar `PlotSpec` ahora (F-1) | Toca el archivo más grande y sin tests del proyecto. Después de 4.1 |
| Unión discriminada de familias antes de decidir el alcance | Podés construir un modelo elaborado para familias que decidas no profundizar |
| Empezar LE-06 | Choca con F-3, que es una decisión de producto no tomada |

---

## Bifurcaciones que pueden cambiar el plan

1. **Si 1.1 declara que las familias son cortesías** → AR-09 se achica de **M** a **S**, y la
   fase 3 casi desaparece. Es la razón principal para hacer 1.1 primero.
2. **Si QA-08 destapa más divergencias** (probable: la numeración fue la primera que se miró,
   nadie comparó el resto) → la fase 2 crece, y **es tiempo bien gastado**: cada divergencia
   encontrada ahí es un bug que no llega a un usuario.
3. **Si aparecen usuarios reales** → RB-10, AR-02 y todo RB-02/RB-03 suben de prioridad de golpe,
   y este plan se reordena alrededor del deploy.

---

## Resumen en una línea por fase

1. **Fase 0** — tapar la pérdida de datos y la vulnerabilidad. *Minutos.*
2. **Fase 1** — escribir las cuatro reglas que definen dónde cae cada cosa. *Papel.*
3. **Fase 2** — construir la capa de política compartida y **cerrarla con tests de equivalencia**.
4. **Fase 3** — ordenar las familias, ya protegido por esos tests.
5. **Fase 4** — partir el editor, ya sobre un modelo estable.
6. **Fase 5** — lo diferible, y las decisiones que preceden a LE-06.

**Lo más importante del plan es la fase 2.3.** Todo lo demás son mejoras; QA-08 es lo único que
convierte la filosofía del proyecto —«un AST, dos salidas de calidad»— en algo que **el build
verifica** en vez de algo que se afirma en un documento.
