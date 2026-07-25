import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('Dockerfile.dev', 'utf8');
const compose = readFileSync('docker-compose.dev.yml', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(dockerfile, /FROM node:24-alpine/);
assert.match(dockerfile, /RUN chown node:node \/app/);
assert.match(dockerfile, /USER node/);
assert.match(dockerfile, /COPY --chown=node:node package\.json package-lock\.json \.\//);
assert.match(dockerfile, /COPY --chown=node:node packages\/latte-core\/package\.json \.\/packages\/latte-core\/package\.json/);
assert.match(dockerfile, /COPY --chown=node:node \. \./);
assert.doesNotMatch(dockerfile, /USER root/);

assert.match(compose, /user: "node"/);
assert.match(compose, /- \/app\/node_modules/);
assert.doesNotMatch(compose, /user: ["']?root["']?/);

assert.match(readme, /container runs as the image-provided `node` user/);
assert.match(readme, /`\/app\/node_modules`/);
