import { AxiosError } from 'axios'
import { useEffect, useState } from 'react'
import {
  attemptLoginRedirect,
  callbackRecoveryPath,
  hasOrganizationRole,
  resolveInitialAuthentication,
  type LatteSession,
} from '@erme2/latte'
import type { LatteProduct, LatteRuntime, ProductContext } from './product/contract'
import { resolveProductRoute } from './product/runtime.mjs'
import './App.css'

type AuthState = 'checking' | 'authenticated' | 'redirecting' | 'error'

function redirectUrl(path: string): string {
  return new URL(path, window.location.origin).toString()
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
        const initial = await resolveInitialAuthentication(window.location.search, runtime.auth)

        if (!active) return

        if (initial.status === 'error') {
          setAuthState('error')
          setMessage(initial.message)
          return
        }

        setSession(initial.session)
        setAuthState('authenticated')

        if (initial.fromCallback) {
          window.history.replaceState(null, '', product.defaultPath)
        }
      } catch (error) {
        if (!active) return

        if (error instanceof AxiosError && error.response?.status === 401) {
          setAuthState('redirecting')
          setMessage('Redirecting to sign in')
          const result = await attemptLoginRedirect(() =>
            runtime.auth.beginLogin(redirectUrl(window.location.pathname)),
          )

          if (result.status === 'error' && active) {
            setAuthState('error')
            setMessage(result.message)
          }
          return
        }

        setAuthState('error')
        setMessage(error instanceof Error ? error.message : 'Unable to start the application')
      }
    }

    void authenticate()
    return () => {
      active = false
    }
  }, [runtime, product.defaultPath])

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
          <h1>{product.brand.name}</h1>
        </div>
        <nav aria-label="Primary navigation">
          {product.navigation
            .filter((item) => !item.roles || hasOrganizationRole(session, item.roles))
            .map((item) => (
              <a href={item.path} key={item.id}>{item.label}</a>
            ))}
        </nav>
      </header>
      {Page ? <Page context={context} /> : <h2>Page not found</h2>}
    </main>
  )
}
