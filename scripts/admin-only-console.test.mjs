import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  adminOnlyLoginUrl,
  adminOnlyRedirectUrl,
  isAuthenticationRequired,
  parseLatteRuntimeConfig,
  resolveInitialAuthentication,
} from '../packages/latte-core/dist/index.js'

const applicationId = '01900000-0000-7000-8000-000000000001'
const organizationId = '01900000-0000-7000-8000-000000000002'
const baseConfig = {
  paneBaseUrl: '/pane',
  expectedApplicationId: applicationId,
  expectedOrganizationId: organizationId,
  expectedOrigin: 'https://admin.example.test',
}
const productAppUrl = 'https://app.example.test/'

// Config parsing.
assert.equal(parseLatteRuntimeConfig(baseConfig).adminOnly, undefined)
assert.equal('adminOnly' in parseLatteRuntimeConfig(baseConfig), false)
assert.deepEqual(parseLatteRuntimeConfig({ ...baseConfig, adminOnly: { productAppUrl } }).adminOnly, {
  productAppUrl,
})
assert.deepEqual(
  parseLatteRuntimeConfig({ ...baseConfig, adminOnly: { productAppUrl: 'https://app.example.test/start?from=admin' } })
    .adminOnly,
  { productAppUrl: 'https://app.example.test/start?from=admin' },
)
assert.deepEqual(
  parseLatteRuntimeConfig({
    ...baseConfig,
    expectedOrigin: 'http://localhost:5173',
    adminOnly: { productAppUrl: 'http://localhost:5174/' },
  }).adminOnly,
  { productAppUrl: 'http://localhost:5174/' },
)

for (const [adminOnly, message] of [
  [true, /adminOnly must be an object/],
  [[productAppUrl], /adminOnly must be an object/],
  [{}, /requires productAppUrl/],
  [{ productAppUrl: '  ' }, /requires productAppUrl/],
  [{ productAppUrl, extra: 1 }, /Unknown adminOnly configuration: extra/],
  [{ productAppUrl: '/app' }, /absolute HTTP\(S\) URL/],
  [{ productAppUrl: 'http://app.example.test/' }, /credential-free HTTPS URL/],
  [{ productAppUrl: 'javascript:alert(1)' }, /credential-free HTTPS URL/],
  [{ productAppUrl: 'https://user:pass@app.example.test/' }, /credential-free HTTPS URL/],
  [{ productAppUrl: 'https://app.example.test/#home' }, /without a fragment/],
  [{ productAppUrl: 'https://admin.example.test/app' }, /different origin than this console/],
]) {
  assert.throws(() => parseLatteRuntimeConfig({ ...baseConfig, adminOnly }), message)
}

// Optional loginUrl: where signed-out visitors go instead of the console's own login.
const loginUrl = 'https://app.example.test/login'
assert.deepEqual(parseLatteRuntimeConfig({ ...baseConfig, adminOnly: { productAppUrl, loginUrl } }).adminOnly, {
  productAppUrl,
  loginUrl,
})
assert.equal(
  parseLatteRuntimeConfig({ ...baseConfig, adminOnly: { productAppUrl } }).adminOnly.loginUrl,
  undefined,
)
for (const [settings, message] of [
  [{ productAppUrl, loginUrl: '/login' }, /adminOnly\.loginUrl must be an absolute HTTP\(S\) URL/],
  [{ productAppUrl, loginUrl: 'http://app.example.test/login' }, /adminOnly\.loginUrl must be a credential-free HTTPS URL/],
  [{ productAppUrl, loginUrl: 'https://user:pass@app.example.test/login' }, /adminOnly\.loginUrl must be a credential-free HTTPS URL/],
  [{ productAppUrl, loginUrl: 'https://app.example.test/login#top' }, /adminOnly\.loginUrl must be a credential-free HTTPS URL, or loopback HTTP URL, without a fragment/],
  [{ productAppUrl, loginUrl: 'https://admin.example.test/login' }, /adminOnly\.loginUrl must be on a different origin than this console/],
  [{ productAppUrl, loginUrl: '  ' }, /requires loginUrl/],
]) {
  assert.throws(() => parseLatteRuntimeConfig({ ...baseConfig, adminOnly: settings }), message)
}
assert.deepEqual(
  parseLatteRuntimeConfig({
    ...baseConfig,
    expectedOrigin: 'http://localhost:5173',
    adminOnly: { productAppUrl: 'http://localhost:5174/', loginUrl: 'http://localhost:5174/login' },
  }).adminOnly,
  { productAppUrl: 'http://localhost:5174/', loginUrl: 'http://localhost:5174/login' },
)

function sessionWithRole(role) {
  return {
    data: {
      mode: 'latte',
      user: { id: 'u', type: 'user', attributes: { email: 'user@example.test', name: 'User' } },
      application: {
        id: applicationId,
        type: 'application',
        attributes: {
          kind: 'latte',
          name: 'Admin',
          trusted_origin: 'https://admin.example.test',
          redirect_uris: ['https://admin.example.test/'],
          status: 'active',
          created_at: '2026-11-07T00:00:00Z',
          updated_at: '2026-11-07T00:00:00Z',
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
          created_at: '2026-11-07T00:00:00Z',
          updated_at: '2026-11-07T00:00:00Z',
        },
      },
      membership: {
        id: 'm',
        type: 'membership',
        attributes: {
          role,
          status: 'active',
          created_at: '2026-11-07T00:00:00Z',
          updated_at: '2026-11-07T00:00:00Z',
        },
      },
    },
    meta: { request_id: 'r' },
  }
}

const admin = sessionWithRole('organization_administrator')
const member = sessionWithRole('organization_user')
const adminOnlyConfig = parseLatteRuntimeConfig({ ...baseConfig, adminOnly: { productAppUrl } })
const defaultConfig = parseLatteRuntimeConfig(baseConfig)

assert.equal(adminOnlyRedirectUrl(admin, adminOnlyConfig), null)
assert.equal(adminOnlyRedirectUrl(member, adminOnlyConfig), productAppUrl)
assert.equal(adminOnlyRedirectUrl(member, defaultConfig), null)

function authReturning(session) {
  return {
    async session() {
      return session
    },
    async completeLogin() {
      return session
    },
  }
}

// An organization administrator can use the admin console.
assert.deepEqual(await resolveInitialAuthentication('', authReturning(admin), adminOnlyConfig), {
  status: 'authenticated',
  session: admin,
  fromCallback: false,
})

// A signed-in non-admin is sent to the product app, also straight after login.
assert.deepEqual(await resolveInitialAuthentication('', authReturning(member), adminOnlyConfig), {
  status: 'product_redirect',
  url: productAppUrl,
})
assert.deepEqual(
  await resolveInitialAuthentication('?code=c&state=s', authReturning(member), adminOnlyConfig),
  { status: 'product_redirect', url: productAppUrl },
)

// A signed-out visitor still gets Pane's 401, which starts the normal login flow.
const signedOut = {
  async session() {
    throw Object.assign(new Error('Unauthenticated'), {
      isAxiosError: true,
      response: { status: 401, data: { error: { code: 'authentication_required' } } },
    })
  },
  async completeLogin() {
    throw new Error('no callback expected')
  },
}
await assert.rejects(
  resolveInitialAuthentication('', signedOut, adminOnlyConfig),
  (error) => isAuthenticationRequired(error),
)

// With loginUrl, a signed-out visitor is sent to it with next set to the console page
// they opened (no fragment). Without it, the console starts its own login.
const loginConfig = parseLatteRuntimeConfig({ ...baseConfig, adminOnly: { productAppUrl, loginUrl } })
assert.equal(
  adminOnlyLoginUrl(loginConfig, 'https://admin.example.test/customers?page=2#row'),
  'https://app.example.test/login?next=https%3A%2F%2Fadmin.example.test%2Fcustomers%3Fpage%3D2',
)
assert.equal(adminOnlyLoginUrl(adminOnlyConfig, 'https://admin.example.test/'), null)
assert.equal(adminOnlyLoginUrl(defaultConfig, 'https://admin.example.test/'), null)
assert.equal(adminOnlyLoginUrl(undefined, 'https://admin.example.test/'), null)

// Without the setting, non-admins use the console as before.
assert.deepEqual(await resolveInitialAuthentication('', authReturning(member), defaultConfig), {
  status: 'authenticated',
  session: member,
  fromCallback: false,
})

// The app redirects before rendering and replaces history so Back can't
// return to the console.
const app = readFileSync('src/App.tsx', 'utf8')
assert.match(app, /resolveInitialAuthentication\(\s*window\.location\.search,\s*runtime\.auth,\s*runtime\.config,\s*\)/)
assert.match(app, /initial\.status === 'product_redirect'[\s\S]*window\.location\.replace\(initial\.url\)[\s\S]*return/)
assert.ok(
  app.indexOf("initial.status === 'product_redirect'") < app.indexOf('setSession(initial.session)'),
  'the admin-only redirect must happen before the session is stored and the console renders',
)

// Signed-out visitors on a loginUrl console are redirected, and the console never
// starts its own login there: beginLogin is only called from beginSignIn.
assert.match(app, /adminOnlyLoginUrl\(runtime\.config, window\.location\.href\)/)
assert.match(app, /window\.location\.replace\(loginUrl\)/)
assert.equal(app.match(/runtime\.auth\.beginLogin\(/g)?.length, 1, 'beginLogin is only called from beginSignIn')

for (const doc of ['docs/template-contract.md', 'README.md']) {
  const text = readFileSync(doc, 'utf8')
  assert.match(text, /adminOnly/, `${doc} documents adminOnly`)
  assert.match(text, /productAppUrl/, `${doc} documents productAppUrl`)
}
assert.match(readFileSync('docs/template-contract.md', 'utf8'), /loginUrl/, 'template contract documents loginUrl')
