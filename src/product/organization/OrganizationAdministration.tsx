import { useState, type FormEvent } from 'react'
import type { OrganizationRole } from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'
import { formatDate, formatRole, memberDisplayName } from './presentation'
import { useOrganizationAdministration } from './useOrganizationAdministration'

export function OrganizationAdministration({ context }: ProductPageProps<ProductServices>) {
  const {
    loadState,
    message,
    memberships,
    invitations,
    deliveryUrl,
    copyState,
    activeAdministratorCount,
    refresh,
    updateMembership,
    inviteMember,
    resendInvitation,
    revokeInvitation,
    copyDeliveryUrl,
  } = useOrganizationAdministration(context.services.administration)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationRole>('organization_user')

  function submitInvitation(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void inviteMember({ email, role }, () => {
      setEmail('')
      setRole('organization_user')
    })
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

      <form className="admin-form" onSubmit={submitInvitation}>
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
