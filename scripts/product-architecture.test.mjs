import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const architecture = readFileSync('docs/product-architecture.md', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(readme, /docs\/product-architecture\.md/);
assert.match(architecture, /2026-11-18-sweegly-mvp-roadmap/);
assert.match(architecture, /There are no organizations and no managed database connections/);
assert.match(architecture, /Latte\*\* is the admin frontend over the same Pane API and the same login/);
assert.match(architecture, /Migrations are the source of truth/);
assert.match(architecture, /Hiding a route or a button in Latte is a usability measure only/);
assert.match(architecture, /`latte-config\.json` is public/);

// The retired multi-organization design must not creep back into the product docs.
for (const doc of [architecture, readme]) {
  assert.doesNotMatch(doc, /organization-scoped|organization administrator|Burro application/i);
}
