import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertBrowserOrigin,
  assertLatteSession,
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
assert.throws(
  () => parseLatteRuntimeConfig({ ...config, expectedOrganizationId: 'not-a-uuid' }),
  /must be a UUID/,
)

const session = {
  data: {
    mode: 'latte',
    user: { id: 'u', type: 'user', attributes: {} },
    application: {
      id: applicationId,
      type: 'application',
      attributes: { kind: 'latte', organization_id: organizationId, name: 'Example', status: 'active' },
    },
    organization: {
      id: organizationId,
      type: 'organization',
      attributes: { name: 'Example', slug: 'example', status: 'active' },
    },
    membership: {
      id: 'm',
      type: 'membership',
      attributes: { organization_id: organizationId, role: 'organization_user', status: 'active' },
    },
  },
  meta: { request_id: 'r' },
}

assert.equal(assertLatteSession(session, config), session)
assert.throws(
  () => assertLatteSession({ ...session, data: { ...session.data, organization: { ...session.data.organization, id: applicationId } } }, config),
  /organization does not match/,
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
