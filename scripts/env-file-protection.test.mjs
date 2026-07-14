import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const gitIgnoredPaths = ['.env', '.env.local', '.env.docker', '.env.production'];
const gitTrackedTemplatePaths = ['.env.example', '.env.docker.example'];

for (const path of gitIgnoredPaths) {
  const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', path]);

  assert.equal(result.status, 0, path + ' must be ignored by Git');
}

for (const path of gitTrackedTemplatePaths) {
  const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', path]);

  assert.equal(result.status, 1, path + ' must stay trackable by Git');
}

const dockerIgnoreLines = readFileSync('.dockerignore', 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'));

function dockerIgnoreMatches(pattern, path) {
  if (pattern === '.env') {
    return path === '.env';
  }

  if (pattern === '.env.*') {
    return path.startsWith('.env.');
  }

  if (pattern === '.env.example') {
    return path === '.env.example';
  }

  if (pattern === '.env.docker.example') {
    return path === '.env.docker.example';
  }

  return pattern === path;
}

function isDockerIgnored(path) {
  let ignored = false;

  for (const line of dockerIgnoreLines) {
    const isException = line.startsWith('!');
    const pattern = isException ? line.slice(1) : line;

    if (dockerIgnoreMatches(pattern, path)) {
      ignored = !isException;
    }
  }

  return ignored;
}

for (const path of ['.env', '.env.local', '.env.docker', '.env.production']) {
  assert.equal(isDockerIgnored(path), true, path + ' must be excluded from the Docker build context');
}

for (const path of ['.env.example', '.env.docker.example']) {
  assert.equal(isDockerIgnored(path), false, path + ' must remain available in the Docker build context');
}
