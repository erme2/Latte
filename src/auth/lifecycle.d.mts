import type {
  LatteRuntimeConfig,
  LatteSession,
  LoginRedirectResult,
  createAuthService,
} from '@erme2/latte'

export type AuthState = 'checking' | 'authenticated' | 'redirecting' | 'error'

export type AuthStatus = {
  state: AuthState
  message: string
  session: LatteSession | null
}

export type AuthRuntime = {
  config: LatteRuntimeConfig
  auth: ReturnType<typeof createAuthService>
}

export type AuthBrowser = {
  location: Pick<Location, 'href' | 'origin' | 'search' | 'assign' | 'replace' | 'reload'>
  history: Pick<History, 'replaceState'>
}

export type AuthLifecycle = {
  runtime: AuthRuntime
  defaultPath: string
  browser: AuthBrowser
  report(status: AuthStatus): void
}

export function beginSignIn(
  runtime: AuthRuntime,
  defaultPath: string,
  browser: AuthBrowser,
  invitationToken?: string,
): Promise<LoginRedirectResult>
export function authenticate(lifecycle: AuthLifecycle, isActive: () => boolean): Promise<void>
export function handlePaneFailure(lifecycle: AuthLifecycle, error: unknown): void
export function logout(lifecycle: AuthLifecycle): Promise<void>
export function retryAuthentication(defaultPath: string, browser: AuthBrowser): void
