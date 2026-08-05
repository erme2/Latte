import type { AxiosInstance, AxiosResponse } from 'axios'
import type {
  CollectionResponse,
  ItemResponse,
  LatteRuntimeConfig,
  OrganizationRole,
  Resource,
  VersionedItemResponse,
} from './types.js'
import { rejectPaneAccessFailure } from './errors.js'
import { createOrganizationRouter } from './organization.js'

export type MembershipStatus = 'active' | 'suspended'

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export type OrganizationMembershipResource = Resource<'membership', {
  organization_id: string
  user_id: string
  user_email: string | null
  user_name: string | null
  role: OrganizationRole
  status: MembershipStatus
  created_at: string
  updated_at: string
}>

export type OrganizationInvitationResource = Resource<'invitation', {
  scope: 'organization'
  organization_id: string
  email: string
  role: OrganizationRole
  status: InvitationStatus
  expires_at: string
  created_at: string
  updated_at: string
}>

export type MembershipUpdate = {
  role?: OrganizationRole
  status?: MembershipStatus
}

export type OrganizationInvitationCreate = {
  email: string
  role: OrganizationRole
}

export type CreatedOrganizationInvitation = VersionedItemResponse<OrganizationInvitationResource> & {
  invitationUrl: string
}

type CreatedInvitationResponse = ItemResponse<OrganizationInvitationResource> & {
  meta: ItemResponse<OrganizationInvitationResource>['meta'] & { invitation_url: string }
}

function versioned<T>(response: AxiosResponse<ItemResponse<T>>): VersionedItemResponse<T> {
  const headers = response.headers as unknown as Record<string, unknown>
  const etag = headers.etag ?? headers.ETag

  if (typeof etag !== 'string' || etag === '') {
    throw new Error('Pane response did not include the required ETag header.')
  }

  return { document: response.data, etag }
}

function createdInvitation(
  response: AxiosResponse<CreatedInvitationResponse>,
): CreatedOrganizationInvitation {
  const result = versioned(response)
  const invitationUrl = response.data.meta.invitation_url

  if (typeof invitationUrl !== 'string' || invitationUrl === '') {
    throw new Error('Pane invitation response did not include the required delivery URL.')
  }

  return { ...result, invitationUrl }
}

export function createOrganizationAdministrationService(
  pane: AxiosInstance,
  config: LatteRuntimeConfig,
) {
  const organization = createOrganizationRouter(config)
  const membershipsPath = organization.path('memberships')
  const invitationsPath = organization.path('invitations')

  return {
    async listMemberships(params?: Record<string, unknown>) {
      const { data } = await pane
        .get<CollectionResponse<OrganizationMembershipResource>>(membershipsPath, { params })
        .catch(rejectPaneAccessFailure)
      return data
    },

    async getMembership(membershipId: string) {
      const response = await pane
        .get<ItemResponse<OrganizationMembershipResource>>(organization.path('memberships', membershipId))
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    async updateMembership(membershipId: string, update: MembershipUpdate, etag: string) {
      const response = await pane
        .patch<ItemResponse<OrganizationMembershipResource>>(
          organization.path('memberships', membershipId),
          update,
          { headers: { 'If-Match': etag } },
        )
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    async listInvitations(params?: Record<string, unknown>) {
      const { data } = await pane
        .get<CollectionResponse<OrganizationInvitationResource>>(invitationsPath, { params })
        .catch(rejectPaneAccessFailure)
      return data
    },

    async createInvitation(input: OrganizationInvitationCreate) {
      const response = await pane
        .post<CreatedInvitationResponse>(invitationsPath, input)
        .catch(rejectPaneAccessFailure)
      return createdInvitation(response)
    },

    async getInvitation(invitationId: string) {
      const response = await pane
        .get<ItemResponse<OrganizationInvitationResource>>(organization.path('invitations', invitationId))
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    async resendInvitation(invitationId: string, etag: string) {
      const response = await pane
        .post<CreatedInvitationResponse>(
          organization.path('invitations', invitationId, 'resends'),
          {},
          { headers: { 'If-Match': etag } },
        )
        .catch(rejectPaneAccessFailure)
      return createdInvitation(response)
    },

    async revokeInvitation(invitationId: string, etag: string) {
      await pane
        .delete(organization.path('invitations', invitationId), {
          headers: { 'If-Match': etag },
        })
        .catch(rejectPaneAccessFailure)
    },
  }
}
