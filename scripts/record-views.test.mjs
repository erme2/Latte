import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import axios from 'axios'
import {
  createDataService,
  formatRecordValue,
  parseRecordInput,
  recordFieldLabel,
  recordFieldWidget,
  recordFormFields,
  recordInputValue,
  recordListColumns,
  recordListSort,
  recordValidationMessages,
  recordWriteFailure,
} from '../packages/latte-core/dist/index.js'
import { resolveProductRoute } from '../src/product/runtime.mjs'

// Record list and edit views (Latte#70) against Pane's /data contract (contracts/pane-v1.json, Pane#156).
const organizationId = '01900000-0000-7000-8000-000000000071'
const config = {
  paneBaseUrl: '/pane',
  expectedApplicationId: '01900000-0000-7000-8000-000000000072',
  expectedOrganizationId: organizationId,
  expectedOrigin: 'https://latte.test',
}
const fixture = (name) => JSON.parse(readFileSync(`scripts/fixtures/data-products-${name}.json`, 'utf8'))
const tableMap = fixture('table-map').data.attributes
const rows = fixture('rows')
const errors = fixture('errors')
const keysOf = (value) => Object.keys(value).sort()

// The fixtures follow the contract's DataRowCollection and error shapes.
assert.deepEqual(keysOf(rows), ['data', 'meta'])
assert.deepEqual(keysOf(rows.meta.page), ['has_more', 'next_cursor'])
for (const row of rows.data) {
  assert.equal(row.type, 'data_row')
  assert.deepEqual(keysOf(row.attributes), ['row_key', 'source', 'table', 'values'])
  assert.match(row.attributes.row_key, /^[A-Za-z0-9_-]+$/)
}
for (const field of tableMap.fields) {
  assert.deepEqual(keysOf(field), ['computed', 'default', 'description', 'format', 'name', 'nullable', 'primary', 'sortable', 'type', 'ui', 'validations'])
}
for (const body of Object.values(errors)) assert.deepEqual(keysOf(body.error).filter((key) => key !== 'details'), ['code', 'message', 'request_id'])

// ---- The data service calls the /data routes by stable map name, with paging, sort and If-Match.
const calls = []
let reply = null
const pane = axios.create({
  adapter: async (request) => {
    calls.push({ method: request.method, url: request.url, params: request.params, data: request.data, ifMatch: request.headers.get('If-Match') })
    if (reply) {
      const { status, body } = reply
      throw Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: body } })
    }
    const etagged = (data, status = 200) => ({ data, status, statusText: 'OK', headers: { etag: '"row-2"' }, config: request })
    if (request.method === 'get' && request.url.endsWith('/rows')) return { data: rows, status: 200, statusText: 'OK', headers: {}, config: request }
    if (request.method === 'delete') return { data: '', status: 204, statusText: 'No Content', headers: {}, config: request }
    if (request.method === 'post') return etagged({ data: rows.data[0], meta: { request_id: 'r' } }, 201)
    return etagged({ data: rows.data[1], meta: { request_id: 'r' } })
  },
})
const data = createDataService(pane, config)
const base = `/organizations/${organizationId}/data/app/tables/products/rows`

const page = await data.list('app', 'products', { limit: 25, sort: '-created_at' })
assert.equal(page.data.length, 2)
assert.equal(page.meta.page.next_cursor, 'eyJpZCI6Mn0')
assert.deepEqual(calls.at(-1), { method: 'get', url: base, params: { 'page[limit]': 25, sort: '-created_at' }, data: undefined, ifMatch: undefined })
await data.list('app', 'products', { cursor: 'eyJpZCI6Mn0' })
assert.deepEqual(calls.at(-1).params, { 'page[cursor]': 'eyJpZCI6Mn0' })

const row = await data.get('app', 'products', 'Mg')
assert.equal(row.etag, '"row-2"')
assert.equal(calls.at(-1).url, `${base}/Mg`)

await data.create('app', 'products', { name: 'Bagel' })
assert.deepEqual([calls.at(-1).method, calls.at(-1).url, JSON.parse(calls.at(-1).data)], ['post', base, { values: { name: 'Bagel' } }])

await data.update('app', 'products', 'Mg', { price: 3 }, '"row-2"')
assert.deepEqual([calls.at(-1).method, JSON.parse(calls.at(-1).data), calls.at(-1).ifMatch], ['patch', { values: { price: 3 } }, '"row-2"'])

await data.remove('app', 'products', 'Mg', '"row-2"')
assert.deepEqual([calls.at(-1).method, calls.at(-1).url, calls.at(-1).ifMatch], ['delete', `${base}/Mg`, '"row-2"'])

// Page URLs can't steer requests elsewhere: names, row keys and sort are checked before any call.
const before = calls.length
for (const [source, table] of [['app', 'Products'], ['app', '../maps'], ['', 'products']]) {
  await assert.rejects(data.list(source, table), /stable map names/)
}
for (const rowKey of ['', '../x', 'a/b', 'a=']) await assert.rejects(data.get('app', 'products', rowKey), /base64url/)
await assert.rejects(data.list('app', 'products', { sort: 'name,price' }), /Sort by one field/)
assert.equal(calls.length, before)

// ---- Denied actions and validation errors become messages the screens show.
const fail = async (status, body, action) => {
  reply = { status, body }
  try {
    await action()
    assert.fail('expected a rejection')
  } catch (error) {
    return recordWriteFailure(error)
  } finally {
    reply = null
  }
}
assert.deepEqual(await fail(422, errors.validation_failed, () => data.create('app', 'products', {})), {
  kind: 'validation',
  message: 'The request could not be processed.',
  fields: { name: ['required'], price: ['must be a number'] },
})
assert.equal((await fail(403, errors.permission_denied, () => data.update('app', 'products', 'Mg', { name: 'x' }, '"row-2"'))).kind, 'denied')
assert.equal((await fail(403, errors.permission_denied, () => data.remove('app', 'products', 'Mg', '"row-2"'))).kind, 'denied')
assert.equal((await fail(403, errors.permission_denied, () => data.create('app', 'products', { name: 'x' }))).kind, 'denied')
const accessDenied = await fail(403, errors.membership_required, () => data.list('app', 'products'))
assert.deepEqual(accessDenied, { kind: 'denied', message: 'Your account does not have access to this application.' })
assert.equal((await fail(404, errors.resource_not_found, () => data.get('app', 'products', 'Mw'))).kind, 'not_found')
assert.equal((await fail(412, errors.version_conflict, () => data.update('app', 'products', 'Mg', {}, '"old"'))).kind, 'conflict')
assert.equal((await fail(503, {}, () => data.list('app', 'products'))).kind, 'unknown')
assert.equal(recordWriteFailure(new Error('network')).kind, 'unknown')

// ---- List view: columns and sort from the map's ui part.
const field = (name) => tableMap.fields.find((candidate) => candidate.name === name)
assert.deepEqual(recordListColumns(tableMap).map((column) => column.name), ['name', 'price'])
const noColumns = { ...tableMap, ui: null }
assert.deepEqual(recordListColumns(noColumns).map((column) => column.name), ['id', 'name', 'price', 'contact', 'notes'])
assert.equal(recordListSort(tableMap), '-created_at')
assert.equal(recordListSort(noColumns), undefined)
assert.equal(recordListSort({ ...tableMap, ui: { list: { default_sort: 'tags' } } }), undefined, 'not sortable')
assert.equal(recordListSort({ ...tableMap, ui: { list: { default_sort: 'nope' } } }), undefined, 'unknown field')

assert.equal(recordFieldLabel(field('name')), 'Product name')
assert.equal(recordFieldLabel(field('secret_note')), 'Secret note')
assert.equal(formatRecordValue(field('price'), null), '—')
assert.equal(formatRecordValue(field('available'), false), 'No')
assert.equal(formatRecordValue(field('tags'), ['bread']), '["bread"]')
assert.equal(formatRecordValue(field('name'), 'Sourdough'), 'Sourdough')

// ---- Edit view: writable fields, widgets, input parsing and the map's client hints.
assert.deepEqual(recordFormFields(tableMap, 'create').map((item) => item.name), ['id', 'name', 'price', 'contact', 'notes', 'available', 'tags'])
assert.deepEqual(recordFormFields(tableMap, 'edit').map((item) => item.name), ['name', 'price', 'contact', 'notes', 'available', 'tags'])
assert.deepEqual(
  tableMap.fields.map((item) => recordFieldWidget(item)),
  ['number', 'text', 'number', 'email', 'textarea', 'checkbox', 'json', 'text', 'date'],
)
assert.equal(recordFieldWidget({ ...field('name'), ui: { widget: 'textarea' } }), 'textarea')
assert.equal(recordFieldWidget({ ...field('name'), ui: { widget: 'colour-wheel' } }), 'text', 'unknown widgets fall back to the type')
assert.equal(recordFieldWidget({ ...field('name'), type: 'password' }), 'password')

assert.equal(recordInputValue(field('tags'), ['a']), '[\n  "a"\n]')
assert.equal(recordInputValue(field('created_at'), '2026-11-10T09:00:00Z'), '2026-11-10')
assert.equal(recordInputValue(field('price'), null), '')
assert.deepEqual(parseRecordInput(field('price'), '4.5'), { ok: true, value: 4.5 })
assert.deepEqual(parseRecordInput(field('price'), 'abc'), { ok: false, message: 'Enter a number.' })
assert.deepEqual(parseRecordInput(field('price'), ''), { ok: true, value: null })
assert.deepEqual(parseRecordInput(field('id'), ''), { ok: false, message: 'Enter a value.' })
assert.deepEqual(parseRecordInput(field('name'), ''), { ok: true, value: '' })
assert.deepEqual(parseRecordInput(field('available'), false), { ok: true, value: false })
assert.deepEqual(parseRecordInput(field('tags'), '["a","b"]'), { ok: true, value: ['a', 'b'] })
assert.equal(parseRecordInput(field('tags'), '{"a":1}').ok, false)
assert.equal(parseRecordInput(field('tags'), '[oops').ok, false)

assert.deepEqual(recordValidationMessages(field('name'), 'Sourdough'), [])
assert.deepEqual(recordValidationMessages(field('name'), 'A very long loaf'), ['At most 12 characters.'])
assert.deepEqual(recordValidationMessages(field('price'), -1), ["Prices can't be negative."])
assert.deepEqual(recordValidationMessages(field('price'), null), [])
assert.deepEqual(recordValidationMessages(field('contact'), 'not-an-email'), ['Enter an email address.'])
assert.deepEqual(recordValidationMessages(field('contact'), 'baker@example.test'), [])

// ---- Routes: list, create and edit all belong to the records function; /new is the create form.
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
const routes = [
  { id: 'records', path: '/records/:source/:table', function: 'records' },
  { id: 'record-new', path: '/records/:source/:table/new', function: 'records' },
  { id: 'record-edit', path: '/records/:source/:table/:rowKey', function: 'records' },
]
for (const { id, path } of routes) {
  assert.match(manifest, new RegExp(`id: '${id}',\\s+path: '${path.replaceAll('/', '\\/')}'`))
}
assert.ok(manifest.indexOf("id: 'record-new'") < manifest.indexOf("id: 'record-edit'"))
const on = new Set(['records'])
const resolve = (pathname, enabled = on) => resolveProductRoute(routes, pathname, 'organization_user', enabled)
assert.equal(resolve('/records/app/products/new').route.id, 'record-new')
assert.deepEqual(resolve('/records/app/products/Mg').params, { source: 'app', table: 'products', rowKey: 'Mg' })
assert.equal(resolve('/records/app/products/Mg', new Set()).status, 'not_found')

// The pages use the data service and show Pane's per-field validation messages.
const editor = readFileSync('src/product/records/RecordEditor.tsx', 'utf8')
const list = readFileSync('src/product/records/RecordList.tsx', 'utf8')
assert.match(list, /data\.list\(table\.source, table\.table/)
assert.match(editor, /data\.update\(table\.source, table\.table, current\.rowKey, values, current\.etag\)/)
assert.match(editor, /failure\.kind === 'validation'\) setFieldErrors\(failure\.fields\)/)
assert.match(editor, /untouched && input === ''\) continue/)
assert.doesNotMatch(editor, /input === false\) continue/)
assert.match(editor, /disabled=\{busy\}/)
assert.match(readFileSync('docs/template-contract.md', 'utf8'), /createDataService/)
