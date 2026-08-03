# Plan de calidad y profundidad del contenido

> **Estado:** ✅ COMPLETO (2026-06-30). Las 6 fases hechas y verificadas.
> ✅ Fase 0 (canon como datos) · ✅ Fase 1 (lint `canonLint` + `corpus.test` en CI) ·
> ✅ Fase 2 (canon aplicado a todo: 584→0 violaciones, codemod idempotente, 122 compilaciones OK) ·
> ✅ Fase 4 (lecciones nuevas: canon-preámbulo, siunitx, anti-patrones + `l0-base-preambulo` a pedido → ruta 51→**55**) ·
> ✅ Fase 3 (**las 55 lecciones** al estándar rico, 4→6-7 bloques, content-only en N1-N4) ·
> ✅ Fase 5 (metadatos `\hypersetup{unicode,pdftitle,pdfauthor}` en los 7 ejemplares navegables; los
> 4 de clase especial se dejan sin hyperref a propósito).
> **Verificación final: 264 tests verdes, tsc+lint limpios, 122+31 compilaciones OK.**
> Gotcha registrado: `nag` rompe en este MiKTeX (Missing \endcsname) → se enseña pero no se carga en el ejemplo.
> Disparador: auditoría de la ruta, del código LaTeX que enviamos (curso,
> ejemplos, galería, plantillas) y de la profundidad de las lecciones.
> Vara de medición: [`latex/estandares/estandares.tex`](../../latex/estandares/estandares.tex).

## Objetivo

Que **todo** el LaTeX que muestra la plataforma sea de primer nivel y coherente
con "nuestra manera" de entender LaTeX (el `estandares.tex`), y que las lecciones,
ejemplos y prácticas tengan la **profundidad** y **cobertura** que el alumno
necesita. Sin romper lo que ya compila ni bajar la calidad del código de la app
(ports & adapters, contenido-como-datos, sin parches).

## Diagnóstico (resumen de la auditoría)

- **Cobertura:** buena y bien organizada (51 lecciones, módulos coherentes).
  Huecos: no hay lección del **canon de preámbulo** (vive solo en un PDF), ni de
  **siunitx**, ni de **anti-patrones/log limpio** (`l2tabu`/`nag`); el gotcha
  `es-noshorthands` no se enseña.
- **Código que enviamos — limpio en lo grave, incumple el piso:** `0` anti-patrones
  clásicos (`eqnarray`/`$$`/`\SI`/`\hline`) y `booktabs` se respeta. Pero contra
  nuestro propio canon "siempre":
  - `es-noshorthands`: **0** usos en código compilado (los 11 ejemplares, todas las
    plantillas y casi todas las lecciones usan `[spanish]{babel}` pelado).
  - `microtype`: ~15 docs de ~100+.
  - `mathtools` (4) vs `amsmath` solo (19): invertido.
  - Los *starters* de los desafíos suelen ir `\documentclass{article}` + el paquete
    del tema, **sin `fontenc`/`babel`**, en una plataforma en español.
- **Profundidad despareja:** el techo es excelente (`l1-amsmath`); el piso (N0 y las
  "survey" de N4) está en "mínimo adecuado".

## Principio rector: PISO vs EXTRA (no "cargar todo")

El propio estándar distingue **base MÍNIMA** vs **MÁXIMA** y dice que *cargar
paquetes que no se usan también es anti-patrón*. Por eso el canon tiene **niveles**,
no un bloque único:

- **PISO (siempre, en todo documento real en español):**
  `\usepackage[T1]{fontenc}`, `\usepackage{lmodern}`,
  `\usepackage[spanish,es-noshorthands]{babel}`, `\usepackage{microtype}`.
  Es gratis y evita bugs; va hasta en los *starters*.
- **POR TEMA (se agrega solo si el contenido lo usa):** matemática
  (`mathtools`+`amssymb`+`amsthm`+`siunitx`+`bm`), tablas (`booktabs`+`tabularx`),
  gráficos (`graphicx`/`pgfplots`+`compat`), navegación (`hyperref`+`cleveref`),
  etc.
- **Excepción consciente:** las 1–2 lecciones de "primer contacto"
  (`l0-primer-documento`) pueden quedar *barebones* a propósito, con un callout que
  diga "esto es lo mínimo para arrancar; el preámbulo completo se ve en
  [El canon del preámbulo]". El lint las tiene en una allowlist explícita.

---

## Fases

### Fase 0 — El canon, como datos tipados
**Qué:** `plataforma/src/features/latex/canon.ts` (módulo nuevo, sin dependencias):
fragmentos de preámbulo nombrados + builders que **componen** las bases
(`pisoEspañol()`, `baseMatematica()`, `baseBeamer()`, …) devolviendo strings. Es la
fuente única de verdad del preámbulo, espejo de `estandares.tex`.
- **Por qué módulo y no copiar strings:** DRY — cambiar el canon es un solo lugar;
  los ejemplos nuevos/reescritos se componen desde acá.
- **Criterio de hecho:** el canon reproduce las bases MÍNIMA/MÁXIMA del estándar;
  documentado con el *porqué* de cada fragmento; cubierto por un test de snapshot.

### Fase 1 — Lint de contenido ejecutable (extiende QA-03)
**Qué:** `features/latex/canonLint.ts` (función pura) + tests que **fallan** si:
- un doc con prosa en español no trae `es-noshorthands` / `fontenc[T1]` / `babel`
  (salvo allowlist de "primer contacto");
- usa `amsmath` solo donde corresponde `mathtools` (heurística: si carga
  `mathtools` no debe además cargar `amsmath` suelto; si usa comandos de mathtools
  exige el paquete);
- reaparece cualquier anti-patrón (`eqnarray`/`$$`/`\SI{`/`\hline`/`|c|`).
- Corre sobre lecciones (example+solution+starter), ejemplares y plantillas.
- **Criterio de hecho:** test verde con la allowlist mínima; integrado al `npm test`
  y a CI (job *checks*). Es la red que impide volver a divergir.

### Fase 2 — Aplicar el canon a TODO el corpus
**Qué:** normalizar preámbulos de las 51 lecciones (example/solution/starter), los
11 ejemplares y las plantillas para pasar el lint de Fase 1.
- Empezar por **ejemplares y plantillas** (son los "modelos" que el alumno copia),
  después lecciones.
- **Riesgo y mitigación:** cada cambio se revalida con `verify-content` (compila de
  verdad). `es-noshorthands` puede *destapar* dependencias que dependían de los
  shorthands (raro) → se prueba doc por doc.
- **Criterio de hecho:** lint verde + `verify-content` TODO OK (sin regресiones de
  compilación) + lint + tsc + build verdes.

### Fase 3 — Enriquecer las lecciones delgadas al "estándar rico"
**Qué:** llevar ~15–18 lecciones (sobre todo N0 y survey de N4) al nivel de
`l1-amsmath`: prosa qué/por qué/cuándo/variantes/errores, **ejemplo amplio
comentado**, **práctica fill-in con solución**, callouts de errores y buenas
prácticas. Lista candidata inicial: `l0-estructura-texto`, `l0-listas`,
`l0-caracteres-especiales`, `l0-matematica-basica`, `l1-tipografia`,
`l1-diseno-pagina`, `l2-numeracion`, `l4-instalacion`, `l4-inyectar`,
`l4-documentos-especiales` (las survey: enriquecer aunque no compilen, con código
ilustrativo). Orden por nivel.
- **Criterio de hecho por lección:** ≥4 bloques de contenido sustantivos, ejemplo y
  solución que compilan (cuando aplica) y pasan el lint, práctica con `mustInclude`
  significativo verificado por el test de QA-03.

### Fase 4 — Lecciones nuevas (cerrar huecos)
**Qué:** autorar (datos + quiz + ejemplo verificado):
1. **El canon del preámbulo** (N1, módulo Configuración) — la lección bisagra:
   base MÍNIMA vs MÁXIMA, *por qué* cada paquete, PISO vs EXTRA. Usa `canon.ts`.
2. **Números y unidades: siunitx** (N1/N2, Matemática) — `\num`, `\qty`, columna `S`,
   `output-decimal-marker`.
3. **Anti-patrones y log limpio** (N2 o N4) — `l2tabu`, `nag`, leer warnings
   (Overfull/Font shape/undefined refs), `showkeys`/`todonotes`.
- (Opcional, según apetito) KOMA a fondo, `standalone`, externalización de TikZ.
- **Criterio de hecho:** lección rica + quiz + ejemplo verificado; la ruta pasa de
  51 a ~54 lecciones; `content.test.ts`/`questions.test.ts` verdes.

### Fase 5 — Pasada fina de los ejemplares y plantillas
**Qué:** revisar que cada ejemplar/plantilla sea *ejemplar* de verdad: comentarios
con el *porqué*, una-idea-por-línea, macros semánticas donde repite, metadatos
`hypersetup{unicode,pdftitle,pdfauthor}`. Alinear con el canon (Fase 2 ya hizo el
preámbulo; esto es el cuerpo).
- **Criterio de hecho:** revisión doc por doc; `verify-content` verde.

---

## Orden recomendado y por qué

`Fase 0 → 1 → 2` primero: deja el **piso parejo y blindado** antes de invertir en
profundidad (no tiene sentido enriquecer una lección cuyo preámbulo después vamos a
tocar). Luego `3` (enriquecer) y `4` (nuevas) en paralelo conceptual, `5` al cierre.

## Criterios globales de "hecho" (en cada fase)

- `npm run lint` + `tsc -b --force` + `npm test` + `npm run build` verdes.
- `verify-content` (compila TODO contra el backend real) TODO OK.
- Sin bajar la calidad del código de la app (módulos, sin parches, ports & adapters).

## Riesgos

- **`es-noshorthands` destapa fallos latentes** en docs que usaban shorthands →
  mitigado por `verify-content` doc por doc.
- **Volumen:** tocar 51 lecciones es grande → las fases 2/3 se hacen por nivel, con
  verificación incremental, para no acumular riesgo.
- **Sobre-cargar preámbulos** (violar "no cargues lo que no usás") → mitigado por el
  diseño PISO/EXTRA y por el lint, que distingue ambos.

## Estimación (relativa)

- Fase 0: S · Fase 1: M · Fase 2: L (corpus entero) · Fase 3: L (15–18 lecciones) ·
  Fase 4: M (3 lecciones nuevas) · Fase 5: M.
