/* ─────────────────────────────────────────────────────────────────
   Formalia — Documento de ejemplo
   UUIDs se generan al cargar para que refs internas sean consistentes.
   ───────────────────────────────────────────────────────────────── */

const ID_DEF_CONT   = crypto.randomUUID()
const ID_THM_IVT    = crypto.randomUUID()
const ID_DEF_DERIV  = crypto.randomUUID()
const ID_LEM_DIFER  = crypto.randomUUID()
const ID_EJ_PROD    = crypto.randomUUID()

export const EXAMPLE_DOCUMENT = {
  type: 'doc',
  content: [

    // ── Intro ──────────────────────────────────────────────────────
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

    // ── Sección 1 ──────────────────────────────────────────────────
    {
      type: 'heading', attrs: { level: 1 },
      content: [{ type: 'text', text: 'Continuidad' }]
    },

    {
      type: 'theoremEnv',
      attrs: { envType: 'definition', id: ID_DEF_CONT },
      content: [
        {
          type: 'theoremEnvTitle',
          content: [{ type: 'text', text: 'Continuidad en un punto' }]
        },
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

    {
      type: 'theoremEnv',
      attrs: { envType: 'theorem', id: ID_THM_IVT },
      content: [
        {
          type: 'theoremEnvTitle',
          content: [{ type: 'text', text: 'Valor Intermedio' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Sea ' },
            { type: 'mathInline', attrs: { latex: 'f: [a, b] \\to \\mathbb{R}' } },
            { type: 'text', text: ' continua (ver ' },
            { type: 'theoremRef', attrs: { id: ID_DEF_CONT } },
            { type: 'text', text: '). Si ' },
            { type: 'mathInline', attrs: { latex: 'f(a)' } },
            { type: 'text', text: ' y ' },
            { type: 'mathInline', attrs: { latex: 'f(b)' } },
            { type: 'text', text: ' tienen signos opuestos, existe ' },
            { type: 'mathInline', attrs: { latex: 'c \\in (a, b)' } },
            { type: 'text', text: ' tal que ' },
            { type: 'mathInline', attrs: { latex: 'f(c) = 0' } },
            { type: 'text', text: '.' },
          ]
        }
      ]
    },

    {
      type: 'theoremEnv',
      attrs: { envType: 'proof', id: crypto.randomUUID() },
      content: [
        { type: 'theoremEnvTitle' },
        {
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
        }
      ]
    },

    {
      type: 'theoremEnv',
      attrs: { envType: 'remark', id: crypto.randomUUID() },
      content: [
        { type: 'theoremEnvTitle' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'El recíproco del ' },
            { type: 'theoremRef', attrs: { id: ID_THM_IVT } },
            { type: 'text', text: ' es falso: ' },
            { type: 'mathInline', attrs: { latex: 'f(x) = \\sin(1/x)' } },
            { type: 'text', text: ' cumple la propiedad del valor intermedio en ' },
            { type: 'mathInline', attrs: { latex: '(0, 1]' } },
            { type: 'text', text: ' pero no es continua en ' },
            { type: 'mathInline', attrs: { latex: 'x = 0' } },
            { type: 'text', text: '.' },
          ]
        }
      ]
    },

    // ── Sección 2 ──────────────────────────────────────────────────
    {
      type: 'heading', attrs: { level: 1 },
      content: [{ type: 'text', text: 'Diferenciabilidad' }]
    },

    {
      type: 'theoremEnv',
      attrs: { envType: 'definition', id: ID_DEF_DERIV },
      content: [
        {
          type: 'theoremEnvTitle',
          content: [{ type: 'text', text: 'Derivada' }]
        },
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

    {
      type: 'theoremEnv',
      attrs: { envType: 'lemma', id: ID_LEM_DIFER },
      content: [
        { type: 'theoremEnvTitle' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Si ' },
            { type: 'mathInline', attrs: { latex: 'f' } },
            { type: 'text', text: ' es diferenciable en ' },
            { type: 'mathInline', attrs: { latex: 'x_0' } },
            { type: 'text', text: ' (ver ' },
            { type: 'theoremRef', attrs: { id: ID_DEF_DERIV } },
            { type: 'text', text: '), entonces es continua en ' },
            { type: 'mathInline', attrs: { latex: 'x_0' } },
            { type: 'text', text: '. El recíproco es falso: ' },
            { type: 'mathInline', attrs: { latex: 'f(x) = |x|' } },
            { type: 'text', text: ' es continua pero no diferenciable en ' },
            { type: 'mathInline', attrs: { latex: 'x = 0' } },
            { type: 'text', text: '.' },
          ]
        }
      ]
    },

    // ── Sección 3 ──────────────────────────────────────────────────
    {
      type: 'heading', attrs: { level: 1 },
      content: [{ type: 'text', text: 'Reglas de derivación' }]
    },

    {
      type: 'mathDisplay',
      attrs: {
        latex: "(f \\cdot g)' = f' g + f g' \\qquad \\left(\\frac{f}{g}\\right)' = \\frac{f'g - fg'}{g^2}",
        numbered: false, aligned: false, label: ''
      }
    },

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

    {
      type: 'theoremEnv',
      attrs: { envType: 'example', id: ID_EJ_PROD },
      content: [
        { type: 'theoremEnvTitle' },
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

    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Esto es consecuencia directa del ' },
        { type: 'theoremRef', attrs: { id: ID_LEM_DIFER } },
        { type: 'text', text: ' aplicado a ' },
        { type: 'mathInline', attrs: { latex: 'f(x) = x^3 \\sin(x)' } },
        { type: 'text', text: '.' },
      ]
    },

    {
      type: 'heading', attrs: { level: 2 },
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
