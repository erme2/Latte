import { useEffect, useMemo, useState } from 'react'
import './App.css'

type AuthState = 'checking' | 'authenticated' | 'redirecting' | 'error'

type PaneUser = {
  user_id?: number
  name?: string
  email?: string
  workos_id?: string
  workos_organization_id?: string | null
  last_login_at?: string | null
}

type AuthUserResponse = {
  user: PaneUser | null
  workos_organization_id: string | null
}

const paneBaseUrl = import.meta.env.VITE_PANE_BASE_URL ?? 'http://localhost:8000'
const dashboardPath = '/dashboard'

function authLoginUrl(): string {
  const redirectTo = new URL(dashboardPath, window.location.origin)
  const loginUrl = new URL('/auth/login', paneBaseUrl)
  loginUrl.searchParams.set('redirect_to', redirectTo.toString())

  return loginUrl.toString()
}

async function fetchCurrentUser(): Promise<AuthUserResponse> {
  const response = await fetch(new URL('/auth/user', paneBaseUrl), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('unauthenticated')
  }

  if (!response.ok) {
    throw new Error(`Pane auth check failed with status ${response.status}`)
  }

  return response.json() as Promise<AuthUserResponse>
}

function App() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [authUser, setAuthUser] = useState<AuthUserResponse | null>(null)
  const [message, setMessage] = useState('Checking your Pane session')

  const loginUrl = useMemo(() => authLoginUrl(), [])

  useEffect(() => {
    let active = true

    fetchCurrentUser()
      .then((data) => {
        if (!active) {
          return
        }

        setAuthUser(data)
        setAuthState('authenticated')

        if (window.location.pathname !== dashboardPath) {
          window.history.replaceState(null, '', dashboardPath)
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }

        if (error instanceof Error && error.message === 'unauthenticated') {
          setAuthState('redirecting')
          setMessage('Redirecting to WorkOS login')
          window.location.assign(loginUrl)
          return
        }

        setAuthState('error')
        setMessage(error instanceof Error ? error.message : 'Unable to check authentication')
      })

    return () => {
      active = false
    }
  }, [loginUrl])

  if (authState !== 'authenticated') {
    return (
      <main className="auth-shell">
        <section className="status-panel" aria-live="polite">
          <span className="status-dot" data-state={authState} />
          <p className="eyebrow">Burro</p>
          <h1>{message}</h1>
          {authState === 'error' ? (
            <div className="actions">
              <a className="button" href={loginUrl}>
                Sign in with WorkOS
              </a>
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
          <p>Burro is reading the active Laravel session through Pane.</p>
        </div>
        <code>{new URL('/auth/user', paneBaseUrl).toString()}</code>
      </section>
    </main>
  )
}

export default App
