# 04 · Roadmap y compuertas de decisión

> Documento **vivo**. Define el **orden de trabajo** y las **compuertas (go/no-go)**
> que evitan invertir años en C antes de validar la tesis. Principio rector:
> **prototipar antes que teorizar**; cada etapa produce evidencia para la siguiente.

## 0. Estado actual

- ✅ Documentación reorganizada; históricos archivados ([`../00-historico/`](../00-historico/)).
- ✅ Visión, alcance, no-objetivos y niveles A/B/C ([`../01-vision/`](../01-vision/)).
- ✅ Marco de estado del arte ([`../02-estado-del-arte/`](../02-estado-del-arte/)).
- 🟡 Modelo semántico en borrador ([`../03-modelo-semantico/`](../03-modelo-semantico/)).

## 1. Orden de trabajo

> **Decisión (2026-06-28): la plataforma de enseñanza (nivel A) va primero.** Es
> el deliverable de menor riesgo y mayor valor inmediato. El barrido de Typst/
> Quarto (que valida el **lenguaje**, nivel B) queda **parqueado** hasta que toque
> esa apuesta. Spec completa en [05-plataforma](../05-plataforma/plataforma-spec.md).

### Paso 1 — Plataforma de enseñanza, MVP *(en curso)* ← **foco actual**
Nivel A. Web sobre la suite `latex/` + `TEMARIO.md`: **ruta por niveles**, **preview
real en el navegador** (SwiftLaTeX WASM), modalidades de práctica y **seguimiento
done/missing**. Stack y alcance del MVP cerrados en
[05-plataforma](../05-plataforma/plataforma-spec.md). Sub-pasos:

1. Scaffold Vite + React + TS + Tailwind/shadcn.
2. Editor CodeMirror 6 + puerto `LatexCompiler` con `MockCompiler` → PDF (PDF.js).
   La app funciona end-to-end **sin elegir backend**.
3. Enchufar el backend real detrás del puerto — candidato: **Docker + TeX Live**
   (`RemoteCompiler` HTTP); WASM como alternativa. **WASM es lo más débil: queda
   abierto y modular, se decide después.**
4. Autorar **Nivel 0** (~5–8 lecciones) con desafíos autocorregidos.
5. Motor de progreso por nivel/lección.

### Paso 1b (parqueado) — Barrido de estado del arte *(días, cuando toque el lenguaje)*
Portar [matematica.tex](../../latex/3-matematica/matematica.tex) a **Typst** y a
**Quarto/MyST** para identificar el **hueco real**. Solo necesario antes de
encarar el **nivel B** (capa semántica Matex). No bloquea la plataforma.

### Paso 3 — Cerrar el schema de un objeto *(semanas)*
Nivel B, parte 1. Cerrar el modelo de **`demostracion`** en
[03-modelo-semantico](../03-modelo-semantico/#4-ejemplo-el-nodo-demostracion-el-primer-objeto-a-modelar):
atributos, contención, *cross-refs*, proyección a LaTeX y HTML. Decidir
**substrato** (Pandoc AST / MyST / Typst) con la evidencia del Paso 1.

### Paso 4 — Vertical slice *(semanas)* ← **prueba de tesis**
Nivel B, parte 2. Implementar `demostracion` de **punta a punta**: superficie
heredada (directiva MyST o función Typst) → modelo → render a **PDF + HTML**.
Un solo objeto, completo.

### Paso 5 — Compuerta de decisión
Evaluar contra el [criterio de éxito](../01-vision/vision-y-alcance.md#7):
¿es técnicamente bueno **y** un autor prefiere escribirlo así? → seguir con más
objetos (grafos, autómatas) o, si no, **pivotar** a plataforma de enseñanza pura.

### Más allá — Nivel C *(diferido)*
Editor, workspace, multi-backend completo, IA sobre el AST, colaboración. Solo si
la compuerta del Paso 5 da verde y hay tracción. Ver
[niveles de ambición](../01-vision/niveles-de-ambicion.md#nivel-c--ecosistema-completo).

## 2. Diagrama

```mermaid
flowchart TD
    P1[1 · Barrido Typst/Quarto] --> P3[3 · Schema de 'demostracion']
    P1 --> P2[2 · Plataforma MVP (A)]
    P2 -. laboratorio .-> P3
    P3 --> P4[4 · Vertical slice → PDF+HTML]
    P4 --> G{5 · ¿valida la tesis?}
    G -- sí --> More[Más objetos + Nivel C]
    G -- no --> Pivot[Pivot: plataforma de enseñanza pura]
```

## 3. Compuertas (resumen)

| Compuerta | Pregunta | Si NO |
|-----------|----------|-------|
| Tras Paso 1 | ¿Hay un objeto que Typst **y** Quarto modelan mal? | Si todo lo cubren bien → el proyecto es **plataforma de enseñanza** (A), no lenguaje. |
| Tras Paso 4 | ¿El slice rinde bien en PDF y HTML? | Replantear modelo/substrato. |
| Tras Paso 5 | ¿Un autor lo **prefiere** a LaTeX/Typst crudo? | Pivot a A; archivar B/C como exploración. |

## 4. Principios de ejecución

- **Un objeto a la vez, de punta a punta.** Nada de modelar 10 nodos en abstracto.
- **Heredar, no inventar** (parser, backends, editor). Ver [02-estado-del-arte](../02-estado-del-arte/).
- **Evidencia > teoría.** La frontera semántica/carpintería se descubre construyendo.
- **A vale aunque B/C no ocurran.** Asegura valor incluso si la tesis del lenguaje no se valida.
