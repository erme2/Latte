// Picks the release tag for a commit on main from `git ls-remote --tags` output.
// Run as `node scripts/release-tag.mjs <sha>` with that output on stdin, inside a
// clone that has the tagged commits: prints the next vX.Y.Z tag, or nothing when
// the commit already has one or is already contained in the latest tag.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const RELEASE_TAG = /^refs\/tags\/(v(\d+)\.(\d+)\.(\d+))(\^\{\})?$/;

export function releaseTags(lsRemote) {
  return lsRemote
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length === 2)
    .map(([sha, ref]) => [sha, RELEASE_TAG.exec(ref)])
    .filter(([, match]) => match)
    .map(([sha, match]) => ({ sha, name: match[1], version: match.slice(2, 5).map(Number), peeled: Boolean(match[5]) }));
}

// isAncestor(a, b) reports whether commit a is contained in commit b.
export function nextReleaseTag(lsRemote, sha, isAncestor = () => false) {
  const tags = releaseTags(lsRemote);
  // Annotated tags list the tag object and, with ^{}, the commit it points to.
  if (tags.some((tag) => tag.sha === sha)) {
    return null;
  }
  if (tags.length === 0) {
    return 'v0.1.0';
  }
  const latest = tags.reduce((best, tag) => (compareVersions(tag.version, best.version) > 0 ? tag : best));
  const latestCommit = (tags.find((tag) => tag.name === latest.name && tag.peeled) ?? latest).sha;
  // Release runs can start out of merge order. If a newer commit was tagged
  // first, this commit ships in that tag; a higher tag here would deploy older code.
  if (isAncestor(sha, latestCommit)) {
    return null;
  }
  const [major, minor, patch] = latest.version;
  return `v${major}.${minor}.${patch + 1}`;
}

function gitIsAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'pipe' });
    return true;
  } catch (error) {
    if (error.status === 1) {
      return false;
    }
    throw new Error(`git merge-base failed for ${ancestor} and ${descendant}: ${error.stderr ?? error.message}`);
  }
}

function compareVersions(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sha = process.argv[2];
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) {
    console.error('usage: node scripts/release-tag.mjs <full commit sha> < ls-remote-output');
    process.exit(1);
  }
  const tag = nextReleaseTag(readFileSync(0, 'utf8'), sha, gitIsAncestor);
  if (tag) {
    console.log(tag);
  }
}
