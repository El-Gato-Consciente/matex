import { useMemo, useRef } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Copy, Download, MoreHorizontal, Pencil, Plus, Trash, Upload } from '@/components/icons'
import { relativeTime } from '@/lib/relativeTime'
import { FolderTree } from './FolderTree'
import { MiniSheet } from './MiniSheet'
import { MoveToMenu } from './MoveToMenu'
import { projectOutline } from './projectOutline'
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

/**
 * Mis Proyectos: árbol de carpetas + **grilla de tarjetas** de la carpeta activa. Cada tarjeta
 * muestra una miniatura dibujada con el esqueleto del documento (`projectOutline`), así se
 * reconoce cada proyecto de un vistazo sin compilar nada.
 */
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
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {/* En pantallas angostas el encabezado se apila (antes el texto quedaba en una columna
              de una palabra y «Nuevo proyecto» se salía de la pantalla). */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <MobileFolderPicker folders={folders} selectedId={selectedFolderId} onSelect={onSelectFolder} />
              <h1 className="truncate text-xl font-semibold text-(--color-ink)">{folderName}</h1>
              <p className="mt-1 text-sm text-(--color-ink-muted)">
                {visible.length} {visible.length === 1 ? 'proyecto' : 'proyectos'} · guardados en este navegador
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              className="group flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-(--color-border) px-6 py-14 text-center transition-colors hover:border-(--color-primary)"
            >
              <span className="grid size-11 place-items-center rounded-full bg-(--color-primary)/15 text-(--color-primary) transition-transform group-hover:scale-110">
                <Plus width={20} height={20} />
              </span>
              <span className="font-medium text-(--color-ink)">Todavía no hay proyectos acá</span>
              <span className="max-w-sm text-sm text-(--color-ink-muted)">
                Creá uno en blanco o arrancá desde una plantilla: informe, apunte, paper, presentación…
              </span>
            </button>
          ) : (
            <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
              {visible.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  folders={folders}
                  onOpen={() => onOpen(project.id)}
                  onRename={() => onRename(project.id)}
                  onDuplicate={() => onDuplicate(project.id)}
                  onDelete={() => onDelete(project.id)}
                  onDownloadZip={() => onDownloadZip(project.id)}
                  onMove={(folderId) => onMove(project.id, folderId)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface ProjectCardProps {
  project: Project
  folders: readonly Folder[]
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDownloadZip: () => void
  onMove: (folderId: string | null) => void
}

function ProjectCard({ project, folders, onOpen, onRename, onDuplicate, onDelete, onDownloadZip, onMove }: ProjectCardProps) {
  // El esqueleto solo cambia cuando cambia el proyecto (la lista se rearma al volver a la galería).
  const outline = useMemo(() => projectOutline(project), [project])
  const visual = project.kind === 'matex'

  return (
    <li className="group relative overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) transition-[border-color,box-shadow] hover:border-(--color-primary)/60 hover:shadow-[0_12px_30px_-18px_rgb(0_0_0/0.9)]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="grid aspect-[4/3] place-items-center border-b border-(--color-border) bg-(--color-surface-muted)">
          <MiniSheet outline={outline} />
        </div>
        <div className="flex flex-col gap-1.5 px-3.5 py-3">
          <span className="truncate font-medium text-(--color-ink)">{project.name}</span>
          <span className="flex items-center gap-2 text-xs text-(--color-ink-muted)">
            <span
              className={[
                'rounded-full border px-1.5 py-px text-[10.5px] font-medium',
                visual
                  ? 'border-(--color-primary)/40 bg-(--color-primary)/10 text-indigo-300'
                  : 'border-(--color-border) text-(--color-ink-muted)',
              ].join(' ')}
            >
              {visual ? 'Visual' : 'LaTeX'}
            </span>
            <time dateTime={project.updatedAt} title={new Date(project.updatedAt).toLocaleString()}>
              {relativeTime(project.updatedAt)}
            </time>
          </span>
        </div>
      </button>

      {/* Acciones: aparecen al pasar el mouse; en pantallas táctiles (sin hover), siempre. */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg border border-(--color-border) bg-(--color-surface)/95 p-0.5 opacity-0 shadow-md transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
        <MoveToMenu folders={folders} currentFolderId={project.folderId} onMove={onMove} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={`Más acciones de ${project.name}`}
            title="Más acciones"
            className="rounded-md p-1.5 text-(--color-ink-muted) outline-none hover:text-(--color-ink) data-[state=open]:text-(--color-ink)"
          >
            <MoreHorizontal />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-48 rounded-lg border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl"
            >
              <CardAction onSelect={onRename} icon={<Pencil width={14} height={14} />}>Renombrar</CardAction>
              <CardAction onSelect={onDuplicate} icon={<Copy width={14} height={14} />}>Duplicar</CardAction>
              <CardAction onSelect={onDownloadZip} icon={<Download width={14} height={14} />}>Descargar .zip</CardAction>
              <DropdownMenu.Separator className="my-1 h-px bg-(--color-border)" />
              <CardAction onSelect={onDelete} icon={<Trash width={14} height={14} />} danger>
                Eliminar
              </CardAction>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </li>
  )
}

function CardAction({
  onSelect,
  icon,
  danger = false,
  children,
}: {
  onSelect: () => void
  icon: React.ReactNode
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <DropdownMenu.Item
      // Diferido: los `confirm`/`prompt` de las acciones no deben abrirse con el menú a medio cerrar.
      onSelect={() => setTimeout(onSelect, 0)}
      className={[
        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-(--color-surface-muted)',
        danger ? 'text-(--color-danger)' : 'text-(--color-ink)',
      ].join(' ')}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  )
}

/** En celular el árbol de carpetas no entra: un selector simple ocupa su lugar. */
function MobileFolderPicker({
  folders,
  selectedId,
  onSelect,
}: {
  folders: readonly Folder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (folders.length === 0) return null
  const depth = (folder: Folder): number => {
    let level = 0
    let parent = folders.find((f) => f.id === folder.parentId)
    while (parent && level < 10) {
      level += 1
      parent = folders.find((f) => f.id === parent!.parentId)
    }
    return level
  }
  return (
    <select
      value={selectedId ?? ''}
      onChange={(event) => onSelect(event.target.value || null)}
      aria-label="Carpeta"
      className="mb-3 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm sm:hidden"
    >
      <option value="">Todos los proyectos</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {'  '.repeat(depth(folder))}
          {folder.name}
        </option>
      ))}
    </select>
  )
}
