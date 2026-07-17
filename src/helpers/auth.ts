import { AxiosError } from 'axios'
import { validateAuthRedirectUrl } from './auth-redirect.mjs'
import { pane } from './connection'

export type PaneUser = {
  user_id?: number
  name?: string
  email?: string
  workos_id?: string
  workos_organization_id?: string | null
  last_login_at?: string | null
}

export type AuthUserResponse = {
  user: PaneUser | null
  workos_organization_id: string | null
}

type LoginUrlResponse = {
  authorization_url: string
  state: string
}

type LoginCallbackPayload = {
  code: string | null
  state: string | null
  error?: string
  error_description?: string
}

type LoginCallbackRequest = {
  key: string
  promise: Promise<AuthUserResponse>
}

const sessionKey = 'burro.auth'

let loginRedirectInProgress = false
let loginCallbackInProgress: LoginCallbackRequest | null = null
let completedLoginCallbackKey: string | null = null

export function getStoredAuth(): AuthUserResponse | null {
  const value = window.sessionStorage.getItem(sessionKey)

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as AuthUserResponse
  } catch {
    window.sessionStorage.removeItem(sessionKey)
    return null
  }
}

export function storeAuth(auth: AuthUserResponse): void {
  window.sessionStorage.setItem(sessionKey, JSON.stringify(auth))
}

export function clearStoredAuth(): void {
  window.sessionStorage.removeItem(sessionKey)
  loginRedirectInProgress = false
  loginCallbackInProgress = null
  completedLoginCallbackKey = null
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof AxiosError && [401, 403].includes(error.response?.status ?? 0)
}

export async function getCurrentUser(): Promise<AuthUserResponse> {
  const { data } = await pane.get<AuthUserResponse>('/auth/user')
  storeAuth(data)

  return data
}

export async function login(redirectTo: string): Promise<void> {
  if (loginRedirectInProgress) {
    return
  }

  loginRedirectInProgress = true

  try {
    const { data } = await pane.get<LoginUrlResponse>('/auth/login-url', {
      params: {
        redirect_to: redirectTo,
      },
    })

    window.location.assign(
      validateAuthRedirectUrl(
        data.authorization_url,
        import.meta.env.VITE_AUTH_REDIRECT_ALLOWED_HOSTS,
      ),
    )
  } catch (error) {
    loginRedirectInProgress = false
    throw error
  }
}

export function makeLoginCallbackPayload(params: URLSearchParams): LoginCallbackPayload {
  const payload: LoginCallbackPayload = {
    code: params.get('code'),
    state: params.get('state'),
  }

  const error = params.get('error')
  const errorDescription = params.get('error_description')

  if (error) {
    payload.error = error
  }

  if (errorDescription) {
    payload.error_description = errorDescription
  }

  return payload
}

function loginCallbackKey(payload: LoginCallbackPayload): string {
  return JSON.stringify([
    payload.code,
    payload.state,
    payload.error ?? null,
    payload.error_description ?? null,
  ])
}

async function submitLoginCallback(
  payload: LoginCallbackPayload,
  key: string,
): Promise<AuthUserResponse> {
  const { data } = await pane.post<AuthUserResponse>('/auth/callback', payload)
  storeAuth(data)
  completedLoginCallbackKey = key

  return data
}

export function completeLoginCallback(params: URLSearchParams): Promise<AuthUserResponse> {
  const payload = makeLoginCallbackPayload(params)
  const key = loginCallbackKey(payload)

  if (completedLoginCallbackKey === key) {
    const storedAuth = getStoredAuth()

    if (storedAuth) {
      return Promise.resolve(storedAuth)
    }
  }

  if (loginCallbackInProgress?.key === key) {
    return loginCallbackInProgress.promise
  }

  const promise = submitLoginCallback(payload, key).finally(() => {
    if (loginCallbackInProgress?.key === key && loginCallbackInProgress.promise === promise) {
      loginCallbackInProgress = null
    }
  })

  loginCallbackInProgress = { key, promise }

  return promise
}
