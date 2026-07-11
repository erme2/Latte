import axios from 'axios'

export const paneBaseUrl = import.meta.env.VITE_PANE_BASE_URL ?? '/pane'

export function paneUrl(path: string): string {
  return `${paneBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

export const pane = axios.create({
  baseURL: paneBaseUrl,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})
