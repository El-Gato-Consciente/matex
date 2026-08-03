import { describe, expect, it } from 'vitest'
import { lintLatex } from './latex/canonLint'
import type { MatexDoc } from './ast'
import { compileToLatex, parseMatexDoc, serializeMatexDoc } from './index'

const sample: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Prueba & cía', author: 'Estudiante' },
  content: [
    { type: 'heading', level: 1, content: [{ type: 'text', text: 'Introducción' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Un ' },
        { type: 'text', text: 'énfasis', marks: ['emph'] },
        { type: 'text', text: ' y ' },
        { type: 'text', text: 'negrita', marks: ['strong'] },
        { type: 'text', text: '. En línea: ' },
        { type: 'mathInline', tex: 'x^2' },
        { type: 'text', text: '. Con 50% de símbolos_raros.' },
      ],
    },
    {
      type: 'bulletList',
      items: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uno' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dos' }] }] },
      ],
    },
    { type: 'mathDisplay', rows: [{ tex: 'e^{i\\pi} + 1 = 0' }] },
    { type: 'rawLatex', latex: '\\vspace{1em}' },
  ],
}

describe('compileToLatex', () => {
  const out = compileToLatex(sample)

  it('genera un preámbulo canónico (PISO) y carga matemática al usarla', () => {
    expect(out).toContain('[spanish,es-noshorthands]{babel}')
    expect(out).toContain('{lmodern}')
    expect(out).toContain('{microtype}')
    expect(out).toContain('amsmath') // hay matemática en el documento
  })

  it('la salida cumple el canon (lint limpio)', () => {
    expect(lintLatex(out)).toEqual([])
  })

  it('serializa títulos, secciones, marcas y matemática', () => {
    expect(out).toContain('\\title{Prueba \\& cía}')
    expect(out).toContain('\\maketitle')
    expect(out).toContain('\\section{Introducción}')
    expect(out).toContain('\\emph{énfasis}')
    expect(out).toContain('\\textbf{negrita}')
    expect(out).toContain('$x^2$')
    expect(out).toContain('\\[\n  e^{i\\pi} + 1 = 0\n\\]')
  })

  it('escapa los caracteres reservados del texto', () => {
    expect(out).toContain('50\\% de símbolos\\_raros')
  })

  it('emite el rawLatex tal cual (escape hatch)', () => {
    expect(out).toContain('\\vspace{1em}')
  })

  it('listas → itemize con \\item', () => {
    expect(out).toContain('\\begin{itemize}')
    expect(out).toContain('\\item uno')
    expect(out).toContain('\\end{itemize}')
  })

  it('define las macros Matex (\\R, \\abs…) en el preámbulo cuando hay matemática', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'mathInline', tex: 'x \\in \\R' }] }],
    }
    const withMath = compileToLatex(doc)
    // Sin esto, `\R` (macro de KaTeX) rompía el PDF con "Undefined control sequence".
    expect(withMath).toContain('\\providecommand{\\R}{\\mathbb{R}}')
    expect(withMath).toContain('\\providecommand{\\abs}[1]{\\left|#1\\right|}')
    expect(lintLatex(withMath)).toEqual([])
    // Sin matemática no se inyectan las macros.
    const noMath = compileToLatex({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hola' }] }],
    })
    expect(noMath).not.toContain('providecommand')
  })

  it('sin matemática, no carga amsmath (preámbulo mínimo)', () => {
    const plain = compileToLatex({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }],
    })
    expect(plain).not.toContain('amsmath')
    expect(plain).toContain('[spanish,es-noshorthands]{babel}')
    expect(lintLatex(plain)).toEqual([])
  })

  it('marcas anidadas: negrita por fuera del énfasis', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: ['strong', 'emph'] }] }],
    }
    expect(compileToLatex(doc)).toContain('\\textbf{\\emph{x}}')
  })
})

describe('estructura académica (índice, teoremas, referencias, numeración)', () => {
  const doc: MatexDoc = {
    type: 'doc',
    version: 4,
    meta: { title: 'Apunte', author: 'Estudiante', titlePage: true, toc: true },
    content: [
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'Preliminares' }], label: 'sec:prelim' },
      {
        type: 'theorem',
        variant: 'definition',
        title: 'Continuidad',
        label: 'def:cont',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Una función es continua si…' }] }],
      },
      {
        type: 'theorem',
        variant: 'theorem',
        label: 'thm:tvi',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bolzano.' }] }],
      },
      { type: 'mathDisplay', rows: [{ tex: 'f(a) = 0', label: 'eq:raiz' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Por ' },
          { type: 'ref', target: 'thm:tvi' },
          { type: 'text', text: ' y ' },
          { type: 'ref', target: 'eq:raiz' },
          { type: 'text', text: '.' },
        ],
      },
    ],
  }
  const out = compileToLatex(doc)

  it('la salida cumple el canon (lint limpio)', () => {
    expect(lintLatex(out)).toEqual([])
  })

  it('índice (meta.toc) → \\tableofcontents en su propia página, tras la portada', () => {
    expect(out).toContain('\\maketitle')
    expect(out).toContain('\\clearpage\n\\tableofcontents\n\\clearpage')
  })

  it('teoremas → amsthm + entornos con título/label; proof no numerado disponible', () => {
    expect(out).toContain('\\usepackage{amsthm}')
    expect(out).toContain('\\newtheorem{theorem}{Teorema}[section]')
    expect(out).toContain('\\begin{definition}[Continuidad]')
    expect(out).toContain('\\label{def:cont}')
    expect(out).toContain('\\begin{theorem}')
    expect(out).toContain('\\end{theorem}')
  })

  it('referencias → hyperref + cleveref y \\cref', () => {
    expect(out).toContain('{hyperref}')
    expect(out).toContain('{cleveref}')
    expect(out).toContain('\\cref{thm:tvi}')
    expect(out).toContain('\\cref{eq:raiz}')
  })

  it('heading con label; ecuación con label → equation numerada', () => {
    expect(out).toContain('\\section{Preliminares}\n\\label{sec:prelim}')
    expect(out).toContain('\\begin{equation}')
    expect(out).toContain('\\label{eq:raiz}')
    expect(out).toContain('\\end{equation}')
  })

  it('portada en página propia → clase con opción titlepage', () => {
    expect(out).toContain('titlepage]{article}')
  })

  it('sin estas features, no carga amsthm ni cleveref', () => {
    expect(out).toBeTruthy()
    const plain = compileToLatex({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }],
    })
    expect(plain).not.toContain('amsthm')
    expect(plain).not.toContain('cleveref')
  })

  it('round-trip parse/serialize con los nodos nuevos', () => {
    expect(parseMatexDoc(JSON.parse(serializeMatexDoc(doc)))).toEqual(doc)
  })

  it('proof diferido: `proves` → encabezado con \\cref (número automático) y carga cleveref', () => {
    const out2 = compileToLatex({
      type: 'doc',
      version: 1,
      content: [
        { type: 'theorem', variant: 'theorem', label: 'thm:tvi', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'E.' }] }] },
        { type: 'theorem', variant: 'proof', proves: 'thm:tvi', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'D.' }] }] },
      ],
    })
    expect(out2).toContain('\\begin{proof}[\\proofname\\ del~\\cref{thm:tvi}]')
    expect(out2).toContain('{cleveref}')
    expect(lintLatex(out2)).toEqual([])
  })

  it('un ref sin destino no emite \\cref{} (evita el error fatal) ni carga cleveref', () => {
    const out = compileToLatex({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x ' }, { type: 'ref', target: '' }] }],
    })
    expect(out).not.toContain('\\cref{}')
    expect(out).not.toContain('cleveref')
    expect(lintLatex(out)).toEqual([])
  })
})

describe('referencias por identidad (id → \\label/\\cref)', () => {
  it('ref por id: el objeto emite \\label{id} y la ref \\cref{id}', () => {
    const out = compileToLatex({
      type: 'doc',
      version: 1,
      content: [
        { type: 'theorem', variant: 'theorem', id: 'abc123', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'E.' }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'ver ' }, { type: 'ref', target: 'abc123' }] },
      ],
    })
    expect(out).toContain('\\label{abc123}')
    expect(out).toContain('\\cref{abc123}')
    expect(out).toContain('{cleveref}')
    expect(lintLatex(out)).toEqual([])
  })

  it('etiqueta custom: se usa como clave (resuelta desde el id)', () => {
    const out = compileToLatex({
      type: 'doc',
      version: 1,
      content: [
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Intro' }], id: 'h1', label: 'sec:intro' },
        { type: 'paragraph', content: [{ type: 'ref', target: 'h1' }] },
      ],
    })
    expect(out).toContain('\\label{sec:intro}')
    expect(out).toContain('\\cref{sec:intro}')
    expect(out).not.toContain('\\label{h1}')
  })

  it('no referenciado y sin etiqueta → no emite \\label', () => {
    const out = compileToLatex({
      type: 'doc',
      version: 1,
      content: [{ type: 'theorem', variant: 'theorem', id: 'unused', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }],
    })
    expect(out).not.toContain('\\label')
  })

  it('ref colgada (id inexistente) → marcador seguro, no \\cref{}', () => {
    const out = compileToLatex({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'ref', target: 'ghost' }] }],
    })
    expect(out).not.toContain('\\cref')
    expect(out).toContain('\\textbf{??}')
  })
})

describe('fórmulas en bloque (filas + aligned; el entorno lo deriva el compilador)', () => {
  const wrap = (content: MatexDoc['content']): MatexDoc => ({ type: 'doc', version: 4, content })

  it('derivación → align* con justificaciones (\\text), \\boxed y título', () => {
    const out = compileToLatex(
      wrap([{ type: 'derivation', title: 'Resolución', steps: [{ tex: 'x^2 - 1 &= 0', note: 'condición' }, { tex: 'x &= \\pm 1', boxed: true }] }]),
    )
    expect(out).toContain('\\usepackage{amsmath,amssymb}') // amsmath por align/boxed/text
    expect(out).toContain('\\textbf{Resolución}')
    expect(out).toContain('\\begin{align*}')
    expect(out).toContain('x^2 - 1 &= 0 && \\text{condición}')
    expect(out).toContain('\\boxed{x = \\pm 1}') // el `&` se quita dentro de \boxed
  })

  it('razonamiento → dos minipages por fila; título en negrita; fila boxed → \\fbox', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'reasoning',
          title: 'R',
          rows: [{ left: [{ type: 'mathDisplay', rows: [{ tex: 'x = 1' }] }], right: [{ type: 'paragraph', content: [{ type: 'text', text: 'porque sí' }] }], boxed: true }],
        },
      ]),
    )
    expect(out).toContain('\\begin{minipage}')
    expect(out).toContain('\\fbox{')
    expect(out).toContain('\\textbf{R}')
  })

  it('figura dentro de una celda de razonamiento → sin float (center + \\captionof)', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'reasoning',
          rows: [{ left: [{ type: 'figure', caption: 'g', items: [{ kind: 'plot', spec: { functions: [{ expr: 'x' }], domain: [-1, 1] } }] }], right: [{ type: 'paragraph', content: [{ type: 'text', text: 'gráfico' }] }] }],
        },
      ]),
    )
    expect(out).not.toContain('\\begin{figure}') // el float no cabe en un minipage
    expect(out).toContain('\\captionof{figure}{g}')
  })

  it('1 fila sin numerar → \\[…\\]; numerada → equation', () => {
    expect(compileToLatex(wrap([{ type: 'mathDisplay', rows: [{ tex: 'a=b' }] }]))).toContain('\\[\n  a=b\n\\]')
    const eq = compileToLatex(wrap([{ type: 'mathDisplay', rows: [{ tex: 'a=b', numbered: true }] }]))
    expect(eq).toContain('\\begin{equation}')
    expect(eq).not.toContain('\\begin{align}')
  })

  it('≥2 filas alineadas (default) → align; numera solo las marcadas (\\notag en el resto); ninguna → align*', () => {
    const num = compileToLatex(
      wrap([{ type: 'mathDisplay', rows: [{ tex: 'a &= b', numbered: true }, { tex: 'c &= d', numbered: true }] }]),
    )
    expect(num).toContain('\\begin{align}\n  a &= b \\\\\n  c &= d\n\\end{align}')
    expect(lintLatex(num)).toEqual([])
    const mixed = compileToLatex(
      wrap([{ type: 'mathDisplay', rows: [{ tex: 'a &= b', numbered: true }, { tex: 'c &= d' }] }]),
    )
    expect(mixed).toContain('\\begin{align}\n  a &= b \\\\\n  c &= d \\notag\n\\end{align}')
    const noNum = compileToLatex(wrap([{ type: 'mathDisplay', rows: [{ tex: 'a &= b' }, { tex: 'c &= d' }] }]))
    expect(noNum).toContain('\\begin{align*}')
  })

  it('≥2 filas con aligned:false → gather/gather*', () => {
    expect(
      compileToLatex(wrap([{ type: 'mathDisplay', aligned: false, rows: [{ tex: 'x', numbered: true }, { tex: 'y' }] }])),
    ).toContain('\\begin{gather}')
    expect(
      compileToLatex(wrap([{ type: 'mathDisplay', aligned: false, rows: [{ tex: 'x' }, { tex: 'y' }] }])),
    ).toContain('\\begin{gather*}')
  })

  it('fila referenciada emite \\label; una etiqueta custom también', () => {
    const referenced = wrap([
      { type: 'mathDisplay', rows: [{ tex: 'a &= b', numbered: true, id: 'e1' }, { tex: 'c &= d', numbered: true }] },
      { type: 'paragraph', content: [{ type: 'ref', target: 'e1' }] },
    ])
    const out = compileToLatex(referenced)
    expect(out).toContain('a &= b \\label{e1}')
    expect(out).toContain('\\cref{e1}')
    expect(out).not.toContain('c &= d \\label')
  })

  it('round-trip con filas + aligned', () => {
    const aligned = wrap([{ type: 'mathDisplay', rows: [{ tex: 'a &= b', numbered: true }, { tex: 'c &= d' }] }])
    expect(parseMatexDoc(JSON.parse(serializeMatexDoc(aligned)))).toEqual(aligned)
    const centered = wrap([{ type: 'mathDisplay', aligned: false, rows: [{ tex: 'x' }, { tex: 'y' }] }])
    expect(parseMatexDoc(JSON.parse(serializeMatexDoc(centered)))).toEqual(centered)
  })

  it('migra v1 (tex de bloque) → filas; align viejo se parte por \\\\', () => {
    const legacyPlain = parseMatexDoc({
      type: 'doc',
      version: 1,
      content: [{ type: 'mathDisplay', tex: 'a=b', numbered: true, label: 'eq:x' }],
    })
    expect(legacyPlain.content[0]).toEqual({ type: 'mathDisplay', rows: [{ tex: 'a=b', numbered: true, label: 'eq:x' }] })
    const legacyAlign = parseMatexDoc({
      type: 'doc',
      version: 1,
      content: [{ type: 'mathDisplay', kind: 'align', tex: 'a &= b \\\\ c &= d', numbered: true }],
    })
    // align viejo → default (alineado, sin campo); gather viejo → aligned:false.
    expect(legacyAlign.content[0]).toEqual({
      type: 'mathDisplay',
      rows: [{ tex: 'a &= b', numbered: true }, { tex: 'c &= d', numbered: true }],
    })
  })

  it('migra kind → aligned (gather = centrado); dropea kind', () => {
    const fromKind = parseMatexDoc({
      type: 'doc',
      version: 4,
      content: [
        { type: 'mathDisplay', kind: 'gather', rows: [{ tex: 'x', numbered: true }, { tex: 'y' }] },
        { type: 'mathDisplay', kind: 'align', rows: [{ tex: 'a &= b' }, { tex: 'c &= d' }] },
      ],
    })
    expect(fromKind.content[0]).toEqual({
      type: 'mathDisplay',
      aligned: false,
      rows: [{ tex: 'x', numbered: true }, { tex: 'y' }],
    })
    expect(fromKind.content[1]).toEqual({
      type: 'mathDisplay',
      rows: [{ tex: 'a &= b' }, { tex: 'c &= d' }],
    })
  })
})

describe('bloque de código (listings, sin shell-escape)', () => {
  const wrap = (content: MatexDoc['content']): MatexDoc => ({ type: 'doc', version: 4, content })

  it('codeBlock → lstlisting verbatim + carga listings; language como opción', () => {
    const out = compileToLatex(wrap([{ type: 'codeBlock', code: 'print("hola & <_>")\nx = 1', language: 'Python' }]))
    expect(out).toContain('\\usepackage{listings}')
    expect(out).toContain('\\begin{lstlisting}[language=Python]\nprint("hola & <_>")\nx = 1\n\\end{lstlisting}')
    // verbatim: los caracteres especiales NO se escapan dentro del código
    expect(out).not.toContain('hola \\&')
  })

  it('sin language → lstlisting sin opción; sin codeBlock → no carga listings', () => {
    expect(compileToLatex(wrap([{ type: 'codeBlock', code: 'ls -la' }]))).toContain('\\begin{lstlisting}\nls -la\n\\end{lstlisting}')
    expect(compileToLatex(wrap([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]))).not.toContain('listings')
  })
})

describe('bibliografía (biblatex + biber, best practice)', () => {
  const wrap = (content: MatexDoc['content'], references?: MatexDoc['references'], meta?: MatexDoc['meta']): MatexDoc => ({
    type: 'doc',
    version: 4,
    content,
    ...(references ? { references } : {}),
    ...(meta ? { meta } : {}),
  })
  const refs: MatexDoc['references'] = [{ key: 'knuth1984', type: 'book', author: 'Knuth, Donald E.', title: 'The {\\TeX}book', year: '1984', publisher: 'Addison-Wesley' }]

  it('references (nivel doc) → biblatex+biber, .bib vía filecontents emitido desde la estructura, print al final', () => {
    const out = compileToLatex(wrap(
      [{ type: 'paragraph', content: [{ type: 'cite', keys: ['knuth1984'] }] }],
      refs,
      { bibStyle: 'authoryear' },
    ))
    expect(out).toContain('\\usepackage[backend=biber,style=authoryear]{biblatex}')
    expect(out).toContain('\\begin{filecontents}[overwrite]{\\jobname.bib}')
    // El .bib se EMITE desde la estructura (el usuario no escribe BibTeX):
    expect(out).toContain('@book{knuth1984,')
    expect(out).toContain('author = {Knuth, Donald E.}')
    expect(out).toContain('title = {The {\\TeX}book}')
    expect(out).toContain('\\addbibresource{\\jobname.bib}')
    expect(out).toContain('\\printbibliography')
    expect(out).not.toContain('thebibliography')
  })

  it('cita: parenthetical → \\parencite (default), textual → \\textcite', () => {
    const out = compileToLatex(wrap([
      { type: 'paragraph', content: [
        { type: 'cite', keys: ['a', 'b'] },
        { type: 'cite', keys: ['c'], style: 'textual' },
      ] },
    ], refs))
    expect(out).toContain('\\parencite{a,b}')
    expect(out).toContain('\\textcite{c}')
  })

  it('estilo default numeric; meta.bibTitle reemplaza el encabezado', () => {
    const out = compileToLatex(wrap([], refs, { bibTitle: 'Bibliografía' }))
    expect(out).toContain('\\usepackage[backend=biber,style=numeric]{biblatex}')
    expect(out).toContain('\\printbibliography[title={Bibliografía}]')
  })

  it('la lista de referencias se imprime al final', () => {
    const out = compileToLatex(wrap([{ type: 'paragraph', content: [{ type: 'cite', keys: ['knuth1984'] }] }], refs))
    expect(out).toContain('\\printbibliography')
  })

  it('cita suelta sin biblioteca → carga biblatex igual (no deja \\parencite colgado)', () => {
    const out = compileToLatex(wrap([{ type: 'paragraph', content: [{ type: 'cite', keys: ['x'] }] }]))
    expect(out).toContain('{biblatex}')
    expect(out).toContain('\\addbibresource{\\jobname.bib}')
  })

  it('orden del cierre: hyperref → biblatex → cleveref (con referencias)', () => {
    const out = compileToLatex(wrap([
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'S' }], id: 's' },
      { type: 'paragraph', content: [{ type: 'ref', target: 's' }, { type: 'cite', keys: ['knuth1984'] }] },
    ], refs))
    expect(out.indexOf('{hyperref}')).toBeLessThan(out.indexOf('{biblatex}'))
    expect(out.indexOf('{biblatex}')).toBeLessThan(out.indexOf('{cleveref}'))
  })

  it('sin citas ni bibliografía → no carga biblatex', () => {
    expect(compileToLatex(wrap([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]))).not.toContain('biblatex')
  })
})

describe('caja / callout (tcolorbox)', () => {
  const wrap = (content: MatexDoc['content']): MatexDoc => ({ type: 'doc', version: 4, content })

  it('callout → tcolorbox con color de la variante + título + carga el paquete', () => {
    const out = compileToLatex(wrap([
      { type: 'callout', variant: 'warning', title: 'Ojo & cía', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'texto' }] }] },
    ]))
    expect(out).toContain('\\usepackage{tcolorbox}')
    expect(out).toContain('\\tcbuselibrary{breakable}')
    expect(out).toContain('\\begin{tcolorbox}[breakable, colback=orange!8, colframe=orange!75!black, title={Ojo \\& cía}')
    expect(out).toContain('texto')
    expect(out).toContain('\\end{tcolorbox}')
  })

  it('sin título omite la barra de título; sin callout no carga tcolorbox', () => {
    const noTitle = compileToLatex(wrap([{ type: 'callout', variant: 'note', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }]))
    expect(noTitle).toContain('\\begin{tcolorbox}[breakable, colback=blue!5, colframe=blue!55!black]')
    expect(compileToLatex(wrap([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]))).not.toContain('tcolorbox')
  })
})

describe('include (\\input) y bibliografía como archivo real', () => {
  const wrap = (content: MatexDoc['content'], references?: MatexDoc['references']): MatexDoc =>
    references ? { type: 'doc', version: 4, content, references } : { type: 'doc', version: 4, content }

  it('IncludeNode → \\input{target}; vacío → nada', () => {
    expect(compileToLatex(wrap([{ type: 'include', target: 'figuras/tikz1.tex' }]))).toContain('\\input{figuras/tikz1.tex}')
    expect(compileToLatex(wrap([{ type: 'include', target: '  ' }]))).not.toContain('\\input')
  })

  it('presentación (ME-23): clase beamer + slides → frames + tema; sin geometry', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 4,
      meta: { title: 'T', family: { kind: 'presentation' }, style: 'classic' },
      content: [
        { type: 'slide', title: 'Uno', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hola' }] }] },
        { type: 'slide', content: [{ type: 'codeBlock', code: 'x=1' }] },
      ],
    }
    const tex = compileToLatex(doc)
    expect(tex).toContain('\\documentclass{beamer}')
    expect(tex).toContain('\\usetheme{Madrid}')
    expect(tex).toContain('\\begin{frame}[plain]\n\\titlepage')
    expect(tex).toContain('\\begin{frame}{Uno}')
    expect(tex).toContain('\\begin{frame}[fragile]') // frame con código
    expect(tex).not.toContain('geometry')
  })

  it('CV (ME-23): clase moderncv + identidad + \\cventry por entrada', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 4,
      meta: { author: 'Ana Pérez', accent: 'blue', family: { kind: 'cv', cv: { email: 'a@b.c', subtitle: 'Matemática' } } },
      content: [
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Formación' }] },
        { type: 'cvEntry', period: '2020–2024', role: 'Lic.', org: 'UNL', place: 'Santa Fe', detail: 'tesina' },
      ],
    }
    const tex = compileToLatex(doc)
    expect(tex).toContain('{moderncv}')
    expect(tex).toContain('\\moderncvstyle{banking}')
    expect(tex).toContain('\\name{Ana}{Pérez}') // parte por el último espacio
    expect(tex).toContain('\\email{a@b.c}')
    expect(tex).toContain('\\makecvtitle')
    expect(tex).toContain('\\cventry{2020–2024}{Lic.}{UNL}{Santa Fe}{}{tesina}')
    expect(tex).not.toContain('\\maketitle')
  })

  it('examen (ME-23): clase exam, questions con puntaje; la MISMA AST da las 2 versiones vía opts (FIX-20)', () => {
    const base: MatexDoc = {
      type: 'doc',
      version: 4,
      meta: { title: 'Parcial', family: { kind: 'exam', exam: { instructions: 'Justificá.' } } },
      content: [
        {
          type: 'examQuestion',
          points: 20,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'enunciado' }] }],
          solution: [{ type: 'paragraph', content: [{ type: 'text', text: 'resuelto' }] }],
        },
      ],
    }
    // Versión del docente: `opts.showSolutions` (ocasión de emisión, no propiedad del documento).
    const docente = compileToLatex(base, { showSolutions: true })
    expect(docente).toContain('{exam}')
    expect(docente).toContain('\\begin{questions}')
    expect(docente).toContain('\\question[20]')
    expect(docente).toContain('\\begin{solution}')
    expect(docente).toContain('\\printanswers')
    expect(docente).toContain('\\pointpoints{punto}{puntos}') // rótulos en español
    // Versión del alumno: el MISMO AST, sin opts → sin `\printanswers`.
    const alumno = compileToLatex(base)
    expect(alumno).toContain('\\begin{solution}')
    expect(alumno).not.toContain('\\printanswers')
  })

  it('carta (ME-23): clase letter + opening/closing/firma; direcciones multilínea con \\\\', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 4,
      meta: {
        family: {
          kind: 'letter',
          letter: {
            from: 'Ana',
            fromAddress: 'Calle 1\nCiudad',
            to: 'Dr. Pérez',
            toAddress: 'Depto\nFacultad',
            opening: 'Estimado Dr.:',
            closing: 'Cordialmente,',
            encl: 'Certificado',
          },
        },
      },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cuerpo' }] }],
    }
    const tex = compileToLatex(doc)
    expect(tex).toContain('\\documentclass[11pt,a4paper]{letter}')
    expect(tex).toContain('\\begin{letter}{Dr. Pérez \\\\ Depto \\\\ Facultad}')
    expect(tex).toContain('\\address{Ana \\\\ Calle 1 \\\\ Ciudad}')
    expect(tex).toContain('\\opening{Estimado Dr.:}')
    expect(tex).toContain('\\closing{Cordialmente,}')
    expect(tex).toContain('\\signature{Ana}')
    expect(tex).toContain('\\encl{Certificado}')
    expect(tex).not.toContain('\\maketitle')
  })

  it('columnas: beamer `columns` en presentación, `minipage` en un documento normal', () => {
    const cols: MatexDoc['content'] = [
      {
        type: 'columns',
        columns: [
          { ratio: 0.5, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'izq' }] }] },
          { ratio: 0.5, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'der' }] }] },
        ],
      },
    ]
    // Documento (article): `columns` de beamer no existe → minipage lado a lado.
    const doc = compileToLatex(wrap(cols))
    expect(doc).toContain('\\begin{minipage}[t]')
    expect(doc).toContain('\\hfill')
    expect(doc).not.toContain('\\begin{columns}')
    // Presentación: el entorno nativo de beamer.
    const pres = compileToLatex({ type: 'doc', version: 4, meta: { family: { kind: 'presentation' } }, content: cols })
    expect(pres).toContain('\\begin{columns}[t]')
    expect(pres).toContain('\\begin{column}{0.5\\textwidth}')
  })

  it('encabezados: `report`/`book` usan \\chapter en el nivel 1; `article` usa \\section', () => {
    const head: MatexDoc['content'] = [{ type: 'heading', level: 1, content: [{ type: 'text', text: 'Uno' }] }]
    expect(compileToLatex(wrap(head))).toContain('\\section{Uno}')
    const report = compileToLatex({ type: 'doc', version: 4, meta: { docKind: 'report' }, content: head })
    expect(report).toContain('\\chapter{Uno}')
  })

  it('sin presentación, un slide degrada a frame pero NO fuerza beamer', () => {
    // Un documento normal no es beamer (article); el frame igual no rompe el typecheck.
    const tex = compileToLatex(wrap([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]))
    expect(tex).not.toContain('\\documentclass{beamer}')
  })

  it('bibFile: usa \\addbibresource{refs.bib} (sin filecontents); default sigue filecontents', () => {
    const refs: MatexDoc['references'] = [{ key: 'k', type: 'book', title: 'X', year: '2020' }]
    const doc = wrap([{ type: 'paragraph', content: [{ type: 'cite', keys: ['k'] }] }], refs)
    const real = compileToLatex(doc, { bibFile: 'refs.bib' })
    expect(real).toContain('\\addbibresource{refs.bib}')
    expect(real).not.toContain('filecontents')
    // Default (sin opción) = autocontenido con filecontents.
    expect(compileToLatex(doc)).toContain('\\begin{filecontents}[overwrite]{\\jobname.bib}')
  })
})

describe('nota al pie (footnote)', () => {
  it('footnote inline → \\footnote{…} con el texto escapado', () => {
    const out = compileToLatex({
      type: 'doc',
      version: 4,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dato' }, { type: 'footnote', text: 'una nota con 50% & _' }] }],
    })
    expect(out).toContain('\\footnote{una nota con 50\\% \\& \\_}')
  })
})

describe('portada ampliada (autores/afiliación/correo, resumen, institución)', () => {
  const meta = (m: MatexDoc['meta']): MatexDoc => ({ type: 'doc', version: 4, content: [], meta: m })

  it('autores estructurados → \\author con \\and, afiliación (\\small) y correo (\\texttt); abstract', () => {
    const out = compileToLatex(meta({
      title: 'T',
      authors: [{ name: 'A. Uno', affiliation: 'Inst X', email: 'a@x.com' }, { name: 'B. Dos' }],
      abstract: 'Un resumen.',
    }))
    expect(out).toContain('\\author{A. Uno \\\\ {\\small Inst X} \\\\ {\\small \\texttt{a@x.com}} \\and B. Dos}')
    expect(out).toContain('\\maketitle')
    expect(out).toContain('\\begin{abstract}')
    expect(out).toContain('Un resumen.')
  })

  it('sin authors: author simple + institution debajo', () => {
    expect(compileToLatex(meta({ author: 'Solo', institution: 'Inst' }))).toContain('\\author{Solo \\\\ {\\small Inst}}')
  })

  it('solo autores (sin título) igual dispara \\maketitle', () => {
    expect(compileToLatex(meta({ authors: [{ name: 'X' }] }))).toContain('\\maketitle')
  })

  it('margen → geometry (ME-15); sin margen no carga geometry', () => {
    expect(compileToLatex(meta({ margin: '2cm' }))).toContain('margin=2cm]{geometry}')
    expect(compileToLatex(meta({}))).not.toContain('{geometry}')
  })

  it('informe con portada propia: la clase se DERIVA del diseño semántico (LE-02)', () => {
    const out = compileToLatex(meta({ docKind: 'report', titlePage: true }))
    expect(out).toContain('\\documentclass[11pt,a4paper,titlepage]{report}')
  })
})

describe('gráficos categóricos (familia A1/A2: barras + torta)', () => {
  const fig = (item: unknown): MatexDoc => ({ type: 'doc', version: 4, content: [{ type: 'figure', items: [item as never] }] })

  it('barras → pgfplots ybar (una \\addplot por serie, categorías por xticklabels)', () => {
    const out = compileToLatex(fig({
      kind: 'chart',
      spec: { form: 'bar', categories: ['Datos', 'Redes'], series: [{ label: 'Uso', values: [65, 30] }], ylabel: 'Porcentaje', legend: true },
    }))
    expect(out).toContain('ybar')
    expect(out).toContain('xticklabels={{Datos},{Redes}}')
    expect(out).toContain('\\addplot[fill=blue, draw=blue] coordinates {(1,65) (2,30)};')
    expect(out).toContain('ylabel={Porcentaje}')
    expect(out).toContain('\\legend{Uso}')
    expect(out).not.toContain('pgf-pie') // barras no cargan pgf-pie
  })

  it('torta → pgf-pie (carga el paquete; sectores valor/categoría; omite ceros)', () => {
    const out = compileToLatex(fig({
      kind: 'chart',
      spec: { form: 'pie', categories: ['A', 'B', 'C'], series: [{ values: [10, 0, 30] }], legend: true },
    }))
    expect(out).toContain('\\usepackage{pgf-pie}')
    expect(out).toContain('\\pie[text=legend]{10/A, 30/C}') // B (valor 0) se omite
  })

  it('histograma → ybar interval (bins calculados en JS); sin librería statistics', () => {
    const out = compileToLatex(fig({ kind: 'distribution', spec: { form: 'histogram', data: [{ samples: [1, 2, 2, 3, 3, 3, 4] }] } }))
    expect(out).toContain('ybar interval')
    expect(out).toContain('\\usepackage{pgfplots}')
    expect(out).toContain('coordinates {')
    expect(out).not.toContain('statistics')
  })

  it('boxplot → boxplot prepared + carga la librería statistics', () => {
    const out = compileToLatex(fig({ kind: 'distribution', spec: { form: 'boxplot', data: [{ label: 'A', samples: [1, 2, 3, 4, 5, 6, 7, 8, 9] }] } }))
    expect(out).toContain('\\usepgfplotslibrary{statistics}')
    expect(out).toContain('boxplot prepared={lower whisker=1, lower quartile=3, median=5, upper quartile=7, upper whisker=9}')
  })

  it('formas de eje: apiladas → ybar stacked, horizontales → xbar, línea → mark', () => {
    const spec = (form: string) => fig({ kind: 'chart', spec: { form, categories: ['A', 'B'], series: [{ values: [1, 2] }] } })
    expect(compileToLatex(spec('stackedBar'))).toContain('ybar stacked')
    const hbar = compileToLatex(spec('hbar'))
    expect(hbar).toContain('xbar')
    expect(hbar).toContain('yticklabels={{A},{B}}') // categorías en el eje y
    expect(compileToLatex(spec('line'))).toMatch(/\\addplot\[color=[^,]+, mark=\*/)
  })

  it('diagrama conmutativo → tikz-cd (carga el paquete; aristas relativas por posición en grilla)', () => {
    const out = compileToLatex(fig({
      kind: 'diagram',
      spec: {
        form: 'commutative',
        nodes: [
          { id: 'a', label: 'A', row: 0, col: 0 },
          { id: 'b', label: 'B', row: 0, col: 1 },
          { id: 'c', label: 'C', row: 1, col: 0 },
          { id: 'd', label: 'D', row: 1, col: 1 },
        ],
        edges: [
          { from: 'a', to: 'b', label: 'f' },
          { from: 'a', to: 'c', label: 'g' },
          { from: 'b', to: 'd', label: 'h' },
          { from: 'c', to: 'd', label: 'k' },
        ],
      },
    }))
    expect(out).toContain('\\usepackage{tikz-cd}')
    expect(out).toContain('\\begin{tikzcd}')
    // A: derecha a B ("r") y abajo a C ("d"); D recibe de B (abajo) y de C (derecha).
    expect(out).toContain('A \\arrow[r, "f"] \\arrow[d, "g"] & B \\arrow[d, "h"]')
    expect(out).toContain('C \\arrow[r, "k"] & D')
  })

  it('aristas: punta (mono/epi), trazo (dashed) y curvado (bend) → opciones tikz-cd', () => {
    const out = compileToLatex(fig({
      kind: 'diagram',
      spec: {
        form: 'commutative',
        nodes: [
          { id: 'x', label: 'X', row: 0, col: 0 },
          { id: 'y', label: 'Y', row: 0, col: 1 },
        ],
        edges: [
          { from: 'x', to: 'y', label: '\\iota', tip: 'mono' },
          { from: 'y', to: 'x', label: 's', style: 'dashed', bend: 'left' },
        ],
      },
    }))
    expect(out).toContain('X \\arrow[r, "\\iota", hook]')
    expect(out).toContain('Y \\arrow[l, "s", dashed, bend left]')
  })

  it('árbol → forest (carga el paquete; jerarquía como corchetes anidados)', () => {
    const out = compileToLatex(fig({
      kind: 'tree',
      spec: {
        form: 'tree',
        nodes: [
          { id: 'r', label: 'Raíz' },
          { id: 'a', label: 'A', parent: 'r' },
          { id: 'b', label: 'B', parent: 'r' },
          { id: 'a1', label: 'A1', parent: 'a' },
        ],
      },
    }))
    expect(out).toContain('\\usepackage{forest}')
    expect(out).toContain('\\begin{forest}')
    // Raíz con hijos A (que a su vez tiene A1) y B.
    expect(out).toContain('[{Raíz} [{A} [{A1}]] [{B}]]')
  })

  it('la figura con chart carga graphicx/pgfplots pero NO fuerza matemática', () => {
    const out = compileToLatex(fig({ kind: 'chart', spec: { form: 'bar', categories: ['A'], series: [{ values: [1] }] } }))
    expect(out).toContain('\\usepackage{pgfplots}')
    // sin gráfico de funciones ni math, no se cargan las macros del canon
    expect(out).not.toContain('\\providecommand{\\abs}')
  })
})

describe('tablas (booktabs, sin verticales)', () => {
  const doc: MatexDoc = {
    type: 'doc',
    version: 4,
    content: [
      {
        type: 'table',
        header: true,
        align: ['left', 'right'],
        caption: 'Resultados & datos',
        label: 'tab:res',
        rows: [
          {
            type: 'tableRow',
            cells: [
              { type: 'tableCell', content: [{ type: 'text', text: 'Nombre' }] },
              { type: 'tableCell', content: [{ type: 'text', text: 'Valor' }] },
            ],
          },
          {
            type: 'tableRow',
            cells: [
              { type: 'tableCell', content: [{ type: 'text', text: 'x' }] },
              { type: 'tableCell', content: [{ type: 'mathInline', tex: '\\pi' }] },
            ],
          },
        ],
      },
    ],
  }
  const out = compileToLatex(doc)

  it('la salida cumple el canon (lint limpio: booktabs, sin \\hline ni verticales)', () => {
    expect(lintLatex(out)).toEqual([])
  })

  it('carga booktabs y usa \\toprule/\\midrule/\\bottomrule', () => {
    expect(out).toContain('\\usepackage{booktabs}')
    expect(out).toContain('\\toprule')
    expect(out).toContain('\\midrule')
    expect(out).toContain('\\bottomrule')
  })

  it('column spec sin verticales, con la alineación pedida', () => {
    expect(out).toContain('\\begin{tabular}{lr}') // 'lr' sin barras; el lint verifica que no haya verticales
    expect(out).not.toContain('\\hline')
  })

  it('encabezado separado por \\midrule (sin negrita, estilo booktabs) y celdas con &', () => {
    expect(out).not.toContain('\\textbf{Nombre}')
    expect(out).toContain('Nombre & Valor \\\\')
    expect(out).toContain('\\midrule')
    expect(out).toContain('x & $\\pi$ \\\\')
  })

  it('con caption/label va en un flotante table (caption escapado, label crudo)', () => {
    expect(out).toContain('\\begin{table}[htbp]')
    expect(out).toContain('\\caption{Resultados \\& datos}')
    expect(out).toContain('\\label{tab:res}')
  })

  it('el caption va abajo (después de \\end{tabular}) con el label pegado', () => {
    expect(out.indexOf('\\end{tabular}')).toBeLessThan(out.indexOf('\\caption'))
    expect(out).toContain('\\caption{Resultados \\& datos}\\label{tab:res}')
  })

  it('round-trip parse/serialize', () => {
    expect(parseMatexDoc(JSON.parse(serializeMatexDoc(doc)))).toEqual(doc)
  })

  it('sin caption/label va centrada (sin flotante)', () => {
    const simple = compileToLatex({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'table',
          rows: [
            { type: 'tableRow', cells: [{ type: 'tableCell', content: [{ type: 'text', text: 'a' }] }] },
          ],
        },
      ],
    })
    expect(simple).toContain('\\begin{center}')
    expect(simple).not.toContain('\\begin{table}')
    expect(lintLatex(simple)).toEqual([])
  })
})

describe('figuras (partes: imagen | gráfico)', () => {
  const wrap = (content: MatexDoc['content']): MatexDoc => ({ type: 'doc', version: 4, content })
  const imgFig = (src: string, extra: object = {}, item: object = {}): MatexDoc['content'][number] => ({
    type: 'figure',
    items: [{ kind: 'image', src, ...item }],
    ...extra,
  })

  it('imagen con caption/width → figure[htbp], includegraphics, caption abajo, carga graphicx', () => {
    const out = compileToLatex(wrap([imgFig('diagrama.png', { caption: 'Un diagrama & más', label: 'fig:d' }, { width: 0.7 })]))
    expect(out).toContain('\\usepackage{graphicx}')
    expect(out).toContain('\\begin{figure}[htbp]')
    expect(out).toContain('\\centering')
    // `\linewidth` (no `\textwidth`): dentro de un bloque de póster / columna / minipage el ancho
    // disponible NO es el de la página — así la figura nunca se desborda de su caja.
    expect(out).toContain('\\includegraphics[width=0.7\\linewidth]{diagrama.png}')
    expect(out.indexOf('\\includegraphics')).toBeLessThan(out.indexOf('\\caption'))
    expect(out).toContain('\\caption{Un diagrama \\& más}\\label{fig:d}')
    expect(lintLatex(out)).toEqual([])
  })

  it('imagen sin width → ancho completo (\\linewidth); sin src → sin includegraphics', () => {
    expect(compileToLatex(wrap([imgFig('foto.jpg')]))).toContain('\\includegraphics[width=\\linewidth]{foto.jpg}')
    const empty = compileToLatex(wrap([imgFig('', { caption: 'Vacía' })]))
    expect(empty).toContain('\\begin{figure}[htbp]')
    expect(empty).not.toContain('\\includegraphics')
  })

  it('sin caption → sin \\caption ni \\label (la ref cuelga); con caption → \\label y \\cref', () => {
    const hangs = compileToLatex(wrap([imgFig('x.png', { id: 'f1' }), { type: 'paragraph', content: [{ type: 'ref', target: 'f1' }] }]))
    expect(hangs).not.toContain('\\caption')
    expect(hangs).toContain('\\textbf{??}')
    const ok = compileToLatex(wrap([imgFig('x.png', { caption: 'Foto', id: 'f1' }), { type: 'paragraph', content: [{ type: 'ref', target: 'f1' }] }]))
    expect(ok).toContain('\\caption{Foto}\\label{f1}')
    expect(ok).toContain('\\cref{f1}')
  })

  it('≥2 partes → subfiguras con \\subcaption, \\linewidth, \\hfill y refs de subparte', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          caption: 'Comparación',
          items: [
            { kind: 'image', src: 'a.png', subcaption: 'Antes', id: 'sa', label: 'fig:antes' },
            { kind: 'image', src: 'b.png', subcaption: 'Después', id: 'sb' },
          ],
        },
        { type: 'paragraph', content: [{ type: 'ref', target: 'fig:antes' }] },
      ]),
    )
    expect(out).toContain('\\begin{subfigure}[t]{0.47\\textwidth}')
    expect(out).toContain('\\includegraphics[width=\\linewidth]{a.png}')
    expect(out).toContain('\\subcaption{Antes}\\label{fig:antes}') // referenciada → \label
    expect(out).toContain('\\subcaption{Después}') // id sin usar → sin \label (política del canon)
    expect(out).not.toContain('\\label{sb}')
    expect(out).toContain('\\hfill')
    expect(out).toContain('\\cref{fig:antes}') // la subparte es referenciable
    expect(lintLatex(out)).toEqual([])
  })

  it('gráfico de funciones → tikzpicture/axis/addplot (pgfplots, radianes)', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          caption: 'Parábola',
          items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2', legend: 'y=x²' }], domain: [-3, 3], grid: true, legend: true } }],
        },
      ]),
    )
    expect(out).toContain('\\usepackage{pgfplots}')
    expect(out).toContain('\\begin{tikzpicture}')
    expect(out).toContain('\\begin{axis}[')
    expect(out).toContain('domain=-3:3')
    expect(out).toContain('trig format plots=rad')
    expect(out).toContain('grid=major')
    expect(out).toContain('\\addplot[smooth, color=blue] {(x ^ 2)};')
    // El `²` del rótulo se traduce a math: literal rompería pdflatex ("Unicode character not set up").
    expect(out).toContain('\\addlegendentry{y=x$^{2}$}')
    expect(out).toContain('\\caption{Parábola}')
    expect(out).not.toContain('axis equal')
  })

  it('parámetros (ME-36) → el valor se sustituye en la expresión emitida', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [{ kind: 'plot', spec: { functions: [{ expr: 'a*x^2 + b' }], domain: [-3, 3], parameters: [{ name: 'a', value: 2 }, { name: 'b', value: -1 }] } }],
        },
      ]),
    )
    // `a`→2, `b`→-1 horneados y re-emitidos; sin nombres de parámetro sueltos en el pgfplots.
    expect(out).toContain('\\addplot[smooth, color=blue] {((2 * (x ^ 2)) + (-1))};')
  })

  it('punto anclado a una función (`fn`) → y = f(x) computado (ignora la y almacenada)', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: { functions: [{ expr: 'x^2' }], domain: [-3, 3], points: [{ x: 2, y: 0, fn: 0, label: 'P' }] },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('coordinates {(2, 4)};') // f(2)=4, no la y=0
    expect(out).toContain('at (axis cs:2,4)')
  })

  it('función con trig de argumento gigante → coordenadas JS (evita "Dimension too large")', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [{ kind: 'plot', spec: { functions: [{ expr: 'x*sin(1/x^2)' }, { expr: 'x^2' }], domain: [-0.8, 0.8], range: [-0.5, 1] } }],
        },
      ]),
    )
    expect(out).toMatch(/\\addplot\[smooth, color=blue\] coordinates \{\(-0/) // la salvaje → coordenadas
    expect(out).toContain('{(x ^ 2)}') // la normal sigue como {expr} (salida limpia)
  })

  it('hideTicks → `ticks=none` en el eje', () => {
    const out = compileToLatex(wrap([{ type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: 'x' }], domain: [-3, 3], hideTicks: true } }] }]))
    expect(out).toContain('ticks=none')
  })

  it('intersección de dos funciones → marcas en los cruces (computadas)', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [{ expr: 'x' }, { expr: 'x^2' }],
                domain: [-3, 3],
                range: [-3, 3],
                intersections: [{ a: { kind: 'function', i: 0 }, b: { kind: 'function', i: 1 }, label: 'P', showCoords: true }],
              },
            },
          ],
        },
      ]),
    )
    const markLine = out.split('\n').find((l) => l.includes('mark size=2pt')) ?? ''
    const coords = markLine.match(/\([^)]+\)/g) ?? []
    expect(coords).toContain('(0,0)') // cruce exacto (cae en un punto de muestreo)
    expect(coords).toHaveLength(2) // los dos cruces de y=x ∩ y=x² (el otro ~(1,1))
    expect(out).toContain('{$(0,\\, 0)$}') // showCoords: anotación de coordenadas en (0,0)
  })

  it('equalAxes → `axis equal image`; varias funciones ciclan colores', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: { functions: [{ expr: 'x' }, { expr: 'sin(x)' }], domain: [-3, 3], equalAxes: true },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('axis equal image')
    expect(out).toContain('\\addplot[smooth, color=blue] {x};')
    expect(out).toContain('\\addplot[smooth, color=red] {sin(x)};')
  })

  it('función deshabilitada no se dibuja, pero el color de índice se conserva', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: { functions: [{ expr: 'x', disabled: true }, { expr: 'sin(x)' }], domain: [-3, 3] },
            },
          ],
        },
      ]),
    )
    expect(out).not.toContain('{x};') // la deshabilitada (índice 0, azul) se omite
    expect(out).toContain('\\addplot[smooth, color=red] {sin(x)};') // la segunda mantiene su color (rojo, índice 1)
  })

  it('área bajo la curva → \\addplot fill …\\closedcycle (detrás de la curva)', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-3, 3], areas: [{ fn: 0, from: 0, to: 2 }] } }],
        },
      ]),
    )
    expect(out).toContain('\\addplot[draw=none, fill=blue, fill opacity=0.2, domain=0:2, forget plot] {(x ^ 2)} \\closedcycle;')
    // el área se emite ANTES que la curva (queda detrás)
    expect(out.indexOf('\\closedcycle')).toBeLessThan(out.indexOf('\\addplot[smooth'))
  })

  it('puntos marcados y líneas verticales', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [{ expr: 'x^2' }],
                domain: [-3, 3],
                points: [{ x: 1, y: 1, label: 'P' }],
                vlines: [{ x: 2, label: 'x=2' }],
              },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('\\addplot[only marks, mark=*, mark size=1.5pt, black, forget plot] coordinates {(1, 1)};')
    expect(out).toContain('at (axis cs:1,1) {P};')
    expect(out).toContain('\\draw[dashed, gray] ({axis cs:2,0} |- {rel axis cs:0,0}) -- ({axis cs:2,0} |- {rel axis cs:0,1});')
    expect(out).toContain('{x=2};')
  })

  it('propiedades por función: color, trazo (dashed) y dominio restringido', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: { functions: [{ expr: 'x^2', color: 'orange', style: 'dashed', domain: [0, 2] }], domain: [-3, 3] },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('\\addplot[smooth, color=orange, dashed, domain=0:2] {(x ^ 2)};')
  })

  it('área entre dos curvas → fillbetween con name path en ambas', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [{ expr: 'x^2' }, { expr: 'x' }],
                domain: [-1, 2],
                areas: [{ fn: 0, toFn: 1, from: 0, to: 1 }],
              },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('name path=matexf0')
    expect(out).toContain('name path=matexf1')
    expect(out).toContain('fill between[of=matexf0 and matexf1, soft clip={domain=0:1}]')
  })

  it('líneas horizontales, puntos huecos y posición de leyenda', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [{ expr: '1/x' }],
                domain: [-4, 4],
                legend: true,
                legendPos: 'bottom-right',
                hlines: [{ y: 0, label: 'asíntota' }],
                points: [{ x: 1, y: 1, open: true }],
              },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('legend pos=south east')
    expect(out).toContain('\\draw[dashed, gray] ({rel axis cs:0,0} |- {axis cs:0,0}) -- ({rel axis cs:1,0} |- {axis cs:0,0});')
    expect(out).toContain('{asíntota};')
    expect(out).toContain('\\addplot[only marks, mark=o, mark size=1.5pt, black, forget plot] coordinates {(1, 1)};')
  })

  it('serie de datos (scatter) → \\addplot coordinates con marcas (y línea opcional)', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [{ expr: 'x' }],
                domain: [-1, 3],
                legend: true,
                data: [{ points: [[0, 0], [1, 1], [2, 4]], legend: 'medidas', line: true, style: 'dashed' }],
              },
            },
          ],
        },
      ]),
    )
    // color tras las funciones (índice 1 = rojo); línea punteada + marcas
    expect(out).toContain('\\addplot[smooth, color=red, dashed, mark=*, mark size=1.5pt] coordinates {(0,0) (1,1) (2,4)};')
    expect(out).toContain('\\addlegendentry{medidas}')
  })

  it('curva paramétrica → \\addplot[parametric] ({x(t)}, {y(t)}) en t', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: { functions: [], domain: [-2, 2], parametrics: [{ x: 'cos(t)', y: 'sin(t)', tmin: 0, tmax: 6.283, style: 'dotted' }] },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('\\addplot[parametric, variable=t, smooth, samples=100, domain=0:6.283, color=blue, dotted] ({cos(t)}, {sin(t)});')
  })

  it('migración: legendPos pgfplots viejo (`south east`) → semántico (`bottom-right`) al cargar', () => {
    const doc = parseMatexDoc({
      type: 'doc',
      version: 4,
      content: [{ type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: 'x' }], domain: [-1, 1], legend: true, legendPos: 'south east' } }] }],
    })
    const item = (doc.content[0] as { items: { spec: { legendPos?: string } }[] }).items[0]
    expect(item!.spec.legendPos).toBe('bottom-right') // el modelo ya no guarda vocabulario de pgfplots
    expect(compileToLatex(doc)).toContain('legend pos=south east') // y el backend LaTeX lo re-traduce
  })

  it('título, muestreo y texto libre → title=, samples= y \\node', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [{ expr: 'sin(x)' }],
                domain: [-3, 3],
                title: 'Onda & co',
                samples: 300,
                texts: [{ x: 1, y: 0.5, text: 'pico' }],
              },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('title={Onda \\& co}')
    expect(out).toContain('samples=300')
    expect(out).toContain('\\node[font=\\footnotesize, inner sep=2pt] at (axis cs:1,0.5) {pico};')
  })

  it('series deshabilitadas (datos/paramétrica/polar) no se emiten', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [{ expr: 'x' }],
                domain: [-2, 2],
                data: [{ points: [[0, 0]], disabled: true }],
                parametrics: [{ x: 'cos(t)', y: 'sin(t)', tmin: 0, tmax: 6.283, disabled: true }],
                polars: [{ r: '1', tmin: 0, tmax: 6.283, disabled: true }],
              },
            },
          ],
        },
      ]),
    )
    expect(out).toContain('\\addplot[smooth, color=blue] {x};') // la función sí
    expect(out).not.toContain('only marks') // datos ocultos
    expect(out).not.toContain('parametric') // paramétrica y polar ocultas
  })

  it('curva polar r(θ) → paramétrica (r·cos t, r·sin t)', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [{ kind: 'plot', spec: { functions: [], domain: [-2, 2], polars: [{ r: '1 + cos(t)', tmin: 0, tmax: 6.283 }] } }],
        },
      ]),
    )
    expect(out).toContain('\\addplot[parametric, variable=t, smooth, samples=100, domain=0:6.283, color=blue] ({((1 + cos(t)))*cos(t)}, {((1 + cos(t)))*sin(t)});')
  })

  it('serie de datos sin línea → only marks', () => {
    const out = compileToLatex(
      wrap([{ type: 'figure', items: [{ kind: 'plot', spec: { functions: [], domain: [-1, 3], data: [{ points: [[0, 0]], open: true }] } }] }]),
    )
    expect(out).toContain('\\addplot[only marks, color=blue, mark=o, mark size=2pt] coordinates {(0,0)};')
  })

  it('tangente en un punto → recta con pendiente numérica + punto de tangencia', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-3, 3], tangents: [{ fn: 0, at: 1 }] } }],
        },
      ]),
    )
    // f(x)=x² en x=1: f(1)=1, f'(1)=2 → y = 1 + 2(x−1)
    expect(out).toContain('\\addplot[dashed, thick, color=blue, forget plot] {(1) + (2)*(x - (1))};')
    expect(out).toContain('\\addplot[only marks, mark=*, mark size=1.5pt, black, forget plot] coordinates {(1, 1)};')
  })

  it('ticks en π → xtick/xticklabels en múltiplos de π/2', () => {
    const out = compileToLatex(
      wrap([{ type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: 'sin(x)' }], domain: [-3.15, 3.15], piTicks: true } }] }]),
    )
    expect(out).toContain('xtick={')
    expect(out).toContain('xticklabels={')
    expect(out).toContain('$-\\pi$')
    expect(out).toContain('$\\frac{\\pi}{2}$')
    expect(out).toContain('$0$')
  })

  it('función partida → una curva por rama + leyenda \\begin{cases} + saltos ●/○', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [
                  {
                    expr: '',
                    legend: undefined,
                    markJumps: true,
                    pieces: [
                      { expr: '-1', from: -3, to: 0 },
                      { expr: '1', from: 0, to: 3 },
                    ],
                  },
                ],
                domain: [-3, 3],
                legend: true,
              },
            },
          ],
        },
      ]),
    )
    // una curva por rama (misma color); la 2ª con forget plot para no duplicar leyenda
    expect(out).toContain('\\addplot[smooth, color=blue, domain=-3:0] {(-1)};')
    expect(out).toContain('\\addplot[smooth, color=blue, domain=0:3, forget plot] {1};')
    // leyenda cases
    expect(out).toContain('\\addlegendentry{$f(x) = \\begin{cases}')
    expect(out).toContain('\\end{cases}$}')
    // salto en x=0 (−1 → 1): ● (incluido, rama derecha) y ○ (excluido, izquierda)
    expect(out).toContain('\\addplot[only marks, mark=*, mark size=1.5pt, black, forget plot] coordinates {(0, 1)};')
    expect(out).toContain('\\addplot[only marks, mark=o, mark size=1.5pt, black, forget plot] coordinates {(0, -1)};')
  })

  it('rótulos con matemática inline: `$…$` crudo, el resto texto escapado', () => {
    const out = compileToLatex(
      wrap([
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: { functions: [{ expr: 'sqrt(x)', legend: 'raíz & $\\sqrt{x}$' }], domain: [0, 4], legend: true },
            },
          ],
        },
      ]),
    )
    // el `&` se escapa (texto), el `$\sqrt{x}$` queda crudo (math)
    expect(out).toContain('\\addlegendentry{raíz \\& $\\sqrt{x}$}')
  })

  it('round-trip parse/serialize (imagen y gráfico)', () => {
    const doc = wrap([
      imgFig('a.png', { caption: 'Cap', id: 'f', label: 'fig:a' }, { width: 0.5 }),
      { type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: 'sin(x)' }], domain: [-6, 6] } }] },
    ])
    expect(parseMatexDoc(JSON.parse(serializeMatexDoc(doc)))).toEqual(doc)
  })

  it('migra la figura de 1 imagen (`src`) al contenedor de partes (`items`)', () => {
    const migrated = parseMatexDoc({
      type: 'doc',
      version: 4,
      content: [{ type: 'figure', src: 'a.png', width: 0.5, caption: 'C', id: 'f', label: 'fig:a' }],
    })
    expect(migrated.content[0]).toEqual({
      type: 'figure',
      caption: 'C',
      id: 'f',
      label: 'fig:a',
      items: [{ kind: 'image', src: 'a.png', width: 0.5 }],
    })
  })
})

describe('parse/serialize', () => {
  it('round-trip: serializar → parsear devuelve el mismo AST', () => {
    const restored = parseMatexDoc(JSON.parse(serializeMatexDoc(sample)))
    expect(restored).toEqual(sample)
  })

  it('valida la forma: rechaza un documento mal formado', () => {
    expect(() => parseMatexDoc({ type: 'doc' })).toThrow()
    // Una versión futura desconocida no se acepta (v4 es la actual).
    expect(() => parseMatexDoc({ type: 'doc', version: 5, content: [] })).toThrow()
  })

  it('acepta un documento vacío válido y normaliza su versión a la actual', () => {
    expect(parseMatexDoc({ type: 'doc', version: 1, content: [] })).toEqual({
      type: 'doc',
      version: 4,
      content: [],
    })
  })
})
