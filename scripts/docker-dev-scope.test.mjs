import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

assert.equal(existsSync('Dockerfile'), false, 'A default Dockerfile could be mistaken for a production image');
assert.equal(existsSync('docker-compose.yml'), true, 'The default Compose file must start Latte local HTTPS development');

const dockerfile = readFileSync('Dockerfile.dev', 'utf8');
const defaultCompose = readFileSync('docker-compose.yml', 'utf8');
const compose = readFileSync('docker-compose.dev.yml', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(dockerfile, /COPY --chown=node:node packages\/latte-core\/package\.json \.\/packages\/latte-core\/package\.json/);
assert.match(dockerfile, /CMD \["\.\/bash\/docker-dev-entrypoint\.sh"\]/);
assert.match(compose, /dockerfile: Dockerfile\.dev/);
assert.match(compose, /expose:\n\s+- "5173"/);
assert.doesNotMatch(compose, /127\.0\.0\.1:5173:5173/);
assert.match(compose, /^  latte-nginx:/m);
assert.match(compose, /image: nginx:1\.25-alpine/);
assert.match(compose, /container_name: latte-nginx/);
assert.match(compose, /"127\.0\.0\.1:443:443"/);
assert.match(compose, /\/nginx\/default\.conf:\/etc\/nginx\/conf\.d\/default\.conf:ro/);
assert.match(defaultCompose, /docker-compose\.dev\.yml/);
assert.match(defaultCompose, /^  latte-nginx:/m);
assert.match(readme, /docker compose up/);
assert.match(readme, /https:\/\/latte\.localhost/);
assert.match(readme, /only for local development/);
assert.match(readme, /must run `npm run build`/);
