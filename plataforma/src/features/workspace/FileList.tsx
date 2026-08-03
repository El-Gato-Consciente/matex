import { ChevronLeft } from '@/components/icons'

interface FileEntry {
  path: string
  // `| undefined` explícito por `exactOptionalPropertyTypes`: los archivos vienen
  // de datos zod (ejemplares/lecciones), cuyo `encoding` es `… | undefined`.
  encoding?: 'utf8' | 'base64' | undefined
}

interface FileListProps {
  title?: string
  files: ReadonlyArray<FileEntry>
  activePath: string
  mainFile: string
  onSelect: (path: string) => void
  onCollapse?: () => void
}

/**
 * Panel **de solo lectura** con la lista de archivos del proyecto (vertical, como
 * un explorador). Lo usa la Galería en el panel izquierdo del workspace. Para
 * editar/crear/borrar está `documents/ProjectFiles` (Mis Proyectos).
 */
export function FileList({ title = 'Archivos', files, activePath, mainFile, onSelect, onCollapse }: FileListProps) {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))
  return (
    <div className="flex flex-col text-sm text-(--color-ink)">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">{title}</span>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Colapsar panel"
            title="Colapsar panel"
            className="rounded-md p-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <ChevronLeft />
          </button>
        )}
      </header>
      <ul className="flex flex-col px-1.5 pb-2">
        {sorted.map((file) => {
          const active = file.path === activePath
          return (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => onSelect(file.path)}
                className={[
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  active ? 'bg-(--color-surface-muted) text-(--color-ink)' : 'text-(--color-ink-muted) hover:bg-(--color-surface-muted)',
                ].join(' ')}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
                {file.encoding === 'base64' && (
                  <span className="shrink-0 rounded bg-(--color-surface) px-1 text-[10px] text-(--color-ink-muted)">bin</span>
                )}
                {file.path === mainFile && (
                  <span className="shrink-0 rounded bg-(--color-primary) px-1.5 py-0.5 text-[10px] font-medium text-(--color-primary-ink)">
                    principal
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
