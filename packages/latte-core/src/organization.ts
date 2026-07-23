import type { LatteRuntimeConfig } from './types.js'

function segment(value: string): string {
  if (value.length === 0) {
    throw new Error('Pane organization route segments must not be empty.')
  }

  return encodeURIComponent(value)
}

export type OrganizationRouter = {
  readonly organizationId: string
  path(...segments: readonly string[]): string
}

/**
 * Builds Pane paths below the deployment's fixed organization. The organization
 * identifier is deliberately not accepted at call sites, so URL or form state
 * cannot select another organization.
 */
export function createOrganizationRouter(config: LatteRuntimeConfig): OrganizationRouter {
  const root = `/organizations/${segment(config.expectedOrganizationId)}`

  return Object.freeze({
    organizationId: config.expectedOrganizationId,
    path(...segments: readonly string[]): string {
      return segments.length === 0
        ? root
        : `${root}/${segments.map(segment).join('/')}`
    },
  })
}
