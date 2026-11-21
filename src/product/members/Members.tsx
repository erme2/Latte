import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { paneErrorCode, type InvitationKind, type InvitationResource } from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'

type Props = ProductPageProps<ProductServices>

const kindLabels: Record<InvitationKind, string> = { admin: 'administrator', user: 'user' }

type Row = { invitation: InvitationResource; kind: InvitationKind; etag?: string }

// Pane pages each collection (25 by default): follow next_cursor so older invitations stay reachable.
const maxPages = 40

async function listAll(invitations: ProductServices['invitations'], kind: InvitationKind): Promise<InvitationResource[]> {
  const all: InvitationResource[] = []
  let cursor: string | undefined
  for (let page = 0; page < maxPages; page += 1) {
    const result = await invitations.list(kind, cursor)
    all.push(...result.data)
    if (!result.meta.page.has_more || !result.meta.page.next_cursor) break
    cursor = result.meta.page.next_cursor
  }
  return all
}

function failureMessage(error: unknown): string {
  switch (paneErrorCode(error)) {
    case 'operation_conflict': return 'That email already belongs to an active member.'
    case 'validation_failed': return 'Enter a valid email address.'
    case 'rate_limited': return 'Too many invitations. Try again in a moment.'
    default: return 'Pane could not complete the request. Try again.'
  }
}

export function Members({ context }: Props) {
  const { invitations } = context.services
  const [kind, setKind] = useState<InvitationKind>('user')
  const [email, setEmail] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; url: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [admins, users] = await Promise.all([listAll(invitations, 'admin'), listAll(invitations, 'user')])
      // Pane sends an invitation's ETag only when it is created, so the ones read here can't be revoked from this list.
      setRows((previous) => [
        ...admins.map((invitation) => ({ invitation, kind: 'admin' as const })),
        ...users.map((invitation) => ({ invitation, kind: 'user' as const })),
      ].map((row) => ({ ...row, etag: previous.find((old) => old.invitation.id === row.invitation.id)?.etag })))
      setError(null)
    } catch (failure) {
      setError(failureMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [invitations])

  useEffect(() => { void load() }, [load])

  async function invite(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setCreated(null)
    try {
      const result = await invitations.create(kind, email)
      setCreated({ email: result.document.data.attributes.email, url: result.document.meta.invitation_url })
      setEmail('')
      setRows((previous) => [
        { invitation: result.document.data, kind, etag: result.etag },
        ...previous.filter((row) => row.invitation.id !== result.document.data.id),
      ])
      setError(null)
    } catch (failure) {
      setError(failureMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(row: Row) {
    if (!row.etag) return
    setBusy(true)
    try {
      await invitations.revoke(row.kind, row.invitation.id, row.etag)
      await load()
    } catch (failure) {
      setError(failureMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-layout">
      <div className="page-heading">
        <div>
          <h2>Members</h2>
          <p className="page-description">Invite administrators and users. Sweegly is invite only.</p>
        </div>
      </div>

      <form className="admin-form invite-form" onSubmit={(event) => { void invite(event) }}>
        <label>
          Email
          <input type="email" required maxLength={320} value={email} autoComplete="off"
            onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Role
          <select value={kind} onChange={(event) => setKind(event.target.value as InvitationKind)}>
            <option value="user">User</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <button className="button" type="submit" disabled={busy || email.trim() === ''}>Send invitation</button>
      </form>

      {error ? <p className="notice error" role="alert">{error}</p> : null}
      {created ? (
        <p className="notice invitation-link" role="status">
          <span>
            Invitation for {created.email}. Copy the link now: Pane shows it only once.
            <code>{created.url}</code>
          </span>
          <button className="button secondary" type="button"
            onClick={() => { void navigator.clipboard?.writeText(created.url) }}>Copy link</button>
        </p>
      ) : null}

      <div className="section-heading">
        <h3>Invitations</h3>
      </div>
      {loading ? <p aria-live="polite">Loading…</p> : rows.length === 0 ? <p>No invitations yet.</p> : (
        <div className="resource-list">
          {rows.map((row) => (
            <div className="resource-row" key={`${row.kind}-${row.invitation.id}`}>
              <div>
                <strong>{row.invitation.attributes.email}</strong>
                <span>
                  {kindLabels[row.kind]} · {row.invitation.attributes.status} · expires{' '}
                  {new Date(row.invitation.attributes.expires_at).toLocaleString()}
                </span>
              </div>
              {row.invitation.attributes.status === 'pending' && row.etag ? (
                <div className="row-actions">
                  <button className="button danger" type="button" disabled={busy}
                    onClick={() => { void revoke(row) }}>Revoke</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="page-description">
        The members list with roles needs a Pane endpoint that does not exist yet; until then this page shows invitations.
      </p>
    </section>
  )
}
