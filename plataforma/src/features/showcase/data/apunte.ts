import type { MatexDoc, BlockNode, InlineNode } from '../../matex/core'
import type { ExemplarInput } from '../types'

/**
 * Ejemplar · Apunte / handout de cátedra (clase article). Modelo de material de
 * estudio: definiciones y ejemplos en cajas `tcolorbox`, una figura `pgfplots`,
 * y ejercicios con **soluciones condicionales** (`\newif`) — la misma fuente
 * genera la versión con o sin respuestas.
 */
// ── Versión Matex (AST) del mismo apunte (ME-23) ─────────────────────────────
// Autorada a mano: mismo contenido que la fuente LaTeX, pero como modelo semántico.
// Las cajas tcolorbox (definición azul / ejemplo verde) ↔ callouts note/tip; el gráfico
// pgfplots ↔ figura con plot (mismo x² + tangente + punto). Compila a PDF *y* a HTML.

/** Ítem de lista con un párrafo de contenido inline. */
const li = (content: InlineNode[]): { type: 'listItem'; content: BlockNode[] } => ({
  type: 'listItem',
  content: [{ type: 'paragraph', content }],
})
/** Ítem de ejercicio: enunciado + solución (párrafo aparte, "Solución:" en negrita). */
const ejercicio = (enunciado: InlineNode[], solucion: InlineNode[]): { type: 'listItem'; content: BlockNode[] } => ({
  type: 'listItem',
  content: [
    { type: 'paragraph', content: enunciado },
    { type: 'paragraph', content: [{ type: 'text', text: 'Solución: ', marks: ['strong'] }, ...solucion] },
  ],
})

function apunteMatex(): MatexDoc {
  return {
    type: 'doc',
    version: 4,
    meta: { title: 'Apunte: la derivada', author: 'Cátedra de Laboratorio de Cálculo', margin: '2.5cm' },
    content: [
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'Definición' }] },
      {
        type: 'callout',
        variant: 'note',
        title: 'Derivada en un punto',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'La derivada de ' }, { type: 'mathInline', tex: 'f' }, { type: 'text', text: ' en ' }, { type: 'mathInline', tex: 'x' }, { type: 'text', text: ' es' }] },
          { type: 'mathDisplay', rows: [{ tex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}," }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'siempre que el límite exista.' }] },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Geométricamente, ' },
          { type: 'mathInline', tex: "f'(x)" },
          { type: 'text', text: ' es la ' },
          { type: 'text', text: 'pendiente de la recta tangente', marks: ['emph'] },
          { type: 'text', text: ' a la gráfica de ' },
          { type: 'mathInline', tex: 'f' },
          { type: 'text', text: ' en el punto ' },
          { type: 'mathInline', tex: '(x, f(x))' },
          { type: 'text', text: '.' },
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        title: 'La derivada de x²',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Con la definición, para ' }, { type: 'mathInline', tex: 'f(x)=x^2' }, { type: 'text', text: ':' }] },
          { type: 'mathDisplay', rows: [{ tex: "f'(x) = \\lim_{h \\to 0} \\frac{(x+h)^2 - x^2}{h} = \\lim_{h \\to 0} (2x + h) = 2x." }] },
        ],
      },
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'Reglas básicas' }] },
      {
        type: 'bulletList',
        items: [
          li([{ type: 'text', text: 'Constante: ', marks: ['strong'] }, { type: 'mathInline', tex: "(c)' = 0" }, { type: 'text', text: '.' }]),
          li([{ type: 'text', text: 'Potencia: ', marks: ['strong'] }, { type: 'mathInline', tex: "(x^n)' = n\\,x^{n-1}" }, { type: 'text', text: '.' }]),
          li([{ type: 'text', text: 'Suma: ', marks: ['strong'] }, { type: 'mathInline', tex: "(f+g)' = f' + g'" }, { type: 'text', text: '.' }]),
          li([{ type: 'text', text: 'Producto: ', marks: ['strong'] }, { type: 'mathInline', tex: "(fg)' = f'g + fg'" }, { type: 'text', text: '.' }]),
          li([{ type: 'text', text: 'Cadena: ', marks: ['strong'] }, { type: 'mathInline', tex: "\\big(f(g(x))\\big)' = f'(g(x))\\,g'(x)" }, { type: 'text', text: '.' }]),
        ],
      },
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'Interpretación gráfica' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'La recta tangente toca la curva con la misma pendiente:' }] },
      {
        type: 'figure',
        caption: 'La tangente a y = x² en x = 1',
        items: [
          {
            kind: 'plot',
            spec: {
              functions: [
                { expr: 'x^2', legend: 'f(x)=x^2', color: 'blue' },
                { expr: '2*x - 1', domain: [0.2, 1.8], legend: 'tangente en x=1', color: 'red' },
              ],
              domain: [-1, 3],
              grid: true,
              legend: true,
              legendPos: 'top-left',
              points: [{ x: 1, y: 1 }],
            },
          },
        ],
      },
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'Ejercicios' }] },
      {
        type: 'orderedList',
        items: [
          ejercicio(
            [{ type: 'text', text: 'Calculá ' }, { type: 'mathInline', tex: "f'(x)" }, { type: 'text', text: ' para ' }, { type: 'mathInline', tex: 'f(x) = 3x^2 - 5x + 1' }, { type: 'text', text: '.' }],
            [{ type: 'mathInline', tex: "f'(x) = 6x - 5" }, { type: 'text', text: '.' }],
          ),
          ejercicio(
            [{ type: 'text', text: 'Derivá ' }, { type: 'mathInline', tex: 'g(x) = \\sqrt{x}' }, { type: 'text', text: '.' }],
            [{ type: 'mathInline', tex: 'g(x)=x^{1/2}' }, { type: 'text', text: ', así que ' }, { type: 'mathInline', tex: "g'(x) = \\tfrac{1}{2}x^{-1/2} = \\dfrac{1}{2\\sqrt{x}}" }, { type: 'text', text: '.' }],
          ),
          ejercicio(
            [{ type: 'text', text: 'Usando la regla de la cadena, derivá ' }, { type: 'mathInline', tex: 'h(x) = (x^2+1)^3' }, { type: 'text', text: '.' }],
            [{ type: 'mathInline', tex: "h'(x) = 3(x^2+1)^2 \\cdot 2x = 6x(x^2+1)^2" }, { type: 'text', text: '.' }],
          ),
        ],
      },
    ],
  }
}

export const apunte = {
  id: 'ex-apunte-derivada',
  title: 'Apunte: la derivada',
  docType: 'Apunte / handout (article)',
  description:
    'Material de cátedra: definiciones y ejemplos en cajas de colores (tcolorbox), gráfico de la tangente (pgfplots) y ejercicios con soluciones que se muestran u ocultan con una bandera (\\newif). Cambiás una línea y tenés la versión del alumno o la del docente.',
  techniques: [
    'cajas con color (tcolorbox)',
    'definiciones/ejemplos en caja',
    'figura pgfplots (tangente)',
    'soluciones condicionales (\\newif)',
    'una fuente, dos versiones',
  ],
  source: [
    '\\documentclass[11pt,a4paper]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{lmodern}',
    '\\usepackage[spanish,es-noshorthands]{babel}',
    '\\usepackage{microtype}',
    '\\usepackage[margin=2.5cm]{geometry}',
    '\\usepackage{amsmath,amssymb}',
    '\\usepackage[most]{tcolorbox}',
    '\\usepackage{pgfplots}',
    '\\pgfplotsset{compat=1.18}',
    '\\usepackage[hidelinks]{hyperref}',
    '\\hypersetup{unicode, pdftitle={La derivada}, pdfauthor={Estudiante}}',
    '',
    '% Poné \\solucionesfalse para la versión del alumno (sin respuestas).',
    '\\newif\\ifsoluciones',
    '\\solucionestrue',
    '',
    '% Cajas reutilizables:',
    '\\newtcolorbox{definicion}[1]{colback=blue!4,colframe=blue!45!black,title=#1,fonttitle=\\bfseries}',
    '\\newtcolorbox{ejemplo}[1]{colback=green!4,colframe=green!50!black,title=#1,fonttitle=\\bfseries}',
    '',
    '\\title{Apunte: la derivada}',
    '\\author{Cátedra de Laboratorio de Cálculo}',
    '\\date{\\today}',
    '',
    '\\begin{document}',
    '\\maketitle',
    '',
    '\\section{Definición}',
    '',
    '\\begin{definicion}{Derivada en un punto}',
    '  La derivada de $f$ en $x$ es',
    '  \\[ f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}, \\]',
    '  siempre que el límite exista.',
    '\\end{definicion}',
    '',
    'Geométricamente, $f\'(x)$ es la \\emph{pendiente de la recta tangente} a la',
    'gráfica de $f$ en el punto $(x, f(x))$.',
    '',
    '\\begin{ejemplo}{La derivada de $x^2$}',
    '  Con la definición, para $f(x)=x^2$:',
    '  \\[ f\'(x) = \\lim_{h \\to 0} \\frac{(x+h)^2 - x^2}{h}',
    '          = \\lim_{h \\to 0} (2x + h) = 2x. \\]',
    '\\end{ejemplo}',
    '',
    '\\section{Reglas básicas}',
    '\\begin{itemize}',
    '  \\item \\textbf{Constante:} $(c)\' = 0$.',
    '  \\item \\textbf{Potencia:} $(x^n)\' = n\\,x^{n-1}$.',
    '  \\item \\textbf{Suma:} $(f+g)\' = f\' + g\'$.',
    '  \\item \\textbf{Producto:} $(fg)\' = f\'g + fg\'$.',
    '  \\item \\textbf{Cadena:} $\\big(f(g(x))\\big)\' = f\'(g(x))\\,g\'(x)$.',
    '\\end{itemize}',
    '',
    '\\section{Interpretación gráfica}',
    'La recta tangente toca la curva con la misma pendiente:',
    '',
    '\\begin{center}',
    '\\begin{tikzpicture}',
    '\\begin{axis}[width=11cm, height=6cm, axis lines=middle,',
    '    xlabel=$x$, ylabel=$y$, domain=-1:3, samples=80, legend pos=north west]',
    '  \\addplot[thick, blue]{x^2};            \\addlegendentry{$f(x)=x^2$}',
    '  \\addplot[red, domain=0.2:1.8]{2*x - 1}; \\addlegendentry{tangente en $x=1$}',
    '  \\addplot[only marks, mark=*, black] coordinates {(1,1)};',
    '\\end{axis}',
    '\\end{tikzpicture}',
    '\\end{center}',
    '',
    '\\section{Ejercicios}',
    '\\begin{enumerate}',
    '  \\item Calculá $f\'(x)$ para $f(x) = 3x^2 - 5x + 1$.',
    '    \\ifsoluciones',
    '      \\par\\textbf{Solución:} $f\'(x) = 6x - 5$.',
    '    \\fi',
    '  \\item Derivá $g(x) = \\sqrt{x}$.',
    '    \\ifsoluciones',
    '      \\par\\textbf{Solución:} $g(x)=x^{1/2}$, así que $g\'(x) = \\tfrac{1}{2}x^{-1/2} = \\dfrac{1}{2\\sqrt{x}}$.',
    '    \\fi',
    '  \\item Usando la regla de la cadena, derivá $h(x) = (x^2+1)^3$.',
    '    \\ifsoluciones',
    '      \\par\\textbf{Solución:} $h\'(x) = 3(x^2+1)^2 \\cdot 2x = 6x(x^2+1)^2$.',
    '    \\fi',
    '\\end{enumerate}',
    '',
    '\\end{document}',
    '',
  ].join('\n'),
  matex: apunteMatex(),
} satisfies ExemplarInput
