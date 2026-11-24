import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AxiosError } from 'axios'
import {
  buildMapBody,
  buildMapEdit,
  buildRecordView,
  createMapsService,
  createPaneClient,
  paneErrorCode,
} from '../packages/latte-core/dist/index.js'

// Maps editor (Latte#71): edits a table map through Pane's maps admin API (PUT /maps/{source}/{table}, If-Match).
const map = JSON.parse(readFileSync('scripts/fixtures/data-products-table-map.json', 'utf8')).data.attributes
const find = (edit, name) => edit.fields.find((field) => field.name === name)

// The editor starts from what the map says, ignoring unknown columns.
const edit = buildMapEdit(map)
assert.equal(edit.label, 'Products')
assert.equal(edit.description, 'Things for sale')
assert.deepEqual(edit.columns, ['name', 'price', 'secret_note'])
assert.equal(edit.sortField, 'created_at')
assert.equal(edit.sortDescending, true)
assert.deepEqual(find(edit, 'name').validations, [{ rule: 'max', value: '12', message: '' }])
assert.equal(find(edit, 'name').label, 'Product name')

// Saving without changes sends the same map back.
const untouched = buildMapBody(map, edit)
assert.deepEqual(untouched.errors, {})
assert.deepEqual(untouched.body.fields.map((field) => field.name), map.fields.map((field) => field.name))
assert.deepEqual(untouched.body.fields.find((field) => field.name === 'name').validations, [{ rule: 'max', value: 12 }])
assert.equal(untouched.body.ui.list.default_sort, '-created_at')

// A change: new label, hidden field, a new rule, reordered columns and fields, other `ui` keys kept.
const withUi = { ...map, ui: { ...map.ui, dashboard: { count: true } } }
const changed = buildMapEdit(withUi)
changed.label = '  Goods '
changed.columns = ['price', 'name']
changed.sortField = 'name'
changed.sortDescending = false
changed.fields = [find(changed, 'name'), find(changed, 'id'), ...changed.fields.filter((field) => !['id', 'name'].includes(field.name))]
find(changed, 'price').hidden = true
find(changed, 'price').validations.push({ rule: 'max', value: '99.5', message: 'Too much.' })
find(changed, 'name').help = ''
const { body, errors } = buildMapBody(withUi, changed)
assert.deepEqual(errors, {})
assert.equal(body.ui.label, 'Goods')
assert.deepEqual(body.ui.list, { columns: ['price', 'name'], default_sort: 'name' })
assert.deepEqual(body.ui.dashboard, { count: true })
assert.deepEqual(body.fields.slice(0, 2).map((field) => field.name), ['name', 'id'])
const price = body.fields.find((field) => field.name === 'price')
assert.equal(price.ui.hidden, true)
assert.deepEqual(price.validations, [{ rule: 'min', value: 0, message: "Prices can't be negative." }, { rule: 'max', value: 99.5, message: 'Too much.' }])
// An emptied help text leaves the key out; the label stays.
assert.deepEqual(body.fields.find((field) => field.name === 'name').ui, { label: 'Product name' })
// The field's other parts are sent as they were read.
assert.equal(body.fields.find((field) => field.name === 'tags').type, 'array')

// Problems found before sending.
const bad = buildMapEdit(map)
find(bad, 'name').validations = [{ rule: 'max', value: 'lots', message: '' }]
bad.columns = ['name', 'name']
bad.sortField = 'nope'
const problems = buildMapBody(map, bad).errors
assert.equal(problems['name.validations.0'], 'Enter a number.')
assert.match(problems.columns, /only once/)
assert.match(problems.sort, /one of the fields/)

// The saved map still draws the generic views (#81): the edit reaches them through Pane's map.
const view = buildRecordView({ ...map, ui: body.ui, fields: body.fields })
assert.deepEqual(view.columns.map((column) => column.name), ['price', 'name'])
assert.equal(view.fields[0].name, 'name')

// Requests: PUT with If-Match, never without the version; stable map names only.
const config = { paneBaseUrl: '/pane', expectedApplicationId: '01900000-0000-7000-8000-000000000042', expectedOrigin: 'https://latte.test' }
const requests = []
function service(respond) {
  const pane = createPaneClient(config)
  pane.defaults.adapter = async (request) => {
    requests.push(request)
    return respond(request)
  }
  return createMapsService(pane, config)
}
const answer = (request, status, data, headers = {}) => {
  const response = { status, statusText: String(status), headers, config: request, data }
  if (status < 400) return response
  throw new AxiosError('failed', 'ERR_BAD_REQUEST', request, null, response)
}

const ok = service((request) => answer(request, 200, { data: { type: 'table_map', attributes: map } }, { etag: '"table_map-3"' }))
const saved = await ok.saveTableMap('app', 'products', '"table_map-2"', body)
assert.equal(saved.etag, '"table_map-3"')
assert.equal(requests[0].method, 'put')
assert.equal(requests[0].url, '/maps/app/products')
assert.equal(requests[0].headers.get('If-Match'), '"table_map-2"')
assert.deepEqual(JSON.parse(requests[0].data), body)
await assert.rejects(ok.saveTableMap('App', 'products', '"x"', body), /stable map names/)
await assert.rejects(ok.saveTableMap('app', '../users', '"x"', body), /stable map names/)
assert.equal(requests.length, 1)

// A stale edit is Pane's 412 version_conflict; a system map is 409 system_map_protected.
for (const [status, code] of [[412, 'version_conflict'], [409, 'system_map_protected'], [403, 'permission_denied']]) {
  const failing = service((request) => answer(request, status, { error: { code, message: 'no' } }))
  await assert.rejects(
    failing.saveTableMap('app', 'products', '"table_map-1"', body),
    (error) => paneErrorCode(error) === code && error.response.status === status,
  )
}

console.log('maps editor ok')
