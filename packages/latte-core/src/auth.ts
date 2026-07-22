import type { AxiosInstance } from 'axios'
import { assertLatteSession } from './session.js'
import type { LatteRuntimeConfig, LatteSession } from './types.js'

type LoginIntentResponse = {
  data: { authorization_url: string; state: string }
}

export type LoginRedirectResult =
  | { status: 'redirecting' }
  | { status: 'error'; message: string }

export async function attemptLoginRedirect(beginLogin: () => Promise<void>): Promise<LoginRedirectResult> {
  try {
    await beginLogin()
    return { status: 'redirecting' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to start sign in',
    }
  }
}

export function validateAuthRedirectUrl(value: string, allowedHosts: readonly string[]): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error('Pane returned an untrusted authentication redirect URL.')
  }
  const hostname = url.hostname.toLowerCase()
  const allowed = allowedHosts.some((pattern) => {
    const normalized = pattern.toLowerCase()
    return normalized.startsWith('*.')
      ? hostname.endsWith(normalized.slice(1)) && hostname !== normalized.slice(2)
      : hostname === normalized
  })

  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed) {
    throw new Error('Pane returned an untrusted authentication redirect URL.')
  }

  return url.toString()
}

export function createAuthService(
  pane: AxiosInstance,
  config: LatteRuntimeConfig,
  allowedAuthHosts: readonly string[] = ['api.workos.com', '*.authkit.app'],
) {
  return {
    async session(): Promise<LatteSession> {
      const { data } = await pane.get<LatteSession>('/session')
      return assertLatteSession(data, config)
    },

    async beginLogin(redirectTo: string, invitationToken?: string): Promise<void> {
      await pane.post('/csrf-cookie')
      const { data } = await pane.post<LoginIntentResponse>('/auth/login-intents', {
        redirect_to: redirectTo,
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
      })

      window.location.assign(validateAuthRedirectUrl(data.data.authorization_url, allowedAuthHosts))
    },

    async completeLogin(code: string, state: string): Promise<LatteSession> {
      const { data } = await pane.post<LatteSession>('/auth/callback', { code, state })
      return assertLatteSession(data, config)
    },

    async logout(): Promise<void> {
      await pane.delete('/session')
    },
  }
}
