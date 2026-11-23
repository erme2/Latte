import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import {
  buildDashboardCards,
  createCrudService,
  createPaneClient,
  dashboardRecentMax,
  paneErrorCode,
} from '../packages/latte-core/dist/index.js'

// Dashboard (Latte#73): cards configured in the maps' table `ui.dashboard`, rows read through Pane's /crud route.
const table = (name, ui, over = {}) => ({
  source: 'sweegly', table: name, description: null, system: false, version: 1, ui, ...over,
})

const cards = buildDashboardCards([
  table('products', { label: 'Products', dashboard: { count: true, position: 2 } }),
  table('lists', { label: 'Lists', list: { columns: ['name', 'created_at', 'owner', 'extra'] }, dashboard: { count: true, recent: 5, sort: 'created_at', position: 1 } }),
  table('no_dashboard', { label: 'Plain' }),
  table('empty_card', { dashboard: { count: false, recent: 0 } }),
  table('bad_config', { dashboard: 'yes' }),
  table('maps_tables', { dashboard: { count: true } }, { system: true }),
  table('too_many', { dashboard: { recent: 500, sort: 'id' } }),
  table('bad_sort', { dashboard: { count: true, recent: 1, sort: 'x; drop table' } }),
  table('no_sort', { dashboard: { recent: 3 } }),
  table('no_ui', null),
  table('Bad-Name', { dashboard: { count: true } }),
])

assert.deepEqual(cards.map((card) => card.table), ['bad_sort', 'too_many', 'lists', 'products'])
const lists = cards.find((card) => card.table === 'lists')
assert.deepEqual(lists, {
  source: 'sweegly', table: 'lists', label: 'Lists', count: true, recent: 5, sort: 'created_at',
  columns: ['name', 'created_at', 'owner'],
})
assert.equal(cards.find((card) => card.table === 'too_many').recent, dashboardRecentMax)
assert.equal(cards.find((card) => card.table === 'bad_sort').sort, null)
// Recent rows without a usable sort would be the oldest ones, so they are dropped (and a card with no count goes too).
assert.equal(cards.find((card) => card.table === 'bad_sort').recent, 0)
assert.equal(cards.find((card) => card.table === 'no_sort'), undefined)
assert.equal(cards.find((card) => card.table === 'products').label, 'Products')
assert.deepEqual(buildDashboardCards([]), [])

const pane = createPaneClient({
  paneBaseUrl: 'https://pane.example.test',
  expectedApplicationId: '01900000-0000-7000-8000-000000000042',
  expectedOrigin: 'https://latte.test',
})
const calls = []
let failWith = null
pane.defaults.adapter = async (request) => {
  calls.push({ method: request.method, url: request.url, baseURL: request.baseURL, params: request.params })
  if (failWith) {
    throw new AxiosError('failed', 'ERR_BAD_REQUEST', request, null, {
      status: failWith, data: { error: { code: 'forbidden' } }, headers: {}, config: request,
    })
  }
  return {
    data: { status: 'OK', data: [{ id: 1, name: 'Groceries' }], pagination: { page: 1, limit: 5, total: 12 } },
    status: 200, statusText: '', headers: {}, config: request,
  }
}

const crud = createCrudService(pane, {
  paneBaseUrl: 'https://pane.example.test/',
  expectedApplicationId: '01900000-0000-7000-8000-000000000042',
  expectedOrigin: 'https://latte.test',
})
const result = await crud.list('lists', { limit: 5, sort: 'created_at', order: 'desc' })
assert.deepEqual(result.rows, [{ id: 1, name: 'Groceries' }])
assert.deepEqual(result.pagination, { page: 1, limit: 5, total: 12 })
// The CRUD route sits beside /api/v1, so the request leaves the versioned base URL.
assert.equal(calls[0].url, '/crud/lists')
assert.equal(calls[0].baseURL, 'https://pane.example.test')
assert.deepEqual(calls[0].params, { limit: 5, sort: 'created_at', order: 'desc' })

await assert.rejects(() => crud.list('../users'), /stable map names/)
await assert.rejects(() => crud.list('lists', { sort: 'a b' }), /stable map names/)
assert.equal(calls.length, 1)

failWith = 403
await assert.rejects(() => crud.list('lists'), (error) => paneErrorCode(error) !== undefined || error instanceof Error)
