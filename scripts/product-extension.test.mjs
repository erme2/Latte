import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  createProductServices,
  matchRoutePattern,
  resolveProductRoute,
  validateRoutePattern,
} from '../src/product/runtime.mjs'

const routes = [
  { id: 'dashboard', path: '/dashboard' },
  {
    id: 'connection',
    path: '/connections/:connectionId',
    roles: ['admin'],
  },
  { id: 'row', path: '/tables/:tableId/rows/:rowKey' },
]

assert.deepEqual(resolveProductRoute(routes, '/dashboard', 'user'), {
  status: 'matched',
  route: routes[0],
  params: {},
})
assert.deepEqual(
  resolveProductRoute(routes, '/connections/connection%20one', 'admin'),
  { status: 'matched', route: routes[1], params: { connectionId: 'connection one' } },
)
assert.deepEqual(
  resolveProductRoute(routes, '/tables/table-1/rows/row%2Fkey', 'user'),
  { status: 'matched', route: routes[2], params: { tableId: 'table-1', rowKey: 'row/key' } },
)
assert.equal(
  resolveProductRoute(routes, '/connections/connection-1', 'user').status,
  'forbidden',
)
assert.deepEqual(resolveProductRoute(routes, '/missing', 'user'), {
  status: 'not_found',
})
assert.deepEqual(resolveProductRoute(routes, '/connections/%ZZ', 'admin'), {
  status: 'not_found',
})
assert.deepEqual(matchRoutePattern('/', '/'), {})
assert.throws(() => validateRoutePattern('/rows/:rowId/:rowId'), /route parameter/)

let serviceConstructions = 0
const platform = { marker: 'platform' }
const services = createProductServices((receivedPlatform) => {
  serviceConstructions += 1
  assert.equal(receivedPlatform, platform)
  return { records: { marker: 'service' } }
}, platform)
const page = ({ context }) => context.services.records.marker

assert.equal(serviceConstructions, 1)
assert.equal(page({ context: { services } }), 'service')

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')
const lifecycle = readFileSync('src/auth/lifecycle.mjs', 'utf8')
assert.match(main, /createLatteRuntime\(config, product\)/)
assert.doesNotMatch(app, /createProductServices|createLatteRuntime/)
assert.match(app, /product\.notFoundPage/)
assert.match(app, /<img className="brand-logo" src=\{brand\.logoUrl \?\? '\/latte-logo\.svg'\} alt=\{brandName\}/)
assert.ok(existsSync('public/latte-logo.svg'), 'the shell logo is served from public/')
assert.doesNotMatch(lifecycle, /beginLogin\(redirectUrl\(browser\.location\.pathname/)
assert.match(lifecycle, /beginLogin\(redirectUrl\(defaultPath/)
assert.match(app, /useLatteAuthentication\(runtime, product\.defaultPath\)/)

const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
assert.match(manifest, /roles: \['admin'\]/)
