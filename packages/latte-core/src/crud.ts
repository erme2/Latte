import type { AxiosInstance } from 'axios'
import type { LatteRuntimeConfig } from './types.js'
import { rejectPaneAccessFailure } from './errors.js'
import { isMapName } from './maps.js'
import axios from 'axios'

// Pane's Story/Action/Mapper CRUD route (`GET /crud/{subject}`, docs/crud-authentication.md). It sits next to /api/v1
// and answers with its own envelope: `{status, data: row[], pagination: {page, limit, total}}`.
// The subject is the table name (Pane has no source in the route).

export type CrudRow = Record<string, unknown>

export type CrudPagination = { page: number; limit: number; total: number | null }

export type CrudList = { rows: CrudRow[]; pagination: CrudPagination }

export type CrudListQuery = { page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' }

export type CrudFieldError = { field: string; message: string }

// Pane answers a failed validation with 400 and `data.errors: [{field_name, message}]`.
export class CrudValidationError extends Error {
  readonly errors: CrudFieldError[]

  constructor(errors: CrudFieldError[], cause?: unknown) {
    super('Pane rejected the record.', { cause })
    this.name = 'CrudValidationError'
    this.errors = errors
  }
}

function rejectCrudFailure(error: unknown): never {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const list = (error.response.data as { data?: { errors?: unknown } } | undefined)?.data?.errors
    if (Array.isArray(list)) {
      const errors = list.flatMap((item): CrudFieldError[] => {
        const { field_name: field, message } = (item ?? {}) as { field_name?: unknown; message?: unknown }
        return typeof field === 'string' && typeof message === 'string' ? [{ field, message }] : []
      })
      if (errors.length > 0) throw new CrudValidationError(errors, error)
    }
  }
  return rejectPaneAccessFailure(error)
}

function subjectKey(subject: string, key: unknown): string {
  if (!isMapName(subject) || (typeof key !== 'string' && typeof key !== 'number') || String(key) === '') {
    throw new Error('Records are addressed by stable map names and a record key.')
  }
  return `/crud/${subject}/${encodeURIComponent(String(key))}`
}

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

    // One row, or null when Pane has no row with that key.
    async get(subject: string, key: string | number): Promise<CrudRow | null> {
      const response = await pane
        .get<{ data?: unknown }>(subjectKey(subject, key), { baseURL: root, validateStatus: (status) => status < 300 || status === 404 })
        .catch(rejectCrudFailure)
      const rows = response.status === 404 ? [] : response.data.data
      return Array.isArray(rows) && rows[0] ? (rows[0] as CrudRow) : null
    },

    async create(subject: string, values: CrudRow): Promise<CrudRow | null> {
      if (!isMapName(subject)) throw new Error('Records are addressed by stable map names.')
      const response = await pane
        .post<{ data?: unknown }>(`/crud/${subject}`, values, { baseURL: root })
        .catch(rejectCrudFailure)
      const rows = response.data.data
      return Array.isArray(rows) && rows[0] ? (rows[0] as CrudRow) : null
    },

    async update(subject: string, key: string | number, values: CrudRow): Promise<CrudRow | null> {
      const response = await pane
        .put<{ data?: unknown }>(subjectKey(subject, key), values, { baseURL: root })
        .catch(rejectCrudFailure)
      const rows = response.data.data
      return Array.isArray(rows) && rows[0] ? (rows[0] as CrudRow) : null
    },

    async remove(subject: string, key: string | number): Promise<void> {
      await pane.delete(subjectKey(subject, key), { baseURL: root }).catch(rejectCrudFailure)
    },
  }
}

export type CrudService = ReturnType<typeof createCrudService>
