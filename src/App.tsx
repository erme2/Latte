import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  type AuthUserResponse,
  completeLoginCallback,
  getCurrentUser,
  getStoredAuth,
  isUnauthenticated,
  login,
} from './helpers/auth'
import { paneUrl } from './helpers/connection'

type AuthState = 'checking' | 'authenticated' | 'redirecting' | 'error'

const dashboardPath = '/dashboard'

function dashboardUrl(): string {
  return new URL(dashboardPath, window.location.origin).toString()
}

function hasWorkOsCallbackParams(): boolean {
  const params = new URLSearchParams(window.location.search)

  return params.has('code') || params.has('error')
}

function App() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [authUser, setAuthUser] = useState<AuthUserResponse | null>(() => getStoredAuth())
  const [message, setMessage] = useState('Checking your Pane session')

  const redirectTo = useMemo(() => dashboardUrl(), [])

  useEffect(() => {
    let active = true

    async function authenticate(): Promise<void> {
      try {
        if (hasWorkOsCallbackParams()) {
          setMessage('Completing WorkOS login')
          const auth = await completeLoginCallback(new URLSearchParams(window.location.search))

          if (!active) {
            return
          }

          setAuthUser(auth)
          setAuthState('authenticated')
          window.history.replaceState(null, '', dashboardPath)
          return
        }

        const auth = await getCurrentUser()

        if (!active) {
          return
        }

        setAuthUser(auth)
        setAuthState('authenticated')

        if (window.location.pathname !== dashboardPath) {
          window.history.replaceState(null, '', dashboardPath)
        }
      } catch (error) {
        if (!active) {
          return
        }

        if (isUnauthenticated(error)) {
          setAuthState('redirecting')
          setMessage('Redirecting to WorkOS login')
          await login(redirectTo)
          return
        }

        setAuthState('error')
        setMessage(error instanceof Error ? error.message : 'Unable to check authentication')
      }
    }

    void authenticate()

    return () => {
      active = false
    }
  }, [redirectTo])

  if (authState !== 'authenticated') {
    return (
      <main className="auth-shell">
        <section className="status-panel" aria-live="polite">
          <span className="status-dot" data-state={authState} />
          <p className="eyebrow">Burro</p>
          <h1>{message}</h1>
          {authState === 'error' ? (
            <div className="actions">
              <button className="button" type="button" onClick={() => void login(redirectTo)}>
                Sign in with WorkOS
              </button>
            </div>
          ) : null}
        </section>
      </main>
    )
  }

  const user = authUser?.user

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">Burro demo</p>
          <h1>Dashboard</h1>
        </div>
        <span className="session-badge">Signed in</span>
      </header>

      <section className="summary-grid" aria-label="Authenticated user summary">
        <article>
          <span>Name</span>
          <strong>{user?.name ?? 'Unknown'}</strong>
        </article>
        <article>
          <span>Email</span>
          <strong>{user?.email ?? 'No email returned'}</strong>
        </article>
        <article>
          <span>WorkOS user</span>
          <strong>{user?.workos_id ?? 'Not linked'}</strong>
        </article>
        <article>
          <span>Organization</span>
          <strong>
            {authUser?.workos_organization_id ?? user?.workos_organization_id ?? 'None'}
          </strong>
        </article>
      </section>

      <section className="activity">
        <div>
          <h2>Pane connection</h2>
          <p>Burro owns the login redirect and Pane owns the authenticated session.</p>
        </div>
        <code>{paneUrl('/auth/user')}</code>
      </section>
    </main>
  )
}

export default App
