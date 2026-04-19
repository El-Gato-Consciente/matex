# Backslash trigger — abrir el formula editor desde el lienzo

## Idea

Cuando el usuario tipea `\` en el lienzo de TipTap (en texto plano), el sistema interpreta eso como intención de escribir LaTeX e inmediatamente:

1. Borra el `\` del documento
2. Inserta un nodo `mathInline` vacío en su lugar
3. Abre el floating formula editor en **modo código** con `\` ya pre-cargado en el textarea

El usuario continúa tipeando la fórmula directamente (ej. `frac{a}{b}`) sin interrupciones.

## Flujo completo

```
Usuario tipea \           →  trigger detectado
                          →  se borra el \ del doc
                          →  se inserta nodo mathInline vacío
                          →  se abre floating editor (modo código) con "\" pre-cargado
Usuario tipea "frac{a}{b} →  el textarea ya tiene "\frac{a}{b}"
Usuario presiona Enter    →  se confirma, el nodo queda en el doc con la fórmula
```

## Caso: el usuario quería un `\` literal

El usuario presiona `Esc` → el floating editor se cierra, el nodo math vacío se elimina, y se inserta un `\` literal en el texto del doc devolviendo el foco al editor.

Esto se comunica con una leyenda contextual que aparece **solo cuando el popup se abre por este trigger** (no cuando se abre haciendo click en una fórmula existente):

```
┌─────────────────────────────────────────────┐
│  Visual  │  Código                           │
│  \|                                          │
│  ─────────────────────────────────────────  │
│  Esc · cancelar e insertar \ como texto      │
└─────────────────────────────────────────────┘
```

## Implementación

### 1. Detección del trigger

Un **plugin ProseMirror** (TipTap Extension) intercepta el input antes de que llegue al doc. En `handleTextInput`:

```typescript
handleTextInput(view, from, to, text) {
  if (text !== '\\') return false
  // disparar trigger
  return true  // consumir el evento, no insertar el \ en el doc
}
```

### 2. Inserción del nodo y apertura del editor

Reutilizar `insertNewFormulaAndActivate('', false)` del EditorStore, que ya:
- Inserta el nodo mathInline
- Llama a `activateNode()` que abre el floating editor

### 3. Pre-carga del `\` en el textarea

El floating editor necesita saber que fue abierto por el trigger para:
- Arrancar en **modo código** (ignorar la preferencia guardada)
- Pre-cargar `\` en el textarea
- Mostrar el hint especial de Esc

Una señal adicional en EditorStore, por ejemplo `triggerSource: 'backslash' | 'click' | 'keyboard' | 'toolbar'`, permite al floating editor adaptar su comportamiento.

### 4. Comportamiento del Esc en este modo

En lugar del Esc normal (que solo cierra), en modo trigger:
1. `deactivateNode()` — cierra el editor y elimina el nodo vacío
2. Insertar un `\` literal en la posición donde estaba el cursor
3. Devolver el foco al editor

### 5. Hint contextual

El floating editor renderiza el hint de Esc condicionalmente:
- Trigger normal: `Esc · cerrar`
- Trigger backslash: `Esc · cancelar e insertar \ como texto`

## Configuración

Agregar a las settings de usuario (futura pantalla de preferencias o localStorage):

```
formalia:backslash-trigger  →  '1' (activado, default) | '0' (desactivado)
```

Cuando está desactivado, el `\` se inserta normalmente en el doc sin disparar nada.

## Lo que NO hace este sistema

- No muestra un listado de sugerencias mientras se tipea (eso sería una feature separada de autocomplete)
- No intercepta `\\` — si el trigger está desactivado y el usuario quiere `\`, lo tiene naturalmente
- No funciona dentro del floating editor ya abierto (el textarea/mathfield manejan `\` por su cuenta)
