import {
  adminOnlyLoginUrl,
  attemptLoginRedirect,
  authenticationFailureMessage,
  callbackRecoveryPath,
  hasAuthenticationCallback,
  invitationTokenFromSearch,
  isAuthenticationRequired,
  paneAccessFailure,
  resolveInitialAuthentication,
} from '@erme2/latte'

// Every function takes the browser (`window` in the app) and reports state changes
// through `report`, so the whole sign-in lifecycle runs without React in tests.

function redirectUrl(path, browser) {
  return new URL(path, browser.location.origin).toString()
}

function failed(message) {
  return { state: 'error', message, session: null }
}

// Starts sign-in. An admin-only console with a loginUrl hands sign-in to that page and
// never starts its own login; otherwise the console starts login as before.
export function beginSignIn(runtime, defaultPath, browser, invitationToken) {
  const loginUrl = adminOnlyLoginUrl(runtime.config, browser.location.href)

  if (loginUrl) {
    browser.location.replace(loginUrl)
    return Promise.resolve({ status: 'redirecting' })
  }

  return attemptLoginRedirect(() => runtime.auth.beginLogin(redirectUrl(defaultPath, browser), invitationToken))
}

async function redirectToSignIn({ runtime, defaultPath, browser, report }, message, { invitationToken, isActive = () => true } = {}) {
  report({ state: 'redirecting', message, session: null })
  const result = await beginSignIn(runtime, defaultPath, browser, invitationToken)

  if (result.status === 'error' && isActive()) {
    report(failed(result.message))
  }
}

// `isActive` turns false when the app stops caring about this attempt (React effect cleanup).
export async function authenticate(lifecycle, isActive) {
  const { runtime, defaultPath, browser, report } = lifecycle

  try {
    const invitation = invitationTokenFromSearch(browser.location.search)

    if (invitation.status === 'invalid') {
      report(failed(invitation.message))
      return
    }

    if (invitation.status === 'ready' && !hasAuthenticationCallback(browser.location.search)) {
      await redirectToSignIn(lifecycle, 'Redirecting to accept invitation', { invitationToken: invitation.token, isActive })
      return
    }

    const initial = await resolveInitialAuthentication(
      browser.location.search,
      runtime.auth,
      runtime.config,
    )

    if (!isActive()) return

    if (initial.status === 'error') {
      report(failed(initial.message))
      return
    }

    if (initial.status === 'product_redirect') {
      // Admin-only console: non-administrators go to the product app and
      // never see a console screen.
      report({
        state: 'redirecting',
        message: 'This console is for organization administrators. Redirecting to the app',
        session: null,
      })
      browser.location.replace(initial.url)
      return
    }

    report({ state: 'authenticated', message: '', session: initial.session })

    if (initial.fromCallback) {
      browser.history.replaceState(null, '', defaultPath)
    }
  } catch (error) {
    if (!isActive()) return

    if (isAuthenticationRequired(error)) {
      await redirectToSignIn(lifecycle, 'Redirecting to sign in', { isActive })
      return
    }

    report(failed(paneAccessFailure(error)?.message ?? authenticationFailureMessage(error)))
  }
}

// Called for every failed Pane response while signed in.
export function handlePaneFailure(lifecycle, error) {
  const accessFailure = paneAccessFailure(error)

  if (accessFailure) {
    lifecycle.report(failed(accessFailure.message))
  } else if (isAuthenticationRequired(error)) {
    void redirectToSignIn(lifecycle, 'Your session expired. Redirecting to sign in')
  }
}

export async function logout({ runtime, browser, report }) {
  report({ state: 'redirecting', message: 'Signing out', session: null })

  try {
    const logoutUrl = await runtime.auth.logout()
    browser.location.assign(logoutUrl)
  } catch (error) {
    report(failed(authenticationFailureMessage(error)))
  }
}

export function retryAuthentication(defaultPath, browser) {
  const recoveryPath = callbackRecoveryPath(browser.location.search, defaultPath)

  if (recoveryPath) {
    browser.history.replaceState(null, '', recoveryPath)
  }

  browser.location.reload()
}
