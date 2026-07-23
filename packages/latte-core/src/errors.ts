import axios from 'axios'

export const paneAccessErrorCodes = [
  'application_not_allowed',
  'organization_context_mismatch',
  'organization_inactive',
  'membership_required',
] as const

export type PaneAccessErrorCode = (typeof paneAccessErrorCodes)[number]

export type PaneAccessFailure = {
  code: PaneAccessErrorCode
  kind: 'deployment_unavailable' | 'organization_unavailable' | 'access_denied'
  message: string
  requestId?: string
}

function accessFailure(code: PaneAccessErrorCode, requestId?: string): PaneAccessFailure {
  if (code === 'organization_inactive') {
    return {
      code,
      kind: 'organization_unavailable',
      message: 'This organization is not currently available.',
      requestId,
    }
  }

  if (code === 'membership_required') {
    return {
      code,
      kind: 'access_denied',
      message: 'Your account does not have access to this application.',
      requestId,
    }
  }

  return {
    code,
    kind: 'deployment_unavailable',
    message: 'This application is not available for its configured organization.',
    requestId,
  }
}

/** Returns a presentation-safe fixed-organization failure for Pane 403 responses. */
export function paneAccessFailure(error: unknown): PaneAccessFailure | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 403) return null

  const body = error.response.data as {
    error?: { code?: unknown; request_id?: unknown }
  } | undefined
  const code = body?.error?.code

  if (typeof code !== 'string' || !paneAccessErrorCodes.includes(code as PaneAccessErrorCode)) {
    return null
  }

  const requestId = typeof body?.error?.request_id === 'string'
    ? body.error.request_id
    : undefined

  return accessFailure(code as PaneAccessErrorCode, requestId)
}
