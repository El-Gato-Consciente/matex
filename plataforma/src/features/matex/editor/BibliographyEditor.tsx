import { useState } from 'react'
import { ChevronDown } from '@/components/icons'
import { autoKey, parseBibtex, type BibEntry, type BibEntryType, type BibStyle } from '../core'

/**
 * **Editor visual de la biblioteca de referencias** (contenido del modal de Bibliografía).
 * Recibe la biblioteca (`entries`, nivel documento) + estilo/título, y sus callbacks. Cada
 * entrada se edita con un **formulario** (tipo + campos relevantes, clave auto), nunca
 * sintaxis BibTeX. Botón **Importar BibTeX** para pegar un `.bib` (Zotero/Scholar/Mendeley) y
 * parsearlo. El compilador emite el `.bib` real (`biblatex`+`biber`) desde esta estructura.
 */

const TYPE_LABEL: Record<BibEntryType, string> = {
  book: 'Libro',
  article: 'Artículo',
  incollection: 'Capítulo de libro',
  inproceedings: 'Ponencia (actas)',
  thesis: 'Tesis',
  online: 'Recurso web',
  misc: 'Otro',
}
const TYPES = Object.keys(TYPE_LABEL) as BibEntryType[]

type Field = Exclude<keyof BibEntry, 'key' | 'type'>
const FIELD_LABEL: Record<Field, string> = {
  author: 'Autor(es)',
  title: 'Título',
  year: 'Año',
  journal: 'Revista',
  booktitle: 'En (libro/actas)',
  publisher: 'Editorial',
  institution: 'Institución',
  volume: 'Volumen',
  number: 'Número',
  pages: 'Páginas',
  edition: 'Edición',
  doi: 'DOI',
  url: 'URL',
  note: 'Nota',
}
/** Campos que muestra el formulario según el tipo (los demás no aplican a ese tipo). */
const FIELDS_BY_TYPE: Record<BibEntryType, Field[]> = {
  book: ['author', 'title', 'year', 'publisher', 'edition', 'volume', 'doi', 'url', 'note'],
  article: ['author', 'title', 'journal', 'year', 'volume', 'number', 'pages', 'doi', 'url', 'note'],
  incollection: ['author', 'title', 'booktitle', 'publisher', 'year', 'pages', 'doi', 'url', 'note'],
  inproceedings: ['author', 'title', 'booktitle', 'year', 'pages', 'doi', 'url', 'note'],
  thesis: ['author', 'title', 'institution', 'year', 'url', 'note'],
  online: ['author', 'title', 'year', 'url', 'note'],
  misc: ['author', 'title', 'year', 'url', 'note'],
}

/** Autor(es) → «Apellido, N.» corto para el encabezado de la tarjeta. */
function shortLabel(e: BibEntry): string {
  const author = (e.author ?? '').split(/\s+and\s+/)[0]?.trim() ?? ''
  const who = author || '(sin autor)'
  const year = e.year ? ` (${e.year})` : ''
  const title = e.title ? ` · ${e.title}` : ''
  return `${who}${year}${title}`
}

const INPUT = 'rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)'

interface Props {
  entries: BibEntry[]
  onEntries: (entries: BibEntry[]) => void
  style: BibStyle
  onStyle: (style: BibStyle) => void
  title: string
  onTitle: (title: string) => void
}

export function BibliographyEditor({ entries, onEntries, style, onStyle, title, onTitle }: Props) {
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [expanded, setExpanded] = useState<number | null>(entries.length === 0 ? null : 0)

  const setEntry = (i: number, patch: Partial<BibEntry>): void =>
    onEntries(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const setField = (i: number, field: Field, value: string): void =>
    setEntry(i, { [field]: value.trim() ? value : undefined })
  const addEntry = (): void => {
    onEntries([...entries, { key: '', type: 'book' }])
    setExpanded(entries.length)
  }
  const removeEntry = (i: number): void => {
    onEntries(entries.filter((_, j) => j !== i))
    setExpanded(null)
  }
  const doImport = (): void => {
    const parsed = parseBibtex(importText)
    if (parsed.length > 0) onEntries([...entries, ...parsed])
    setImportText('')
    setImporting(false)
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Ajustes de la lista: estilo biblatex + título del encabezado. */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Estilo de citas y de la lista (biblatex).">
          Estilo
          <select value={style} onChange={(e) => onStyle(e.target.value as BibStyle)} className={INPUT}>
            <option value="numeric">Numérico [1]</option>
            <option value="authoryear">Autor-año (Knuth 1984)</option>
            <option value="alphabetic">Alfabético [Knu84]</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Encabezado de la lista (por defecto «Referencias»).">
          Título
          <input value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Referencias" className={`w-40 ${INPUT}`} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addEntry} className="rounded bg-(--color-primary) px-2 py-1 font-medium text-(--color-primary-ink)">
          + Entrada
        </button>
        <button type="button" onClick={() => setImporting((v) => !v)} className={`rounded border border-(--color-border) px-2 py-1 text-(--color-ink) ${importing ? 'bg-(--color-surface-muted)' : ''}`}>
          Importar BibTeX…
        </button>
        <span className="text-(--color-ink-muted)">{entries.length} {entries.length === 1 ? 'referencia' : 'referencias'}</span>
      </div>

      {importing && (
        <div className="flex flex-col gap-1.5 rounded border border-(--color-border) bg-(--color-surface) p-2">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'Pegá tu .bib aquí (Zotero, Google Scholar → "Citar" → BibTeX, Mendeley…)\n\n@book{knuth1984, author={Knuth, Donald E.}, title={The TeXbook}, year={1984}}'}
            rows={6}
            className={`w-full resize-y font-mono ${INPUT}`}
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={doImport} className="rounded bg-(--color-primary) px-2 py-1 font-medium text-(--color-primary-ink)">
              Importar {parseBibtex(importText).length > 0 ? `(${parseBibtex(importText).length})` : ''}
            </button>
            <span className="text-(--color-ink-muted)">Se agregan a la lista como entradas editables.</span>
          </div>
        </div>
      )}

      {entries.length === 0 && !importing && (
        <p className="text-(--color-ink-muted)">Sin referencias todavía. Agregá una entrada o importá tu `.bib`.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {entries.map((e, i) => {
          const isOpen = expanded === i
          const effectiveKey = e.key.trim() || autoKey(e)
          return (
            <div key={i} className="rounded border border-(--color-border) bg-(--color-surface)">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button type="button" onClick={() => setExpanded(isOpen ? null : i)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-(--color-ink)">
                  <ChevronDown className={['h-3 w-3 shrink-0 transition-transform', isOpen ? '' : '-rotate-90'].join(' ')} />
                  <span className="truncate">{shortLabel(e)}</span>
                </button>
                <span className="shrink-0 rounded bg-(--color-surface-muted) px-1.5 py-0.5 font-mono text-[0.7rem] text-(--color-ink-muted)">{effectiveKey}</span>
                <span className="shrink-0 text-(--color-ink-muted)">{TYPE_LABEL[e.type]}</span>
                <button type="button" onClick={() => removeEntry(i)} title="Quitar entrada" className="shrink-0 rounded px-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted)">
                  ✕
                </button>
              </div>

              {isOpen && (
                <div className="flex flex-col gap-2 border-t border-(--color-border) p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
                      Tipo
                      <select value={e.type} onChange={(ev) => setEntry(i, { type: ev.target.value as BibEntryType })} className={INPUT}>
                        {TYPES.map((t) => (
                          <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Clave de cita (la que usás al citar). Auto = apellido+año.">
                      Clave
                      <input value={e.key} onChange={(ev) => setEntry(i, { key: ev.target.value })} placeholder={autoKey(e)} className={`w-32 font-mono ${INPUT}`} />
                    </label>
                    <button type="button" onClick={() => setEntry(i, { key: autoKey(e) })} title="Generar clave desde autor+año" className="rounded border border-(--color-border) px-1.5 py-0.5 text-(--color-ink-muted) hover:bg-(--color-surface-muted)">
                      ↻ auto
                    </button>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
                    {FIELDS_BY_TYPE[e.type].map((f) => (
                      <label key={f} className="contents">
                        <span className="text-(--color-ink-muted)">{FIELD_LABEL[f]}</span>
                        <input value={e[f] ?? ''} onChange={(ev) => setField(i, f, ev.target.value)} className={`w-full ${INPUT}`} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
