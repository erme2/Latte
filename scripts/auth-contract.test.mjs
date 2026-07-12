import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync('src/helpers/auth.ts', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(auth, /state: params\.get\('state'\)/);
assert.match(auth, /pane\.post<AuthUserResponse>\('\/auth\/callback', payload\)/);
assert.doesNotMatch(auth, /sessionStorage\.setItem\([^)]*state/i);
assert.match(readme, /Pane owns server-side OAuth state validation/);
assert.match(readme, /Burro forwards the callback state to Pane/);
