import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Copy } from '@/components/icons'
import { relativeTime } from '@/lib/relativeTime'
import { shareLink, ShareUnauthorized, type Share, type ShareApi, type ShareKind } from './ShareApi'

interface ShareDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly project: { readonly id: string; readonly name: string }
  /** `null` = este build no tiene API configurada. */
  readonly api: ShareApi | null
  readonly signedIn: boolean
  /** Dibuja el botón oficial de Google (para iniciar sesión sin salir del diálogo). */
  readonly renderSignInButton: (element: HTMLElement) => void
  /**
   * La copia que se publica, tal como está el documento ahora. Para `pdf` compila si hace falta;
   * tira con un mensaje legible si no se puede (p. ej. el documento no compila).
   */
  readonly getContent: (kind: ShareKind) => Promise<Blob>
}

const KINDS: ReadonlyArray<{ kind: ShareKind; title: string; can: string }> = [
  { kind: 'mtex', title: 'Documento Matex (.mtex)', can: 'Quien lo abra puede verlo, descargarlo e importarlo a sus proyectos.' },
  { kind: 'pdf', title: 'PDF', can: 'Quien lo abra puede verlo y descargarlo. No recibe la fuente.' },
]

/**
 * **Compartir por link.** Un link por tipo (`.mtex` o PDF) y por documento. Cada link es una
 * foto fija del documento al momento de compartir: seguir editando no lo cambia hasta tocar
 * «Actualizar». No vence; «Revocar» lo apaga y borra la copia.
 */
export function ShareDialog({ open, onClose, project, api, signedIn, renderSignInButton, getContent }: ShareDialogProps) {
  const [shares, setShares] = useState<readonly Share[] | null>(null)
  const [busy, setBusy] = useState<ShareKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const fail = (cause: unknown) =>
    setError(cause instanceof ShareUnauthorized ? 'La sesión venció. Volvé a iniciar sesión para compartir.' : cause instanceof Error ? cause.message : String(cause))

  useEffect(() => {
    if (!open || !api || !signedIn) return
    let cancelled = false
    setShares(null)
    setError(null)
    api
      .list()
      .then((all) => !cancelled && setShares(all.filter((share) => share.projectId === project.id)))
      .catch((cause) => !cancelled && (setShares([]), fail(cause)))
    return () => {
      cancelled = true
    }
  }, [open, api, signedIn, project.id])

  async function run(kind: ShareKind, action: () => Promise<void>) {
    setBusy(kind)
    setError(null)
    try {
      await action()
    } catch (cause) {
      fail(cause)
    } finally {
      setBusy(null)
    }
  }

  const replace = (share: Share) => setShares((current) => [...(current ?? []).filter((entry) => entry.id !== share.id), share])

  const create = (kind: ShareKind) =>
    run(kind, async () => {
      const content = await getContent(kind)
      replace(await api!.create({ projectId: project.id, name: project.name, kind, content }))
    })

  const update = (share: Share) =>
    run(share.kind, async () => {
      const content = await getContent(share.kind)
      replace(await api!.update(share, { name: project.name, content }))
    })

  const revoke = (share: Share) =>
    run(share.kind, async () => {
      await api!.revoke(share.id)
      setShares((current) => (current ?? []).filter((entry) => entry.id !== share.id))
    })

  async function copy(share: Share) {
    try {
      await navigator.clipboard.writeText(shareLink(share.id))
      setCopied(share.id)
      window.setTimeout(() => setCopied((current) => (current === share.id ? null : current)), 1800)
    } catch {
      setError('No se pudo copiar. Seleccioná el link y copialo a mano.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Compartir por link" width="max-w-xl">
      <div className="flex flex-col gap-3 text-xs">
        {!api ? (
          <p className="text-(--color-ink-muted)">Compartir no está disponible en esta versión del sitio.</p>
        ) : !signedIn ? (
          <SignIn renderSignInButton={renderSignInButton} />
        ) : (
          <>
            <p className="text-(--color-ink-muted)">
              El link muestra el documento <strong className="text-(--color-ink)">como está ahora</strong>. Si después seguís
              editando, tocá «Actualizar» para que el link muestre la versión nueva.
            </p>
            {KINDS.map(({ kind, title, can }) => {
              const share = shares?.find((entry) => entry.kind === kind && entry.published)
              const working = busy === kind
              return (
                <section key={kind} className="rounded-lg border border-(--color-border) p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-(--color-ink)">{title}</h3>
                      <p className="mt-0.5 text-(--color-ink-muted)">{can}</p>
                    </div>
                    {!share && (
                      <button
                        type="button"
                        disabled={shares === null || busy !== null}
                        onClick={() => void create(kind)}
                        className="shrink-0 rounded-md bg-(--color-primary) px-3 py-1.5 font-medium text-(--color-primary-ink) hover:opacity-90 disabled:opacity-50"
                      >
                        {working ? 'Creando…' : 'Crear link'}
                      </button>
                    )}
                  </div>
                  {share && (
                    <div className="mt-2.5 flex flex-col gap-2">
                      <div className="flex gap-1.5">
                        <input
                          readOnly
                          value={shareLink(share.id)}
                          aria-label={`Link de ${title}`}
                          onFocus={(event) => event.target.select()}
                          className="min-w-0 flex-1 rounded-md border border-(--color-border) bg-(--color-surface-muted) px-2 py-1.5 font-mono text-[11px] text-(--color-ink) outline-none focus:border-(--color-primary)"
                        />
                        <button
                          type="button"
                          onClick={() => void copy(share)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-(--color-border) px-2.5 py-1.5 text-(--color-ink) hover:bg-(--color-surface-muted)"
                        >
                          <Copy width={13} height={13} /> {copied === share.id ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-(--color-ink-muted)">
                        <span>Muestra la versión de {relativeTime(share.updatedAt)}.</span>
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void update(share)}
                            className="rounded-md border border-(--color-border) px-2.5 py-1 text-(--color-ink) hover:bg-(--color-surface-muted) disabled:opacity-50"
                          >
                            {working ? 'Guardando…' : 'Actualizar'}
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void revoke(share)}
                            title="El link deja de funcionar y se borra la copia compartida"
                            className="rounded-md border border-(--color-border) px-2.5 py-1 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                          >
                            Revocar
                          </button>
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
            {shares === null && <p className="text-(--color-ink-muted)">Buscando tus links…</p>}
          </>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-3 py-2 text-red-200">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** Compartir guarda una copia en la nube: hace falta una cuenta. El botón es el oficial de Google. */
function SignIn({ renderSignInButton }: { renderSignInButton: (element: HTMLElement) => void }) {
  const slot = useRef<HTMLDivElement>(null)
  const render = useCallback(() => {
    if (slot.current) renderSignInButton(slot.current)
  }, [renderSignInButton])
  useEffect(render, [render])
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-(--color-ink-muted)">
        Para compartir hay que <strong className="text-(--color-ink)">iniciar sesión</strong>: el link guarda una copia del
        documento en tu cuenta, y solo vos podés actualizarlo o revocarlo. Quien lo reciba no necesita cuenta.
      </p>
      <div ref={slot} />
    </div>
  )
}
