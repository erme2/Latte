import axios, { type AxiosInstance } from 'axios'
import type { LatteRuntimeConfig } from './types.js'

export function createPaneClient(config: LatteRuntimeConfig): AxiosInstance {
  return axios.create({
    baseURL: `${config.paneBaseUrl.replace(/\/$/, '')}/api/v1`,
    withCredentials: true,
    withXSRFToken: true,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    headers: { Accept: 'application/json' },
  })
}
