import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const readme = readFileSync('README.md', 'utf8');
const docs = readFileSync('docs/hostinger-hosting.md', 'utf8');
const htaccess = readFileSync('public/.htaccess', 'utf8');
const hostingerConfig = JSON.parse(readFileSync('docs/examples/latte-config.hostinger.json', 'utf8'));

assert.equal(existsSync('public/.htaccess'), true);
assert.match(htaccess, /RewriteEngine On/);
assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -f \[OR\]/);
assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -d/);
assert.match(htaccess, /RewriteRule \^ index\.html \[END\]/);

// Simulates the cache headers in public/.htaccess for a request path.
// SetEnvIf sets an env var when its regex matches the request path.
// <FilesMatch> sections apply in file order against the file's base name, and
// a later "Header set" replaces an earlier one; "env=NAME" makes it apply only
// when NAME is set. Returns the Cache-Control value, or undefined.
function cacheControlFor(htaccessText, requestPath) {
  const baseName = requestPath.split('/').pop();
  const env = new Set();
  for (const [, pattern, name] of htaccessText.matchAll(/SetEnvIf Request_URI "([^"]+)" (\w+)/g)) {
    if (new RegExp(pattern).test(requestPath)) {
      env.add(name);
    }
  }
  const sections = htaccessText.matchAll(
    /<FilesMatch "([^"]+)">\s*Header set Cache-Control "([^"]+)"(?: env=(\w+))?\s*<\/FilesMatch>/g,
  );
  let value;
  for (const [, pattern, header, envName] of sections) {
    if (new RegExp(pattern).test(baseName) && (!envName || env.has(envName))) {
      value = header;
    }
  }
  return value;
}

function filesUnder(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

const NO_STORE = 'no-store, no-cache, must-revalidate, max-age=0';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'public, max-age=0, must-revalidate';

// Build the real upload artifact into a temporary directory, so the checks
// cover what Vite actually copies into dist/.
const outDir = mkdtempSync(join(tmpdir(), 'latte-hostinger-dist-'));
try {
  const build = spawnSync(
    join('node_modules', '.bin', 'vite'),
    ['build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
    { encoding: 'utf8' },
  );
  assert.equal(build.status, 0, `vite build failed:\n${build.stdout}${build.stderr}`);

  const distFiles = filesUnder(outDir);
  const distHtaccess = readFileSync(join(outDir, '.htaccess'), 'utf8');

  assert.equal(distHtaccess, htaccess, 'dist/.htaccess must be the committed public/.htaccess');
  assert.equal(
    distFiles.some((file) => file.includes('latte-config.hostinger')),
    false,
    'the Hostinger example config must not be copied into dist/',
  );
  assert.equal(distFiles.some((file) => file.startsWith('docs')), false);

  assert.equal(cacheControlFor(distHtaccess, '/index.html'), NO_STORE);
  assert.equal(cacheControlFor(distHtaccess, '/latte-config.json'), NO_STORE);

  // Files served at a fixed URL must revalidate, or a changed favicon could
  // stay cached for a year.
  for (const file of ['favicon.svg', 'icons.svg']) {
    assert.equal(distFiles.includes(file), true, `${file} should be in dist/`);
    assert.equal(cacheControlFor(distHtaccess, `/${file}`), REVALIDATE, file);
  }

  // Vite's hashed build output is the only thing cached as immutable.
  const hashedAssets = distFiles.filter((file) => file.startsWith('assets'));
  assert.ok(hashedAssets.length > 0, 'expected hashed assets in dist/assets');
  for (const file of hashedAssets) {
    assert.equal(cacheControlFor(distHtaccess, `/${file.split(/[\\/]/).join('/')}`), IMMUTABLE, file);
  }

  // Only the path decides immutability: a fixed-URL public/ file whose name
  // happens to look hashed must still revalidate.
  for (const path of ['/logo-12345678.svg', '/images/logo-12345678.svg', '/assets/nested/app-12345678.js']) {
    assert.equal(cacheControlFor(distHtaccess, path), REVALIDATE, path);
  }
  assert.match(distHtaccess, /<IfModule mod_setenvif\.c>/);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

assert.equal(hostingerConfig.paneBaseUrl, 'https://pane.erme2.com');
assert.equal(hostingerConfig.expectedOrigin, 'https://latte.erme2.com');
assert.equal(typeof hostingerConfig.expectedApplicationId, 'string');
assert.equal(typeof hostingerConfig.expectedOrganizationId, 'string');

assert.match(docs, /https:\/\/latte\.erme2\.com/);
assert.match(docs, /https:\/\/pane\.erme2\.com/);
assert.match(docs, /\/home\/u253124519\/domains\/erme2\.com\/public_html\/latte/);
assert.match(docs, /FRONTEND_URL=https:\/\/latte\.erme2\.com/);
assert.match(docs, /WORKOS_REDIRECT_URI=https:\/\/latte\.erme2\.com\/auth\/callback/);
assert.match(docs, /public assertion data/);
assert.match(docs, /must never contain passwords, API keys,\s+database credentials, WorkOS secrets, invitation tokens/);
assert.match(docs, /VITE_PANE_PROXY_\*/);
assert.match(docs, /copied into `dist\/` by Vite/);
assert.match(docs, /\/dashboard/);
assert.match(docs, /\/auth\/callback/);
assert.match(docs, /do not delete the `\/latte` directory/);

assert.match(readme, /Hostinger Alpha Hosting/);
