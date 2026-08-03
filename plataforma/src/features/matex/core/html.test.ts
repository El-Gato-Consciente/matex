import { describe, expect, it } from 'vitest'
import { compileToHtml } from './html'
import type { MatexDoc } from './ast'

describe('compileToHtml (LE-03 · segundo backend)', () => {
  it('documento standalone: estructura HTML + título + CSS embebido + MathML', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      meta: { title: 'Mi documento' },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hola ' }, { type: 'mathInline', tex: 'x^2' }] },
      ],
    }
    const html = compileToHtml(doc)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>Mi documento</title>')
    expect(html).toContain('<style>')
    expect(html).toContain('<h1 class="mx-title">Mi documento</h1>')
    // KaTeX → MathML (sin CSS/fuentes externas).
    expect(html).toContain('<math')
  })

  it('standalone:false devuelve solo el fragmento <article>', () => {
    const doc: MatexDoc = { type: 'doc', version: 3, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }
    const frag = compileToHtml(doc, { standalone: false })
    expect(frag.startsWith('<article class="mx-doc">')).toBe(true)
    expect(frag).not.toContain('<!doctype')
    expect(frag.trimEnd().endsWith('</article>')).toBe(true)
  })

  it('escapa el texto (no inyecta HTML)', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script> & "x"' }] }],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&amp;')
  })

  it('marcas → <strong>/<em>/<code>', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: ['strong', 'emph', 'code'] }] }],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('<strong><em><code>x</code></em></strong>')
  })

  it('headings numerados jerárquicamente + referencias cruzadas resueltas con link', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Intro' }], id: 's1', label: 'sec:intro' },
        { type: 'heading', level: 2, content: [{ type: 'text', text: 'Sub' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'ver ' }, { type: 'ref', target: 'sec:intro' }] },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('<span class="mx-secnum">1</span>')
    expect(html).toContain('<span class="mx-secnum">1.1</span>')
    expect(html).toContain('id="mx-sec-1"')
    expect(html).toContain('<a href="#mx-sec-1" class="mx-ref">sección 1</a>')
  })

  it('ecuación numerada: número (1) + ancla, y ref la resuelve a "ecuación (1)"', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'mathDisplay', rows: [{ tex: 'a=b', numbered: true, label: 'eq:x' }] },
        { type: 'paragraph', content: [{ type: 'ref', target: 'eq:x' }] },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('id="mx-eq-1"')
    expect(html).toContain('(1)')
    expect(html).toContain('ecuación (1)')
  })

  it('teorema numerado + proof diferido enlaza al teorema', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Sección' }] },
        { type: 'theorem', variant: 'theorem', title: 'Pitágoras', id: 't1', label: 'thm:pit', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'enunciado' }] }] },
        { type: 'theorem', variant: 'proof', proves: 'thm:pit', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'qed' }] }] },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    // Numeración POR SECCIÓN, como LaTeX (`\newtheorem{theorem}[section]`): el 1.er teorema
    // de la §1 es «1.1», no «1». Antes esto decía «Teorema 1» y fijaba el bug de FIX-18.
    expect(html).toContain('Teorema 1.1 (Pitágoras).')
    expect(html).toContain('id="mx-thm-1-1"')
    expect(html).toContain('Demostración de <a href="#mx-thm-1-1"')
  })

  it('derivación: grilla de pasos (matemática + nota), boxed sin &', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'derivation', title: 'Resolución', steps: [{ tex: 'x^2 - 1 &= 0', note: 'condición' }, { tex: 'x &= \\pm 1', boxed: true }] },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('class="mx-derivation"')
    expect(html).toContain('mx-deriv-step')
    expect(html).toContain('mx-deriv-note')
  })

  it('razonamiento: filas de dos columnas con contenido de bloque recursivo', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        {
          type: 'reasoning',
          title: 'Dos columnas',
          rows: [
            { left: [{ type: 'mathDisplay', rows: [{ tex: 'x=1' }] }], right: [{ type: 'paragraph', content: [{ type: 'text', text: 'condición' }] }], boxed: true },
          ],
        },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('class="mx-reasoning"')
    expect(html).toContain('mx-reasoning-row is-boxed')
    expect(html).toContain('condición')
  })

  it('tabla con caption → <table> + numeración + alineación por columna', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        {
          type: 'table',
          header: true,
          align: ['left', 'right'],
          caption: 'Datos',
          rows: [
            { type: 'tableRow', cells: [{ type: 'tableCell', content: [{ type: 'text', text: 'a' }] }, { type: 'tableCell', content: [{ type: 'text', text: 'b' }] }] },
            { type: 'tableRow', cells: [{ type: 'tableCell', content: [{ type: 'text', text: '1' }] }, { type: 'tableCell', content: [{ type: 'text', text: '2' }] }] },
          ],
        },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('<table class="mx-table">')
    expect(html).toContain('<thead>')
    expect(html).toContain('text-align:right')
    expect(html).toContain('Tabla 1')
  })

  it('figura con gráfico → SVG embebido + caption; imagen usa el data URI provisto', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'figure', caption: 'Parábola', items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-2, 2] } }] },
        { type: 'figure', items: [{ kind: 'image', src: 'foto.png', width: 0.5 }] },
      ],
    }
    const html = compileToHtml(doc, { standalone: false, images: { 'foto.png': 'data:image/png;base64,AAAA' } })
    expect(html).toContain('<svg')
    expect(html).toContain('Figura 1')
    expect(html).toContain('<img src="data:image/png;base64,AAAA"')
    expect(html).toContain('width:50%')
  })

  it('diagrama conmutativo → SVG (nodos como texto + flechas como path)', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        {
          type: 'figure',
          caption: 'Cuadrado',
          items: [
            {
              kind: 'diagram',
              spec: {
                form: 'commutative',
                nodes: [
                  { id: 'a', label: 'A', row: 0, col: 0 },
                  { id: 'b', label: 'B', row: 0, col: 1 },
                ],
                edges: [{ from: 'a', to: 'b', label: 'f' }],
              },
            },
          ],
        },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('<svg')
    expect(html).toContain('<path')
    expect(html).toContain('>A</text>')
    expect(html).toContain('>f</text>')
    expect(html).toContain('Figura 1')
  })

  it('plot con parámetro de rango → widget interactivo con renderer en vivo (ME-37), sin eval', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: 'a*x^2' }], domain: [-3, 3], parameters: [{ name: 'a', value: 1, min: -2, max: 2 }] } }] },
      ],
    }
    const html = compileToHtml(doc)
    expect(html).toContain('class="mx-plot-interactive"')
    expect(html).toContain('<input type="range"')
    expect(html).toContain('class="mx-plot-canvas"') // contenedor que se recomputa en vivo
    expect(html).toContain('__mxRenderPlot') // el runtime embebido
    expect(html).toContain('__mxInitPlot(') // la llamada parametrizada del controlador (AR-11)
    expect(html).not.toContain('class="mx-frame"') // ya no hay fotogramas
    expect(html).not.toContain('eval(') // el motor parsea la expresión, no hay eval de JS
  })

  it('el runtime y el controlador viven en el bundle; el HTML por widget solo llama (AR-11)', () => {
    const spec = { functions: [{ expr: 'a*x' }], domain: [-3, 3] as [number, number], parameters: [{ name: 'a', value: 1, min: -1, max: 1 }] }
    const doc: MatexDoc = { type: 'doc', version: 3, content: [{ type: 'figure', items: [{ kind: 'plot', spec }] }, { type: 'figure', items: [{ kind: 'plot', spec }] }] }
    const html = compileToHtml(doc)
    // La definición del runtime (el bundle) aparece UNA vez, aunque haya dos plots…
    expect((html.match(/__mxRenderPlot=/g) ?? []).length).toBe(1)
    expect((html.match(/__mxInitPlot=/g) ?? []).length).toBe(1) // el controlador también se define una vez
    // …y hay una llamada al inicializador por cada widget interactivo.
    expect((html.match(/class="mx-plot-interactive"/g) ?? []).length).toBe(2)
    expect((html.match(/window\.__mxInitPlot\(/g) ?? []).length).toBe(2)
  })

  it('muchos parámetros de rango (6) → un slider por cada uno, todos continuos', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'g']
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: names.join(' + ') + ' + x' }], domain: [-4, 4], parameters: names.map((n) => ({ name: n, value: 0, min: -1, max: 1 })) } }] },
      ],
    }
    const html = compileToHtml(doc)
    expect((html.match(/type="range"/g) ?? []).length).toBe(6) // los 6, sin límite de fotogramas
  })

  it('plot SIN parámetro → igual es interactivo (zoom/pan), pero sin sliders', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [{ type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-3, 3] } }] }],
    }
    const html = compileToHtml(doc)
    expect(html).toContain('mx-plot-interactive') // widget (zoom/pan) aunque no haya parámetros
    expect(html).toContain('mx-plot-reset') // botón de restablecer vista
    expect(html).toContain('__mxRenderPlot') // runtime embebido
    expect(html).not.toContain('type="range"') // pero ningún slider
    expect(html).toContain('<svg')
  })

  it('nota al pie → superíndice + lista al final', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'texto' }, { type: 'footnote', text: 'aclaración' }] }],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('class="mx-fnref"')
    expect(html).toContain('id="mx-fn-1"')
    expect(html).toContain('aclaración')
  })

  it('citas + bibliografía: la cita enlaza a la entrada, que tiene ancla', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      references: [{ key: 'knuth1984', type: 'book', author: 'D. Knuth', title: 'The TeXbook', year: '1984' }],
      content: [{ type: 'paragraph', content: [{ type: 'cite', keys: ['knuth1984'] }] }],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('<a href="#mx-bib-knuth1984"')
    expect(html).toContain('id="mx-bib-knuth1984"')
    expect(html).toContain('The TeXbook')
  })

  it('escotillas: rawLatex e include emiten aviso, no rompen', () => {
    const doc: MatexDoc = {
      type: 'doc',
      version: 3,
      content: [
        { type: 'rawLatex', latex: '\\vspace{1em}' },
        { type: 'include', target: 'figuras/x.tex' },
      ],
    }
    const html = compileToHtml(doc, { standalone: false })
    expect(html).toContain('LaTeX crudo omitido')
    expect(html).toContain('figuras/x.tex')
    expect(html).not.toContain('\\vspace')
  })
})

/**
 * Las cuatro **familias de documento** que ME-23 sumó al modelo (carta · examen · CV ·
 * póster). El backend LaTeX ya las cubría; estos tests las cubren del lado HTML, para que
 * la tesis "un AST → dos salidas **de calidad**" valga también para ellas.
 */
describe('compileToHtml · familias de documento (ME-23)', () => {
  describe('carta', () => {
    it('encabezado: remitente, fecha, destinatario y saludo; las direcciones van por renglón', () => {
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: {
          date: '21 de julio de 2026',
          family: {
            kind: 'letter',
            letter: {
              from: 'Rodrigo Martín',
              fromAddress: 'Av. Siempreviva 742\nBuenos Aires',
              to: 'Comité Editorial',
              toAddress: 'Revista de Matemática',
              opening: 'Estimado comité:',
            },
          },
        },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Adjunto el manuscrito.' }] }],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect(html).toContain('class="mx-letter-from"')
      expect(html).toContain('<div>Av. Siempreviva 742</div><div>Buenos Aires</div>')
      expect(html).toContain('class="mx-letter-to"')
      expect(html).toContain('Comité Editorial')
      expect(html).toContain('<p class="mx-letter-opening">Estimado comité:</p>')
      expect(html).toContain('21 de julio de 2026')
    })

    it('cierre tras el cuerpo: despedida, firma, adjuntos y copias', () => {
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: {
          family: { kind: 'letter', letter: { from: 'R. Martín', closing: 'Cordialmente,', signature: 'Rodrigo Martín', encl: 'manuscrito.pdf', cc: 'Secretaría' } },
        },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cuerpo' }] }],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect(html).toContain('<p class="mx-letter-closing">Cordialmente,</p>')
      expect(html).toContain('<p class="mx-letter-sign">Rodrigo Martín</p>')
      expect(html).toContain('Adjuntos: manuscrito.pdf')
      expect(html).toContain('Copia: Secretaría')
      // El cierre va DESPUÉS del cuerpo, no antes.
      expect(html.indexOf('cuerpo')).toBeLessThan(html.indexOf('mx-letter-closing'))
    })

    it('defaults: saludo y despedida estándar; sin firma propia, firma el remitente', () => {
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: { title: 'No debería salir como portada', family: { kind: 'letter', letter: { from: 'Ana Gómez', to: 'Dirección' } } },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cuerpo' }] }],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect(html).toContain('Estimado/a:')
      expect(html).toContain('Saludos cordiales,')
      expect(html).toContain('<p class="mx-letter-sign">Ana Gómez</p>')
      // En modo carta no hay portada: el título no se imprime como encabezado del documento.
      expect(html).not.toContain('class="mx-title"')
    })
  })

  describe('examen', () => {
    it('preguntas consecutivas → una sola lista numerada, con su puntaje y la consigna general', () => {
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: { title: 'Parcial 1', family: { kind: 'exam', exam: { instructions: 'Justificar cada respuesta.' } } },
        content: [
          { type: 'examQuestion', points: 20, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Derivar f(x)=x^2.' }] }] },
          { type: 'examQuestion', points: 30, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Integrar g(x)=1/x.' }] }] },
        ],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect((html.match(/<ol class="mx-questions">/g) ?? []).length).toBe(1)
      expect((html.match(/<li class="mx-question">/g) ?? []).length).toBe(2)
      expect(html).toContain('20 pts')
      expect(html).toContain('Justificar cada respuesta.')
    })

    it('EL MISMO AST da la versión del alumno y la del docente según opts.showSolutions (FIX-20)', () => {
      const content: MatexDoc['content'] = [
        {
          type: 'examQuestion',
          points: 10,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Enunciado' }] }],
          solution: [{ type: 'paragraph', content: [{ type: 'text', text: 'La respuesta es 42' }] }],
        },
      ]
      // El mismo documento (family: exam); la versión la elige la OCASIÓN de emisión (opts), no el AST.
      const exam: MatexDoc = { type: 'doc', version: 4, meta: { family: { kind: 'exam', exam: {} } }, content }
      const alumno = compileToHtml(exam, { standalone: false })
      const docente = compileToHtml(exam, { standalone: false, showSolutions: true })

      expect(alumno).toContain('Enunciado')
      expect(alumno).not.toContain('La respuesta es 42')
      expect(docente).toContain('La respuesta es 42')
      expect(docente).toContain('mx-q-solution')
    })
  })

  describe('CV', () => {
    it('entrada de trayectoria: período, rol, organización, lugar y detalle', () => {
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: { author: 'Ana Gómez', family: { kind: 'cv', cv: {} } },
        content: [
          { type: 'heading', level: 1, content: [{ type: 'text', text: 'Formación' }] },
          { type: 'cvEntry', period: '2020–2024', role: 'Lic. en Matemática', org: 'UAI', place: 'Buenos Aires', detail: 'Promedio 9.1' },
        ],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect(html).toContain('class="mx-cv-entry"')
      expect(html).toContain('2020–2024')
      expect(html).toContain('Lic. en Matemática')
      expect(html).toContain('UAI')
      expect(html).toContain('Buenos Aires')
      expect(html).toContain('Promedio 9.1')
    })

    it('los datos de contacto del CV llegan al HTML (no son solo del backend LaTeX)', () => {
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: { author: 'Ana Gómez', family: { kind: 'cv', cv: { subtitle: 'Lic. en Matemática', email: 'ana@ejemplo.com', address: 'Buenos Aires' } } },
        content: [{ type: 'cvEntry', period: '2024', role: 'Docente', org: 'UAI' }],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect(html).toContain('Ana Gómez')
      expect(html).toContain('Lic. en Matemática')
      expect(html).toContain('ana@ejemplo.com')
      expect(html).toContain('Buenos Aires')
    })
  })

  describe('póster', () => {
    it('bloque de póster: recuadro con título y contenido rico', () => {
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: { title: 'Método de Newton', family: { kind: 'poster', poster: {} } },
        content: [
          {
            type: 'posterBlock',
            title: 'Motivación',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Buscamos raíces de ' }, { type: 'mathInline', tex: 'f(x)=0' }] },
            ],
          },
        ],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect(html).toContain('class="mx-poster-block"')
      expect(html).toContain('<h3>Motivación</h3>')
      expect(html).toContain('<math')
    })

    it('la grilla de columnas del póster se respeta (misma maquetación que el PDF)', () => {
      const block = (t: string): MatexDoc['content'][number] => ({
        type: 'posterBlock',
        title: t,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
      })
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: { title: 'Póster', family: { kind: 'poster', poster: { columns: 2 } } },
        content: [block('A'), block('B'), block('C'), block('D')],
      }
      const html = compileToHtml(doc, { standalone: false })
      expect(html).toContain('class="mx-poster-cols"')
      expect((html.match(/class="mx-poster-col"/g) ?? []).length).toBe(2)
    })

    it('un bloque puede fijar su columna (column es 1-based, como en el backend LaTeX)', () => {
      const block = (t: string, column?: number): MatexDoc['content'][number] => ({
        type: 'posterBlock',
        title: t,
        ...(column != null ? { column } : {}),
        content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
      })
      const doc: MatexDoc = {
        type: 'doc',
        version: 3,
        meta: { family: { kind: 'poster', poster: { columns: 2 } } },
        content: [block('A'), block('fijo', 2), block('C')],
      }
      const html = compileToHtml(doc, { standalone: false })
      const cols = html.split('class="mx-poster-col"')
      // El bloque fijado cae en la SEGUNDA columna, no donde lo pondría el reparto por orden.
      expect(cols[2]).toContain('fijo')
      expect(cols[1]).not.toContain('fijo')
    })
  })
})
