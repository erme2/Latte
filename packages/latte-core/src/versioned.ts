import type { AxiosResponse } from 'axios'
import type { ItemResponse, VersionedItemResponse } from './types.js'

// Pane returns the item's version as an ETag; every later write sends it back in If-Match.
export function versionedItemResponse<T>(response: AxiosResponse<ItemResponse<T>>): VersionedItemResponse<T> {
  const headers = response.headers as unknown as Record<string, unknown>
  const etag = headers.etag ?? headers.ETag

  if (typeof etag !== 'string' || etag === '') {
    throw new Error('Pane response did not include the required ETag header.')
  }

  return { document: response.data, etag }
}
