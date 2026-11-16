import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const architecture = readFileSync('docs/architecture.md', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(readme, /\(docs\/architecture\.md\)/, 'README links the architecture document');

for (const heading of [
  '## Role in the product',
  '## Structure',
  '## Authentication, sessions and trust boundaries',
  '## Data and user flows',
  '## Current and target: known differences',
  '## Before making changes',
]) {
  assert.ok(architecture.includes(heading), `architecture document has "${heading}"`);
}

assert.match(architecture, /Target, not implemented/);
assert.match(architecture, /product-architecture\.md/);
assert.match(architecture, /github\.com\/erme2\/Pane\/blob\/main\/docs\/architecture\.md/);
assert.match(architecture, /github\.com\/erme2\/Pane\/blob\/main\/docs\/api-v1\.md/);

// Every repository path the document names in backticks must still exist, so the
// code map can't silently drift from the tree.
const referencedPaths = new Set(
  [...architecture.matchAll(/`((?:src|packages|scripts|docs|nginx|public|\.github)\/[^`\s]+)`/g)]
    .map(([, path]) => path.replace(/\/$/, ''))
    .filter((path) => !path.includes('*')),
);

assert.ok(referencedPaths.size > 20, 'architecture document points to concrete code locations');

// The package module table names files relative to packages/latte-core/.
for (const path of referencedPaths) {
  assert.ok(
    existsSync(path) || existsSync(`packages/latte-core/${path}`),
    `architecture document references a missing path: ${path}`,
  );
}

console.log('architecture document tests passed');
