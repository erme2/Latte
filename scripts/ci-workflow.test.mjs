import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/pr-tests.yml', 'utf8');

assert.match(workflow, /pull_request:\n\s+types: \[opened, reopened, ready_for_review, synchronize\]/);
assert.doesNotMatch(workflow, /\npush:/);
assert.match(workflow, /actions\/setup-node@v4/);
assert.match(workflow, /cache: npm/);
assert.match(workflow, /run: npm ci/);
assert.match(workflow, /run: npm test/);
assert.match(workflow, /run: npm run lint/);
assert.match(workflow, /run: npm run build/);
