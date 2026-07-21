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

  if (
    session.data.application.attributes.organization_id !== config.expectedOrganizationId ||
    session.data.organization.id !== config.expectedOrganizationId ||
    session.data.membership.attributes.organization_id !== config.expectedOrganizationId
  ) {
    throw new Error('Pane session organization does not match this deployment.')
  }

  return session
}

export function hasOrganizationRole(
  session: LatteSession,
  allowedRoles: readonly OrganizationRole[],
): boolean {
  return allowedRoles.includes(session.data.membership.attributes.role)
}
