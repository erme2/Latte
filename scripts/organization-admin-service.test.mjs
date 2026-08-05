import assert from 'node:assert/strict'
import axios from 'axios'
import {
  createOrganizationAdministrationService,
  organizationRoles,
} from '../packages/latte-core/dist/index.js'

const organizationId = '01900000-0000-7000-8000-000000000031'
const membershipId = '01900000-0000-7000-8000-000000000032'
const invitationId = '01900000-0000-7000-8000-000000000033'
const calls = []
const membership = {
  id: membershipId,
  type: 'membership',
  attributes: {
    organization_id: organizationId,
    user_id: '01900000-0000-7000-8000-000000000034',
    user_email: 'member@example.test',
    user_name: 'Example Member',
    role: 'organization_user',
    status: 'active',
    created_at: '2026-07-31T00:00:00Z',
    updated_at: '2026-07-31T00:00:00Z',
  },
}
const invitation = {
  id: invitationId,
  type: 'invitation',
  attributes: {
    scope: 'organization',
    organization_id: organizationId,
    email: 'invited@example.test',
    role: 'organization_user',
    status: 'pending',
    expires_at: '2026-08-01T00:00:00Z',
    created_at: '2026-07-31T00:00:00Z',
    updated_at: '2026-07-31T00:00:00Z',
  },
}
const pane = axios.create({
  adapter: async (request) => {
    calls.push({
      method: request.method,
      url: request.url,
      data: request.data,
      ifMatch: request.headers?.['If-Match'],
    })

    if (request.url?.endsWith('/memberships') && request.method === 'get') {
      return {
        data: {
          data: [membership],
          meta: { request_id: 'request-id', page: { next_cursor: null, has_more: false } },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: request,
      }
    }

    if (request.url?.endsWith(`/memberships/${membershipId}`) && request.method === 'get') {
      return {
        data: { data: membership, meta: { request_id: 'request-id' } },
        status: 200,
        statusText: 'OK',
        headers: { etag: '"membership-version"' },
        config: request,
      }
    }

    if (request.url?.endsWith(`/memberships/${membershipId}`) && request.method === 'patch') {
      return {
        data: { data: { ...membership, attributes: { ...membership.attributes, role: 'organization_administrator' } }, meta: { request_id: 'request-id' } },
        status: 200,
        statusText: 'OK',
        headers: { etag: '"membership-updated"' },
        config: request,
      }
    }

    if (request.url?.endsWith('/invitations') && request.method === 'get') {
      return {
        data: {
          data: [invitation],
          meta: { request_id: 'request-id', page: { next_cursor: null, has_more: false } },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: request,
      }
    }

    if (request.url?.endsWith('/invitations') && request.method === 'post') {
      return {
        data: {
          data: invitation,
          meta: { request_id: 'request-id', invitation_url: 'https://latte.test/auth/login?invitation_token=token' },
        },
        status: 201,
        statusText: 'Created',
        headers: { etag: '"invitation-created"' },
        config: request,
      }
    }

    if (request.url?.endsWith(`/invitations/${invitationId}`) && request.method === 'get') {
      return {
        data: { data: invitation, meta: { request_id: 'request-id' } },
        status: 200,
        statusText: 'OK',
        headers: { etag: '"invitation-version"' },
        config: request,
      }
    }

    if (request.url?.endsWith(`/invitations/${invitationId}/resends`) && request.method === 'post') {
      return {
        data: {
          data: { ...invitation, id: '01900000-0000-7000-8000-000000000035' },
          meta: { request_id: 'request-id', invitation_url: 'https://latte.test/auth/login?invitation_token=replacement' },
        },
        status: 201,
        statusText: 'Created',
        headers: { etag: '"replacement-version"' },
        config: request,
      }
    }

    if (request.url?.endsWith(`/invitations/${invitationId}`) && request.method === 'delete') {
      return { data: null, status: 204, statusText: 'No Content', headers: {}, config: request }
    }

    throw new Error(`Unexpected request ${request.method} ${request.url}`)
  },
})
const service = createOrganizationAdministrationService(pane, {
  paneBaseUrl: '/pane',
  expectedApplicationId: '01900000-0000-7000-8000-000000000036',
  expectedOrganizationId: organizationId,
  expectedOrigin: 'https://latte.test',
})

assert.deepEqual(organizationRoles, ['organization_administrator', 'organization_user'])
assert.equal((await service.listMemberships()).data[0].id, membershipId)
assert.equal((await service.getMembership(membershipId)).etag, '"membership-version"')

const updated = await service.updateMembership(
  membershipId,
  { role: 'organization_administrator' },
  '"membership-version"',
)
assert.equal(updated.document.data.attributes.role, 'organization_administrator')

assert.equal((await service.listInvitations()).data[0].id, invitationId)
assert.equal(
  (await service.createInvitation({ email: 'invited@example.test', role: 'organization_user' })).invitationUrl,
  'https://latte.test/auth/login?invitation_token=token',
)
assert.equal((await service.getInvitation(invitationId)).etag, '"invitation-version"')
assert.equal(
  (await service.resendInvitation(invitationId, '"invitation-version"')).invitationUrl,
  'https://latte.test/auth/login?invitation_token=replacement',
)
await service.revokeInvitation(invitationId, '"replacement-version"')

assert.deepEqual(calls.map((call) => [call.method, call.url, call.ifMatch]), [
  ['get', `/organizations/${organizationId}/memberships`, undefined],
  ['get', `/organizations/${organizationId}/memberships/${membershipId}`, undefined],
  ['patch', `/organizations/${organizationId}/memberships/${membershipId}`, '"membership-version"'],
  ['get', `/organizations/${organizationId}/invitations`, undefined],
  ['post', `/organizations/${organizationId}/invitations`, undefined],
  ['get', `/organizations/${organizationId}/invitations/${invitationId}`, undefined],
  ['post', `/organizations/${organizationId}/invitations/${invitationId}/resends`, '"invitation-version"'],
  ['delete', `/organizations/${organizationId}/invitations/${invitationId}`, '"replacement-version"'],
])
