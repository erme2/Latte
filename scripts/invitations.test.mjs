import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canResendInvitation, createInvitationsService, resendNotice, createPaneClient } from '../packages/latte-core/dist/index.js'

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
  if (request.method === 'post' && request.url.endsWith('/resend')) {
    return reply(200, { data: invitation, meta: { request_id: 'r', invitation_url: 'https://app.test/?invitation_token=y', email_sent: false } }, { etag: '"e2"' })
  }
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
const resent = await service.resend(id)
assert.equal(resent.document.meta.invitation_url, 'https://app.test/?invitation_token=y')
assert.equal(resent.document.meta.email_sent, false)
assert.equal(resent.etag, '"e2"')
await assert.rejects(service.resend('../x'))
await assert.rejects(service.revoke('user', '../x', '"e"'))

assert.deepEqual(calls.map(([method, url]) => `${method} ${url}`), [
  'get /installation/pane-admin-invitations',
  'get /installation/user-invitations',
  'get /installation/pane-admin-invitations',
  'post /installation/user-invitations',
  'post /installation/pane-admin-invitations',
  `delete /installation/user-invitations/${id}`,
  `post /installation/user-invitations/${id}/resend`,
])
assert.deepEqual(calls[3][3] && JSON.parse(calls[3][3]), { email: 'a@example.test' })
assert.equal(calls[5][2], '"e1"')

// listAll follows every page, also past 40 pages (1,001 entries at 25 per page), and stops on a repeated cursor.
const pagedPane = createPaneClient({
  paneBaseUrl: 'https://pane.example.test',
  expectedApplicationId: '01900000-0000-7000-8000-000000000042',
  expectedOrigin: 'https://latte.test',
})
let pageCalls = 0
let loop = false
pagedPane.defaults.adapter = async (request) => {
  pageCalls += 1
  const start = Number(request.params?.['page[cursor]'] ?? 0)
  const total = 1001
  const items = []
  for (let n = start; n < Math.min(start + 25, total); n += 1) items.push({ ...invitation, id: `i${n}` })
  const hasMore = loop || start + 25 < total
  const next = loop ? 'same' : String(start + 25)
  return { data: { data: items, meta: { request_id: 'r', page: { next_cursor: hasMore ? next : null, has_more: hasMore } } }, status: 200, statusText: '', headers: {}, config: request }
}
const everything = await createInvitationsService(pagedPane).listAll('user')
assert.equal(everything.length, 1001)
assert.equal(everything.at(-1).id, 'i1000')
assert.equal(pageCalls, 41)
loop = true
pageCalls = 0
await createInvitationsService(pagedPane).listAll('user')
assert.equal(pageCalls, 2)

// Resend is offered for pending user invitations only.
for (const status of ['pending', 'accepted', 'revoked', 'expired']) {
  assert.equal(canResendInvitation('user', status), status === 'pending')
  assert.equal(canResendInvitation('admin', status), false)
}
assert.equal(resendNotice('a@example.test', { email_sent: true }).tone, 'success')
assert.equal(resendNotice('a@example.test', {}).tone, 'success')
const failed = resendNotice('a@example.test', { email_sent: false })
assert.equal(failed.tone, 'error')
assert.match(failed.message, /could not be sent/)

const members = readFileSync('src/product/members/Members.tsx', 'utf8')
assert.match(members, /invitations\.listAll\(/)
assert.match(members, /invitations\.resend\(/)
assert.match(members, /Resend invitation/)
// After a resend the row takes the new ETag and the superseded create link is cleared, so revoke still works.
assert.match(members, /etag: result\.etag/)
assert.match(members, /setCreated\(null\)/)

// The members page is admin only and sits behind the members function.
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
assert.match(manifest, /id: 'members',\s+path: '\/members',\s+component: Members,\s+roles: \['admin'\],\s+function: 'members'/)
console.log('invitations ok')
