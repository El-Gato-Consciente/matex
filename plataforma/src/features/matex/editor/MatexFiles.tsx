import { useRef, useState } from 'react'
import { ChevronLeft, Download, Pencil, Plus, Trash, Upload } from '@/components/icons'
import type { ProjectFile } from '@/features/documents/types'

interface MatexFilesProps {
  /** Nombre base del documento → se muestra como `<docName>.mtex`. */
  docName: string
  images: readonly ProjectFile[]
  /** Recursos de texto (`.tex`/`.bib`/datos) subidos al proyecto (ME-12). */
  textFiles: readonly ProjectFile[]
  /** Nombres de imagen en uso por alguna figura (para el estado «en uso»/«sin usar»). */
  usedSrcs: Set<string>
  onUpload: (files: File[]) => void
  onInsertFigure: (name: string) => void
  onDeleteImage: (name: string) => void
  onDownloadImage: (name: string) => void
  /** Renombra una imagen (actualiza también las figuras que la usan). */
  onRename: (oldPath: string, newPath: string) => void
  /** Inserta `\input{path}` apuntando a un `.tex` subido. */
  onInsertInclude: (path: string) => void
  onDeleteText: (path: string) => void
  onDownloadText: (path: string) => void
  onRenameText: (oldPath: string, newPath: string) => void
  onDownloadMtex: () => void
  onCollapse: () => void
}

/** Etiqueta corta del tipo de recurso de texto por su extensión (para el badge). */
function textKind(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return ext === 'tex' ? 'tex' : ext === 'bib' ? 'bib' : ext === 'cls' || ext === 'sty' ? ext : 'datos'
}

/**
 * Explorador de **archivos del proyecto Matex**, con el mismo lenguaje visual que el de
 * los proyectos LaTeX (`ProjectFiles`): el documento (`.mtex`, la fuente de verdad) y las
 * imágenes subidas. **No** muestra el `main.tex` (derivado/efímero). Pensado para crecer
 * (bibliografía, includes, etc.). Acciones por ahora: subir/insertar/descargar/borrar imágenes.
 */
export function MatexFiles({
  docName,
  images,
  textFiles,
  usedSrcs,
  onUpload,
  onInsertFigure,
  onDeleteImage,
  onDownloadImage,
  onRename,
  onInsertInclude,
  onDeleteText,
  onDownloadText,
  onRenameText,
  onDownloadMtex,
  onCollapse,
}: MatexFilesProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const sorted = [...images].sort((a, b) => a.path.localeCompare(b.path))
  const sortedText = [...textFiles].sort((a, b) => a.path.localeCompare(b.path))
  const textPaths = new Set(textFiles.map((f) => f.path))
  // Renombrado inline: `renaming` = ruta en edición; `draft` = texto del input.
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const commitRename = (): void => {
    const from = renaming
    setRenaming(null)
    if (from && draft.trim() && draft.trim() !== from) (textPaths.has(from) ? onRenameText : onRename)(from, draft.trim())
  }

  return (
    <div className="flex h-full flex-col text-sm text-(--color-ink)">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">Archivos</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Subir archivos"
            title="Subir archivos al proyecto (imágenes, .tex, .bib, datos)"
            className="rounded-md p-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <Upload width={15} height={15} />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Colapsar panel"
            title="Colapsar panel"
            className="rounded-md p-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <ChevronLeft width={15} height={15} />
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.tex,.bib,.cls,.sty,.dat,.csv,.txt"
            aria-label="Subir archivos al proyecto"
            className="hidden"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? [])
              if (picked.length > 0) onUpload(picked)
              event.target.value = ''
            }}
          />
        </div>
      </header>

      <ul className="flex flex-col px-1.5 pb-2">
        {/* El documento en sí (AST). No se abre como texto: el editor visual es su editor. */}
        <li className="group flex items-center gap-1 rounded-md bg-(--color-surface-muted) pr-1">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left font-mono text-xs text-(--color-ink)">
            <span className="truncate">{docName}.mtex</span>
            <span className="shrink-0 rounded bg-(--color-primary) px-1.5 py-0.5 text-[10px] font-medium text-(--color-primary-ink)">
              documento
            </span>
          </div>
          <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
            <FileAction label="Descargar .mtex" onClick={onDownloadMtex}>
              <Download width={13} height={13} />
            </FileAction>
          </div>
        </li>

        {sorted.map((file) => {
          const used = usedSrcs.has(file.path)
          return (
            <li key={file.path} className="group flex items-center gap-1 rounded-md pr-1 hover:bg-(--color-surface-muted)">
              {renaming === file.path ? (
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    else if (e.key === 'Escape') setRenaming(null)
                  }}
                  autoFocus
                  aria-label={`Renombrar ${file.path}`}
                  className="min-w-0 flex-1 rounded border border-(--color-primary) bg-(--color-surface) px-2 py-1 font-mono text-xs text-(--color-ink) outline-none"
                />
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left font-mono text-xs text-(--color-ink-muted)">
                  <span className="truncate" title={file.path}>{file.path}</span>
                  <span className="shrink-0 rounded bg-(--color-surface) px-1 text-[10px]">img</span>
                  <span className={`shrink-0 text-[10px] ${used ? 'text-(--color-ink-muted)' : 'text-amber-600'}`}>
                    {used ? 'en uso' : 'sin usar'}
                  </span>
                </div>
              )}
              <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
                <FileAction label="Insertar como figura" onClick={() => onInsertFigure(file.path)}>
                  <Plus width={13} height={13} />
                </FileAction>
                <FileAction label="Renombrar" onClick={() => { setRenaming(file.path); setDraft(file.path) }}>
                  <Pencil width={13} height={13} />
                </FileAction>
                <FileAction label="Descargar" onClick={() => onDownloadImage(file.path)}>
                  <Download width={13} height={13} />
                </FileAction>
                <FileAction label="Eliminar" danger onClick={() => onDeleteImage(file.path)}>
                  <Trash width={13} height={13} />
                </FileAction>
              </div>
            </li>
          )
        })}

        {/* Recursos de texto (ME-12): `.tex` (se inserta con \input), `.bib` (bibliografía), datos. */}
        {sortedText.map((file) => {
          const kind = textKind(file.path)
          const isTex = file.path.toLowerCase().endsWith('.tex')
          return (
            <li key={file.path} className="group flex items-center gap-1 rounded-md pr-1 hover:bg-(--color-surface-muted)">
              {renaming === file.path ? (
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    else if (e.key === 'Escape') setRenaming(null)
                  }}
                  autoFocus
                  aria-label={`Renombrar ${file.path}`}
                  className="min-w-0 flex-1 rounded border border-(--color-primary) bg-(--color-surface) px-2 py-1 font-mono text-xs text-(--color-ink) outline-none"
                />
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left font-mono text-xs text-(--color-ink-muted)">
                  <span className="truncate" title={file.path}>{file.path}</span>
                  <span className="shrink-0 rounded bg-(--color-surface) px-1 text-[10px]">{kind}</span>
                </div>
              )}
              <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
                {isTex && (
                  <FileAction label="Insertar \input" onClick={() => onInsertInclude(file.path)}>
                    <Plus width={13} height={13} />
                  </FileAction>
                )}
                <FileAction label="Renombrar" onClick={() => { setRenaming(file.path); setDraft(file.path) }}>
                  <Pencil width={13} height={13} />
                </FileAction>
                <FileAction label="Descargar" onClick={() => onDownloadText(file.path)}>
                  <Download width={13} height={13} />
                </FileAction>
                <FileAction label="Eliminar" danger onClick={() => onDeleteText(file.path)}>
                  <Trash width={13} height={13} />
                </FileAction>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-auto px-3 py-2 text-xs text-(--color-ink-muted)">
        El <span className="font-medium">documento</span> (<code className="font-mono">.mtex</code>) es la fuente de verdad;
        el <code className="font-mono">main.tex</code> se genera al compilar. Subí <span className="font-medium">imágenes</span> (para figuras),
        <code className="font-mono"> .tex</code> (insertá con <code className="font-mono">\input</code>), <code className="font-mono">.bib</code> o datos.
      </p>
    </div>
  )
}

interface FileActionProps {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}

function FileAction({ label, danger, onClick, children }: FileActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'rounded p-1 text-(--color-ink-muted)',
        danger ? 'hover:text-(--color-danger)' : 'hover:text-(--color-ink)',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
