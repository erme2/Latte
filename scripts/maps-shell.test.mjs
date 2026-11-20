import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import axios from 'axios'
import {
  buildMapsShell,
  createMapsService,
  mapFunctionKeys,
  mapsRecordPath,
} from '../packages/latte-core/dist/index.js'
import { functionPathsFromRoutes, resolveProductRoute } from '../src/product/runtime.mjs'

const organizationId = '01900000-0000-7000-8000-000000000041'
const config = {
  paneBaseUrl: '/pane',
  expectedApplicationId: '01900000-0000-7000-8000-000000000042',
  expectedOrganizationId: organizationId,
  expectedOrigin: 'https://latte.test',
}
const fixture = (name) => JSON.parse(readFileSync(`scripts/fixtures/maps-install-${name}.json`, 'utf8'))
const installs = { sweegly: fixture('sweegly'), bakery: fixture('bakery') }

// The fixtures follow Pane's MapsResource schema (contracts/pane-v1.json, Pane#154).
const mapName = /^[a-z][a-z0-9_]{0,63}$/
const keysOf = (value) => Object.keys(value).sort()
for (const [install, document] of Object.entries(installs)) {
  assert.deepEqual(keysOf(document), ['data', 'meta'], install)
  assert.deepEqual(keysOf(document.data), ['attributes', 'type'], install)
  assert.equal(document.data.type, 'maps', install)
  const { attributes } = document.data
  assert.deepEqual(keysOf(attributes), ['functions', 'menu', 'settings', 'tables', 'version'], install)
  for (const item of attributes.menu) {
    assert.deepEqual(keysOf(item), ['icon', 'key', 'label', 'parent', 'position', 'target'], install)
    assert.match(item.key, mapName)
    assert.ok(item.parent === null || mapName.test(item.parent))
    assert.ok(Number.isInteger(item.position) && item.position >= 0)
    if (item.target.type === 'table') {
      assert.deepEqual(keysOf(item.target), ['source', 'table', 'type'])
      assert.match(item.target.source, mapName)
      assert.match(item.target.table, mapName)
    } else {
      assert.deepEqual(keysOf(item.target), ['function', 'type'])
      assert.ok(mapFunctionKeys.includes(item.target.function))
    }
  }
  for (const item of attributes.functions) {
    assert.deepEqual(keysOf(item), ['enabled', 'key'])
    assert.ok(mapFunctionKeys.includes(item.key))
  }
  for (const setting of attributes.settings) assert.deepEqual(keysOf(setting), ['key', 'type', 'value'])
  for (const table of attributes.tables) {
    assert.deepEqual(keysOf(table), ['description', 'source', 'system', 'table', 'ui', 'version'])
  }
}

// The maps service reads both maps routes under the fixed organization and keeps the ETag.
const tableMap = {
  type: 'table_map',
  attributes: {
    source: 'app',
    table: 'products',
    description: 'Things for sale',
    system: false,
    version: 2,
    ui: { label: 'Products' },
    fields: [],
  },
}
const calls = []
const pane = axios.create({
  adapter: async (request) => {
    calls.push([request.method, request.url])
    const ok = (data, etag) => ({ data, status: 200, statusText: 'OK', headers: { etag }, config: request })

    if (request.url === `/organizations/${organizationId}/maps`) return ok(installs.sweegly, '"maps-4"')
    if (request.url === `/organizations/${organizationId}/maps/app/products`) {
      return ok({ data: tableMap, meta: { request_id: 'r' } }, '"table-2"')
    }
    throw Object.assign(new Error('Not found'), {
      isAxiosError: true,
      response: { status: 404, data: { error: { code: 'resource_not_found' } } },
    })
  },
})
const maps = createMapsService(pane, config)

const bootstrap = await maps.getMaps()
assert.equal(bootstrap.etag, '"maps-4"')
assert.equal(bootstrap.document.data.attributes.version, 4)
const products = await maps.getTableMap('app', 'products')
assert.equal(products.etag, '"table-2"')
assert.equal(products.document.data.attributes.ui.label, 'Products')
await assert.rejects(maps.getTableMap('app', 'secrets'), (error) => error.response?.status === 404)
for (const [source, table] of [['app', 'Products'], ['app', '../maps'], ['', 'products'], ['app', 'a/b']]) {
  await assert.rejects(maps.getTableMap(source, table), /stable map names/)
}
assert.deepEqual(calls, [
  ['get', `/organizations/${organizationId}/maps`],
  ['get', `/organizations/${organizationId}/maps/app/products`],
  ['get', `/organizations/${organizationId}/maps/app/secrets`],
])

// The same routes serve both installs: nothing below changes per install.
const routes = [
  { id: 'dashboard', path: '/dashboard', function: 'dashboard' },
  { id: 'records', path: '/records/:source/:table', function: 'records' },
  { id: 'connection', path: '/connections/:connectionId', roles: ['admin'] },
  { id: 'organization', path: '/organization', roles: ['admin'], function: 'members' },
]
const functionPaths = functionPathsFromRoutes(routes)
assert.deepEqual(functionPaths, { dashboard: '/dashboard', members: '/organization' })

const sweegly = buildMapsShell(installs.sweegly.data.attributes, { functionPaths })
assert.deepEqual(sweegly.menu, [
  { key: 'home', label: 'Home', icon: 'home', path: '/dashboard', children: [] },
  {
    key: 'catalogue',
    label: 'Catalogue',
    icon: 'box',
    path: '/records/app/products',
    children: [{ key: 'categories', label: 'Categories', icon: null, path: '/records/app/categories', children: [] }],
  },
  {
    key: 'team',
    label: 'Team',
    icon: 'users',
    path: '/organization',
    children: [{ key: 'audit', label: 'Audit trail', icon: null, path: '/records/pane/audit_events', children: [] }],
  },
])
assert.deepEqual([...sweegly.enabledFunctions].sort(), ['dashboard', 'members', 'records'])
assert.deepEqual(sweegly.brand, {
  name: 'Sweegly',
  tagline: 'Your shop, your way',
  logoUrl: 'https://cdn.sweegly.test/logo.svg',
})

// The bakery switched members and the dashboard off, and its member can't see recipes.
const bakery = buildMapsShell(installs.bakery.data.attributes, { functionPaths })
assert.deepEqual(bakery.menu, [
  { key: 'orders', label: 'Orders', icon: 'receipt', path: '/records/app/orders', children: [] },
])
assert.deepEqual([...bakery.enabledFunctions], ['records'])
assert.deepEqual(bakery.brand, {})

// Switched-off functions hide their routes too; untagged routes stay.
const route = (pathname, shell, role = 'admin') =>
  resolveProductRoute(routes, pathname, role, shell?.enabledFunctions).status
assert.equal(route('/organization', sweegly), 'matched')
assert.equal(route('/organization', sweegly, 'user'), 'forbidden')
assert.equal(route('/organization', bakery), 'not_found')
assert.equal(route('/dashboard', bakery), 'not_found')
assert.equal(route('/records/app/orders', bakery), 'matched')
assert.equal(route('/connections/c1', bakery), 'matched')
// Before the maps load (or when they fail) switchable pages stay hidden.
assert.equal(route('/dashboard', null), 'not_found')
assert.equal(route('/connections/c1', null), 'matched')

// Records off: table items go; nesting is one level; menu order follows position.
const base = installs.sweegly.data.attributes
const recordsOff = buildMapsShell(
  { ...base, functions: base.functions.map((item) => ({ ...item, enabled: item.key !== 'records' })) },
  { functionPaths },
)
assert.deepEqual(recordsOff.menu.map((item) => [item.key, item.children.length]), [['home', 0], ['team', 0]])
const reordered = buildMapsShell({
  ...base,
  menu: [
    ...base.menu.map((item) => (item.key === 'home' ? { ...item, position: 9 } : item)),
    { key: 'deep', label: 'Deep', icon: null, target: { type: 'function', function: 'dashboard' }, parent: 'categories', position: 0 },
  ],
}, { functionPaths })
assert.deepEqual(reordered.menu.map((item) => item.key), ['catalogue', 'team', 'home'])
assert.deepEqual(reordered.menu[0].children.map((item) => item.key), ['categories'])

// A function the app has no page for has no menu entry.
assert.deepEqual(buildMapsShell(base, { functionPaths: {} }).menu.map((item) => item.key), ['catalogue'])

// Branding only takes non-empty text, and logos from HTTPS or same-origin paths.
const withSettings = (settings) => buildMapsShell({ ...base, settings }, { functionPaths }).brand
assert.deepEqual(withSettings([{ key: 'brand_logo_url', type: 'image', value: '/uploads/logo.png' }]), { logoUrl: '/uploads/logo.png' })
for (const value of ['javascript:alert(1)', 'http://cdn.test/logo.svg', '//cdn.test/logo.svg', '', 42]) {
  assert.deepEqual(withSettings([{ key: 'brand_logo_url', type: 'image', value }]), {}, String(value))
}
assert.deepEqual(withSettings([{ key: 'brand_name', type: 'text', value: '   ' }, { key: 'brand_tagline', type: 'text', value: true }]), {})
assert.equal(mapsRecordPath('app', 'products'), '/records/app/products')

// The shell renders the maps menu and brand, with the manifest as fallback.
const app = readFileSync('src/App.tsx', 'utf8')
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
assert.match(app, /useMapsShell\(runtime\.maps, shellOptions,/)
assert.match(app, /maps\.shell\.menu\.map/)
assert.match(app, /maps\.status === 'ready' \? maps\.shell\.enabledFunctions : null/)
assert.match(app, /brand\.name \?\? product\.brand\.name/)
assert.match(manifest, /function: 'dashboard'/)
assert.match(manifest, /function: 'members'/)
assert.match(manifest, /path: '\/records\/:source\/:table'/)
assert.match(readFileSync('docs/template-contract.md', 'utf8'), /buildMapsShell/)
