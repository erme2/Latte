import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AxiosError } from 'axios'
import {
  buildRecordView,
  createCrudService,
  createPaneClient,
  CrudValidationError,
  recordFieldValue,
  recordFormBody,
} from '../packages/latte-core/dist/index.js'
import { resolveProductRoute } from '../src/product/runtime.mjs'

// Generic list and edit views (Latte#81): drawn from a table's map, over Pane's /crud route.
const map = JSON.parse(readFileSync('scripts/fixtures/data-products-table-map.json', 'utf8')).data.attributes
const view = buildRecordView(map)

assert.equal(view.title, 'Products')
assert.equal(view.primaryKey, 'id')
// Configured columns, minus unknown names; a hidden field can still be a configured column.
assert.deepEqual(view.columns.map((column) => column.name), ['name', 'price', 'secret_note'])
assert.equal(view.columns[0].label, 'Product name')
assert.deepEqual(view.sort, { name: 'created_at', order: 'desc' })
// Hidden and computed fields are not editable; the primary key is read-only.
assert.deepEqual(view.fields.map((field) => field.name), ['id', 'name', 'price', 'contact', 'notes', 'available', 'tags'])
const inputs = Object.fromEntries(view.fields.map((field) => [field.name, field.input]))
assert.deepEqual(inputs, { id: 'number', name: 'text', price: 'number', contact: 'email', notes: 'textarea', available: 'checkbox', tags: 'json' })
assert.equal(view.fields.find((field) => field.name === 'id').readOnly, true)
assert.equal(view.fields.find((field) => field.name === 'name').help, 'Up to 12 characters')

// Without a configured list: the first visible fields, no passwords, no sort.
const bare = buildRecordView({
  ...map,
  ui: null,
  fields: [
    ...map.fields.slice(0, 2),
    { ...map.fields[1], name: 'pass', type: 'password' },
    { ...map.fields[1], name: 'Bad-Name' },
  ],
})
assert.equal(bare.title, 'products')
assert.deepEqual(bare.columns.map((column) => column.name), ['id', 'name'])
assert.equal(bare.sort, null)
assert.deepEqual(bare.fields.map((field) => field.name), ['id', 'name', 'pass'])
assert.equal(bare.fields[2].input, 'password')
assert.equal(buildRecordView({ ...map, fields: [map.fields[1]] }).primaryKey, null)

// Editing a row as Pane returns it: dates arrive as objects, JSON as strings, arrays as arrays.
const field = (input, wire = null) => ({ name: 'f', label: 'F', help: null, input, wire, readOnly: false })
assert.equal(recordFieldValue(field('date'), { f: { date: '2021-01-01 00:00:00.000000', timezone_type: 3, timezone: 'UTC' } }), '2021-01-01')
assert.equal(recordFieldValue(field('date'), { f: '2021-02-03' }), '2021-02-03')
assert.equal(recordFieldValue(field('date'), { f: null }), '')
assert.equal(recordFieldValue(field('json', 'json'), { f: { some: 'JSON' } }), '{\n  "some": "JSON"\n}')
// A decoded JSON string (even a number- or object-looking one) round-trips unchanged.
for (const stored of ['hello', '123', '{"x":1}']) {
  const shown = recordFieldValue(field('json', 'json'), { f: stored })
  assert.equal(shown, JSON.stringify(stored, null, 2))
  assert.equal(recordFormBody([field('json', 'json')], { f: shown }).body.f, JSON.stringify(stored))
}
assert.equal(recordFieldValue(field('json', 'array'), { f: ['a'] }), '[\n  "a"\n]')
// Pane's `json` rule needs a string and its `array` type an array.
assert.deepEqual(recordFormBody([field('json', 'json')], { f: '{"some": "JSON"}' }).body, { f: '{"some":"JSON"}' })
assert.deepEqual(recordFormBody([field('json', 'array')], { f: '["a"]' }).body, { f: ['a'] })
assert.equal(recordFormBody([field('json', 'array')], { f: '{}' }).errors.f, 'Enter a JSON array.')
assert.equal(recordFormBody([field('json', 'json')], { f: '{' }).errors.f, 'Enter valid JSON.')
assert.ok(['array', 'json'].includes(view.fields.find((item) => item.name === 'tags').wire))

// The records route needs the records function and takes the source and table from the path.
const routes = [{ id: 'records', path: '/records/:source/:table', function: 'records' }]
assert.deepEqual(resolveProductRoute(routes, '/records/app/products', 'admin', new Set(['records'])).params, { source: 'app', table: 'products' })
assert.equal(resolveProductRoute(routes, '/records/app/products', 'admin', new Set()).status, 'not_found')
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
assert.match(manifest, /path: '\/records\/:source\/:table',\s+component: Records,\s+function: 'records'/)

const config = {
  paneBaseUrl: 'https://pane.example.test',
  expectedApplicationId: '01900000-0000-7000-8000-000000000042',
  expectedOrigin: 'https://latte.test',
}
const pane = createPaneClient(config)
const calls = []
let reply = null
pane.defaults.adapter = async (request) => {
  calls.push({ method: request.method, url: request.url, baseURL: request.baseURL, data: request.data })
  const response = { headers: {}, config: request, statusText: '', ...reply }
  const accepted = request.validateStatus ?? ((status) => status >= 200 && status < 300)
  if (!accepted(response.status)) {
    throw new AxiosError('failed', 'ERR_BAD_REQUEST', request, null, response)
  }
  return response
}
const crud = createCrudService(pane, config)

reply = { status: 200, data: { status: 'OK', data: [{ id: 7, name: 'Tea' }] } }
assert.deepEqual(await crud.get('products', 7), { id: 7, name: 'Tea' })
assert.equal(calls[0].url, '/crud/products/7')
reply = { status: 201, data: { status: 'Created', data: [{ id: 8, name: 'Jam' }] } }
assert.deepEqual(await crud.create('products', { name: 'Jam' }), { id: 8, name: 'Jam' })
assert.equal(calls[1].method, 'post')
assert.equal(calls[1].url, '/crud/products')
assert.equal(calls[1].baseURL, 'https://pane.example.test')
assert.equal(calls[1].data, JSON.stringify({ name: 'Jam' }))
reply = { status: 200, data: { status: 'OK', data: [{ id: 8, name: 'Honey' }] } }
await crud.update('products', 8, { name: 'Honey' })
assert.equal(calls[2].method, 'put')
assert.equal(calls[2].url, '/crud/products/8')
reply = { status: 204, data: '' }
await crud.remove('products', 8)
assert.equal(calls[3].method, 'delete')
assert.equal(calls[3].url, '/crud/products/8')

reply = { status: 404, data: { status: 'Not Found', data: [] } }
assert.equal(await crud.get('products', 99), null)

// Pane's validation answer: 400 with data.errors [{field_name, message}].
reply = { status: 400, data: { status: 'Bad Request', data: { message: 'Validation failed', errors: [{ field_name: 'name', message: 'The name is too long.' }] } } }
await assert.rejects(() => crud.create('products', { name: 'x' }), (error) => {
  assert.ok(error instanceof CrudValidationError)
  assert.deepEqual(error.errors, [{ field: 'name', message: 'The name is too long.' }])
  return true
})
reply = { status: 403, data: {} }
await assert.rejects(() => crud.remove('products', 1), (error) => !(error instanceof CrudValidationError))

const before = calls.length
await assert.rejects(() => crud.get('../users', 1), /stable map names/)
await assert.rejects(() => crud.update('products', '', {}), /record key/)
await assert.rejects(() => crud.create('Bad-Name', {}), /stable map names/)
assert.equal(calls.length, before)
console.log('records ok')
