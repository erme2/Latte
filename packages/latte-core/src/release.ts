// Release metadata written next to the build by the deploy (`latte-release.json`).
// Local and preview builds have no such file and show as "dev".

export type LatteRelease = {
  version: string
  ref: string | null
  commit: string | null
  builtAt: string | null
}

export const developmentRelease: LatteRelease = { version: 'dev', ref: null, commit: null, builtAt: null }

const SAFE_VALUE = /^[A-Za-z0-9._/@+:-]{1,128}$/

function safeString(value: unknown): string | null {
  return typeof value === 'string' && SAFE_VALUE.test(value) ? value : null
}

/** Release metadata from the parsed `latte-release.json`, or "dev" when it is missing or malformed. */
export function parseLatteRelease(body: unknown): LatteRelease {
  if (typeof body !== 'object' || body === null) return developmentRelease
  const raw = body as Record<string, unknown>
  const version = safeString(raw.version)
  if (!version) return developmentRelease
  const commit = safeString(raw.commit)

  return {
    version,
    ref: safeString(raw.ref),
    commit: commit && /^[0-9a-f]{7,40}$/i.test(commit) ? commit.toLowerCase() : null,
    builtAt: safeString(raw.built_at),
  }
}

/** Short label: `v0.1.3` for releases, `dev · abc1234` for untagged builds, `dev` locally. */
export function latteReleaseLabel(release: LatteRelease): string {
  const short = release.commit?.slice(0, 7)
  if (/^\d+\.\d+\.\d+$/.test(release.version)) return `v${release.version}`
  if (release.version === 'dev' || release.version.startsWith('0.0.0-dev')) {
    return short ? `dev · ${short}` : 'dev'
  }
  return short ? `${release.version} · ${short}` : release.version
}

/** Longer text for the tooltip: version, ref, commit and build time when known. */
export function latteReleaseDetails(release: LatteRelease): string {
  return [
    `Latte ${latteReleaseLabel(release)}`,
    release.ref && `ref ${release.ref}`,
    release.commit && `commit ${release.commit.slice(0, 12)}`,
    release.builtAt && `built ${release.builtAt}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Fetches `latte-release.json` without caching; never throws. */
export async function loadLatteRelease(url = '/latte-release.json'): Promise<LatteRelease> {
  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit' })
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return developmentRelease
    return parseLatteRelease(await response.json())
  } catch {
    return developmentRelease
  }
}
