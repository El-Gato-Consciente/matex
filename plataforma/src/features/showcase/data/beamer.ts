import type { MatexDoc } from '../../matex/core'
import type { ExemplarInput } from '../types'

/** Ítem de lista con un solo párrafo de texto (helper para autorar el AST de la presentación). */
const li = (text: string) => ({ type: 'listItem' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] }] })
const para = (text: string) => ({ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] })

/**
 * **Versión Matex (AST)** del ejemplar beamer (ME-23): el mismo tema (series de Fourier) autorado
 * con el modelo de presentación → `slide` (con `reveal`), `columns`, math y un `plot`. Compila a
 * **beamer** (PDF) y al **deck HTML** desde un solo AST — la tesis semántica llevada a las slides.
 */
const beamerMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Series de Fourier', author: 'Cátedra de Laboratorio de Cálculo', institution: 'Lic. en Matemática', family: { kind: 'presentation' }, style: 'classic', accent: 'blue', toc: true },
  content: [
    {
      type: 'slide',
      title: 'La idea',
      reveal: true,
      content: [
        {
          type: 'bulletList',
          items: [
            li('Una función periódica se escribe como suma de senos y cosenos.'),
            li('Cada término aporta una frecuencia distinta.'),
            li('Con suficientes términos, aproximamos casi cualquier señal.'),
          ],
        },
        { type: 'mathDisplay', rows: [{ tex: 'f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty} \\big(a_n \\cos nx + b_n \\sin nx\\big)' }] },
      ],
    },
    {
      type: 'slide',
      title: 'Onda cuadrada',
      content: [
        {
          type: 'columns',
          columns: [
            {
              ratio: 0.42,
              content: [para('Se aproxima sumando senos impares:'), { type: 'mathDisplay', rows: [{ tex: '\\frac{4}{\\pi}\\sum_{k=0}^{n} \\frac{\\sin((2k+1)x)}{2k+1}' }] }],
            },
            {
              ratio: 0.58,
              content: [{ type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: '(4/pi)*(sin(x) + sin(3*x)/3 + sin(5*x)/5)', color: 'blue' }], domain: [-3.5, 3.5], hideTicks: true } }] }],
            },
          ],
        },
      ],
    },
    {
      type: 'slide',
      title: 'Para recordar',
      content: [
        {
          type: 'orderedList',
          items: [
            li('Las frecuencias son los bloques de construcción.'),
            li('Más términos, mejor aproximación.'),
            li('Es la base del procesamiento de señales.'),
          ],
        },
      ],
    },
  ],
}

/**
 * Ejemplar · Presentación (clase beamer). Charla completa: portada, índice,
 * viñetas con aparición por pasos (overlays), un bloque, columnas, matemática y
 * un gráfico pgfplots dentro de una diapositiva.
 */
export const beamer = {
  id: 'ex-beamer-fourier',
  title: 'Presentación: series de Fourier',
  docType: 'Presentación (beamer)',
  description:
    'Charla completa con beamer: portada, índice por secciones, viñetas con overlays (<1->), un bloque destacado, columnas con matemática y un gráfico pgfplots en la diapositiva. Modelo de cómo armar una exposición.',
  techniques: [
    'clase beamer + tema',
    'portada e índice',
    'overlays (<1->) y \\onslide',
    'bloques y columnas',
    'gráfico pgfplots en una diapositiva',
  ],
  source: [
    '\\documentclass{beamer}',
    '\\usepackage{lmodern}',
    '\\usepackage{microtype}',
    '\\usetheme{Madrid}',
    '\\usecolortheme{seahorse}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[spanish,es-noshorthands]{babel}',
    '\\usepackage{amsmath}',
    '\\usepackage{pgfplots}',
    '\\pgfplotsset{compat=1.18}',
    '',
    '\\title{Series de Fourier}',
    '\\subtitle{Una introducción visual}',
    '\\author{Cátedra de Laboratorio de Cálculo}',
    '\\institute{Lic. en Matemática}',
    '\\date{\\today}',
    '\\hypersetup{unicode, pdftitle={Series de Fourier}, pdfauthor={Catedra de Laboratorio}}',
    '',
    '\\begin{document}',
    '',
    '\\begin{frame}',
    '  \\titlepage',
    '\\end{frame}',
    '',
    '\\begin{frame}{Contenido}',
    '  \\tableofcontents',
    '\\end{frame}',
    '',
    '\\section{La idea}',
    '\\begin{frame}{La idea}',
    '  \\begin{itemize}',
    '    \\item<1-> Una función periódica se escribe como suma de senos y cosenos.',
    '    \\item<2-> Cada término aporta una \\emph{frecuencia}.',
    '    \\item<3-> Con suficientes términos, aproximamos casi cualquier señal.',
    '  \\end{itemize}',
    '  \\onslide<3->{%',
    '  \\begin{block}{Serie de Fourier}',
    '    \\[ f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty} \\big(a_n \\cos nx + b_n \\sin nx\\big). \\]',
    '  \\end{block}}',
    '\\end{frame}',
    '',
    '\\section{Un ejemplo}',
    '\\begin{frame}{Onda cuadrada}',
    '  \\begin{columns}',
    '    \\begin{column}{0.42\\textwidth}',
    '      Se aproxima sumando senos impares:',
    '      \\[ \\frac{4}{\\pi}\\sum_{k=0}^{n} \\frac{\\sin((2k+1)x)}{2k+1}. \\]',
    '    \\end{column}',
    '    \\begin{column}{0.58\\textwidth}',
    '      \\begin{tikzpicture}',
    '      \\begin{axis}[width=\\textwidth, height=4.5cm, samples=120,',
    '          domain=-3.5:3.5, xlabel=$x$, ticks=none]',
    '        \\addplot[blue, thick]{4/pi*(sin(deg(x)) + sin(deg(3*x))/3 + sin(deg(5*x))/5)};',
    '      \\end{axis}',
    '      \\end{tikzpicture}',
    '    \\end{column}',
    '  \\end{columns}',
    '\\end{frame}',
    '',
    '\\section{Cierre}',
    '\\begin{frame}{Para recordar}',
    '  \\begin{enumerate}',
    '    \\item Las frecuencias son los bloques de construcción.',
    '    \\item Más términos, mejor aproximación.',
    '    \\item Es la base del procesamiento de señales.',
    '  \\end{enumerate}',
    '\\end{frame}',
    '',
    '\\end{document}',
    '',
  ].join('\n'),
  matex: beamerMatex,
} satisfies ExemplarInput
