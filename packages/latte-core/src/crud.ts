import type { AxiosInstance } from 'axios'
import type { CollectionResponse, ItemResponse, LatteRuntimeConfig } from './types.js'

function segment(value: string): string {
  return encodeURIComponent(value)
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
      const { data } = await pane.get<ItemResponse<T>>(
        `${collectionPath(connectionId, tableId)}/${segment(rowKey)}`,
      )
      return data
    },

    async create<T>(connectionId: string, tableId: string, attributes: Record<string, unknown>) {
      const { data } = await pane.post<ItemResponse<T>>(collectionPath(connectionId, tableId), {
        data: { type: 'row', attributes },
      })
      return data
    },

    async update<T>(
      connectionId: string,
      tableId: string,
      rowKey: string,
      attributes: Record<string, unknown>,
      etag: string,
    ) {
      const { data } = await pane.patch<ItemResponse<T>>(
        `${collectionPath(connectionId, tableId)}/${segment(rowKey)}`,
        { data: { type: 'row', attributes } },
        { headers: { 'If-Match': etag } },
      )
      return data
    },

    async remove(connectionId: string, tableId: string, rowKey: string, etag: string) {
      await pane.delete(`${collectionPath(connectionId, tableId)}/${segment(rowKey)}`, {
        headers: { 'If-Match': etag },
      })
    },
  }
}
