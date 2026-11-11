import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  developmentRelease,
  latteReleaseDetails,
  latteReleaseLabel,
  loadLatteRelease,
  parseLatteRelease,
} from '../packages/latte-core/dist/index.js'

const deployed = {
  version: '0.1.3',
  ref: 'v0.1.3',
  commit: '400c9dd64210b9204dc8b64efeb57a8ff2296ce2',
  built_at: '2026-11-10T15:08:09Z',
}

// A tagged release, as written by erme2/deploy.
const release = parseLatteRelease(deployed)
assert.deepEqual(release, {
  version: '0.1.3',
  ref: 'v0.1.3',
  commit: '400c9dd64210b9204dc8b64efeb57a8ff2296ce2',
  builtAt: '2026-11-10T15:08:09Z',
})
assert.equal(latteReleaseLabel(release), 'v0.1.3')
assert.equal(
  latteReleaseDetails(release),
  'Latte v0.1.3 · ref v0.1.3 · commit 400c9dd64210 · built 2026-11-10T15:08:09Z',
)

// Untagged deploys (a branch or commit) and local builds.
const branch = parseLatteRelease({ ...deployed, version: '0.0.0-dev+400c9dd', ref: 'main' })
assert.equal(latteReleaseLabel(branch), 'dev · 400c9dd')
assert.equal(latteReleaseLabel(developmentRelease), 'dev')
assert.equal(latteReleaseDetails(developmentRelease), 'Latte dev')

// Missing, malformed or unsafe metadata falls back to "dev" instead of showing it.
for (const body of [null, 'x', {}, { version: 1 }, { version: '<script>' }, { version: 'a'.repeat(200) }]) {
  assert.deepEqual(parseLatteRelease(body), developmentRelease, JSON.stringify(body))
}
assert.equal(parseLatteRelease({ ...deployed, commit: 'not-a-sha' }).commit, null)
assert.equal(parseLatteRelease({ ...deployed, ref: 'v0.1.3 <b>' }).ref, null)

// Loading never throws: HTML fallbacks (dev server, SPA rewrite) and network errors show "dev".
const realFetch = globalThis.fetch
try {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/latte-release.json')
    assert.equal(init.cache, 'no-store')
    return new Response(JSON.stringify(deployed), { headers: { 'content-type': 'application/json' } })
  }
  assert.equal(latteReleaseLabel(await loadLatteRelease()), 'v0.1.3')

  globalThis.fetch = async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
  assert.deepEqual(await loadLatteRelease(), developmentRelease)

  globalThis.fetch = async () => new Response('missing', { status: 404 })
  assert.deepEqual(await loadLatteRelease(), developmentRelease)

  globalThis.fetch = async () => {
    throw new TypeError('offline')
  }
  assert.deepEqual(await loadLatteRelease(), developmentRelease)
} finally {
  globalThis.fetch = realFetch
}

// The badge has its own root, so it shows on every screen (loading, redirects, errors).
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
assert.match(html, /<div id="latte-release"><\/div>/)
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
assert.match(main, /createRoot\(document\.getElementById\('latte-release'\)!\)/)
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.match(css, /\.release-badge \{[^}]*position: fixed;[^}]*right:[^}]*bottom:/s)

console.log('latte release badge tests passed')
