import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

assert.equal(existsSync('Dockerfile'), false, 'A default Dockerfile could be mistaken for a production image');
assert.equal(existsSync('docker-compose.yml'), false, 'A default Compose file could expose the dev server accidentally');

const dockerfile = readFileSync('Dockerfile.dev', 'utf8');
const compose = readFileSync('docker-compose.dev.yml', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(dockerfile, /CMD \["npm", "run", "dev"/);
assert.match(compose, /dockerfile: Dockerfile\.dev/);
assert.match(compose, /"127\.0\.0\.1:5173:5173"/);
assert.match(readme, /docker compose -f docker-compose\.dev\.yml up/);
assert.match(readme, /only for local development/);
assert.match(readme, /must run `npm run build`/);
