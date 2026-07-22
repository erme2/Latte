import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertBrowserOrigin,
  assertLatteSession,
  attemptLoginRedirect,
  createPaneClient,
  parseLatteRuntimeConfig,
} from '../packages/latte-core/dist/index.js'

const applicationId = '01900000-0000-7000-8000-000000000001'
const organizationId = '01900000-0000-7000-8000-000000000002'
const config = parseLatteRuntimeConfig({
  paneBaseUrl: '/pane',
  expectedApplicationId: applicationId,
  expectedOrganizationId: organizationId,
  expectedOrigin: 'https://example.test',
})

assert.equal(config.paneBaseUrl, '/pane')
assert.doesNotThrow(() => assertBrowserOrigin(config, 'https://example.test'))
assert.throws(() => assertBrowserOrigin(config, 'https://other.test'), /other than/)
assert.throws(
  () => parseLatteRuntimeConfig({ ...config, clientSecret: 'never' }),
  /Unknown Latte runtime configuration: clientSecret/,
)

for (const acceptedOrigin of [
  'https://example.test',
  'https://example.test:8443',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://[::1]:5173',
]) {
  assert.equal(
    parseLatteRuntimeConfig({ ...config, expectedOrigin: acceptedOrigin }).expectedOrigin,
    acceptedOrigin,
  )
}

for (const rejectedOrigin of [
  'http://example.test',
  'https://Example.test',
  'https://example.test:443',
  'https://user@example.test',
  'https://example.test.',
  'https://foo_bar.example',
  'https://-bad.example',
  'https://bad-.example',
]) {
  assert.throws(
    () => parseLatteRuntimeConfig({ ...config, expectedOrigin: rejectedOrigin }),
    /expectedOrigin/,
  )
}

for (const [paneBaseUrl, expected] of [
  ['/', '/api/v1'],
  ['/pane', '/pane/api/v1'],
  ['/pane/', '/pane/api/v1'],
  ['https://pane.example', 'https://pane.example/api/v1'],
  ['https://pane.example/gateway', 'https://pane.example/gateway/api/v1'],
  ['http://localhost:8000', 'http://localhost:8000/api/v1'],
]) {
  const parsed = parseLatteRuntimeConfig({ ...config, paneBaseUrl })
  assert.equal(createPaneClient(parsed).defaults.baseURL, expected)
}

for (const rejectedBaseUrl of [
  '//evil.example',
  '/pane?target=evil',
  '/pane#fragment',
  '/pane/../api',
  'http://pane.example',
  'HTTPS://pane.example',
  'https://pane.example:443',
  'https://pane.example/gateway/',
  'https://pane.example//gateway',
  'https://pane.example/gateway/../api',
  'https://user@pane.example',
]) {
  assert.throws(
    () => parseLatteRuntimeConfig({ ...config, paneBaseUrl: rejectedBaseUrl }),
    /paneBaseUrl/,
  )
}
assert.throws(
  () => parseLatteRuntimeConfig({ ...config, expectedOrganizationId: 'not-a-uuid' }),
  /must be a UUID/,
)

const session = {
  data: {
    mode: 'latte',
    user: { id: 'u', type: 'user', attributes: { email: 'user@example.test', name: 'User' } },
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
      id: 'm',
      type: 'membership',
      attributes: {
        role: 'organization_user',
        status: 'active',
        created_at: '2026-07-22T00:00:00Z',
        updated_at: '2026-07-22T00:00:00Z',
      },
    },
  },
  meta: { request_id: 'r' },
}

assert.equal(assertLatteSession(session, config), session)
assert.throws(
  () => assertLatteSession({ ...session, data: { ...session.data, organization: { ...session.data.organization, id: applicationId } } }, config),
  /organization does not match/,
)

assert.deepEqual(await attemptLoginRedirect(async () => {}), { status: 'redirecting' })
assert.deepEqual(
  await attemptLoginRedirect(async () => { throw new Error('Origin rejected') }),
  { status: 'error', message: 'Origin rejected' },
)

const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'))
const corePackage = JSON.parse(readFileSync('packages/latte-core/package.json', 'utf8'))
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
const contract = readFileSync('src/product/contract.ts', 'utf8')
const docs = readFileSync('docs/template-contract.md', 'utf8')

assert.equal(rootPackage.private, true)
assert.equal(rootPackage.dependencies['@erme2/latte'], 'file:packages/latte-core')
assert.equal(corePackage.name, '@erme2/latte')
assert.equal(corePackage.publishConfig.access, 'public')
assert.match(manifest, /defineLatteProduct/)
assert.match(contract, /routes: readonly ProductRoute\[\]/)
assert.match(contract, /navigation: readonly NavigationItem\[\]/)
assert.match(contract, /roles\?: readonly OrganizationRole\[\]/)
assert.match(docs, /never selects.*application or organization/is)
assert.match(docs, /npm update @erme2\/latte/)
