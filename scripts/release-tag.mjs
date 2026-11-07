// Picks the release tag for a commit on main from `git ls-remote --tags` output.
// Run as `node scripts/release-tag.mjs <sha>` with that output on stdin: prints the
// next vX.Y.Z tag, or nothing when the commit already has one.
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
    .map(([sha, match]) => ({ sha, name: match[1], version: match.slice(2, 5).map(Number) }));
}

export function nextReleaseTag(lsRemote, sha) {
  const tags = releaseTags(lsRemote);
  // Annotated tags list the tag object and, with ^{}, the commit it points to.
  if (tags.some((tag) => tag.sha === sha)) {
    return null;
  }
  const versions = tags.map((tag) => tag.version);
  if (versions.length === 0) {
    return 'v0.1.0';
  }
  const [major, minor, patch] = versions.reduce((latest, version) =>
    compareVersions(version, latest) > 0 ? version : latest,
  );
  return `v${major}.${minor}.${patch + 1}`;
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
  const tag = nextReleaseTag(readFileSync(0, 'utf8'), sha);
  if (tag) {
    console.log(tag);
  }
}
