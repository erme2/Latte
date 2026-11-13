import {
  paneErrorCode,
  type OrganizationMembershipResource,
  type OrganizationRole,
} from '@erme2/latte'

const roleLabels: Record<OrganizationRole, string> = {
  organization_administrator: 'Administrator',
  organization_user: 'User',
}

export function actionFailureMessage(error: unknown): string {
  const code = paneErrorCode(error)

  switch (code) {
    case 'operation_conflict':
      return 'Pane rejected the change because it would conflict with the current organization state.'
    case 'version_conflict':
      return 'This record changed while you were working. Refresh and try again.'
    case 'permission_denied':
      return 'Pane rejected the change because this account cannot perform that action.'
    case 'validation_failed':
      return 'Check the form values and try again.'
    case 'rate_limited':
      return 'Too many attempts. Wait a moment, then try again.'
    default:
      return 'Unable to complete the organization administration action.'
  }
}

export function formatRole(role: OrganizationRole): string {
  return roleLabels[role]
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function memberDisplayName(membership: OrganizationMembershipResource): string {
  return membership.attributes.user_name || membership.attributes.user_email || membership.attributes.user_id
}
