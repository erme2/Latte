import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  paneErrorCode,
  type OrganizationInvitationResource,
  type OrganizationMembershipResource,
  type OrganizationRole,
} from '@erme2/latte'
import type { ProductPageProps } from './contract'
import type { ProductServices } from './services'

type PageProps = ProductPageProps<ProductServices>

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const roleLabels: Record<OrganizationRole, string> = {
  organization_administrator: 'Administrator',
  organization_user: 'User',
}

function actionFailureMessage(error: unknown): string {
  const code = paneErrorCode(error)

  switch (code) {
    case 'operation_conflict':
      return 'Pane rejected the change because it would conflict with the current organization state.'
    case 'version_conflict':
      return 'This record changed while you were working. Refresh and try again.'
    case 'permission_denied':
      return 'Pane rejected the change because this account cannot perform that action.'
    case 'validation_failed':
      return 'Check the form values and try again.'
    case 'rate_limited':
      return 'Too many attempts. Wait a moment, then try again.'
    default:
      return 'Unable to complete the organization administration action.'
  }
}

function formatRole(role: OrganizationRole): string {
  return roleLabels[role]
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function memberDisplayName(membership: OrganizationMembershipResource): string {
  return membership.attributes.user_name || membership.attributes.user_email || membership.attributes.user_id
}

export function Dashboard({ context }: PageProps) {
  return (
    <section className="activity">
      <div>
        <h2>{context.session.data.organization.attributes.name}</h2>
        <p>
          Signed in as {context.session.data.membership.attributes.role.replaceAll('_', ' ')}.
        </p>
      </div>
      <code>{context.services.connections.path}</code>
    </section>
  )
}

export function OrganizationAdministration({ context }: PageProps) {
  const administration = context.services.administration
  const copyResetTimer = useRef<number | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<OrganizationMembershipResource[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitationResource[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationRole>('organization_user')
  const [deliveryUrl, setDeliveryUrl] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const activeAdministratorCount = useMemo(
    () => memberships.filter((membership) =>
      membership.attributes.status === 'active' &&
      membership.attributes.role === 'organization_administrator'
    ).length,
    [memberships],
  )

  const refresh = useCallback(async (): Promise<void> => {
    setLoadState('loading')
    setMessage(null)

    try {
      const [membershipList, invitationList] = await Promise.all([
        administration.listMemberships(),
        administration.listInvitations(),
      ])

      setMemberships(membershipList.data)
      setInvitations(invitationList.data)
      setLoadState('ready')
    } catch (error) {
      setLoadState('error')
      setMessage(actionFailureMessage(error))
    }
  }, [administration])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => () => {
    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current)
    }
  }, [])

  useEffect(() => {
    setCopyState('idle')

    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current)
      copyResetTimer.current = null
    }
  }, [deliveryUrl])

  async function updateMembership(
    membership: OrganizationMembershipResource,
    update: { role?: OrganizationRole; status?: 'active' | 'suspended' },
  ): Promise<void> {
    setMessage(null)

    try {
      const current = await administration.getMembership(membership.id)
      await administration.updateMembership(membership.id, update, current.etag)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setMessage(null)
    setDeliveryUrl(null)

    try {
      const created = await administration.createInvitation({ email, role })
      setEmail('')
      setRole('organization_user')
      setDeliveryUrl(created.invitationUrl)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function resendInvitation(invitation: OrganizationInvitationResource): Promise<void> {
    setMessage(null)
    setDeliveryUrl(null)

    try {
      const current = await administration.getInvitation(invitation.id)
      const replacement = await administration.resendInvitation(invitation.id, current.etag)
      setDeliveryUrl(replacement.invitationUrl)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function revokeInvitation(invitation: OrganizationInvitationResource): Promise<void> {
    setMessage(null)

    try {
      const current = await administration.getInvitation(invitation.id)
      await administration.revokeInvitation(invitation.id, current.etag)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function copyDeliveryUrl(): Promise<void> {
    if (!deliveryUrl || copyState === 'copied') return

    try {
      await navigator.clipboard.writeText(deliveryUrl)
      setCopyState('copied')

      copyResetTimer.current = window.setTimeout(() => {
        setCopyState('idle')
        copyResetTimer.current = null
      }, 5000)
    } catch {
      setMessage('Unable to copy the invitation link.')
    }
  }

  return (
    <section className="admin-layout">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{context.session.data.organization.attributes.name}</p>
          <h2>Organization administration</h2>
        </div>
        <button className="button secondary" type="button" onClick={() => { void refresh() }}>
          Refresh
        </button>
      </div>

      {message ? <p className="notice error">{message}</p> : null}
      {deliveryUrl ? (
        <div className="notice invitation-link">
          <span>Invitation link ready: <code>{deliveryUrl}</code></span>
          <button
            className="button secondary"
            type="button"
            disabled={copyState === 'copied'}
            onClick={() => { void copyDeliveryUrl() }}
          >
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}

      <form className="admin-form" onSubmit={(event) => { void inviteMember(event) }}>
        <label>
          Email
          <input
            autoComplete="email"
            name="email"
            type="email"
            maxLength={320}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Role
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as OrganizationRole)}
          >
            <option value="organization_user">User</option>
            <option value="organization_administrator">Administrator</option>
          </select>
        </label>
        <button className="button" type="submit">Invite</button>
      </form>

      <div className="admin-columns">
        <section className="admin-section">
          <div className="section-heading">
            <h3>Members</h3>
            <span>{memberships.length}</span>
          </div>
          {loadState === 'loading' && memberships.length === 0 ? <p>Loading members.</p> : null}
          <div className="resource-list">
            {memberships.map((membership) => {
              const isFinalActiveAdministrator =
                membership.attributes.status === 'active' &&
                membership.attributes.role === 'organization_administrator' &&
                activeAdministratorCount <= 1

              return (
                <article className="resource-row" key={membership.id}>
                  <div>
                    <strong>{memberDisplayName(membership)}</strong>
                    {membership.attributes.user_email && membership.attributes.user_email !== membership.attributes.user_name ? (
                      <span>{membership.attributes.user_email}</span>
                    ) : null}
                    <span>{formatRole(membership.attributes.role)} · {membership.attributes.status}</span>
                  </div>
                  <div className="row-actions">
                    {membership.attributes.role === 'organization_user' ? (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          void updateMembership(membership, { role: 'organization_administrator' })
                        }}
                      >
                        Promote
                      </button>
                    ) : (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={isFinalActiveAdministrator}
                        onClick={() => {
                          void updateMembership(membership, { role: 'organization_user' })
                        }}
                      >
                        Demote
                      </button>
                    )}
                    {membership.attributes.status === 'active' ? (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={isFinalActiveAdministrator}
                        onClick={() => {
                          void updateMembership(membership, { status: 'suspended' })
                        }}
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          void updateMembership(membership, { status: 'active' })
                        }}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="admin-section">
          <div className="section-heading">
            <h3>Invitations</h3>
            <span>{invitations.length}</span>
          </div>
          {loadState === 'loading' && invitations.length === 0 ? <p>Loading invitations.</p> : null}
          <div className="resource-list">
            {invitations.map((invitation) => (
              <article className="resource-row" key={invitation.id}>
                <div>
                  <strong>{invitation.attributes.email}</strong>
                  <span>
                    {formatRole(invitation.attributes.role)} · {invitation.attributes.status} · expires {formatDate(invitation.attributes.expires_at)}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    className="button secondary"
                    type="button"
                    disabled={invitation.attributes.status === 'accepted'}
                    onClick={() => { void resendInvitation(invitation) }}
                  >
                    Resend
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={invitation.attributes.status !== 'pending'}
                    onClick={() => { void revokeInvitation(invitation) }}
                  >
                    Revoke
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export function Connection({ context }: PageProps) {
  return <h2>Connection {context.params.connectionId}</h2>
}

export function Forbidden() {
  return <h2>You do not have access to this page.</h2>
}

export function NotFound() {
  return <h2>Page not found.</h2>
}
