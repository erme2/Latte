import { useEffect, useMemo, useRef, useState } from 'react'
import { hasUserRole, mapsRecordPath } from '@erme2/latte'
import { useLatteAuthentication } from './auth/useLatteAuthentication'
import type { LatteProduct, LatteRuntime, ProductContext } from './product/contract'
import { functionPathsFromRoutes, resolveProductRoute } from './product/runtime.mjs'
import { useMapsShell } from './shell/useMapsShell'
import './App.css'

const COLLAPSED_KEY = 'latte.sidebar.collapsed'

// The collapsed state lasts for the browser session.
function readCollapsed(): boolean {
  try {
    return window.sessionStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

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
  const shellOptions = useMemo(
    () => ({ functionPaths: functionPathsFromRoutes(product.routes) }),
    [product.routes],
  )
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const drawerWasOpen = useRef(false)
  const maps = useMapsShell(runtime.maps, shellOptions, authState === 'authenticated' && session !== null)

  useEffect(() => {
    try {
      window.sessionStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Storage can be blocked; the sidebar then resets on reload.
    }
  }, [collapsed])

  useEffect(() => {
    if (!menuOpen) {
      // Give focus back to the Menu button when the drawer is dismissed.
      if (drawerWasOpen.current) menuButtonRef.current?.focus()
      drawerWasOpen.current = false
      return
    }
    drawerWasOpen.current = true
    // Move focus into the drawer; the page behind it is inert while it is open.
    sidebarRef.current?.querySelector<HTMLElement>('nav a, nav button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const wide = window.matchMedia('(min-width: 821px)')
    const onWide = () => {
      if (wide.matches) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    return () => {
      window.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
    }
  }, [menuOpen])

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
    session.data.user.attributes.role,
    maps.status === 'ready' ? maps.shell.enabledFunctions : null,
  )
  const params = resolution.status === 'not_found' ? {} : resolution.params
  const context: ProductContext<Services> = {
    config: runtime.config,
    pane: runtime.pane,
    maps: runtime.maps,
    services: runtime.services,
    session,
    params,
  }
  const Page = resolution.status === 'matched'
    ? resolution.route.component
    : resolution.status === 'forbidden'
      ? product.forbiddenPage
      : product.notFoundPage
  const brand = maps.status === 'ready' ? maps.shell.brand : {}
  const brandName = brand.name ?? product.brand.name

  const closeMenu = () => setMenuOpen(false)
  const userName = session.data.user.attributes.name || session.data.user.attributes.email

  return (
    <div className="shell" data-collapsed={collapsed ? 'true' : 'false'} data-menu-open={menuOpen ? 'true' : 'false'}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar" id="sidebar" ref={sidebarRef}>
        <div className="sidebar-head">
          <a className="sidebar-brand" href={product.defaultPath}>
            <img className="brand-logo" src={brand.logoUrl ?? '/latte-logo.svg'} alt={brandName} width="168" height="67" />
          </a>
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
          </button>
        </div>
        <nav aria-label="Primary navigation" onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) closeMenu()
        }}>
          {maps.status === 'ready'
            ? maps.shell.menu.map((item) => (
              <span className="nav-group" key={item.key} data-icon={item.icon ?? undefined}>
                <a href={item.path} aria-current={window.location.pathname === item.path ? 'page' : undefined}>{item.label}</a>
                {item.children.map((child) => (
                  <a className="nav-child" href={child.path} key={child.key} data-icon={child.icon ?? undefined} aria-current={window.location.pathname === child.path ? 'page' : undefined}>
                    {child.label}
                  </a>
                ))}
              </span>
            ))
            : null}
          {maps.status === 'ready' && maps.shell.enabledFunctions.has('records') && (product.recordMenu ?? []).length > 0
            ? (
              <span className="nav-group" aria-label="Records" role="group">
                {(product.recordMenu ?? []).map((item) => (
                  <a className="nav-child" href={mapsRecordPath(item.source, item.table)} key={item.id}>{item.label}</a>
                ))}
              </span>
            )
            : null}
          {product.navigation
            .filter((item) => !item.roles || hasUserRole(session, item.roles))
            .map((item) => (
              <a href={item.path} key={item.id} aria-current={window.location.pathname === item.path ? 'page' : undefined}>{item.label}</a>
            ))}
        </nav>
      </aside>
      <button className="menu-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={closeMenu} />
      <div className="shell-main" inert={menuOpen}>
        <header className="topbar">
          <button
            className="menu-button"
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            ref={menuButtonRef}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <p className="topbar-org">{brandName}</p>
          <div className="topbar-account">
            <span className="topbar-user">{userName}</span>
            <button className="nav-button" type="button" onClick={() => { void logout() }}>
              Sign out
            </button>
          </div>
        </header>
        <main className="dashboard" id="main-content">
          {maps.status === 'error'
            ? <p className="shell-notice" role="alert">The menu could not be loaded from Pane. Reload the page to try again.</p>
            : null}
          {maps.status === 'loading'
            ? <p aria-live="polite">Loading…</p>
            : Page ? <Page context={context} /> : <h2>Page not found</h2>}
        </main>
      </div>
    </div>
  )
}
