import assert from 'node:assert/strict'
import axios from 'axios'
import {
  PaneAccessError,
  assertLatteSession,
  createAuthService,
  createOrganizationRouter,
  createPaneClient,
  createRowService,
  paneAccessFailure,
} from '../packages/latte-core/dist/index.js'

const applicationId = '01900000-0000-7000-8000-000000000001'
const organizationId = '01900000-0000-7000-8000-000000000002'
const config = { paneBaseUrl: '/pane', expectedApplicationId: applicationId, expectedOrganizationId: organizationId, expectedOrigin: 'https://example.test' }
const session = { data: {
  mode: 'latte',
  user: { id: 'user', type: 'user', attributes: { email: 'a@example.test', name: 'A' } },
  application: { id: applicationId, type: 'application', attributes: { kind: 'latte', name: 'App', trusted_origin: config.expectedOrigin, redirect_uris: ['https://example.test'], status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } },
  organization: { id: organizationId, type: 'organization', attributes: { name: 'Org', slug: 'org', status: 'active', database_limit: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } },
  membership: { id: 'membership', type: 'membership', attributes: { role: 'organization_user', status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } },
}, meta: { request_id: '01900000-0000-7000-8000-000000000003' } }

let sessionRequest
const auth = createAuthService(axios.create({ adapter: async (request) => {
  sessionRequest = request
  return { data: session, status: 200, statusText: 'OK', headers: {}, config: request }
} }), config)
assert.equal(await auth.session(), session)
assert.equal(sessionRequest.url, '/session')

const organization = createOrganizationRouter(config)
assert.equal(organization.organizationId, organizationId)
assert.equal(organization.path('connections', 'connection/from-url', 'tables', 'people'), `/organizations/${organizationId}/connections/connection%2Ffrom-url/tables/people`)
assert.throws(() => organization.path('connections', ''), /must not be empty/)

for (const [field, expected] of [['application', /application does not match/], ['organization', /organization does not match/]]) {
  const changed = structuredClone(session)
  changed.data[field].id = '01900000-0000-7000-8000-000000000099'
  assert.throws(() => assertLatteSession(changed, config), expected)
}
for (const [resource, expected] of [['application', /application is not active/], ['organization', /organization is not active/], ['membership', /membership is not active/]]) {
  const changed = structuredClone(session)
  changed.data[resource].attributes.status = 'suspended'
  assert.throws(() => assertLatteSession(changed, config), expected)
}

function pane403(code, message = 'Sensitive server detail', request = {}) {
  return new axios.AxiosError('Request failed', undefined, {}, request, { status: 403, statusText: 'Forbidden', headers: {}, config: request, data: { error: { code, message, request_id: 'request-id' } } })
}
assert.deepEqual(paneAccessFailure(pane403('application_not_allowed')), { code: 'application_not_allowed', kind: 'deployment_unavailable', message: 'This application is not available for its configured organization.', requestId: 'request-id' })
assert.equal(paneAccessFailure(pane403('organization_context_mismatch')).kind, 'deployment_unavailable')
assert.equal(paneAccessFailure(pane403('organization_inactive')).kind, 'organization_unavailable')
assert.equal(paneAccessFailure(pane403('membership_required')).kind, 'access_denied')
assert.equal(paneAccessFailure(pane403('permission_denied')), null)
assert.doesNotMatch(paneAccessFailure(pane403('organization_inactive')).message, /Sensitive/)

async function rejectsWithPaneAccess(promise, code) {
  await assert.rejects(promise, (error) => {
    const failure = paneAccessFailure(error)
    assert.equal(error instanceof PaneAccessError, true)
    assert.equal(failure?.code, code)
    return true
  })
}

for (const code of [
  'application_not_allowed',
  'organization_context_mismatch',
  'organization_inactive',
  'membership_required',
]) {
  const rejectedRows = createRowService(axios.create({
    adapter: async (request) => {
      throw pane403(code, 'Sensitive row detail', request)
    },
  }), config)
  await rejectsWithPaneAccess(rejectedRows.list('connection', 'table'), code)
}

const deniedRows = createRowService(axios.create({
  adapter: async (request) => {
    throw pane403('permission_denied', 'Permission denied', request)
  },
}), config)
await assert.rejects(deniedRows.list('connection', 'table'), axios.AxiosError)

let connectionRequest
const paneClient = createPaneClient(config)
paneClient.defaults.adapter = async (request) => {
  connectionRequest = request
  throw pane403('organization_context_mismatch', 'Sensitive connection detail', request)
}
await rejectsWithPaneAccess(
  paneClient.get(organization.path('connections')),
  'organization_context_mismatch',
)
assert.equal(connectionRequest.url, `/organizations/${organizationId}/connections`)
