import type { AxiosInstance } from 'axios'
import { assertLatteSession } from './session.js'
import type { LatteRuntimeConfig, LatteSession } from './types.js'

type LoginIntentResponse = {
  data: { authorization_url: string; state: string }
}

export type LoginRedirectResult =
  | { status: 'redirecting' }
  | { status: 'error'; message: string }

export type InitialAuthenticationResult =
  | { status: 'authenticated'; session: LatteSession; fromCallback: boolean }
  | { status: 'error'; message: string }

type InitialAuthService = {
  session(): Promise<LatteSession>
  completeLogin(code: string, state: string): Promise<LatteSession>
}

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

export function callbackRecoveryPath(search: string, defaultPath: string): string | null {
  const params = new URLSearchParams(search)
  return params.has('code') || params.has('state') || params.has('error') ? defaultPath : null
}

export async function resolveInitialAuthentication(
  search: string,
  auth: InitialAuthService,
): Promise<InitialAuthenticationResult> {
  const params = new URLSearchParams(search)
  const providerError = params.get('error')
  const code = params.get('code')
  const state = params.get('state')
  const hasCallbackInput =
    providerError !== null ||
    params.has('error_description') ||
    code !== null ||
    state !== null

  if (providerError !== null) {
    return {
      status: 'error',
      message: providerError === 'access_denied'
        ? 'Sign in was cancelled.'
        : 'The identity provider could not complete sign in.',
    }
  }

  if (hasCallbackInput && (!code || !state)) {
    return { status: 'error', message: 'The authentication callback is incomplete.' }
  }

  if (code && state) {
    try {
      return {
        status: 'authenticated',
        session: await auth.completeLogin(code, state),
        fromCallback: true,
      }
    } catch {
      return { status: 'error', message: 'Unable to complete sign in.' }
    }
  }

  return {
    status: 'authenticated',
    session: await auth.session(),
    fromCallback: false,
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
  const callbackRequests = new Map<string, Promise<LatteSession>>()
  const completedCallbacks = new Map<string, LatteSession>()

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

    completeLogin(code: string, state: string): Promise<LatteSession> {
      const key = JSON.stringify([code, state])
      const completed = completedCallbacks.get(key)

      if (completed) {
        return Promise.resolve(completed)
      }

      const inFlight = callbackRequests.get(key)

      if (inFlight) {
        return inFlight
      }

      const request = pane
        .post<LatteSession>('/auth/callback', { code, state })
        .then(({ data }) => assertLatteSession(data, config))
      const tracked = request.then(
        (session) => {
          callbackRequests.delete(key)
          completedCallbacks.set(key, session)
          return session
        },
        (error: unknown) => {
          callbackRequests.delete(key)
          throw error
        },
      )

      callbackRequests.set(key, tracked)
      return tracked
    },

    async logout(): Promise<void> {
      await pane.delete('/session')
    },
  }
}
