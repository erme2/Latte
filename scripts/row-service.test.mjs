import assert from 'node:assert/strict'
import axios from 'axios'
import { createRowService } from '../packages/latte-core/dist/index.js'

const calls = []
const rowDocument = {
  data: {
    id: '01900000-0000-7000-8000-000000000004',
    type: 'row',
    attributes: { values: { name: 'Ada' } },
  },
  meta: { request_id: '01900000-0000-7000-8000-000000000005' },
}
const pane = axios.create({
  adapter: async (config) => {
    calls.push(config)
    return {
      data: rowDocument,
      status: config.method === 'delete' ? 204 : 200,
      statusText: 'OK',
      headers: config.method === 'delete' ? {} : { etag: '"row-v1"' },
      config,
    }
  },
})
const service = createRowService(pane, {
  paneBaseUrl: '/pane',
  expectedApplicationId: '01900000-0000-7000-8000-000000000001',
  expectedOrganizationId: '01900000-0000-7000-8000-000000000002',
  expectedOrigin: 'https://example.test',
})

assert.deepEqual(await service.get('connection', 'table', 'row/key'), {
  document: rowDocument,
  etag: '"row-v1"',
})
assert.match(calls.at(-1).url, /rows\/row%2Fkey$/)

assert.equal((await service.create('connection', 'table', { name: 'Ada' })).etag, '"row-v1"')
assert.deepEqual(JSON.parse(calls.at(-1).data), { values: { name: 'Ada' } })

assert.equal(
  (await service.update('connection', 'table', 'row', { name: 'Grace' }, '"row-v1"')).etag,
  '"row-v1"',
)
assert.deepEqual(JSON.parse(calls.at(-1).data), { values: { name: 'Grace' } })
assert.equal(calls.at(-1).headers.get('If-Match'), '"row-v1"')

await service.remove('connection', 'table', 'row', '"row-v1"')
assert.equal(calls.at(-1).headers.get('If-Match'), '"row-v1"')

const missingEtag = createRowService(
  axios.create({
    adapter: async (config) => ({
      data: rowDocument,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }),
  }),
  {
    paneBaseUrl: '/pane',
    expectedApplicationId: '01900000-0000-7000-8000-000000000001',
    expectedOrganizationId: '01900000-0000-7000-8000-000000000002',
    expectedOrigin: 'https://example.test',
  },
)
await assert.rejects(
  missingEtag.get('connection', 'table', 'row'),
  /required ETag header/,
)
