import { useEffect, useState } from 'react'
import {
  adminOnlyLoginUrl,
  attemptLoginRedirect,
  authenticationFailureMessage,
  callbackRecoveryPath,
  hasAuthenticationCallback,
  hasOrganizationRole,
  invitationTokenFromSearch,
  isAuthenticationRequired,
  paneAccessFailure,
  resolveInitialAuthentication,
  type LatteSession,
  type LoginRedirectResult,
} from '@erme2/latte'
import type { LatteProduct, LatteRuntime, ProductContext } from './product/contract'
import { resolveProductRoute } from './product/runtime.mjs'
import './App.css'

type AuthState = 'checking' | 'authenticated' | 'redirecting' | 'error'

function redirectUrl(path: string): string {
  return new URL(path, window.location.origin).toString()
}

// Starts sign-in. An admin-only console with a loginUrl hands sign-in to that page and
// never starts its own login; otherwise the console starts login as before.
function beginSignIn<Services extends object>(
  runtime: LatteRuntime<Services>,
  defaultPath: string,
  invitationToken?: string,
): Promise<LoginRedirectResult> {
  const loginUrl = adminOnlyLoginUrl(runtime.config, window.location.href)

  if (loginUrl) {
    window.location.replace(loginUrl)
    return Promise.resolve({ status: 'redirecting' })
  }

  return attemptLoginRedirect(() => runtime.auth.beginLogin(redirectUrl(defaultPath), invitationToken))
}

function retryAuthentication(defaultPath: string): void {
  const recoveryPath = callbackRecoveryPath(window.location.search, defaultPath)

  if (recoveryPath) {
    window.history.replaceState(null, '', recoveryPath)
  }

  window.location.reload()
}

type Props<Services extends object> = {
  runtime: LatteRuntime<Services>
  product: LatteProduct<Services>
}

export default function App<Services extends object>({ runtime, product }: Props<Services>) {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [session, setSession] = useState<LatteSession | null>(null)
  const [message, setMessage] = useState('Checking your Pane session')

  useEffect(() => {
    let active = true

    async function authenticate(): Promise<void> {
      try {
        const invitation = invitationTokenFromSearch(window.location.search)

        if (invitation.status === 'invalid') {
          setAuthState('error')
          setMessage(invitation.message)
          return
        }

        if (invitation.status === 'ready' && !hasAuthenticationCallback(window.location.search)) {
          setAuthState('redirecting')
          setMessage('Redirecting to accept invitation')
          const result = await beginSignIn(runtime, product.defaultPath, invitation.token)

          if (result.status === 'error' && active) {
            setAuthState('error')
            setMessage(result.message)
          }
          return
        }

        const initial = await resolveInitialAuthentication(
          window.location.search,
          runtime.auth,
          runtime.config,
        )

        if (!active) return

        if (initial.status === 'error') {
          setAuthState('error')
          setMessage(initial.message)
          return
        }

        if (initial.status === 'product_redirect') {
          // Admin-only console: non-administrators go to the product app and
          // never see a console screen.
          setAuthState('redirecting')
          setMessage('This console is for organization administrators. Redirecting to the app')
          window.location.replace(initial.url)
          return
        }

        setSession(initial.session)
        setAuthState('authenticated')

        if (initial.fromCallback) {
          window.history.replaceState(null, '', product.defaultPath)
        }
      } catch (error) {
        if (!active) return

        if (isAuthenticationRequired(error)) {
          setAuthState('redirecting')
          setMessage('Redirecting to sign in')
          const result = await beginSignIn(runtime, product.defaultPath)

          if (result.status === 'error' && active) {
            setAuthState('error')
            setMessage(result.message)
          }
          return
        }

        const accessFailure = paneAccessFailure(error)
        if (accessFailure) {
          setAuthState('error')
          setMessage(accessFailure.message)
          return
        }

        setAuthState('error')
        setMessage(authenticationFailureMessage(error))
      }
    }

    void authenticate()
    return () => {
      active = false
    }
  }, [runtime, product.defaultPath])

  useEffect(() => {
    if (authState !== 'authenticated') return undefined

    const interceptor = runtime.pane.interceptors.response.use(undefined, (error: unknown) => {
      const accessFailure = paneAccessFailure(error)

      if (accessFailure) {
        setSession(null)
        setAuthState('error')
        setMessage(accessFailure.message)
      } else if (isAuthenticationRequired(error)) {
        setSession(null)
        setAuthState('redirecting')
        setMessage('Your session expired. Redirecting to sign in')
        void beginSignIn(runtime, product.defaultPath)
          .then((result) => {
            if (result.status === 'error') {
              setAuthState('error')
              setMessage(result.message)
            }
          })
      }

      return Promise.reject(error)
    })

    return () => {
      runtime.pane.interceptors.response.eject(interceptor)
    }
  }, [authState, runtime, product.defaultPath])

  async function logout(): Promise<void> {
    setAuthState('redirecting')
    setMessage('Signing out')

    try {
      const logoutUrl = await runtime.auth.logout()
      window.location.assign(logoutUrl)
    } catch (error) {
      setAuthState('error')
      setMessage(authenticationFailureMessage(error))
    }
  }

  if (authState !== 'authenticated' || !session) {
    return (
      <main className="auth-shell">
        <section className="status-panel" aria-live="polite">
          <span className="status-dot" data-state={authState} />
          <p className="eyebrow">{product.brand.name}</p>
          <h1>{message}</h1>
          {authState === 'error' ? (
            <div className="actions">
              <button
                className="button"
                type="button"
                onClick={() => retryAuthentication(product.defaultPath)}
              >
                Try sign in again
              </button>
            </div>
          ) : null}
        </section>
      </main>
    )
  }

  const resolution = resolveProductRoute(
    product.routes,
    window.location.pathname,
    session.data.membership.attributes.role,
  )
  const params = resolution.status === 'not_found' ? {} : resolution.params
  const context: ProductContext<Services> = {
    config: runtime.config,
    pane: runtime.pane,
    organization: runtime.organization,
    rows: runtime.rows,
    services: runtime.services,
    session,
    params,
  }
  const Page = resolution.status === 'matched'
    ? resolution.route.component
    : resolution.status === 'forbidden'
      ? product.forbiddenPage
      : product.notFoundPage

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">{product.brand.tagline}</p>
          <h1>
            <img className="brand-logo" src="/latte-logo.svg" alt={product.brand.name} width="168" height="67" />
          </h1>
        </div>
        <nav aria-label="Primary navigation">
          {product.navigation
            .filter((item) => !item.roles || hasOrganizationRole(session, item.roles))
            .map((item) => (
              <a href={item.path} key={item.id}>{item.label}</a>
            ))}
          <button className="nav-button" type="button" onClick={() => { void logout() }}>
            Sign out
          </button>
        </nav>
      </header>
      {Page ? <Page context={context} /> : <h2>Page not found</h2>}
    </main>
  )
}
