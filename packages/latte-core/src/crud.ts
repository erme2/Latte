import type { AxiosInstance } from 'axios'
import type { LatteRuntimeConfig } from './types.js'
import { rejectPaneAccessFailure } from './errors.js'
import { isMapName } from './maps.js'

// Pane's Story/Action/Mapper CRUD route (`GET /crud/{subject}`, docs/crud-authentication.md). It sits next to /api/v1
// and answers with its own envelope: `{status, data: row[], pagination: {page, limit, total}}`.
// The subject is the table name (Pane has no source in the route).

export type CrudRow = Record<string, unknown>

export type CrudPagination = { page: number; limit: number; total: number | null }

export type CrudList = { rows: CrudRow[]; pagination: CrudPagination }

export type CrudListQuery = { page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' }

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function createCrudService(pane: AxiosInstance, config: LatteRuntimeConfig) {
  const root = config.paneBaseUrl.replace(/\/$/, '')

  return {
    async list(subject: string, query: CrudListQuery = {}): Promise<CrudList> {
      if (!isMapName(subject) || (query.sort !== undefined && !isMapName(query.sort))) {
        throw new Error('Records are addressed by stable map names.')
      }

      const response = await pane
        .get<{ data?: unknown; pagination?: { page?: unknown; limit?: unknown; total?: unknown } }>(
          `/crud/${subject}`,
          { baseURL: root, params: query },
        )
        .catch(rejectPaneAccessFailure)

      const { data, pagination } = response.data
      return {
        rows: Array.isArray(data) ? (data as CrudRow[]) : [],
        pagination: {
          page: count(pagination?.page) ?? query.page ?? 1,
          limit: count(pagination?.limit) ?? query.limit ?? 0,
          total: count(pagination?.total),
        },
      }
    },
  }
}

export type CrudService = ReturnType<typeof createCrudService>
