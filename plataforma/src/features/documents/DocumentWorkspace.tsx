import { useEffect, useRef, useState } from 'react'
import { type ImperativePanelHandle } from 'react-resizable-panels'
import { ChevronLeft, Pencil } from '@/components/icons'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { downloadBlob, downloadFile, readUploadedFile } from '@/lib/files'
import { buildProjectZip } from '@/lib/projectZip'
import { safeCompile } from '@/features/compiler/safeCompile'
import type { LatexCompiler } from '@/features/compiler/LatexCompiler'
import type { CompileResult } from '@/features/compiler/types'
import { Workspace } from '@/features/workspace/Workspace'
import { ProjectFiles } from './ProjectFiles'
import type { ProjectStore } from './ProjectStore'
import { isBinary, type Project, type ProjectFile } from './types'

interface DocumentWorkspaceProps {
  project: Project
  compiler: LatexCompiler
  store: ProjectStore
  onClose: () => void
}

/**
 * Workspace de un proyecto **multi-archivo**: panel de archivos + editor del
 * archivo activo + PDF. Autosave del conjunto de archivos, compilación de todo
 * el proyecto (se manda `{ files, mainFile }` al backend) y descarga.
 */
export function DocumentWorkspace({ project, compiler, store, onClose }: DocumentWorkspaceProps) {
  const isNarrow = useMediaQuery('(max-width: 860px)')
  const direction = isNarrow ? 'vertical' : 'horizontal'

  const filesPanelRef = useRef<ImperativePanelHandle>(null)
  const [collapsed, setCollapsed] = useState(false)

  const [name, setName] = useState(project.name)
  const [files, setFiles] = useState<readonly ProjectFile[]>(() => project.files)
  const [mainFile, setMainFile] = useState(project.mainFile)
  const [activePath, setActivePath] = useState(project.mainFile)
  const [result, setResult] = useState<CompileResult | null>(null)
  const [compiling, setCompiling] = useState(false)

  const activeFile = files.find((file) => file.path === activePath)
  const activeIsBinary = activeFile ? isBinary(activeFile) : false
  const activeContent = activeIsBinary
    ? `% Archivo binario (no editable): ${activePath}\n% Usalo, por ejemplo, con \\includegraphics{${activePath}}`
    : (activeFile?.content ?? '')

  // Autosave con debounce: el proyecto entero (archivos + principal) persiste solo.
  useEffect(() => {
    const timer = setTimeout(() => store.updateFiles(project.id, files, mainFile), 600)
    return () => clearTimeout(timer)
  }, [files, mainFile, project.id, store])

  async function handleCompile() {
    setCompiling(true)
    try {
      setResult(await safeCompile(compiler, { files, mainFile }))
    } finally {
      setCompiling(false)
    }
  }

  function setActiveContent(content: string) {
    if (activeIsBinary) return
    setFiles((prev) => prev.map((file) => (file.path === activePath ? { ...file, content } : file)))
  }

  function commitName() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project.name) store.rename(project.id, trimmed)
  }

  function toggleFiles() {
    const panel = filesPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  // ── Operaciones sobre archivos ───────────────────────────────────────────
  function addFile() {
    const input = window.prompt('Ruta del nuevo archivo (p. ej. secciones/intro.tex):', 'nuevo.tex')
    const path = input?.trim()
    if (!path) return
    if (files.some((file) => file.path === path)) {
      window.alert('Ya existe un archivo con esa ruta.')
      return
    }
    setFiles((prev) => [...prev, { path, content: '' }])
    setActivePath(path)
  }

  function renameFile(path: string) {
    const input = window.prompt('Nuevo nombre del archivo:', path)
    const next = input?.trim()
    if (!next || next === path) return
    if (files.some((file) => file.path === next)) {
      window.alert('Ya existe un archivo con esa ruta.')
      return
    }
    setFiles((prev) => prev.map((file) => (file.path === path ? { ...file, path: next } : file)))
    if (mainFile === path) setMainFile(next)
    if (activePath === path) setActivePath(next)
  }

  function deleteFile(path: string) {
    if (files.length <= 1 || path === mainFile) return
    if (!window.confirm(`¿Eliminar ${path}? No se puede deshacer.`)) return
    setFiles((prev) => prev.filter((file) => file.path !== path))
    if (activePath === path) setActivePath(mainFile)
  }

  async function uploadFiles(picked: File[]) {
    const read = await Promise.all(picked.map(readUploadedFile))
    setFiles((prev) => {
      const byPath = new Map(prev.map((file) => [file.path, file]))
      for (const file of read) byPath.set(file.path, file)
      return [...byPath.values()]
    })
    const first = read[0]
    if (first) setActivePath(first.path)
  }

  function downloadActiveOr(path: string) {
    const file = files.find((entry) => entry.path === path)
    if (file) downloadFile(file.path, file.content, file.encoding ?? 'utf8')
  }

  async function downloadZip() {
    const blob = await buildProjectZip(files)
    downloadBlob(blob, `${(name || 'proyecto').trim()}.zip`)
  }

  return (
    <Workspace
      direction={direction}
      autoSaveId={`matex-doc-${direction}`}
      leftPanel={
        <ProjectFiles
          files={files}
          activePath={activePath}
          mainFile={mainFile}
          onSelect={setActivePath}
          onAdd={addFile}
          onUpload={uploadFiles}
          onRename={renameFile}
          onDelete={deleteFile}
          onDownload={downloadActiveOr}
          onSetMain={setMainFile}
          onCollapse={toggleFiles}
        />
      }
      leftPanelRef={filesPanelRef}
      leftCollapsed={collapsed}
      onToggleLeft={toggleFiles}
      onLeftCollapse={() => setCollapsed(true)}
      onLeftExpand={() => setCollapsed(false)}
      filePaths={files.map((file) => file.path)}
      onOpenPath={setActivePath}
      extraDownloads={[{ label: 'Proyecto (.zip)', onClick: downloadZip }]}
      toolbarStart={
        <>
          <button
            type="button"
            onClick={onClose}
            title="Volver a Mis Proyectos"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <ChevronLeft width={14} height={14} /> Mis Proyectos
          </button>
          <span className="text-(--color-ink-muted) opacity-40">/</span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-transparent px-2 hover:border-(--color-border) focus-within:border-(--color-primary)">
            <Pencil width={13} height={13} className="shrink-0 text-(--color-ink-muted)" />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              aria-label="Nombre del proyecto"
              placeholder="Nombre del proyecto"
              className="min-w-0 flex-1 bg-transparent py-1 text-sm font-medium text-(--color-ink) outline-none"
            />
          </div>
        </>
      }
      source={activeContent}
      onSourceChange={setActiveContent}
      readOnly={activeIsBinary}
      result={result}
      compiling={compiling}
      onCompile={handleCompile}
      downloadName={name || 'documento'}
    />
  )
}
