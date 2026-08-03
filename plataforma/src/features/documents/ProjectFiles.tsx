import { useRef } from 'react'
import { ChevronLeft, Check, Download, Pencil, Plus, Trash, Upload } from '@/components/icons'
import { isBinary, type ProjectFile } from './types'

interface ProjectFilesProps {
  files: readonly ProjectFile[]
  activePath: string
  mainFile: string
  onSelect: (path: string) => void
  onAdd: () => void
  onUpload: (files: File[]) => void
  onRename: (path: string) => void
  onDelete: (path: string) => void
  onDownload: (path: string) => void
  onSetMain: (path: string) => void
  onCollapse: () => void
}

/**
 * Panel de **archivos del proyecto** (multi-archivo). Cambiar de archivo activo,
 * crear, **subir** (texto o binario), descargar, renombrar/eliminar y elegir el
 * **principal** (el que se compila). Va en el panel izquierdo del workspace.
 */
export function ProjectFiles({
  files,
  activePath,
  mainFile,
  onSelect,
  onAdd,
  onUpload,
  onRename,
  onDelete,
  onDownload,
  onSetMain,
  onCollapse,
}: ProjectFilesProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))

  return (
    <div className="flex h-full flex-col text-sm text-(--color-ink)">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">Archivos</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Nuevo archivo"
            title="Nuevo archivo"
            className="rounded-md p-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <Plus width={15} height={15} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Subir archivos"
            title="Subir archivos (texto o imágenes)"
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
            <ChevronLeft />
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
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
        {sorted.map((file) => {
          const active = file.path === activePath
          const main = file.path === mainFile
          const binary = isBinary(file)
          return (
            <li
              key={file.path}
              className={[
                'group flex items-center gap-1 rounded-md pr-1',
                active ? 'bg-(--color-surface-muted)' : 'hover:bg-(--color-surface-muted)',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => onSelect(file.path)}
                className={[
                  'flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left font-mono text-xs',
                  active ? 'text-(--color-ink)' : 'text-(--color-ink-muted)',
                ].join(' ')}
              >
                <span className="truncate">{file.path}</span>
                {binary && (
                  <span className="shrink-0 rounded bg-(--color-surface) px-1 text-[10px] text-(--color-ink-muted)">bin</span>
                )}
                {main && (
                  <span className="shrink-0 rounded bg-(--color-primary) px-1.5 py-0.5 text-[10px] font-medium text-(--color-primary-ink)">
                    principal
                  </span>
                )}
              </button>
              <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
                {!main && !binary && (
                  <FileAction label="Hacer principal" onClick={() => onSetMain(file.path)}>
                    <Check width={13} height={13} />
                  </FileAction>
                )}
                <FileAction label="Descargar" onClick={() => onDownload(file.path)}>
                  <Download width={13} height={13} />
                </FileAction>
                <FileAction label="Renombrar" onClick={() => onRename(file.path)}>
                  <Pencil width={13} height={13} />
                </FileAction>
                {!main && (
                  <FileAction label="Eliminar" danger onClick={() => onDelete(file.path)}>
                    <Trash width={13} height={13} />
                  </FileAction>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-auto px-3 py-2 text-xs text-(--color-ink-muted)">
        El archivo <span className="font-medium">principal</span> es el que se compila. Subí imágenes y usalas con{' '}
        <code className="font-mono">\includegraphics</code>; referenciá los demás con{' '}
        <code className="font-mono">\input</code>.
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
