import type { AxiosInstance } from 'axios'
import { rejectPaneAccessFailure } from './errors.js'
import type { CollectionResponse, ItemResponse } from './types.js'

// Pane's app settings (`GET /settings`, `PUT /settings/{key}`, `POST /settings/{key}/upload`, docs/api-v1.md, Pane#158).

export type SettingType = 'flag' | 'text' | 'number' | 'image'

export type SettingImage = { path: string; url: string; mime: string; size: number }

export type SettingAttributes = {
  key: string
  type: SettingType
  label: string | null
  help: string | null
  public: boolean
  editable_by: 'administrator' | 'pane_admin'
  default: unknown
  value: unknown
  version: number
}

export type SettingResource = { id: string; type: 'setting'; attributes: SettingAttributes }

export const settingImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const
export const settingImageMaxBytes = 2 * 1024 * 1024

const keyPattern = /^[a-z][a-z0-9_]{0,63}$/

function assertKey(key: string): void {
  if (!keyPattern.test(key)) throw new Error('Settings are addressed by their declared key.')
}

// Pane's value ETag is built from the key and the value version (0 while the value is still the default).
export function settingEtag(setting: Pick<SettingAttributes, 'key' | 'version'>): string {
  return `"setting-${setting.key}-${setting.version}"`
}

// The stored image of an image setting, or null when it has none (or something unexpected).
export function settingImage(value: unknown): SettingImage | null {
  if (typeof value !== 'object' || value === null) return null
  const { path, url, mime, size } = value as Record<string, unknown>
  if (typeof path !== 'string' || typeof url !== 'string' || typeof mime !== 'string' || typeof size !== 'number') {
    return null
  }
  return { path, url, mime, size }
}

// Checks an image before it is sent, with the limits Pane applies (PNG, JPEG or WebP, at most 2 MB).
export function settingImageProblem(file: { type: string; size: number }): 'type' | 'size' | null {
  if (!(settingImageMimeTypes as readonly string[]).includes(file.type)) return 'type'
  if (file.size > settingImageMaxBytes) return 'size'
  return null
}

export function createSettingsService(pane: AxiosInstance) {
  async function write(request: Promise<{ data: ItemResponse<SettingResource> }>): Promise<SettingResource> {
    const response = await request.catch(rejectPaneAccessFailure)
    return response.data.data
  }

  return {
    async list(): Promise<SettingResource[]> {
      const response = await pane
        .get<CollectionResponse<SettingResource>>('/settings')
        .catch(rejectPaneAccessFailure)
      return response.data.data
    },

    // Sends the version the form was loaded with, so a stale form fails with version_conflict instead of overwriting.
    set(setting: SettingAttributes, value: string | number | boolean | null): Promise<SettingResource> {
      assertKey(setting.key)
      return write(pane.put<ItemResponse<SettingResource>>(
        `/settings/${setting.key}`,
        { value },
        { headers: { 'If-Match': settingEtag(setting) } },
      ))
    },

    upload(setting: SettingAttributes, file: Blob): Promise<SettingResource> {
      assertKey(setting.key)
      const body = new FormData()
      body.append('file', file)
      return write(pane.post<ItemResponse<SettingResource>>(
        `/settings/${setting.key}/upload`,
        body,
        { headers: { 'If-Match': settingEtag(setting), 'Content-Type': 'multipart/form-data' } },
      ))
    },
  }
}

export type SettingsService = ReturnType<typeof createSettingsService>
