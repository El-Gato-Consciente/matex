# Auditoría — spec de nodos ejecutables (borrador + addendum + comparativo)

> **Por qué existe.** El `spec-nodos-ejecutables-matex-borrador.md`, su addendum y el comparativo
> se produjeron **fuera de este ecosistema** (conversaciones con Gemini). Antes de consagrarlos como
> fuente de verdad normativa, se auditan contra: (C) el código real, (D) las conclusiones ya
> establecidas + las 4 reglas, (B) consistencia interna, (A) afirmaciones externas. **Un spec que
> vino de afuera no entra por confianza; entra por verificación.** Fecha: 2026-07-22.
>
> Marcas: ✅ verificado correcto · ⚠️ impreciso/a-corregir · ❌ inconsistencia real · 🟡 propuesto,
> no ratificado · Ⓐ externo sin verificar.

---

## ✅ Verificado correcto (la mayoría)

- Invariantes **I1-I9** alineados con lo decidido (un namespace, secuencial, AST=intención, backend
  no ejecuta, sandbox, freeze).
- **I6 = Regla 3**, **§5.2 = Regla 4**, **§7 extiende Regla 3** — los números de regla **coinciden**
  con `reglas-del-modelo.md`.
- **§14** preserva la degradación de `verify` a extra opcional.
- La bisagra `P` (pureza + cerradura + cycle-safety) y "el motor ya integra/deriva" — consistentes
  con el código: `core/graphics/relation.ts` tiene `integrate` (N=300) + Riemann/trapecios;
  `features.ts` hace raíces/extremos/asíntotas.
- **ME-38 / ME-40 / ME-45** citados correctamente (roles+tema / Riemann / interpolación) — existen
  en el backlog con ese contenido.
- Addendum §16.2: el argumento de que las clases isomorfas **no** violan I4 (salida siempre por
  `emit()`, materialización centralizada en el compute pass) es sólido.

## ❌ Inconsistencia interna real (corregir)

**El spec se contradice sobre si una variable Python cruda llega al AST sin `emit_*`.**
- Glosario + **I4**: *"`emit_*` es la **única** vía de un nodo Python hacia el AST"*.
- §3.3: `exec` liga entidades *"vía `emit_*` **o asignación directa a variables Python simples**"*.
- §11.2: `exec: "y = f(2)*10"` → `ref: y` → *"el resultado es {{y}}"* — una variable cruda `y` se
  **renderiza** vía `ref` sin pasar por `emit_value`. **Contradice I4 y el glosario.**

**Resolución adoptada (2026-07-22):** distinguir **valores de namespace** de **materialización al AST**.
- Cualquier valor Python puede **ligar un nombre** en el namespace (`y=5`); eso **no es "llegar al
  AST"**, es poblar el namespace (consumible por más código o por un `ref`).
- **Llegar a contenido visible** ocurre de dos formas, ambas **mediadas por el sistema en el compute
  pass, ninguna es "Python escribe el árbol"**: (a) `emit_*` en la posición del nodo de código (nodo
  tipado en el lugar); (b) un `ref` que **materializa** un valor del namespace en la posición del
  `ref`. Escalares (número/string) → el `ref` los envuelve inline (conversión trivial, determinista);
  valores **estructurados/foráneos** (DataFrame, sympy) → **deben** tiparse antes vía `emit_*`, y un
  `ref` a un valor estructurado sin tipar es **error** (I7). Así I4 conserva su espíritu (nada de
  escritura directa del árbol) y el modelo *pull* (§17.1 addendum) queda coherente.

## ⚠️ Impreciso / a corregir (menor, real)

- §5.3: *"`emit_series` → `PlotDataSeries` hereda color/**rol**/interp"* — `PlotDataSeries` tiene
  color/style/width/interpolate/interpDegree, **NO `role`** (ese campo está en `PlotFunction`).
- §5.3: *"`emit_expr` → mathInline vía LaTeX **reparseado** por el canon"* — el `canon` **normaliza
  macros**, no parsea LaTeX a estructura. La mate en prosa es `tex` crudo (mathInline guarda string);
  **no hay reparse a AST** (eso es F-3, sin resolver). "Reparseado" → "normalizado".
- **Colisión de notación `②`** (productor imperativo vs. política compartida, ya admitida en el
  glosario): renombrar productores a **declarativo/imperativo** y reservar ①②③④ para capas/lugares.
- §3.4: usa **I7** para "referencia inexistente → error"; en realidad ya lidera con **I2** (bien), e
  I7 queda como el "no fallar en silencio" — aceptable, no se toca.
- **(Hallazgo durante la corrección) §11.3 sobre-afirma.** El caso "`emit_expr` → entidad **rica**
  que `g = 2·P` deriva/integra" **mezcla dos cosas**: (a) *mostrar* una expresión computada →
  `mathInline` (`tex`), no evaluable; (b) *ligar una entidad matemática reutilizable/evaluable* →
  requiere forma **estructurada** (`ExprNode`), que en la prosa **no existe** (es F-3). (a) es
  factible; (b) **está bloqueado por F-3** o exige reusar el parser de plots. §11.3 quedó marcado
  como **🟡 dependiente de F-3**, no como caso que ya cierra.

## 🟡 Propuesto, NO ratificado (entra como candidato, no como "verdad")

Diseño del borrador externo, razonable pero **a vetear antes de consagrar** — se marca como propuesta:
- Taxonomía de nodos `exec`/`eval`/`code-block`/`table-from-code`/`figure-from-code`/`fragment-from-code`.
- El set `emit_*` exacto + clases isomorfas `NodeTable`.
- **Pyodide-first** como *la* runtime; kernel-con-red diferido.
- El **multipass** (bien acotado a lo declarativo; sigue siendo propuesta).

## Ⓐ Externo — sin verificar (no se firma)

Comparativo (Quarto `freeze`, Typst `content`/`show`, Marimo DAG estático): **corroborables de
memoria, sin verificación de fuente/vigencia julio-2026**. Quedan marcados "sin verificar". La
**interpretación** del diferencial es del proyecto para juzgar, no para heredar.

---

## Consecuencia

El spec **no se consagra como fuente de verdad** hasta: resolver el ❌ (hecho, resolución arriba),
corregir los ⚠️, y sellar cada 🟡/Ⓐ con su marca. Recién entonces el índice de `03-modelo-semantico/`
lo declara normativo. Estado tras esta pasada: ver notas de estado en la cabecera de cada borrador.
