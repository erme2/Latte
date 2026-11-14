import assert from 'node:assert/strict'
import { versionedItemResponse } from '../packages/latte-core/dist/versioned.js'

const document = {
  data: { id: '01900000-0000-7000-8000-000000000004', type: 'row', attributes: {} },
  meta: { request_id: '01900000-0000-7000-8000-000000000005' },
}

assert.deepEqual(
  versionedItemResponse({ data: document, headers: { etag: '"v1"' } }),
  { document, etag: '"v1"' },
)
assert.equal(versionedItemResponse({ data: document, headers: { ETag: '"v2"' } }).etag, '"v2"')

for (const headers of [{}, { etag: '' }, { etag: 42 }]) {
  assert.throws(
    () => versionedItemResponse({ data: document, headers }),
    /Pane response did not include the required ETag header\./,
  )
}
