/* ─────────────────────────────────────────────────────────────────
   Formalia — Documento de ejemplo
   Cubre todos los features disponibles en Fase 1:
   headings, marks (bold/italic/code), bullet list, ordered list,
   inline math, display math, y todos los entornos de teorema.
   ───────────────────────────────────────────────────────────────── */

// TipTap JSON — se pasa directo a editor.commands.setContent()
export const EXAMPLE_DOCUMENT = {
  type: 'doc',
  content: [

    // ── Título ────────────────────────────────────────────────────
    {
      type: 'heading', attrs: { level: 1 },
      content: [{ type: 'text', text: 'Análisis Real — Continuidad y Derivada' }]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Apunte que cubre los conceptos de ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'continuidad' },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'diferenciabilidad' },
        { type: 'text', text: ' y las reglas de derivación para funciones ' },
        { type: 'mathInline', attrs: { latex: 'f: \\mathbb{R} \\to \\mathbb{R}' } },
        { type: 'text', text: '. Usaremos la notación estándar ' },
        { type: 'text', marks: [{ type: 'code' }], text: 'epsilon-delta' },
        { type: 'text', text: '.' },
      ]
    },

    // ── Sección 1 ─────────────────────────────────────────────────
    {
      type: 'heading', attrs: { level: 2 },
      content: [{ type: 'text', text: '1. Continuidad' }]
    },

    // Definición con inline math y display math
    {
      type: 'theoremEnv',
      attrs: { envType: 'definition', envTitle: 'Continuidad en un punto', label: '' },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Sea ' },
            { type: 'mathInline', attrs: { latex: 'f: \\mathbb{R} \\to \\mathbb{R}' } },
            { type: 'text', text: ' y ' },
            { type: 'mathInline', attrs: { latex: 'x_0 \\in \\mathbb{R}' } },
            { type: 'text', text: '. Decimos que ' },
            { type: 'mathInline', attrs: { latex: 'f' } },
            { type: 'text', text: ' es ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'continua' },
            { type: 'text', text: ' en ' },
            { type: 'mathInline', attrs: { latex: 'x_0' } },
            { type: 'text', text: ' si para todo ' },
            { type: 'mathInline', attrs: { latex: '\\varepsilon > 0' } },
            { type: 'text', text: ' existe ' },
            { type: 'mathInline', attrs: { latex: '\\delta > 0' } },
            { type: 'text', text: ' tal que:' },
          ]
        },
        {
          type: 'mathDisplay',
          attrs: { latex: '|x - x_0| < \\delta \\implies |f(x) - f(x_0)| < \\varepsilon', numbered: false, aligned: false, label: '' }
        },
      ]
    },

    // Teorema del Valor Intermedio
    {
      type: 'theoremEnv',
      attrs: { envType: 'theorem', envTitle: 'Valor Intermedio', label: '' },
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Sea ' },
          { type: 'mathInline', attrs: { latex: 'f: [a, b] \\to \\mathbb{R}' } },
          { type: 'text', text: ' continua. Si ' },
          { type: 'mathInline', attrs: { latex: 'f(a)' } },
          { type: 'text', text: ' y ' },
          { type: 'mathInline', attrs: { latex: 'f(b)' } },
          { type: 'text', text: ' tienen signos opuestos, existe ' },
          { type: 'mathInline', attrs: { latex: 'c \\in (a, b)' } },
          { type: 'text', text: ' tal que ' },
          { type: 'mathInline', attrs: { latex: 'f(c) = 0' } },
          { type: 'text', text: '.' },
        ]
      }]
    },

    // Demostración
    {
      type: 'theoremEnv',
      attrs: { envType: 'proof', envTitle: '', label: '' },
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Por bisección sucesiva. Definir ' },
          { type: 'mathInline', attrs: { latex: 'a_0 = a' } },
          { type: 'text', text: ', ' },
          { type: 'mathInline', attrs: { latex: 'b_0 = b' } },
          { type: 'text', text: ' y en cada paso ' },
          { type: 'mathInline', attrs: { latex: 'm_n = \\frac{a_n + b_n}{2}' } },
          { type: 'text', text: '. Se elige el subintervalo donde ' },
          { type: 'mathInline', attrs: { latex: 'f' } },
          { type: 'text', text: ' cambia de signo. Las sucesiones convergen al mismo ' },
          { type: 'mathInline', attrs: { latex: 'c' } },
          { type: 'text', text: '; por continuidad ' },
          { type: 'mathInline', attrs: { latex: 'f(c) = 0' } },
          { type: 'text', text: '.' },
        ]
      }]
    },

    // Observación
    {
      type: 'theoremEnv',
      attrs: { envType: 'remark', envTitle: '', label: '' },
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'El recíproco es falso: ' },
          { type: 'mathInline', attrs: { latex: 'f(x) = \\sin(1/x)' } },
          { type: 'text', text: ' cumple la propiedad del valor intermedio en ' },
          { type: 'mathInline', attrs: { latex: '(0, 1]' } },
          { type: 'text', text: ' pero no es continua en ' },
          { type: 'mathInline', attrs: { latex: 'x = 0' } },
          { type: 'text', text: '.' },
        ]
      }]
    },

    // ── Sección 2 ─────────────────────────────────────────────────
    {
      type: 'heading', attrs: { level: 2 },
      content: [{ type: 'text', text: '2. Diferenciabilidad' }]
    },

    // Definición de derivada
    {
      type: 'theoremEnv',
      attrs: { envType: 'definition', envTitle: 'Derivada', label: '' },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'La ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'derivada' },
            { type: 'text', text: ' de ' },
            { type: 'mathInline', attrs: { latex: 'f' } },
            { type: 'text', text: ' en ' },
            { type: 'mathInline', attrs: { latex: 'x_0' } },
            { type: 'text', text: ' es, cuando el límite existe:' },
          ]
        },
        {
          type: 'mathDisplay',
          attrs: { latex: "f'(x_0) = \\lim_{h \\to 0} \\frac{f(x_0 + h) - f(x_0)}{h}", numbered: false, aligned: false, label: '' }
        },
      ]
    },

    // Lema
    {
      type: 'theoremEnv',
      attrs: { envType: 'lemma', envTitle: '', label: '' },
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Si ' },
          { type: 'mathInline', attrs: { latex: 'f' } },
          { type: 'text', text: ' es diferenciable en ' },
          { type: 'mathInline', attrs: { latex: 'x_0' } },
          { type: 'text', text: ', entonces es continua en ' },
          { type: 'mathInline', attrs: { latex: 'x_0' } },
          { type: 'text', text: '. El recíproco es falso: ' },
          { type: 'mathInline', attrs: { latex: 'f(x) = |x|' } },
          { type: 'text', text: ' es continua pero no diferenciable en ' },
          { type: 'mathInline', attrs: { latex: 'x = 0' } },
          { type: 'text', text: '.' },
        ]
      }]
    },

    // ── Sección 3 ─────────────────────────────────────────────────
    {
      type: 'heading', attrs: { level: 2 },
      content: [{ type: 'text', text: '3. Reglas de derivación' }]
    },

    // Display math con reglas
    {
      type: 'mathDisplay',
      attrs: {
        latex: "(f \\cdot g)' = f' g + f g' \\qquad \\left(\\frac{f}{g}\\right)' = \\frac{f'g - fg'}{g^2}",
        numbered: false, aligned: false, label: ''
      }
    },

    // Lista ordenada
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Regla de la cadena: ' },
              { type: 'mathInline', attrs: { latex: "(f \\circ g)'(x) = f'(g(x)) \\cdot g'(x)" } },
            ]
          }]
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Integral de potencias: ' },
              { type: 'mathInline', attrs: { latex: '\\int x^n \\,\\mathrm{d}x = \\dfrac{x^{n+1}}{n+1} + C' } },
            ]
          }]
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Integración por partes: ' },
              { type: 'mathInline', attrs: { latex: '\\int u \\,\\mathrm{d}v = uv - \\int v \\,\\mathrm{d}u' } },
            ]
          }]
        },
      ]
    },

    // Ejemplo completo
    {
      type: 'theoremEnv',
      attrs: { envType: 'example', envTitle: '', label: '' },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Derivar ' },
            { type: 'mathInline', attrs: { latex: 'f(x) = x^3 \\sin(x)' } },
            { type: 'text', text: ' usando la regla del producto:' },
          ]
        },
        {
          type: 'mathDisplay',
          attrs: { latex: "f'(x) = 3x^2 \\sin(x) + x^3 \\cos(x)", numbered: false, aligned: false, label: '' }
        },
      ]
    },

    // Lista de conjuntos numéricos
    {
      type: 'heading', attrs: { level: 3 },
      content: [{ type: 'text', text: 'Conjuntos numéricos usados' }]
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'mathInline', attrs: { latex: '\\mathbb{N} = \\{0, 1, 2, \\ldots\\}' } },
              { type: 'text', text: ' — naturales' },
            ]
          }]
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'mathInline', attrs: { latex: '\\mathbb{Z}' } },
              { type: 'text', text: ' — enteros' },
            ]
          }]
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'mathInline', attrs: { latex: '\\mathbb{R}' } },
              { type: 'text', text: ' — cuerpo ordenado completo (Axioma del supremo)' },
            ]
          }]
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'mathInline', attrs: { latex: '\\mathbb{C} = \\{ a + bi : a, b \\in \\mathbb{R} \\}' } },
              { type: 'text', text: ' — complejos' },
            ]
          }]
        },
      ]
    },

  ]
}
