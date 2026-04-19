# Snippets favoritos y atajos de teclado

## Concepto central

Los **favoritos** son el concepto unificador: el usuario marca snippets como favoritos y eso determina simultáneamente:
- Qué aparece en la **sidebar colapsada**
- Qué tiene **atajo de teclado** (los primeros 10)

## Estructura de slots

```
Favoritos (máx ~16)
  ├── slots 0–9   →  Ctrl+Shift+0..9  →  primeros en la sidebar colapsada
  └── slots 10+   →  sin atajo        →  completan la sidebar colapsada (scroll si hace falta)
```

Los slots 0–9 siempre aparecen primero, en orden, con su número visible como badge en la sidebar colapsada.

## Atajos de teclado

- **Combinación fija**: `Ctrl+Shift+0` a `Ctrl+Shift+9`
- Sin configuración de teclas — el slot determina el atajo automáticamente
- Sin riesgo de colisión con el sistema/browser (Ctrl+Shift+dígito está generalmente libre)
- El atajo funciona igual que hacer click en el snippet: inserta en la fórmula abierta o crea una nueva

## UI para marcar favoritos

Ícono de estrella/pin en cada snippet de la lista expandida:
- Sin estrella → snippet normal en la lista
- Con estrella → va al primer slot libre de favoritos
- Reordenar favoritos: drag & drop dentro de una zona de favoritos en la parte superior del sidebar expandido (o simplemente re-pinear en otro orden)

Vista en sidebar expandido:
```
★ Favoritos
  [a/b] [√] [∫] [Σ] [lim] [∂] [sin] [M] [α] [π]  ← slots 0–9 con badge
  [∈]   [≤]  ← slots 10–11 sin badge
──────────────────
  Buscar…
  [Todos] [Fracciones] [Cálculo] …
  lista completa con ★ toggle en cada item
```

## Feedback visual al usar atajo

Cuando `Ctrl+Shift+N` se dispara:
- Si hay fórmula abierta: el snippet se inserta silenciosamente (la fórmula actualiza)
- Si no hay fórmula: se crea el nodo y se abre el floating editor — el propio editor es el feedback
- Opcionalmente: un toast mínimo ("∫ insertado") que desaparece en 1.5s, solo cuando no hay editor visible

## Persistencia

```
localStorage: formalia:snippet-favorites  →  JSON array de snippet IDs en orden
```

El array tiene máximo 16 elementos. El índice en el array determina el slot (y por tanto el atajo).

## Defaults

Los favoritos iniciales (hardcodeados hasta que el usuario los cambie) son los actuales `QUICK_SNIPS`:
`[a/b, √, xⁿ, ∫, Σ, lim, ∂, (), M, sin, α, π, ∈, ≤, sup, E[]]`

Los primeros 10 tienen atajo, los 6 restantes no.

## Lo que NO incluye esta spec

- Atajos personalizables por el usuario (tecla libre) — fuera de scope, la combinación fija es suficiente
- Sincronización entre dispositivos — localStorage por ahora
- Favoritos por documento — global a la app
