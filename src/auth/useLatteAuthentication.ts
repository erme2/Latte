import { useEffect, useMemo, useState } from 'react'
import type { LatteRuntime } from '../product/contract'
import {
  authenticate,
  handlePaneFailure,
  logout,
  retryAuthentication,
  type AuthLifecycle,
  type AuthStatus,
} from './lifecycle.mjs'

// Signs the user in on load, and watches Pane responses while signed in so an expired
// session or lost access returns the app to its status screen.
export function useLatteAuthentication<Services extends object>(
  runtime: LatteRuntime<Services>,
  defaultPath: string,
) {
  const [status, setStatus] = useState<AuthStatus>({
    state: 'checking',
    message: 'Checking your Pane session',
    session: null,
  })
  const lifecycle = useMemo<AuthLifecycle>(
    () => ({ runtime, defaultPath, browser: window, report: setStatus }),
    [runtime, defaultPath],
  )

  useEffect(() => {
    let active = true
    void authenticate(lifecycle, () => active)
    return () => {
      active = false
    }
  }, [lifecycle])

  const signedIn = status.state === 'authenticated'

  useEffect(() => {
    if (!signedIn) return undefined

    const interceptor = runtime.pane.interceptors.response.use(undefined, (error: unknown) => {
      handlePaneFailure(lifecycle, error)
      return Promise.reject(error)
    })

    return () => {
      runtime.pane.interceptors.response.eject(interceptor)
    }
  }, [signedIn, runtime, lifecycle])

  return {
    ...status,
    logout: () => logout(lifecycle),
    retry: () => retryAuthentication(defaultPath, window),
  }
}
