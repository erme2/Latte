import type { LatteRuntimeConfig } from './types.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const portPattern = '(?:[1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])'
const dnsLabelPattern = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const httpsHostPattern = `(?:${dnsLabelPattern}(?:\\.${dnsLabelPattern})*|\\[[0-9a-f:.]+\\])`
const trustedOriginPattern = new RegExp(
  `^(?:https://${httpsHostPattern}(?::(?!443$)${portPattern})?|http://(?:localhost|127\\.0\\.0\\.1|\\[::1\\])(?::(?!80$)${portPattern})?)$`,
)
const relativeBasePattern = /^\/(?!\/)(?:[A-Za-z0-9_~-]+(?:[.-][A-Za-z0-9_~-]+)*(?:\/[A-Za-z0-9_~-]+(?:[.-][A-Za-z0-9_~-]+)*)*)?\/?$/

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Latte runtime configuration must be a JSON object.')
  }

  return value as Record<string, unknown>
}

function requiredString(config: Record<string, unknown>, key: string): string {
  const value = config[key]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Latte runtime configuration requires ${key}.`)
  }

  return value.trim()
}

function expectedUuid(config: Record<string, unknown>, key: string): string {
  const value = requiredString(config, key)

  if (!uuidPattern.test(value)) {
    throw new Error(`${key} must be a UUID.`)
  }

  return value.toLowerCase()
}

function paneBaseUrl(config: Record<string, unknown>): string {
  const value = requiredString(config, 'paneBaseUrl')

  if (value.startsWith('/')) {
    if (!relativeBasePattern.test(value)) {
      throw new Error(
        'paneBaseUrl must be a normalized root-relative path without an authority, dot segments, query, or fragment.',
      )
    }

    return value.replace(/\/$/, '') || '/'
  }

  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new Error('paneBaseUrl must be a root-relative path or an absolute HTTP(S) URL.')
  }

  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  const httpIsLoopback = parsed.protocol !== 'http:' || loopbackHosts.has(parsed.hostname.toLowerCase())
  const normalizedPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
  const canonical = `${parsed.origin}${normalizedPath}`

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !httpIsLoopback ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !relativeBasePattern.test(parsed.pathname) ||
    value !== canonical
  ) {
    throw new Error(
      'paneBaseUrl must be a canonical credential-free HTTPS URL, or loopback HTTP URL, without a query or fragment.',
    )
  }

  return canonical
}

function expectedOrigin(config: Record<string, unknown>): string {
  const value = requiredString(config, 'expectedOrigin')
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new Error('expectedOrigin must be a serialized HTTP(S) origin.')
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.origin !== value ||
    !trustedOriginPattern.test(value)
  ) {
    throw new Error('expectedOrigin must be a canonical serialized HTTP(S) origin.')
  }

  return parsed.origin
}

export function parseLatteRuntimeConfig(value: unknown): LatteRuntimeConfig {
  const config = objectValue(value)
  const allowed = new Set([
    'paneBaseUrl',
    'expectedApplicationId',
    'expectedOrganizationId',
    'expectedOrigin',
  ])
  const unknown = Object.keys(config).filter((key) => !allowed.has(key))

  if (unknown.length > 0) {
    throw new Error(`Unknown Latte runtime configuration: ${unknown.join(', ')}.`)
  }

  return {
    paneBaseUrl: paneBaseUrl(config),
    expectedApplicationId: expectedUuid(config, 'expectedApplicationId'),
    expectedOrganizationId: expectedUuid(config, 'expectedOrganizationId'),
    expectedOrigin: expectedOrigin(config),
  }
}

export async function loadLatteRuntimeConfig(
  url = '/latte-config.json',
  fetcher: typeof fetch = fetch,
): Promise<LatteRuntimeConfig> {
  const response = await fetcher(url, { cache: 'no-store', credentials: 'same-origin' })

  if (!response.ok) {
    throw new Error(`Unable to load Latte runtime configuration (${response.status}).`)
  }

  return parseLatteRuntimeConfig(await response.json())
}

export function assertBrowserOrigin(config: LatteRuntimeConfig, origin: string): void {
  if (origin !== config.expectedOrigin) {
    throw new Error('This build is running on an origin other than its configured Pane registration.')
  }
}
