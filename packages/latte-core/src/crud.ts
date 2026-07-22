import type { AxiosInstance, AxiosResponse } from 'axios'
import type {
  CollectionResponse,
  ItemResponse,
  LatteRuntimeConfig,
  VersionedItemResponse,
} from './types.js'

export type PaneRowValue = string | number | boolean | null
export type PaneRowValues = Record<string, PaneRowValue>

function segment(value: string): string {
  return encodeURIComponent(value)
}

function versioned<T>(response: AxiosResponse<ItemResponse<T>>): VersionedItemResponse<T> {
  const headers = response.headers as unknown as Record<string, unknown>
  const etag = headers.etag ?? headers.ETag

  if (typeof etag !== 'string' || etag === '') {
    throw new Error('Pane row response did not include the required ETag header.')
  }

  return { document: response.data, etag }
}

export function createRowService(pane: AxiosInstance, config: LatteRuntimeConfig) {
  const collectionPath = (connectionId: string, tableId: string) =>
    `/organizations/${segment(config.expectedOrganizationId)}/connections/${segment(connectionId)}/tables/${segment(tableId)}/rows`

  return {
    async list<T>(connectionId: string, tableId: string, params?: Record<string, unknown>) {
      const { data } = await pane.get<CollectionResponse<T>>(collectionPath(connectionId, tableId), {
        params,
      })
      return data
    },

    async get<T>(connectionId: string, tableId: string, rowKey: string) {
      const response = await pane.get<ItemResponse<T>>(
        `${collectionPath(connectionId, tableId)}/${segment(rowKey)}`,
      )
      return versioned(response)
    },

    async create<T>(connectionId: string, tableId: string, values: PaneRowValues) {
      const response = await pane.post<ItemResponse<T>>(collectionPath(connectionId, tableId), {
        values,
      })
      return versioned(response)
    },

    async update<T>(
      connectionId: string,
      tableId: string,
      rowKey: string,
      values: PaneRowValues,
      etag: string,
    ) {
      const response = await pane.patch<ItemResponse<T>>(
        `${collectionPath(connectionId, tableId)}/${segment(rowKey)}`,
        { values },
        { headers: { 'If-Match': etag } },
      )
      return versioned(response)
    },

    async remove(connectionId: string, tableId: string, rowKey: string, etag: string) {
      await pane.delete(`${collectionPath(connectionId, tableId)}/${segment(rowKey)}`, {
        headers: { 'If-Match': etag },
      })
    },
  }
}
