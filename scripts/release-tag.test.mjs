import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { nextReleaseTag } from './release-tag.mjs';

const head = 'a'.repeat(40);
const older = 'b'.repeat(40);
const tagObject = 'c'.repeat(40);

assert.equal(nextReleaseTag('', head), 'v0.1.0');
assert.equal(nextReleaseTag(`${older}\trefs/tags/v0.1.0\n`, head), 'v0.1.1');

// Highest version by number, not by text order.
assert.equal(
  nextReleaseTag(`${older}\trefs/tags/v0.9.0\n${older}\trefs/tags/v0.10.0\n${older}\trefs/tags/v0.2.7\n`, head),
  'v0.10.1',
);

// A hand-pushed minor or major bump is the new base.
assert.equal(nextReleaseTag(`${older}\trefs/tags/v0.1.4\n${older}\trefs/tags/v1.0.0\n`, head), 'v1.0.1');

// Only plain vX.Y.Z tags count.
assert.equal(
  nextReleaseTag(`${older}\trefs/tags/v2.0.0-alpha.1\n${older}\trefs/tags/latest\n${older}\trefs/tags/v0.3.0\n`, head),
  'v0.3.1',
);

// Already tagged commits get no second tag, lightweight or annotated.
assert.equal(nextReleaseTag(`${head}\trefs/tags/v0.1.0\n`, head), null);
assert.equal(nextReleaseTag(`${tagObject}\trefs/tags/v0.2.0\n${head}\trefs/tags/v0.2.0^{}\n`, head), null);

const cli = (sha, input) => execFileSync('node', ['scripts/release-tag.mjs', sha], { input, encoding: 'utf8', stdio: 'pipe' });
assert.equal(cli(head, `${older}\trefs/tags/v0.1.0\n`), 'v0.1.1\n');
assert.equal(cli(head, `${head}\trefs/tags/v0.1.0\n`), '');
assert.throws(() => cli('main', ''), { status: 1 });

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
assert.match(workflow, /push:\n\s+branches:\n\s+- main/);
assert.doesNotMatch(workflow, /pull_request/);
assert.match(workflow, /^permissions:\n\s+contents: read/m);
assert.match(workflow, /cancel-in-progress: false/);
for (const step of ['npm ci', 'npm test', 'npm run lint', 'npm run build']) {
  assert.match(workflow, new RegExp(`run: ${step}\n`));
}
assert.match(workflow, /needs: checks/);
assert.match(workflow, /contents: write/);
