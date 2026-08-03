import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Folder as FolderIcon } from '@/components/icons'
import { indentClass } from './indent'
import type { Folder } from './types'

interface MoveToMenuProps {
  folders: readonly Folder[]
  currentFolderId: string | null
  onMove: (folderId: string | null) => void
}

/** Menú “Mover a…” con el árbol de carpetas aplanado (indentado por profundidad). */
export function MoveToMenu({ folders, currentFolderId, onMove }: MoveToMenuProps) {
  const flat = flatten(folders)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Mover a una carpeta"
        title="Mover a…"
        className="rounded-md p-1.5 text-(--color-ink-muted) outline-none hover:text-(--color-ink) data-[state=open]:text-(--color-ink)"
      >
        <FolderIcon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 max-h-[60vh] w-56 overflow-auto rounded-lg border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl"
        >
          <DropdownMenu.Label className="px-2 py-1 text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">
            Mover a
          </DropdownMenu.Label>
          <MoveItem active={currentFolderId === null} depth={0} onSelect={() => onMove(null)}>
            Todos los proyectos
          </MoveItem>
          {flat.map(({ folder, depth }) => (
            <MoveItem
              key={folder.id}
              active={currentFolderId === folder.id}
              depth={depth + 1}
              onSelect={() => onMove(folder.id)}
            >
              {folder.name}
            </MoveItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface MoveItemProps {
  active: boolean
  depth: number
  onSelect: () => void
  children: React.ReactNode
}

function MoveItem({ active, depth, onSelect, children }: MoveItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={[
        'flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-sm text-(--color-ink-muted) outline-none',
        'data-[highlighted]:bg-(--color-surface-muted) data-[highlighted]:text-(--color-ink)',
        indentClass(depth),
      ].join(' ')}
    >
      <span className="flex w-4 shrink-0 justify-center">
        {active && <Check className="text-(--color-primary)" width={14} height={14} />}
      </span>
      <span className="truncate">{children}</span>
    </DropdownMenu.Item>
  )
}

/** Aplana el árbol en preorden, anotando la profundidad. */
function flatten(folders: readonly Folder[]): Array<{ folder: Folder; depth: number }> {
  const out: Array<{ folder: Folder; depth: number }> = []
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ folder, depth })
      walk(folder.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
