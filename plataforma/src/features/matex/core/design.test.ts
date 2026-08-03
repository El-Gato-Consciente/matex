import { describe, expect, it } from 'vitest'
import { compileToLatex, parseMatexDoc } from './index'
import { compileToHtml } from './html'
import type { MatexDoc } from './ast'

/**
 * **LE-02 · diseño semántico y migración v2→v3.**
 *
 * El AST dejó de guardar vocabulario de LaTeX: en vez de una línea `\documentclass` cruda y
 * nombres de temas de paquete (`metropolis`, `banking`, `Rays`), guarda **qué es** el documento
 * (`docKind`) y **cómo se ve** (`style`, `accent`, `paperSize`, `baseFontSize`). Cada backend
 * traduce eso a lo suyo. Estos tests cubren las dos mitades: que la traducción produzca el mismo
 * LaTeX de antes, y que los documentos v2 guardados se migren sin perder la intención.
 */

const doc = (meta: MatexDoc['meta'], content: MatexDoc['content'] = []): MatexDoc => ({ type: 'doc', version: 3, meta, content })

describe('LE-02 · la clase LaTeX se DERIVA del diseño semántico', () => {
  it('por defecto: artículo 11pt a4', () => {
    expect(compileToLatex(doc({ title: 'T' }))).toContain('\\documentclass[11pt,a4paper]{article}')
  })

  it('la estructura elige la clase, y con portada propia agrega la opción', () => {
    expect(compileToLatex(doc({ docKind: 'report', titlePage: true }))).toContain('\\documentclass[11pt,a4paper,titlepage]{report}')
    expect(compileToLatex(doc({ docKind: 'book' }))).toContain('\\documentclass[11pt,a4paper]{book}')
  })

  it('estructura = informe/libro ⇒ el primer nivel de encabezado es un capítulo', () => {
    const head: MatexDoc['content'] = [{ type: 'heading', level: 1, content: [{ type: 'text', text: 'Uno' }] }]
    expect(compileToLatex(doc({}, head))).toContain('\\section{Uno}')
    expect(compileToLatex(doc({ docKind: 'report' }, head))).toContain('\\chapter{Uno}')
    expect(compileToLatex(doc({ docKind: 'book' }, head))).toContain('\\chapter{Uno}')
  })

  it('diseño moderno ⇒ familia KOMA; papel y cuerpo salen de sus campos', () => {
    expect(compileToLatex(doc({ style: 'modern' }))).toContain('{scrartcl}')
    expect(compileToLatex(doc({ style: 'modern', docKind: 'report' }))).toContain('{scrreprt}')
    expect(compileToLatex(doc({ paperSize: 'letter', baseFontSize: 12 }))).toContain('\\documentclass[12pt,letterpaper]{article}')
  })

  it('cada familia traduce el MISMO diseño a su propio dialecto', () => {
    // Presentación → tema de beamer; CV → estilo de moderncv; póster → tema de tikzposter.
    expect(compileToLatex(doc({ family: { kind: 'presentation' }, style: 'modern' }))).toContain('\\usetheme{metropolis}')
    expect(compileToLatex(doc({ family: { kind: 'presentation' }, style: 'classic' }))).toContain('\\usetheme{Madrid}')
    expect(compileToLatex(doc({ family: { kind: 'presentation' }, accent: 'red' }))).toContain('\\usecolortheme{beaver}')
    expect(compileToLatex(doc({ family: { kind: 'cv', cv: {} }, style: 'modern' }))).toContain('\\moderncvstyle{casual}')
    expect(compileToLatex(doc({ family: { kind: 'cv', cv: {} }, accent: 'green' }))).toContain('\\moderncvcolor{green}')
    expect(compileToLatex(doc({ family: { kind: 'poster', poster: {} }, style: 'modern' }))).toContain('\\usetheme{Rays}')
    expect(compileToLatex(doc({ family: { kind: 'poster', poster: {} }, accent: 'blue' }))).toContain('\\usecolorpalette{BlueGrayOrange}')
  })

  it('diseño estándar en presentación ⇒ ningún \\usetheme (el default de beamer)', () => {
    expect(compileToLatex(doc({ family: { kind: 'presentation' } }))).not.toContain('\\usetheme')
  })

  it('columnas de página: `columns: 2` → `twocolumn` en el PDF; el HTML se proyecta a UNA columna', () => {
    expect(compileToLatex(doc({ columns: 2 }))).toContain('\\documentclass[11pt,a4paper,twocolumn]{article}')
    expect(compileToLatex(doc({}))).not.toContain('twocolumn')
    // La web no tiene páginas: dos columnas serían ilegibles → HTML a una columna (como arXiv).
    expect(compileToHtml(doc({ columns: 2 }), { standalone: false })).not.toContain('mx-twocolumn')
  })

  it('con título y dos columnas, el PDF cruza el título con `\\twocolumn[…]` (no queda en 1 columna)', () => {
    const tex = compileToLatex(doc({ title: 'Paper', columns: 2 }))
    expect(tex).toContain('\\twocolumn[')
    expect(tex).toContain('\\maketitle')
  })

  it('el backend HTML traduce el MISMO diseño a CSS (antes era intraducible)', () => {
    const html = compileToHtml(doc({ style: 'modern', accent: 'purple' }), { standalone: false })
    expect(html).toContain('mx-style-modern')
    expect(html).toContain('mx-accent-purple')
    // El diseño estándar no ensucia el marcado con clases vacías.
    expect(compileToHtml(doc({ style: 'standard' }), { standalone: false })).toContain('<article class="mx-doc">')
  })
})

describe('LE-02 · migración v2→v3 (documentos ya guardados)', () => {
  const migrate = (meta: Record<string, unknown>): Record<string, unknown> =>
    (parseMatexDoc({ type: 'doc', version: 2, meta, content: [] }).meta ?? {}) as unknown as Record<string, unknown>

  it('desarma la línea cruda \\documentclass en sus partes semánticas', () => {
    expect(migrate({ documentclass: '\\documentclass[11pt,a4paper,titlepage]{report}' })).toMatchObject({
      docKind: 'report',
      titlePage: true,
      baseFontSize: 11,
      paperSize: 'a4',
    })
    expect(migrate({ documentclass: '\\documentclass[12pt,letterpaper]{book}' })).toMatchObject({ docKind: 'book', baseFontSize: 12, paperSize: 'letter' })
    // El campo legado no sobrevive.
    expect(migrate({ documentclass: '\\documentclass{article}' })).not.toHaveProperty('documentclass')
  })

  it('una clase KOMA era una decisión de DISEÑO, no de estructura', () => {
    expect(migrate({ documentclass: '\\documentclass[11pt,a4paper]{scrartcl}' })).toMatchObject({ docKind: 'article', style: 'modern' })
    expect(migrate({ documentclass: '\\documentclass{scrreprt}' })).toMatchObject({ docKind: 'report', style: 'modern' })
  })

  it('los temas de beamer se colapsan a la familia de diseño más cercana', () => {
    expect(migrate({ presentation: true, theme: 'metropolis' })).toMatchObject({ style: 'modern' })
    expect(migrate({ presentation: true, theme: 'Madrid' })).toMatchObject({ style: 'classic' })
    expect(migrate({ presentation: true, colortheme: 'seahorse' })).toMatchObject({ accent: 'blue' })
    expect(migrate({ presentation: true, theme: 'Warsaw' })).not.toHaveProperty('theme')
  })

  it('estilo y color de moderncv suben al documento', () => {
    const meta = migrate({ cv: { style: 'casual', color: 'red', email: 'a@b.c' } })
    expect(meta).toMatchObject({ style: 'modern', accent: 'red' })
    // El contacto queda (el vocabulario del paquete se fue) y la migración de familia (v3→v4) lo
    // movió a `family.cv`.
    expect(meta.family).toEqual({ kind: 'cv', cv: { email: 'a@b.c' } })
  })

  it('tema y paleta de tikzposter, ídem (y las columnas se conservan)', () => {
    const meta = migrate({ poster: { columns: 3, theme: 'Rays', colorPalette: 'GreenGrayViolet' } })
    expect(meta).toMatchObject({ style: 'modern', accent: 'green' })
    expect(meta.family).toEqual({ kind: 'poster', poster: { columns: 3 } })
  })

  it('es conservadora: nunca pisa un campo semántico ya presente', () => {
    const meta = migrate({ docKind: 'book', style: 'classic', documentclass: '\\documentclass{scrartcl}' })
    expect(meta).toMatchObject({ docKind: 'book', style: 'classic' })
  })

  it('es idempotente: un documento ya en v4 pasa intacto', () => {
    const v4 = { type: 'doc', version: 4, meta: { docKind: 'report', style: 'modern', accent: 'blue' }, content: [] }
    expect(parseMatexDoc(v4)).toEqual(v4)
  })

  it('un informe v2 guardado sigue compilando al MISMO LaTeX que antes', () => {
    const guardado = parseMatexDoc({
      type: 'doc',
      version: 2,
      meta: { title: 'Informe', documentclass: '\\documentclass[11pt,a4paper,titlepage]{report}' },
      content: [{ type: 'heading', level: 1, content: [{ type: 'text', text: 'Uno' }] }],
    })
    const out = compileToLatex(guardado)
    expect(out).toContain('\\documentclass[11pt,a4paper,titlepage]{report}')
    expect(out).toContain('\\chapter{Uno}')
  })

  it('las puntas de flecha pasan del vocabulario de tikz-cd al del morfismo', () => {
    const parsed = parseMatexDoc({
      type: 'doc',
      version: 2,
      content: [
        {
          type: 'figure',
          items: [
            {
              kind: 'diagram',
              spec: {
                form: 'commutative',
                nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }],
                edges: [{ from: 'a', to: 'b', tip: 'hook' }],
              },
            },
          ],
        },
      ],
    })
    const fig = parsed.content[0]
    const item = fig?.type === 'figure' ? fig.items[0] : undefined
    expect(item?.kind === 'diagram' ? item.spec.edges[0]?.tip : undefined).toBe('mono')
    // Y el LaTeX emitido sigue siendo el mismo que producía `hook`.
    expect(compileToLatex(parsed)).toContain('hook')
  })
})

describe('AR-09 · migración v3→v4 (familias como unión discriminada)', () => {
  const migrate = (meta: Record<string, unknown>): Record<string, unknown> =>
    (parseMatexDoc({ type: 'doc', version: 3, meta, content: [] }).meta ?? {}) as unknown as Record<string, unknown>

  it('cada flag suelto se convierte en su `family`, y el flag legado desaparece', () => {
    expect(migrate({ presentation: true }).family).toEqual({ kind: 'presentation' })
    expect(migrate({ letter: { to: 'X' } }).family).toEqual({ kind: 'letter', letter: { to: 'X' } })
    expect(migrate({ cv: { email: 'a@b.c' } }).family).toEqual({ kind: 'cv', cv: { email: 'a@b.c' } })
    expect(migrate({ poster: { columns: 2 } }).family).toEqual({ kind: 'poster', poster: { columns: 2 } })
    expect(migrate({ letter: {} })).not.toHaveProperty('letter')
  })

  it('`exam.showSolutions` se DESCARTA (pasó a ser ocasión de emisión, opts) — FIX-20', () => {
    const meta = migrate({ exam: { showSolutions: true, instructions: 'Justificá.' } })
    expect(meta.family).toEqual({ kind: 'exam', exam: { instructions: 'Justificá.' } })
  })

  it('con varios flags (estado imposible viejo), gana la precedencia del compilador', () => {
    // presentación > carta > examen > CV > póster. La unión hace irrepresentable el resultado.
    expect(migrate({ letter: {}, presentation: true, cv: {} }).family).toEqual({ kind: 'presentation' })
    expect(migrate({ exam: {}, poster: {} }).family).toEqual({ kind: 'exam', exam: {} })
  })

  it('una carta v3 guardada compila al MISMO LaTeX que antes', () => {
    const guardado = parseMatexDoc({
      type: 'doc',
      version: 3,
      meta: { letter: { from: 'Ana', to: 'Dr. Pérez', opening: 'Estimado:' } },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cuerpo' }] }],
    })
    const out = compileToLatex(guardado)
    expect(out).toContain('{letter}')
    expect(out).toContain('\\opening{Estimado:}')
  })
})
