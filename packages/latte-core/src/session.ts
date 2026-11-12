import type { LatteRuntimeConfig, LatteSession, OrganizationRole } from './types.js'

export function assertLatteSession(
  session: LatteSession,
  config: LatteRuntimeConfig,
): LatteSession {
  if (session.data.mode !== 'latte') {
    throw new Error('Pane returned a non-Latte session to a Latte-derived application.')
  }

  if (session.data.application.id !== config.expectedApplicationId) {
    throw new Error('Pane session application does not match this deployment.')
  }

  if (session.data.organization.id !== config.expectedOrganizationId) {
    throw new Error('Pane session organization does not match this deployment.')
  }

  if (session.data.application.attributes.status !== 'active') {
    throw new Error('Pane session application is not active.')
  }

  if (session.data.organization.attributes.status !== 'active') {
    throw new Error('Pane session organization is not active.')
  }

  if (session.data.membership.attributes.status !== 'active') {
    throw new Error('Pane session membership is not active.')
  }

  return session
}

export function hasOrganizationRole(
  session: LatteSession,
  allowedRoles: readonly OrganizationRole[],
): boolean {
  return allowedRoles.includes(session.data.membership.attributes.role)
}

// Where an admin-only console sends this session instead of rendering, or
// null when it may render. Pane still enforces admin-only actions server side.
export function adminOnlyRedirectUrl(
  session: LatteSession,
  config: LatteRuntimeConfig,
): string | null {
  if (!config.adminOnly || hasOrganizationRole(session, ['organization_administrator'])) {
    return null
  }

  return config.adminOnly.productAppUrl
}

// Where an admin-only console sends a signed-out visitor to sign in: the configured
// loginUrl with `next` set to the console page they opened (origin, path and query,
// no fragment). Null when the console should start its own sign-in.
export function adminOnlyLoginUrl(
  config: LatteRuntimeConfig | undefined,
  consoleUrl: string,
): string | null {
  const loginUrl = config?.adminOnly?.loginUrl

  if (!loginUrl) {
    return null
  }

  const current = new URL(consoleUrl)
  const login = new URL(loginUrl)
  login.searchParams.set('next', `${current.origin}${current.pathname}${current.search}`)

  return login.toString()
}
