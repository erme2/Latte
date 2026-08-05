import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
    roles: ['organization_administrator'],
  },
  { id: 'row', path: '/tables/:tableId/rows/:rowKey' },
]

assert.deepEqual(resolveProductRoute(routes, '/dashboard', 'organization_user'), {
  status: 'matched',
  route: routes[0],
  params: {},
})
assert.deepEqual(
  resolveProductRoute(routes, '/connections/connection%20one', 'organization_administrator'),
  { status: 'matched', route: routes[1], params: { connectionId: 'connection one' } },
)
assert.deepEqual(
  resolveProductRoute(routes, '/tables/table-1/rows/row%2Fkey', 'organization_user'),
  { status: 'matched', route: routes[2], params: { tableId: 'table-1', rowKey: 'row/key' } },
)
assert.equal(
  resolveProductRoute(routes, '/connections/connection-1', 'organization_user').status,
  'forbidden',
)
assert.deepEqual(resolveProductRoute(routes, '/missing', 'organization_user'), {
  status: 'not_found',
})
assert.deepEqual(resolveProductRoute(routes, '/connections/%ZZ', 'organization_administrator'), {
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
const pages = readFileSync('src/product/pages.tsx', 'utf8')
assert.match(main, /createLatteRuntime\(config, product\)/)
assert.doesNotMatch(app, /createProductServices|createLatteRuntime/)
assert.match(app, /product\.notFoundPage/)
assert.doesNotMatch(app, /beginLogin\(redirectUrl\(window\.location\.pathname/)
assert.match(app, /beginLogin\(redirectUrl\(product\.defaultPath/)
assert.match(pages, /navigator\.clipboard\.writeText\(deliveryUrl\)/)
assert.match(pages, /window\.setTimeout\(\(\) => \{/)
assert.match(pages, /copyState === 'copied' \? 'Copied' : 'Copy'/)

const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
assert.match(manifest, /path: '\/organization'/)
assert.match(manifest, /roles: \['organization_administrator'\]/)
