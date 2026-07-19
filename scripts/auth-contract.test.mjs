import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync('src/helpers/auth.ts', 'utf8');
const connection = readFileSync('src/helpers/connection.ts', 'utf8');
const workosDoc = readFileSync('docs/workos-auth.md', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(auth, /state: params\.get\('state'\)/);
assert.match(auth, /pane\.post<AuthUserResponse>\('\/auth\/callback', payload\)/);
assert.match(auth, /loginRedirectInProgress/);
assert.match(auth, /if \(loginRedirectInProgress\)/);
assert.doesNotMatch(auth, /sessionStorage\.setItem\([^)]*state/i);
assert.match(readme, /Pane owns server-side OAuth state validation/);
assert.match(readme, /Latte forwards the callback state to Pane/);

assert.match(auth, /loginCallbackInProgress/);
assert.match(auth, /completedLoginCallbackKey/);
assert.match(auth, /makeLoginCallbackPayload/);
assert.match(connection, /withXSRFToken: true/);
assert.match(connection, /xsrfCookieName: 'XSRF-TOKEN'/);
assert.match(connection, /xsrfHeaderName: 'X-XSRF-TOKEN'/);
assert.match(workosDoc, /in-flight guard/);
assert.match(workosDoc, /X-XSRF-TOKEN/);
assert.match(readme, /X-XSRF-TOKEN/);
