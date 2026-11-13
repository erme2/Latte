import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import {
  authenticate,
  handlePaneFailure,
  logout,
  retryAuthentication,
} from '../src/auth/lifecycle.mjs'

const config = {
  paneBaseUrl: '/pane',
  expectedApplicationId: '01900000-0000-7000-8000-000000000001',
  expectedOrganizationId: '01900000-0000-7000-8000-000000000002',
  expectedOrigin: 'https://console.example.test',
}

function sessionFor(role) {
  return { data: { mode: 'latte', membership: { attributes: { role, status: 'active' } } } }
}

function paneError(status, code) {
  return new AxiosError('Pane error', 'ERR_BAD_RESPONSE', {}, {}, {
    status,
    statusText: '',
    headers: {},
    config: {},
    data: code ? { error: { code } } : {},
  })
}

function browserAt(path) {
  const calls = []
  const url = new URL(path, config.expectedOrigin)
  return {
    calls,
    location: {
      href: url.toString(),
      origin: url.origin,
      search: url.search,
      assign: (target) => calls.push(['assign', target]),
      replace: (target) => calls.push(['replace', target]),
      reload: () => calls.push(['reload']),
    },
    history: {
      replaceState: (_state, _title, target) => calls.push(['replaceState', target]),
    },
  }
}

function setup({ path = '/dashboard', auth = {}, runtimeConfig = config } = {}) {
  const reports = []
  const logins = []
  const browser = browserAt(path)
  const runtime = {
    config: runtimeConfig,
    auth: {
      session: async () => sessionFor('organization_administrator'),
      completeLogin: async () => sessionFor('organization_administrator'),
      beginLogin: async (redirectTo, invitationToken) => { logins.push([redirectTo, invitationToken]) },
      logout: async () => 'https://api.workos.com/logout',
      ...auth,
    },
  }
  const lifecycle = { runtime, defaultPath: '/dashboard', browser, report: (status) => reports.push(status) }
  return { lifecycle, reports, logins, browser }
}

const isActive = () => true

// A signed-in session is reported and the console renders.
{
  const { lifecycle, reports } = setup()
  await authenticate(lifecycle, isActive)
  assert.equal(reports.at(-1).state, 'authenticated')
  assert.equal(reports.at(-1).session.data.membership.attributes.role, 'organization_administrator')
}

// After the WorkOS callback, the callback query is replaced by the default path.
{
  const { lifecycle, reports, browser } = setup({ path: '/auth/callback?code=c&state=s' })
  await authenticate(lifecycle, isActive)
  assert.equal(reports.at(-1).state, 'authenticated')
  assert.deepEqual(browser.calls, [['replaceState', '/dashboard']])
}

// A signed-out visitor is sent to sign in, returning to the default path.
{
  const { lifecycle, reports, logins } = setup({
    auth: { session: async () => { throw paneError(401) } },
  })
  await authenticate(lifecycle, isActive)
  assert.deepEqual(reports.map((status) => status.state), ['redirecting'])
  assert.equal(reports[0].message, 'Redirecting to sign in')
  assert.deepEqual(logins, [['https://console.example.test/dashboard', undefined]])
}

// A failed login start is reported, unless the attempt is no longer active.
{
  const failing = { session: async () => { throw paneError(401) }, beginLogin: async () => { throw new Error('No login') } }
  const { lifecycle, reports } = setup({ auth: failing })
  await authenticate(lifecycle, isActive)
  assert.deepEqual(reports.at(-1), { state: 'error', message: 'No login', session: null })

  const inactive = setup({ auth: failing })
  let active = true
  inactive.lifecycle.runtime.auth.session = async () => {
    active = false
    throw paneError(401)
  }
  await authenticate(inactive.lifecycle, () => active)
  assert.deepEqual(inactive.reports, [])
}

// An invitation link starts sign-in with the invitation token.
{
  const token = 'i'.repeat(40)
  const { lifecycle, reports, logins } = setup({ path: `/dashboard?invitation_token=${token}` })
  await authenticate(lifecycle, isActive)
  assert.equal(reports[0].message, 'Redirecting to accept invitation')
  assert.deepEqual(logins, [[`https://console.example.test/dashboard`, token]])
}

// An invalid invitation link is reported without starting sign-in.
{
  const { lifecycle, reports, logins } = setup({ path: '/dashboard?invitation_token=short' })
  await authenticate(lifecycle, isActive)
  assert.equal(reports.at(-1).state, 'error')
  assert.match(reports.at(-1).message, /invitation link is invalid/)
  assert.deepEqual(logins, [])
}

// Admin-only console: a non-administrator goes to the product app before any session is stored.
{
  const { lifecycle, reports, browser } = setup({
    runtimeConfig: { ...config, adminOnly: { productAppUrl: 'https://app.example.test/' } },
    auth: { session: async () => sessionFor('organization_user') },
  })
  await authenticate(lifecycle, isActive)
  assert.deepEqual(reports.map((status) => status.state), ['redirecting'])
  assert.deepEqual(browser.calls, [['replace', 'https://app.example.test/']])
}

// Admin-only console with a loginUrl: sign-in is handed to that page, never started here.
{
  const { lifecycle, logins, browser } = setup({
    runtimeConfig: {
      ...config,
      adminOnly: { productAppUrl: 'https://app.example.test/', loginUrl: 'https://app.example.test/login' },
    },
    auth: { session: async () => { throw paneError(401) } },
  })
  await authenticate(lifecycle, isActive)
  assert.deepEqual(logins, [])
  assert.equal(browser.calls[0][0], 'replace')
  assert.match(browser.calls[0][1], /^https:\/\/app\.example\.test\/login\?next=/)
}

// Lost organization access shows Pane's presentation-safe message.
{
  const { lifecycle, reports } = setup({
    auth: { session: async () => { throw paneError(403, 'membership_required') } },
  })
  await authenticate(lifecycle, isActive)
  assert.equal(reports.at(-1).state, 'error')
  assert.notEqual(reports.at(-1).message, 'Unable to complete sign in.')
}

// While signed in: an expired session redirects to sign in, lost access shows an error,
// and other failures are left to the page.
{
  const expired = setup()
  handlePaneFailure(expired.lifecycle, paneError(401, 'session_expired'))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(expired.reports[0].message, 'Your session expired. Redirecting to sign in')
  assert.equal(expired.logins.length, 1)

  const forbidden = setup()
  handlePaneFailure(forbidden.lifecycle, paneError(403, 'membership_required'))
  assert.equal(forbidden.reports.at(-1).state, 'error')

  const other = setup()
  handlePaneFailure(other.lifecycle, paneError(409, 'version_conflict'))
  assert.deepEqual(other.reports, [])
}

// Sign out goes to Pane's validated logout URL, or reports the failure.
{
  const { lifecycle, reports, browser } = setup()
  await logout(lifecycle)
  assert.equal(reports[0].message, 'Signing out')
  assert.deepEqual(browser.calls, [['assign', 'https://api.workos.com/logout']])

  const failing = setup({ auth: { logout: async () => { throw paneError(429, 'rate_limited') } } })
  await logout(failing.lifecycle)
  assert.equal(failing.reports.at(-1).state, 'error')
}

// Retrying after a failed callback drops the callback query before reloading.
{
  const callback = browserAt('/auth/callback?code=c&state=s')
  retryAuthentication('/dashboard', callback)
  assert.deepEqual(callback.calls, [['replaceState', '/dashboard'], ['reload']])

  const plain = browserAt('/organization')
  retryAuthentication('/dashboard', plain)
  assert.deepEqual(plain.calls, [['reload']])
}
