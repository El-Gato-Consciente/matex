import { Folder as FolderIcon, FolderPlus, Pencil, Trash } from '@/components/icons'
import { indentClass } from './indent'
import type { Folder } from './types'

interface FolderTreeProps {
  folders: readonly Folder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: (parentId: string | null) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

/** Barra lateral con el **árbol de carpetas** anidadas y sus acciones. */
export function FolderTree({ folders, selectedId, onSelect, onCreate, onRename, onDelete }: FolderTreeProps) {
  const childrenOf = (parentId: string | null) =>
    folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex h-full flex-col gap-0.5 text-sm">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">Carpetas</span>
        <button
          type="button"
          onClick={() => onCreate(selectedId)}
          aria-label="Nueva carpeta"
          title="Nueva carpeta"
          className="rounded-md p-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
        >
          <FolderPlus width={15} height={15} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-left',
          selectedId === null
            ? 'bg-(--color-surface-muted) text-(--color-ink)'
            : 'text-(--color-ink-muted) hover:text-(--color-ink)',
        ].join(' ')}
      >
        <FolderIcon width={15} height={15} className="shrink-0" /> Todos los proyectos
      </button>

      {childrenOf(null).map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          depth={0}
          childrenOf={childrenOf}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

interface FolderRowProps {
  folder: Folder
  depth: number
  childrenOf: (parentId: string | null) => Folder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: (parentId: string | null) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

function FolderRow({ folder, depth, childrenOf, selectedId, onSelect, onCreate, onRename, onDelete }: FolderRowProps) {
  const kids = childrenOf(folder.id)
  const active = selectedId === folder.id
  return (
    <>
      <div
        className={[
          'group flex items-center gap-1 rounded-md pr-1',
          indentClass(depth),
          active ? 'bg-(--color-surface-muted)' : 'hover:bg-(--color-surface-muted)',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className={[
            'flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left',
            active ? 'text-(--color-ink)' : 'text-(--color-ink-muted)',
          ].join(' ')}
        >
          <FolderIcon width={15} height={15} className="shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
          <RowAction label="Nueva subcarpeta" onClick={() => onCreate(folder.id)}>
            <FolderPlus width={13} height={13} />
          </RowAction>
          <RowAction label="Renombrar carpeta" onClick={() => onRename(folder.id)}>
            <Pencil width={13} height={13} />
          </RowAction>
          <RowAction label="Eliminar carpeta" danger onClick={() => onDelete(folder.id)}>
            <Trash width={13} height={13} />
          </RowAction>
        </div>
      </div>
      {kids.map((kid) => (
        <FolderRow
          key={kid.id}
          folder={kid}
          depth={depth + 1}
          childrenOf={childrenOf}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

interface RowActionProps {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}

function RowAction({ label, danger, onClick, children }: RowActionProps) {
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
