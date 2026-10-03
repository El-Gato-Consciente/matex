import type { BibEntry, BibEntryType } from './ast'

/**
 * **BibTeX ↔ estructura** (funciones puras). Matex guarda las referencias como registros
 * estructurados ([[BibEntry]]); acá vive la única capa que toca la sintaxis `.bib`:
 * - `emitBibtex`: estructura → texto `.bib` (para el `filecontents` que compila biblatex).
 * - `parseBibtex`: texto `.bib` → estructura (para **importar** de Zotero/Scholar/Mendeley
 *   y para **migrar** documentos viejos que guardaban el `.bib` como string).
 * - `autoKey`: clave de cita sugerida a partir de autor+año (`apellido+año`).
 *
 * Es un parser/emisor **pragmático** (el subconjunto de biblatex que el modelo expone), no
 * un BibTeX completo: alcanza para los tipos/campos del editor; el resto se ignora al
 * importar (no rompe).
 */

/** Campos que se emiten al `.bib`, en orden legible. Nombres 1:1 con biblatex. */
const BIB_FIELDS: readonly (keyof BibEntry)[] = [
  'author', 'title', 'year', 'journal', 'booktitle', 'publisher', 'institution',
  'volume', 'number', 'pages', 'edition', 'doi', 'url', 'note',
]

const BIB_TYPES: readonly BibEntryType[] = ['book', 'article', 'incollection', 'inproceedings', 'thesis', 'online', 'misc']

/** Normaliza un tipo BibTeX importado al subconjunto del modelo (default `misc`). */
function normalizeType(raw: string): BibEntryType {
  const t = raw.toLowerCase()
  if ((BIB_TYPES as readonly string[]).includes(t)) return t as BibEntryType
  if (t === 'phdthesis' || t === 'mastersthesis') return 'thesis'
  if (t === 'conference') return 'inproceedings'
  if (t === 'electronic' || t === 'www' || t === 'webpage') return 'online'
  if (t === 'inbook') return 'incollection'
  return 'misc'
}

/** Clave de cita sugerida: `apellido+año` en minúsculas y sin acentos (o `ref` si no hay datos). */
export function autoKey(entry: { author?: string | undefined; year?: string | undefined }): string {
  const first = (entry.author ?? '').split(/\s+and\s+/)[0] ?? ''
  const last = first.includes(',') ? (first.split(',')[0] ?? '') : (first.trim().split(/\s+/).pop() ?? '')
  // NFD + quitar todo lo que no sea a–z: descompone y elimina acentos/ñ (marcas combinantes).
  const name = last.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()
  const year = (entry.year ?? '').replace(/[^0-9]/g, '')
  return `${name}${year}` || 'ref'
}

/** ¿Parece un nombre completo? (dos palabras o más, o ya en forma «Apellido, Nombre»). */
const isFullName = (name: string): boolean => name.includes(',') || name.trim().split(/\s+/).length >= 2

/**
 * Lista de autores **como la escribe una persona** → la forma que entiende BibTeX
 * (`A and B and C`). BibTeX separa autores SOLO con ` and `, y lee una coma como
 * «Apellido, Nombre»: «A. Quarteroni, R. Sacco y F. Saleri» le parece UN autor de apellido
 * «A. Quarteroni», y sale impreso «R. Sacco y F. Saleri A. Quarteroni».
 *
 * Solo se toca lo que no es ambiguo:
 *  - Si ya trae ` and `, está en forma BibTeX: no se toca.
 *  - ` y `, ` & ` y `;` separan autores, pero solo si cada lado es un nombre completo
 *    («Ortega y Gasset, José» es una persona: «Ortega» solo no es un nombre completo).
 *  - Adentro de esa lista, las comas separan autores solo si todos los tramos son nombres
 *    completos («A. Quarteroni, R. Sacco»); «Knuth, Donald E.» queda como está.
 */
export function normalizeAuthors(raw: string): string {
  const value = raw.trim()
  if (/\s+and\s+/i.test(value) || value.includes('{')) return value
  const parts = value.split(/\s+y\s+|\s*&\s*|\s*;\s*/).map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2 || !parts.every(isFullName)) return value
  const authors = parts.flatMap((part) => {
    const pieces = part.split(/\s*,\s*/)
    return pieces.length > 1 && pieces.every((piece) => piece.split(/\s+/).length >= 2) ? pieces : [part]
  })
  return authors.join(' and ')
}

/** Una entrada estructurada → bloque `@type{key, campo = {valor}, …}`. */
function emitEntry(entry: BibEntry): string {
  const key = entry.key.trim() || autoKey(entry)
  const lines = BIB_FIELDS.flatMap((f) => {
    const v = entry[f]
    if (typeof v !== 'string' || !v.trim()) return []
    return [`  ${f} = {${f === 'author' ? normalizeAuthors(v) : v.trim()}}`]
  })
  return `@${entry.type}{${key},\n${lines.join(',\n')}${lines.length > 0 ? ',' : ''}\n}`
}

/** Biblioteca estructurada → texto `.bib` completo. */
export function emitBibtex(entries: readonly BibEntry[]): string {
  return entries.map(emitEntry).join('\n\n')
}

/** Índice de `ch` en `s` al nivel 0 de llaves (ignora los que están dentro de `{…}`), o -1. */
function indexAtDepth0(s: string, ch: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]
    if (c === '{') depth += 1
    else if (c === '}') depth = Math.max(0, depth - 1)
    else if (c === ch && depth === 0) return i
  }
  return -1
}

/** Parsea el cuerpo `key, campo = valor, …` de una entrada (ya sin `@type{…}`). */
function parseEntryBody(body: string, rawType: string): BibEntry | null {
  const comma = indexAtDepth0(body, ',')
  const key = (comma < 0 ? body : body.slice(0, comma)).trim()
  if (!key) return null
  const entry: BibEntry = { key, type: normalizeType(rawType) }
  const known = new Set<string>(BIB_FIELDS as readonly string[])

  let rest = comma < 0 ? '' : body.slice(comma + 1)
  while (rest.length > 0) {
    const eq = rest.indexOf('=')
    if (eq < 0) break
    const rawName = rest.slice(0, eq).trim().toLowerCase()
    // Alias comunes de importación → nombres del modelo.
    const name = rawName === 'school' ? 'institution' : rawName === 'date' ? 'year' : rawName
    let q = eq + 1
    while (q < rest.length && /\s/.test(rest[q] ?? '')) q += 1
    let value = ''
    const open = rest[q]
    if (open === '{') {
      let depth = 1
      q += 1
      const start = q
      while (q < rest.length && depth > 0) {
        if (rest[q] === '{') depth += 1
        else if (rest[q] === '}') depth -= 1
        if (depth === 0) break
        q += 1
      }
      value = rest.slice(start, q)
      q += 1
    } else if (open === '"') {
      q += 1
      const start = q
      while (q < rest.length && rest[q] !== '"') q += 1
      value = rest.slice(start, q)
      q += 1
    } else {
      const start = q
      while (q < rest.length && rest[q] !== ',') q += 1
      value = rest.slice(start, q).trim()
    }
    const clean = value.replace(/\s+/g, ' ').trim()
    // `date = {1984-05}` (biblatex) → tomamos el año.
    if (name === 'year' && clean) entry.year = clean.slice(0, 4)
    else if (known.has(name) && clean) (entry as unknown as Record<string, string>)[name] = clean
    const after = rest.slice(q)
    const nextComma = indexAtDepth0(after, ',')
    if (nextComma < 0) break
    rest = after.slice(nextComma + 1)
  }
  return entry
}

/** Texto `.bib` (pegado o migrado) → entradas estructuradas. Ignora lo que no reconoce. */
export function parseBibtex(src: string): BibEntry[] {
  const entries: BibEntry[] = []
  let i = 0
  while (i < src.length) {
    const at = src.indexOf('@', i)
    if (at < 0) break
    let j = at + 1
    let type = ''
    while (j < src.length && /[a-zA-Z]/.test(src[j] ?? '')) {
      type += src[j]
      j += 1
    }
    while (j < src.length && /\s/.test(src[j] ?? '')) j += 1
    if (src[j] !== '{') {
      i = j
      continue
    }
    // `@comment`/`@string`/`@preamble` no son entradas: se saltean.
    if (type.toLowerCase() === 'comment' || type.toLowerCase() === 'string' || type.toLowerCase() === 'preamble') {
      i = j + 1
      continue
    }
    j += 1
    let depth = 1
    const start = j
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth += 1
      else if (src[j] === '}') depth -= 1
      if (depth === 0) break
      j += 1
    }
    const parsed = parseEntryBody(src.slice(start, j), type)
    if (parsed) entries.push(parsed)
    i = j + 1
  }
  return entries
}
