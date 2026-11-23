import type { AxiosInstance } from 'axios'
import { rejectPaneAccessFailure } from './errors.js'
import type { CollectionResponse, Resource } from './types.js'

// Pane's installation invitations (`listPaneAdminInvitations`, `createUserInvitation`, ... in contracts/pane-v1.json).

export type InvitationKind = 'admin' | 'user'

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export type InvitationResource = Resource<
  'invitation',
  {
    email: string
    role: 'pane_administrator' | 'user'
    status: InvitationStatus
    expires_at: string
    created_at: string
    updated_at: string
  }
>

export type InvitationCreated = {
  document: {
    data: InvitationResource
    // The one-time link to send to the invitee: Pane returns it only in this response.
    // `email_sent` is false when Pane kept the invitation but could not send the email.
    meta: { request_id: string; invitation_url: string; email_sent?: boolean }
  }
  // Revoking needs this ETag. Pane sends it on creation only (lists carry none).
  etag: string
}

const paths: Record<InvitationKind, string> = {
  admin: '/installation/pane-admin-invitations',
  user: '/installation/user-invitations',
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Only a pending user invitation can be resent: Pane has no resend route for administrator invitations, and it
// answers 409 for accepted, revoked or expired ones.
export function canResendInvitation(kind: InvitationKind, status: InvitationStatus): boolean {
  return kind === 'user' && status === 'pending'
}

// What to tell the administrator after a resend. Pane keeps the invitation when the email could not be sent.
export function resendNotice(
  email: string,
  meta: { email_sent?: boolean },
): { tone: 'success' | 'error'; message: string } {
  return meta.email_sent === false
    ? { tone: 'error', message: `The email to ${email} could not be sent. Copy the new link and send it yourself.` }
    : { tone: 'success', message: `Invitation sent again to ${email}. The previous link no longer works.` }
}

export function createInvitationsService(pane: AxiosInstance) {
  async function list(kind: InvitationKind, cursor?: string): Promise<CollectionResponse<InvitationResource>> {
    const response = await pane
      .get<CollectionResponse<InvitationResource>>(paths[kind], cursor ? { params: { 'page[cursor]': cursor } } : undefined)
      .catch(rejectPaneAccessFailure)
    return response.data
  }

  return {
    list,

    // Every page of a kind, oldest included. Stops only when Pane has no more pages, or when it repeats a cursor
    // (which would otherwise loop forever).
    async listAll(kind: InvitationKind): Promise<InvitationResource[]> {
      const all: InvitationResource[] = []
      const seen = new Set<string>()
      let cursor: string | undefined
      for (;;) {
        const result = await list(kind, cursor)
        all.push(...result.data)
        const next = result.meta.page.next_cursor
        if (!result.meta.page.has_more || !next || seen.has(next)) return all
        seen.add(next)
        cursor = next
      }
    },

    async create(kind: InvitationKind, email: string): Promise<InvitationCreated> {
      const response = await pane
        .post<InvitationCreated['document']>(paths[kind], { email: email.trim() })
        .catch(rejectPaneAccessFailure)
      const headers = response.headers as unknown as Record<string, unknown>
      const etag = headers.etag ?? headers.ETag
      if (typeof etag !== 'string' || etag === '') {
        throw new Error('Pane response did not include the required ETag header.')
      }
      return { document: response.data, etag }
    },

    // Pane's resend route exists for user invitations only. It issues a fresh link on the same invitation and emails it.
    async resend(invitationId: string): Promise<InvitationCreated['document']> {
      if (!uuidPattern.test(invitationId)) throw new Error('Invitations are addressed by their id.')
      const response = await pane
        .post<InvitationCreated['document']>(`${paths.user}/${invitationId}/resend`)
        .catch(rejectPaneAccessFailure)
      return response.data
    },

    async revoke(kind: InvitationKind, invitationId: string, etag: string): Promise<void> {
      if (!uuidPattern.test(invitationId)) throw new Error('Invitations are addressed by their id.')
      await pane
        .delete(`${paths[kind]}/${invitationId}`, { headers: { 'If-Match': etag } })
        .catch(rejectPaneAccessFailure)
    },
  }
}

export type InvitationsService = ReturnType<typeof createInvitationsService>
