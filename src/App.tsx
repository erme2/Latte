import { hasOrganizationRole } from '@erme2/latte'
import { useLatteAuthentication } from './auth/useLatteAuthentication'
import type { LatteProduct, LatteRuntime, ProductContext } from './product/contract'
import { resolveProductRoute } from './product/runtime.mjs'
import './App.css'

type Props<Services extends object> = {
  runtime: LatteRuntime<Services>
  product: LatteProduct<Services>
}

export default function App<Services extends object>({ runtime, product }: Props<Services>) {
  const {
    state: authState,
    message,
    session,
    logout,
    retry,
  } = useLatteAuthentication(runtime, product.defaultPath)

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
                onClick={retry}
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
