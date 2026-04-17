# Editor — Contratos de comportamiento de nodos

Decisiones de UX y arquitectura para los nodos semánticos del editor.
Esto documenta el *por qué*, no el *cómo* (el cómo está en el código).

---

## theoremEnv (y todos los entornos matemáticos)

### Principio central: contenedor aislado

`theoremEnv` usa `isolating: true` en el schema de ProseMirror.
Esto hace que los comandos genéricos del editor (`joinBackward`, `joinForward`,
`liftEmptyBlock`) no crucen las fronteras del nodo automáticamente.

**Por qué:** sin aislamiento, cada caso de borde requería un handler manual.
La lista crecía indefinidamente. `isolating: true` resuelve la clase entera
de problemas "el nodo se fusiona con su vecino" con una sola propiedad de schema.

### Contrato de teclado

| Situación | Tecla | Comportamiento |
|---|---|---|
| Cursor al inicio del primer hijo | Backspace | No hace nada (isolating lo bloquea) |
| Cursor al final del último hijo | Delete | No hace nada (isolating lo bloquea) |
| Párrafo vacío adyacente **después** del env | Backspace | Elimina el párrafo vacío limpiamente |
| Párrafo vacío adyacente **antes** del env | Delete | Elimina el párrafo vacío limpiamente |
| Párrafo vacío que NO es el último hijo | Enter | Crea nuevo párrafo dentro del env |
| Párrafo vacío que ES el último hijo | Enter | Sale del env — inserta párrafo después |
| GapCursor después de mathDisplay al final | Enter | Inserta párrafo en la posición del gap |

### Por qué "Enter en último párrafo vacío = salir"

Es el mismo patrón que las listas de TipTap/Notion: si estás atrapado
en el último elemento vacío de un contenedor, Enter es la vía de escape.
Sin esto el usuario quedaría atrapado dentro del entorno para siempre.

### mathDisplay al final de un entorno

`mathDisplay` tiene `atom: true`, por lo que ProseMirror crea un GapCursor
después de él. El usuario puede navegar ahí con ↓ o → y luego usar Enter
para insertar un párrafo. Sin el handler de GapCursor, Enter no hacía nada útil.

---

## mathInline / mathDisplay

### Principio: átomos no editables inline

Ambos tienen `atom: true`. El cursor los saltea; no se puede entrar.
La edición se hace exclusivamente via **FloatingFormulaEditor**.

### FloatingFormulaEditor — por qué flotante y no inline

Alternativas descartadas:
- **Edición inline en el NodeView**: Shadow DOM de MathLive conflicta con
  ProseMirror. Además, ProseMirror re-aserta NodeSelection en cada dispatch,
  robando el foco del editor de fórmulas.
- **Panel fijo en el layout**: ocupa espacio permanente, desplaza el canvas.

Solución elegida: `position: fixed` fuera del DOM de TipTap.
Fix crítico asociado: llamar `releaseFormulaSelection()` antes de enfocar
el textarea, para que ProseMirror abandone la NodeSelection y deje de
intentar re-assertarla en cada `setNodeMarkup`.

---

## Agregar un nuevo tipo de nodo semántico (checklist)

Si en fases futuras se agrega un nodo contenedor nuevo (e.g. `exercise`, `figure`):

1. Agregar `isolating: true` al schema
2. Agregar handler de `Enter` para "salir del entorno" (mismo patrón que theoremEnv)
3. Agregar handlers de `Backspace`/`Delete` para párrafos vacíos adyacentes
4. Si contiene atoms (`mathDisplay`): agregar handler de `Enter` para GapCursor
5. No agregar Backspace-en-inicio ni Delete-en-fin: `isolating` los cubre
