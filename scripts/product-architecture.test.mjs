import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const architecture = readFileSync('docs/product-architecture.md', 'utf8');
const readme = readFileSync('README.md', 'utf8');

assert.match(readme, /docs\/product-architecture\.md/);
assert.match(
  architecture,
  /permanently linked to exactly one\s+organization/,
);
assert.match(
  architecture,
  /Every organization-scoped API route includes an explicit organization\s+identifier/,
);
assert.match(
  architecture,
  /route organization matches the application's registered organization/,
);
assert.match(
  architecture,
  /Installation-scoped Pane-administrator routes do not require an organization\s+identifier/,
);
assert.match(
  architecture,
  /mismatch is rejected before Pane resolves or reveals an\s+organization-owned resource/i,
);
assert.match(architecture, /route identifier alone never\s+grants access/);
assert.match(
  architecture,
  /exact route prefix, organization identifier form, and API version syntax\n\s+remain implementation decisions/i,
);
