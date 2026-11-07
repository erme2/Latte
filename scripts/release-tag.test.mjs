import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

// A commit already contained in the latest tag (a newer merge was tagged first)
// gets no tag, so a higher version never points at older code.
const containedIn = (descendant) => (ancestor, commit) => ancestor === older && commit === descendant;
assert.equal(nextReleaseTag(`${head}\trefs/tags/v0.1.0\n`, older, containedIn(head)), null);
// Annotated: compare with the peeled commit, not the tag object.
assert.equal(nextReleaseTag(`${tagObject}\trefs/tags/v0.1.0\n${head}\trefs/tags/v0.1.0^{}\n`, older, containedIn(head)), null);
assert.equal(nextReleaseTag(`${tagObject}\trefs/tags/v0.1.0\n${head}\trefs/tags/v0.1.0^{}\n`, older, containedIn(tagObject)), 'v0.1.1');

// The CLI checks ancestry with git in the current clone.
const script = resolve('scripts/release-tag.mjs');
const repo = mkdtempSync(join(tmpdir(), 'latte-release-tag-'));
try {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '--quiet');
  git('config', 'user.name', 'Latte Test');
  git('config', 'user.email', 'latte@example.test');
  git('config', 'commit.gpgsign', 'false');
  git('commit', '--quiet', '--allow-empty', '-m', 'first');
  const first = git('rev-parse', 'HEAD');
  git('commit', '--quiet', '--allow-empty', '-m', 'second');
  const second = git('rev-parse', 'HEAD');

  const cli = (sha, input) =>
    execFileSync('node', [script, sha], { cwd: repo, input, encoding: 'utf8', stdio: 'pipe' });
  assert.equal(cli(second, `${first}\trefs/tags/v0.1.0\n`), 'v0.1.1\n');
  assert.equal(cli(second, `${second}\trefs/tags/v0.1.0\n`), '');
  assert.equal(cli(first, `${second}\trefs/tags/v0.1.0\n`), '');
  // A latest tag on a commit this clone lacks is an error, not a silent skip.
  assert.throws(() => cli(second, `${head}\trefs/tags/v0.1.0\n`), { status: 1 });
  assert.throws(() => cli('main', ''), { status: 1 });
} finally {
  rmSync(repo, { recursive: true, force: true });
}

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
assert.match(workflow, /push:\n\s+branches:\n\s+- main/);
assert.doesNotMatch(workflow, /pull_request/);
assert.match(workflow, /^permissions:\n\s+contents: read/m);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /^  queue: max$/m);
for (const step of ['npm ci', 'npm test', 'npm run lint', 'npm run build']) {
  assert.match(workflow, new RegExp(`run: ${step}\n`));
}
assert.match(workflow, /needs: checks/);
assert.match(workflow, /contents: write/);
assert.match(workflow, /fetch-depth: 0/);
