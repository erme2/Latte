import assert from 'node:assert/strict'
import axios from 'axios'
import { callbackRecoveryPath, createAuthService } from '../packages/latte-core/dist/index.js'

const applicationId = '01900000-0000-7000-8000-000000000001'
const organizationId = '01900000-0000-7000-8000-000000000002'
const config = {
  paneBaseUrl: '/pane',
  expectedApplicationId: applicationId,
  expectedOrganizationId: organizationId,
  expectedOrigin: 'https://example.test',
}
const session = {
  data: {
    mode: 'latte',
    user: {
      id: '01900000-0000-7000-8000-000000000003',
      type: 'user',
      attributes: { email: 'user@example.test', name: 'User' },
    },
    application: {
      id: applicationId,
      type: 'application',
      attributes: {
        kind: 'latte',
        name: 'Example',
        trusted_origin: 'https://example.test',
        redirect_uris: ['https://example.test/callback'],
        status: 'active',
        created_at: '2026-07-22T00:00:00Z',
        updated_at: '2026-07-22T00:00:00Z',
      },
    },
    organization: {
      id: organizationId,
      type: 'organization',
      attributes: {
        name: 'Example',
        slug: 'example',
        status: 'active',
        database_limit: 1,
        created_at: '2026-07-22T00:00:00Z',
        updated_at: '2026-07-22T00:00:00Z',
      },
    },
    membership: {
      id: '01900000-0000-7000-8000-000000000004',
      type: 'membership',
      attributes: {
        role: 'organization_user',
        status: 'active',
        created_at: '2026-07-22T00:00:00Z',
        updated_at: '2026-07-22T00:00:00Z',
      },
    },
  },
  meta: { request_id: '01900000-0000-7000-8000-000000000005' },
}

let callbackPosts = 0
const pane = axios.create({
  adapter: async (request) => {
    callbackPosts += 1
    await new Promise((resolve) => setTimeout(resolve, 5))
    return { data: session, status: 200, statusText: 'OK', headers: {}, config: request }
  },
})
const auth = createAuthService(pane, config)
const first = auth.completeLogin('one-time-code', 'server-state')
const replay = auth.completeLogin('one-time-code', 'server-state')

assert.equal(first, replay)
assert.deepEqual(await Promise.all([first, replay]), [session, session])
assert.equal(callbackPosts, 1)
assert.equal(await auth.completeLogin('one-time-code', 'server-state'), session)
assert.equal(callbackPosts, 1)

let failedPosts = 0
const retryingAuth = createAuthService(
  axios.create({
    adapter: async (request) => {
      failedPosts += 1
      if (failedPosts === 1) throw new Error('exchange failed')
      return { data: session, status: 200, statusText: 'OK', headers: {}, config: request }
    },
  }),
  config,
)

await assert.rejects(retryingAuth.completeLogin('retry-code', 'retry-state'), /exchange failed/)
assert.equal(await retryingAuth.completeLogin('retry-code', 'retry-state'), session)
assert.equal(failedPosts, 2)

assert.equal(callbackRecoveryPath('?code=consumed&state=old', '/dashboard'), '/dashboard')
assert.equal(callbackRecoveryPath('?error=access_denied', '/dashboard'), '/dashboard')
assert.equal(callbackRecoveryPath('?page=2', '/dashboard'), null)
