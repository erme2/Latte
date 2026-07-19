import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const auth = readFileSync('src/helpers/auth.ts', 'utf8');
const compose = readFileSync('docker-compose.dev.yml', 'utf8');
const html = readFileSync('index.html', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

assert.equal(packageJson.name, 'latte');
assert.equal(packageLock.name, 'latte');
assert.equal(packageLock.packages[''].name, 'latte');
assert.match(html, /<title>Latte<\/title>/);
assert.match(app, />Latte</);
assert.doesNotMatch(app, />Burro(?: demo)?</);
assert.match(auth, /const sessionKey = 'latte\.auth'/);
assert.match(compose, /^  latte:/m);
assert.match(compose, /container_name: latte/);
assert.doesNotMatch(compose, /^  burro:/m);
