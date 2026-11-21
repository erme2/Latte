import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createInvitationsService, createPaneClient } from '../packages/latte-core/dist/index.js'

// Invitations (Latte#79) call Pane's installation routes and nothing organization related.
const pane = createPaneClient({
  paneBaseUrl: 'https://pane.example.test',
  expectedApplicationId: '01900000-0000-7000-8000-000000000042',
  expectedOrigin: 'https://latte.test',
})
const calls = []
const id = '01900000-0000-7000-8000-000000000001'
const invitation = {
  id,
  type: 'invitation',
  attributes: {
    email: 'a@example.test', role: 'user', status: 'pending',
    expires_at: '2026-11-22T00:00:00Z', created_at: '2026-11-21T00:00:00Z', updated_at: '2026-11-21T00:00:00Z',
  },
}
pane.defaults.adapter = async (request) => {
  calls.push([request.method, request.url, request.headers.get('If-Match') ?? null, request.data ?? null])
  const reply = (status, data, headers = {}) => ({ data, status, statusText: '', headers, config: request })
  if (request.method === 'post') {
    return reply(201, { data: invitation, meta: { request_id: 'r', invitation_url: 'https://app.test/?invitation_token=x' } }, { etag: '"e1"' })
  }
  if (request.method === 'delete') return reply(204, '')
  if (request.params?.['page[cursor]'] === 'c2') {
    return reply(200, { data: [{ ...invitation, id: 'older' }], meta: { request_id: 'r', page: { next_cursor: null, has_more: false } } })
  }
  return reply(200, { data: [invitation], meta: { request_id: 'r', page: { next_cursor: null, has_more: false } } })
}

const service = createInvitationsService(pane)
assert.equal((await service.list('admin')).data.length, 1)
await service.list('user')
const older = await service.list('admin', 'c2')
assert.equal(older.data[0].id, 'older')
const created = await service.create('user', ' a@example.test ')
assert.equal(created.etag, '"e1"')
assert.equal(created.document.meta.invitation_url, 'https://app.test/?invitation_token=x')
await service.create('admin', 'b@example.test')
await service.revoke('user', id, created.etag)
await assert.rejects(service.revoke('user', '../x', '"e"'))

assert.deepEqual(calls.map(([method, url]) => `${method} ${url}`), [
  'get /installation/pane-admin-invitations',
  'get /installation/user-invitations',
  'get /installation/pane-admin-invitations',
  'post /installation/user-invitations',
  'post /installation/pane-admin-invitations',
  `delete /installation/user-invitations/${id}`,
])
assert.deepEqual(calls[3][3] && JSON.parse(calls[3][3]), { email: 'a@example.test' })
assert.equal(calls[5][2], '"e1"')

const members = readFileSync('src/product/members/Members.tsx', 'utf8')
assert.match(members, /has_more/)
assert.match(members, /next_cursor/)

// The members page is admin only and sits behind the members function.
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
assert.match(manifest, /id: 'members',\s+path: '\/members',\s+component: Members,\s+roles: \['admin'\],\s+function: 'members'/)
console.log('invitations ok')
