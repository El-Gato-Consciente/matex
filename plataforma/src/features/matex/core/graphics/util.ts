/**
 * Utilidades **compartidas por los backends LaTeX de gráficos/figuras** (puras, sin deps):
 * escape de texto y de rótulos, y ancho de una parte. Las usan `figure.ts` y las familias
 * (`relation.ts`, y a futuro `comparison`/`composition`…). También el compilador general
 * reusa `escapeLatex`/`escapeLabel`.
 */

/**
 * **Símbolos Unicode → LaTeX** (cuerpo de math, sin los `$`). El editor visual deja tipear `π`, `√`
 * o `≤` en un título/epígrafe/celda; pdflatex **falla** con esos caracteres ("Unicode character not
 * set up for use with LaTeX"). En vez de romper el PDF, los traducimos a su comando equivalente.
 */
const UNICODE_TEX: Record<string, string> = {
  // Griegas minúsculas y mayúsculas de uso corriente.
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\varepsilon', ζ: '\\zeta', η: '\\eta',
  θ: '\\theta', ι: '\\iota', κ: '\\kappa', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi',
  π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau', υ: '\\upsilon', φ: '\\varphi', χ: '\\chi',
  ψ: '\\psi', ω: '\\omega', Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda', Ξ: '\\Xi',
  Π: '\\Pi', Σ: '\\Sigma', Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega',
  // Operadores y relaciones.
  '−': '-', '×': '\\times', '÷': '\\div', '±': '\\pm', '∓': '\\mp', '·': '\\cdot',
  '≤': '\\le', '≥': '\\ge', '≠': '\\neq', '≈': '\\approx', '≡': '\\equiv', '∝': '\\propto',
  '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla', '√': '\\surd', '∑': '\\sum', '∏': '\\prod',
  '∫': '\\int', '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq',
  '∪': '\\cup', '∩': '\\cap', '∀': '\\forall', '∃': '\\exists', '¬': '\\neg', '∧': '\\wedge', '∨': '\\vee',
  // Flechas.
  '→': '\\to', '←': '\\leftarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow',
  '⇐': '\\Leftarrow', '⇔': '\\Leftrightarrow', '↦': '\\mapsto',
  // Super/subíndices.
  '⁰': '^{0}', '¹': '^{1}', '²': '^{2}', '³': '^{3}', '⁴': '^{4}', '⁵': '^{5}', '⁶': '^{6}',
  '⁷': '^{7}', '⁸': '^{8}', '⁹': '^{9}',
  '₀': '_{0}', '₁': '_{1}', '₂': '_{2}', '₃': '_{3}', '₄': '_{4}', '₅': '_{5}', '₆': '_{6}',
  '₇': '_{7}', '₈': '_{8}', '₉': '_{9}', 'ₙ': '_{n}', 'ᵢ': '_{i}', 'ₖ': '_{k}',
}
/** Clase de caracteres a tratar: reservados de LaTeX + los símbolos Unicode del mapa. */
const ESCAPE_RE = new RegExp(`[\\\\{}$&#%_~^]|[${Object.keys(UNICODE_TEX).join('')}]`, 'gu')

/**
 * Escapa los caracteres reservados de LaTeX en texto plano y **traduce los símbolos Unicode
 * matemáticos** a su comando (envueltos en `$…$`), para que lo que se escribe en el editor visual
 * compile siempre. Un carácter fuera del mapa se deja tal cual (babel/fontenc cubren los acentos).
 */
export function escapeLatex(text: string): string {
  return text.replace(ESCAPE_RE, (c) => {
    switch (c) {
      case '\\':
        return '\\textbackslash{}'
      case '~':
        return '\\textasciitilde{}'
      case '^':
        return '\\textasciicircum{}'
      case '{':
      case '}':
      case '$':
      case '&':
      case '#':
      case '%':
      case '_':
        return `\\${c}`
      default: {
        const tex = UNICODE_TEX[c]
        return tex ? `$${tex}$` : c
      }
    }
  })
}

/**
 * Escapa un rótulo de gráfico (leyenda/punto/vertical) permitiendo **matemática inline**:
 * los tramos entre `$…$` se dejan crudos (math), el resto se escapa como texto. Así el
 * autor puede poner `y = $\sqrt{2}$` sin romper el PDF. Un `$` suelto se escapa igual.
 */
export function escapeLabel(text: string): string {
  return text
    .split(/(\$[^$]*\$)/)
    .map((seg) => (seg.length >= 2 && seg.startsWith('$') && seg.endsWith('$') ? seg : escapeLatex(seg)))
    .join('')
}

/** Fracción del ancho disponible (`\linewidth`) de una parte (default para imagen: completo; para plot: 0.8). */
export function itemWidth(width: number | undefined, fallback: string): string {
  return typeof width === 'number' && width > 0 ? `${width}\\linewidth` : fallback
}

/** Redondea a 6 decimales y limpia el `-0` (para números emitidos a pgfplots). */
export function num6(n: number): string {
  const r = Number(n.toFixed(6))
  return String(Object.is(r, -0) ? 0 : r)
}
