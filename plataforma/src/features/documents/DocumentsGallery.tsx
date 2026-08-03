import { useRef } from 'react'
import { Copy, Download, Pencil, Plus, Trash, Upload } from '@/components/icons'
import { FolderTree } from './FolderTree'
import { MoveToMenu } from './MoveToMenu'
import type { Folder, Project } from './types'

interface DocumentsGalleryProps {
  projects: readonly Project[]
  folders: readonly Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onCreateFolder: (parentId: string | null) => void
  onRenameFolder: (id: string) => void
  onDeleteFolder: (id: string) => void
  onNew: () => void
  onImportZip: (file: File) => void
  onImportMatex: (file: File) => void
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onDownloadZip: (id: string) => void
  onMove: (id: string, folderId: string | null) => void
}

/** Mis Proyectos: árbol de carpetas + lista de proyectos de la carpeta activa. */
export function DocumentsGallery({
  projects,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onNew,
  onImportZip,
  onImportMatex,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onDownloadZip,
  onMove,
}: DocumentsGalleryProps) {
  const zipInputRef = useRef<HTMLInputElement>(null)
  const matexInputRef = useRef<HTMLInputElement>(null)
  const visible = projects.filter((project) => project.folderId === selectedFolderId)
  const folderName = selectedFolderId
    ? (folders.find((folder) => folder.id === selectedFolderId)?.name ?? 'Carpeta')
    : 'Todos los proyectos'

  return (
    <div className="flex h-full bg-(--color-surface-muted)">
      <aside className="hidden w-60 shrink-0 overflow-auto border-r border-(--color-border) bg-(--color-surface) p-3 sm:block">
        <FolderTree
          folders={folders}
          selectedId={selectedFolderId}
          onSelect={onSelectFolder}
          onCreate={onCreateFolder}
          onRename={onRenameFolder}
          onDelete={onDeleteFolder}
        />
      </aside>

      <div className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-(--color-ink)">{folderName}</h1>
              <p className="mt-1 text-sm text-(--color-ink-muted)">
                {visible.length} {visible.length === 1 ? 'proyecto' : 'proyectos'} · guardados en este navegador.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => matexInputRef.current?.click()}
                title="Importar un documento Matex desde un .mtex"
                className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-2 text-sm hover:bg-(--color-surface)"
              >
                <Upload width={15} height={15} /> Importar .mtex
              </button>
              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                title="Importar un proyecto desde un .zip"
                className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-2 text-sm hover:bg-(--color-surface)"
              >
                <Upload width={15} height={15} /> Importar .zip
              </button>
              <button
                type="button"
                onClick={onNew}
                className="inline-flex items-center gap-1.5 rounded-md bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-primary-ink) hover:opacity-90"
              >
                <Plus width={16} height={16} /> Nuevo proyecto
              </button>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                aria-label="Importar proyecto desde .zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onImportZip(file)
                  event.target.value = ''
                }}
              />
              <input
                ref={matexInputRef}
                type="file"
                accept=".mtex,.json,application/json"
                aria-label="Importar documento Matex desde .mtex"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onImportMatex(file)
                  event.target.value = ''
                }}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <button
              type="button"
              onClick={onNew}
              className="w-full rounded-lg border border-dashed border-(--color-border) p-10 text-center text-sm text-(--color-ink-muted) hover:border-(--color-primary)"
            >
              No hay proyectos en esta carpeta. Tocá para crear uno (en blanco o desde una plantilla).
            </button>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3"
                >
                  <button type="button" onClick={() => onOpen(project.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium text-(--color-ink)">{project.name}</p>
                    <p className="text-xs text-(--color-ink-muted)">
                      Modificado {new Date(project.updatedAt).toLocaleString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpen(project.id)}
                    className="mr-1 rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
                  >
                    Abrir
                  </button>
                  <MoveToMenu
                    folders={folders}
                    currentFolderId={project.folderId}
                    onMove={(folderId) => onMove(project.id, folderId)}
                  />
                  <GalleryAction label="Renombrar" onClick={() => onRename(project.id)}>
                    <Pencil />
                  </GalleryAction>
                  <GalleryAction label="Descargar .zip" onClick={() => onDownloadZip(project.id)}>
                    <Download />
                  </GalleryAction>
                  <GalleryAction label="Duplicar" onClick={() => onDuplicate(project.id)}>
                    <Copy />
                  </GalleryAction>
                  <GalleryAction label="Eliminar" danger onClick={() => onDelete(project.id)}>
                    <Trash />
                  </GalleryAction>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface GalleryActionProps {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}

function GalleryAction({ label, danger, onClick, children }: GalleryActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'rounded-md p-1.5 text-(--color-ink-muted)',
        danger ? 'hover:text-(--color-danger)' : 'hover:text-(--color-ink)',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
