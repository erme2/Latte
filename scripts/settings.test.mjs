import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import { readFileSync } from 'node:fs'
import {
  buildMapsShell,
  createPaneClient,
  createSettingsService,
  paneErrorCode,
  settingEtag,
  settingImage,
  settingImageProblem,
} from '../packages/latte-core/dist/index.js'

// Settings (Latte#72): Pane's admin settings routes, image uploads and the brand read from public settings.
const pane = createPaneClient({
  paneBaseUrl: 'https://pane.example.test',
  expectedApplicationId: '01900000-0000-7000-8000-000000000042',
  expectedOrigin: 'https://latte.test',
})
const calls = []
let failWith = null
const attributes = (over = {}) => ({
  key: 'brand_name', type: 'text', label: 'Name', help: null, public: true,
  editable_by: 'administrator', default: 'Latte', value: 'Latte', version: 0, ...over,
})
pane.defaults.adapter = async (request) => {
  calls.push({ method: request.method, url: request.url, ifMatch: request.headers.get('If-Match') ?? null, data: request.data })
  if (failWith) {
    throw new AxiosError('failed', 'ERR_BAD_REQUEST', request, null, {
      status: failWith.status, data: { error: { code: failWith.code } }, headers: {}, config: request,
    })
  }
  const reply = (data) => ({ data, status: 200, statusText: '', headers: {}, config: request })
  if (request.method === 'get') return reply({ data: [{ id: 'brand_name', type: 'setting', attributes: attributes() }], meta: { request_id: 'r' } })
  return reply({ data: { id: 'brand_name', type: 'setting', attributes: attributes({ version: 1 }) }, meta: { request_id: 'r' } })
}

const service = createSettingsService(pane)
const [first] = await service.list()
assert.equal(first.attributes.key, 'brand_name')

await service.set(first.attributes, 'Sweegly')
assert.equal(calls[1].method, 'put')
assert.equal(calls[1].url, '/settings/brand_name')
assert.equal(calls[1].ifMatch, '"setting-brand_name-0"')
assert.deepEqual(JSON.parse(calls[1].data), { value: 'Sweegly' })

await service.set(attributes({ key: 'brand_logo_url', type: 'image', version: 3 }), null)
assert.equal(calls[2].ifMatch, '"setting-brand_logo_url-3"')

const file = new Blob([new Uint8Array(4)], { type: 'image/png' })
await service.upload(attributes({ key: 'brand_logo_url', type: 'image', version: 3 }), file)
assert.equal(calls[3].method, 'post')
assert.equal(calls[3].url, '/settings/brand_logo_url/upload')
assert.equal(calls[3].ifMatch, '"setting-brand_logo_url-3"')
assert.ok(calls[3].data instanceof FormData && calls[3].data.get('file') instanceof Blob)

// Keys come from Pane's list, but are still checked before they reach a URL.
assert.throws(() => service.set(attributes({ key: '../x' }), 'a'))
assert.throws(() => service.upload(attributes({ key: 'a/b' }), file))
assert.equal(settingEtag({ key: 'a', version: 2 }), '"setting-a-2"')

// Upload errors come back as Pane's error codes (stale version, rejected file).
for (const [status, code] of [[412, 'version_conflict'], [422, 'validation_failed'], [403, 'permission_denied']]) {
  failWith = { status, code }
  await assert.rejects(service.upload(first.attributes, file), (error) => paneErrorCode(error) === code)
}
failWith = null

// The browser checks the image first, with Pane's limits.
assert.equal(settingImageProblem({ type: 'image/svg+xml', size: 10 }), 'type')
assert.equal(settingImageProblem({ type: 'image/png', size: 2 * 1024 * 1024 + 1 }), 'size')
assert.equal(settingImageProblem({ type: 'image/webp', size: 2 * 1024 * 1024 }), null)
assert.equal(settingImage({ path: 'p', url: 'https://cdn.test/p.png', mime: 'image/png', size: 5 })?.url, 'https://cdn.test/p.png')
assert.equal(settingImage(null), null)
assert.equal(settingImage({ url: 'x' }), null)

// The shell reads the logo from an image setting (an object) as well as from a text URL, with the same URL rules.
const shell = (value) => buildMapsShell({
  version: 1, menu: [], functions: [], tables: [],
  settings: [{ key: 'brand_logo_url', type: 'image', value }],
}, { functionPaths: {} }).brand.logoUrl
assert.equal(shell({ path: 'p', url: 'https://cdn.test/p.png', mime: 'image/png', size: 5 }), 'https://cdn.test/p.png')
assert.equal(shell({ url: 'http://cdn.test/p.png' }), undefined)
assert.equal(shell(null), undefined)
assert.equal(shell('/logo.png'), '/logo.png')

// The page is an admin-only route with an always-on menu entry.
const manifest = readFileSync(new URL('../src/product/manifest.tsx', import.meta.url), 'utf8')
assert.match(manifest, /id: 'settings',\s*path: '\/settings',\s*component: Settings,\s*roles: \['admin'\]/)
assert.match(manifest, /navigation: \[\{ id: 'settings'/)
