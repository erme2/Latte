import assert from 'node:assert/strict'
import axios from 'axios'
import {
  authenticationFailureMessage,
  callbackRecoveryPath,
  createAuthService,
  invitationAcceptanceErrorCodes,
  resolveInitialAuthentication,
} from '../packages/latte-core/dist/index.js'

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

let logoutDeletes = 0
const logoutAuth = createAuthService(
  axios.create({
    adapter: async (request) => {
      assert.equal(request.method, 'delete')
      assert.equal(request.url, '/session')
      logoutDeletes += 1

      return {
        data: {
          data: {
            logout_url: 'https://api.workos.com/user_management/sessions/logout?session_id=session_123',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: request,
      }
    },
  }),
  config,
)

assert.equal(
  await logoutAuth.logout(),
  'https://api.workos.com/user_management/sessions/logout?session_id=session_123',
)
assert.equal(logoutDeletes, 1)

const sameOriginLogoutAuth = createAuthService(
  axios.create({
    adapter: async (request) => ({
      data: { data: { logout_url: 'https://example.test/dashboard' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: request,
    }),
  }),
  config,
)

await assert.rejects(sameOriginLogoutAuth.logout(), /untrusted/)

const unsafeLogoutAuth = createAuthService(
  axios.create({
    adapter: async (request) => ({
      data: { data: { logout_url: 'https://evil.example/logout' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: request,
    }),
  }),
  config,
)

await assert.rejects(unsafeLogoutAuth.logout(), /untrusted/)

assert.equal(callbackRecoveryPath('?code=consumed&state=old', '/dashboard'), '/dashboard')
assert.equal(callbackRecoveryPath('?error=access_denied', '/dashboard'), '/dashboard')
assert.equal(callbackRecoveryPath('?page=2', '/dashboard'), null)

let sessionReads = 0
let callbackExchanges = 0
const initialAuth = {
  async session() {
    sessionReads += 1
    return session
  },
  async completeLogin() {
    callbackExchanges += 1
    return session
  },
}

for (const search of [
  '?error=access_denied&error_description=No&state=provider-state',
  '?error=server_error&state=provider-state',
  '?code=missing-state',
  '?state=missing-code',
  '?error_description=missing-error-code',
]) {
  const result = await resolveInitialAuthentication(search, initialAuth)
  assert.equal(result.status, 'error')
}
assert.equal(sessionReads, 0)
assert.equal(callbackExchanges, 0)

assert.deepEqual(await resolveInitialAuthentication('', initialAuth), {
  status: 'authenticated',
  session,
  fromCallback: false,
})
assert.equal(sessionReads, 1)

assert.deepEqual(
  await resolveInitialAuthentication('?code=valid-code&state=valid-state', initialAuth),
  { status: 'authenticated', session, fromCallback: true },
)
assert.equal(callbackExchanges, 1)

const failedCallback = await resolveInitialAuthentication(
  '?code=consumed&state=valid-state',
  {
    async session() {
      throw new Error('session must not be read')
    },
    async completeLogin() {
      throw new Error('code consumed')
    },
  },
)
assert.deepEqual(failedCallback, { status: 'error', message: 'Unable to complete sign in.' })

function paneError(status, code, message = 'Sensitive server detail') {
  return new axios.AxiosError('Request failed', undefined, {}, {}, {
    status,
    statusText: status === 422 ? 'Unprocessable Content' : 'Error',
    headers: {},
    config: {},
    data: { error: { code, message, request_id: 'request-id' } },
  })
}

const expectedInvitationMessages = new Map([
  ['invitation_invalid', 'This invitation link is invalid. Ask an organization administrator to resend it.'],
  ['invitation_expired', 'This invitation has expired. Ask an organization administrator to resend it.'],
  ['invitation_revoked', 'This invitation has been revoked or replaced. Ask an organization administrator to resend it.'],
  ['invitation_already_accepted', 'This invitation has already been accepted. Sign in with the account that accepted it.'],
  ['invitation_email_mismatch', 'This invitation is for a different email address. Sign in with the invited account or ask for a new invitation.'],
  ['invitation_organization_mismatch', 'This invitation cannot be used with this application. Ask for a new invitation from this application.'],
])

assert.deepEqual(invitationAcceptanceErrorCodes, [...expectedInvitationMessages.keys()])

for (const [code, expectedMessage] of expectedInvitationMessages) {
  const error = paneError(422, code)

  assert.equal(authenticationFailureMessage(error), expectedMessage)
  assert.doesNotMatch(authenticationFailureMessage(error), /Sensitive/)

  const result = await resolveInitialAuthentication(
    '?code=invite-code&state=valid-state',
    {
      async session() {
        throw new Error('session must not be read')
      },
      async completeLogin() {
        throw error
      },
    },
  )

  assert.deepEqual(result, { status: 'error', message: expectedMessage })
}

assert.equal(
  authenticationFailureMessage(paneError(422, 'validation_failed')),
  'Unable to complete sign in. Check the link and try again.',
)
