import axios, { type AxiosInstance } from 'axios'
import { rejectPaneAccessFailure } from './errors.js'
import type { LatteRuntimeConfig } from './types.js'

export function createPaneClient(config: LatteRuntimeConfig): AxiosInstance {
  const pane = axios.create({
    baseURL: `${config.paneBaseUrl.replace(/\/$/, '')}/api/v1`,
    withCredentials: true,
    withXSRFToken: true,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    headers: { Accept: 'application/json' },
  })

  pane.interceptors.response.use(undefined, rejectPaneAccessFailure)

  return pane
}
