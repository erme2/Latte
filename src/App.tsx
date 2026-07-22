import { AxiosError, type AxiosInstance } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import {
  createAuthService,
  createPaneClient,
  createRowService,
  hasOrganizationRole,
  attemptLoginRedirect,
  type LatteRuntimeConfig,
  type LatteSession,
} from '@erme2/latte'
import type { LatteProduct, ProductContext } from './product/contract'
import './App.css'

type AuthState = 'checking' | 'authenticated' | 'redirecting' | 'error'

function callbackValues(): { code: string; state: string } | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')

  return code && state ? { code, state } : null
}

function redirectUrl(path: string): string {
  return new URL(path, window.location.origin).toString()
}

function selectedRoute(product: LatteProduct) {
  return (
    product.routes.find((route) => route.path === window.location.pathname) ??
    product.routes.find((route) => route.path === product.defaultPath)
  )
}

type Props = {
  config: LatteRuntimeConfig
  product: LatteProduct
}

export default function App({ config, product }: Props) {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [session, setSession] = useState<LatteSession | null>(null)
  const [message, setMessage] = useState('Checking your Pane session')
  const platform = useMemo(() => {
    const pane = createPaneClient(config)
    return {
      pane,
      auth: createAuthService(pane, config, product.authenticationHosts),
      rows: createRowService(pane, config),
    }
  }, [config, product.authenticationHosts])

  useEffect(() => {
    let active = true

    async function authenticate(): Promise<void> {
      try {
        const callback = callbackValues()
        const result = callback
          ? await platform.auth.completeLogin(callback.code, callback.state)
          : await platform.auth.session()

        if (!active) return
        setSession(result)
        setAuthState('authenticated')

        if (callback) {
          window.history.replaceState(null, '', product.defaultPath)
        }
      } catch (error) {
        if (!active) return

        if (error instanceof AxiosError && error.response?.status === 401) {
          setAuthState('redirecting')
          setMessage('Redirecting to sign in')
          const result = await attemptLoginRedirect(() =>
            platform.auth.beginLogin(redirectUrl(window.location.pathname)),
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
  }, [platform, product.defaultPath])

  if (authState !== 'authenticated' || !session) {
    return (
      <main className="auth-shell">
        <section className="status-panel" aria-live="polite">
          <span className="status-dot" data-state={authState} />
          <p className="eyebrow">{product.brand.name}</p>
          <h1>{message}</h1>
          {authState === 'error' ? (
            <div className="actions">
              <button className="button" type="button" onClick={() => window.location.reload()}>
                Try sign in again
              </button>
            </div>
          ) : null}
        </section>
      </main>
    )
  }

  const context: ProductContext = {
    config,
    pane: platform.pane as AxiosInstance,
    rows: platform.rows,
    session,
  }
  const route = selectedRoute(product)
  const permitted = route && (!route.roles || hasOrganizationRole(session, route.roles))
  const Page = permitted ? route.component : product.forbiddenPage

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
