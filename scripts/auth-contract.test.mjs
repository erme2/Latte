import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync('packages/latte-core/src/auth.ts', 'utf8')
const client = readFileSync('packages/latte-core/src/client.ts', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')
const workosDoc = readFileSync('docs/workos-auth.md', 'utf8')

assert.match(auth, /pane\.post\('\/csrf-cookie'\)/)
assert.match(auth, /pane\.post<LoginIntentResponse>\('\/auth\/login-intents'/)
assert.match(auth, /pane\.post<LatteSession>\('\/auth\/callback'/)
assert.match(auth, /pane\.get<LatteSession>\('\/session'\)/)
assert.match(auth, /assertLatteSession/)
assert.match(auth, /validateAuthRedirectUrl/)
assert.match(client, /\/api\/v1/)
assert.match(client, /withXSRFToken: true/)
assert.match(client, /xsrfHeaderName: 'X-XSRF-TOKEN'/)
assert.match(app, /error\.response\?\.status === 401/)
assert.match(app, /attemptLoginRedirect/)
assert.match(app, /Try sign in again/)
assert.doesNotMatch(app, /organization[_-]?id.*params/i)
assert.match(workosDoc, /Pane owns.*application.*organization/is)
assert.match(workosDoc, /X-XSRF-TOKEN/)
