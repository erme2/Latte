import type { AxiosInstance } from 'axios'
import type { CollectionResponse, ItemResponse, LatteRuntimeConfig, VersionedItemResponse } from './types.js'
import { PaneAccessError, paneErrorCode, paneErrorStatus, rejectPaneAccessFailure } from './errors.js'
import { isMapName, type MapField, type TableMapResource } from './maps.js'
import { createOrganizationRouter } from './organization.js'
import { versionedItemResponse as versioned } from './versioned.js'

// Shapes of Pane's /data routes (`listDataRows` … `deleteDataRow` in contracts/pane-v1.json, Pane#156).

export type DataRowValues = Record<string, unknown>

export type DataRowResource = {
  type: 'data_row'
  attributes: { source: string; table: string; row_key: string; values: DataRowValues }
}

export type DataListParams = {
  cursor?: string
  limit?: number
  sort?: string
}

const rowKeyPattern = /^[A-Za-z0-9_-]{1,2048}$/
const sortPattern = /^-?[a-z][a-z0-9_]{0,63}$/

function assertTable(source: string, table: string): void {
  if (!isMapName(source) || !isMapName(table)) {
    throw new Error('Data rows are addressed by stable map names.')
  }
}

function assertRowKey(rowKey: string): void {
  if (!rowKeyPattern.test(rowKey)) {
    throw new Error('Row keys are unpadded base64url strings.')
  }
}

export function createDataService(pane: AxiosInstance, config: LatteRuntimeConfig) {
  const organization = createOrganizationRouter(config)
  const rowsPath = (source: string, table: string) => {
    assertTable(source, table)
    return organization.path('data', source, 'tables', table, 'rows')
  }
  const rowPath = (source: string, table: string, rowKey: string) => {
    assertTable(source, table)
    assertRowKey(rowKey)
    return organization.path('data', source, 'tables', table, 'rows', rowKey)
  }

  return {
    async list(source: string, table: string, params: DataListParams = {}): Promise<CollectionResponse<DataRowResource>> {
      const query: Record<string, string | number> = {}
      if (params.cursor) query['page[cursor]'] = params.cursor
      if (params.limit) query['page[limit]'] = params.limit
      if (params.sort) {
        if (!sortPattern.test(params.sort)) throw new Error('Sort by one field name, with - for descending.')
        query.sort = params.sort
      }
      const { data } = await pane
        .get<CollectionResponse<DataRowResource>>(rowsPath(source, table), { params: query })
        .catch(rejectPaneAccessFailure)
      return data
    },

    async get(source: string, table: string, rowKey: string): Promise<VersionedItemResponse<DataRowResource>> {
      const response = await pane
        .get<ItemResponse<DataRowResource>>(rowPath(source, table, rowKey))
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    async create(source: string, table: string, values: DataRowValues): Promise<VersionedItemResponse<DataRowResource>> {
      const response = await pane
        .post<ItemResponse<DataRowResource>>(rowsPath(source, table), { values })
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    async update(
      source: string,
      table: string,
      rowKey: string,
      values: DataRowValues,
      etag: string,
    ): Promise<VersionedItemResponse<DataRowResource>> {
      const response = await pane
        .patch<ItemResponse<DataRowResource>>(rowPath(source, table, rowKey), { values }, {
          headers: { 'If-Match': etag },
        })
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    async remove(source: string, table: string, rowKey: string, etag: string): Promise<void> {
      await pane
        .delete(rowPath(source, table, rowKey), { headers: { 'If-Match': etag } })
        .catch(rejectPaneAccessFailure)
    },
  }
}

export type DataService = ReturnType<typeof createDataService>

// ---- Record views: what the list and edit screens show, worked out from the table map's `ui` part.

export type TableMap = TableMapResource['attributes']

export type RecordWidget = 'text' | 'textarea' | 'number' | 'checkbox' | 'date' | 'email' | 'password' | 'json'

const recordWidgets: readonly RecordWidget[] = ['text', 'textarea', 'number', 'checkbox', 'date', 'email', 'password', 'json']

// List views fall back to this many fields when the map names no columns.
const defaultColumnCount = 5

export function recordFieldLabel(field: MapField): string {
  const label = field.ui?.label?.trim()
  if (label) return label
  const words = field.name.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function isShown(field: MapField): boolean {
  return field.ui?.hidden !== true && field.type !== 'password'
}

/** Fields shown as list columns: `ui.list.columns` in order, else the first visible fields. */
export function recordListColumns(table: TableMap): MapField[] {
  const byName = new Map(table.fields.map((field) => [field.name, field]))
  const named = table.ui?.list?.columns
  if (Array.isArray(named) && named.length > 0) {
    return named
      .map((name) => byName.get(name))
      .filter((field): field is MapField => field !== undefined && isShown(field))
  }
  return table.fields.filter(isShown).slice(0, defaultColumnCount)
}

/** The map's `ui.list.default_sort`, when it names a sortable field (Pane rejects any other). */
export function recordListSort(table: TableMap): string | undefined {
  const sort = table.ui?.list?.default_sort
  if (typeof sort !== 'string' || !sortPattern.test(sort)) return undefined
  const field = table.fields.find((candidate) => candidate.name === sort.replace(/^-/, ''))
  return field?.sortable ? sort : undefined
}

export type RecordFormMode = 'create' | 'edit'

/**
 * Fields the form lets the member write. Computed fields are Pane's, and the
 * primary key can be sent on create but never changed on update.
 */
export function recordFormFields(table: TableMap, mode: RecordFormMode): MapField[] {
  return table.fields.filter((field) =>
    field.ui?.hidden !== true && !field.computed && !(mode === 'edit' && field.primary))
}

/** The input a field gets: a known `ui.widget`, else one that suits its type. */
export function recordFieldWidget(field: MapField): RecordWidget {
  const widget = field.ui?.widget
  if (typeof widget === 'string' && (recordWidgets as readonly string[]).includes(widget)) {
    return widget as RecordWidget
  }
  switch (field.type) {
    case 'text': return 'textarea'
    case 'number': return 'number'
    case 'boolean': return 'checkbox'
    case 'date': return 'date'
    case 'password': return 'password'
    case 'array':
    case 'json': return 'json'
    default: return field.format === 'email' ? 'email' : 'text'
  }
}

/** A stored value as the form's input text. */
export function recordInputValue(field: MapField, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (field.type === 'array' || field.type === 'json') return JSON.stringify(value, null, 2)
  if (field.type === 'date' && typeof value === 'string') return value.slice(0, 10)
  return String(value)
}

export type ParsedRecordInput = { ok: true; value: unknown } | { ok: false; message: string }

/** The form's input text as the value Pane takes, or why it can't be one. */
export function parseRecordInput(field: MapField, input: string | boolean): ParsedRecordInput {
  if (typeof input === 'boolean') return { ok: true, value: input }
  if (input.trim() === '') {
    if (field.nullable) return { ok: true, value: null }
    if (field.type === 'string' || field.type === 'text' || field.type === 'password') return { ok: true, value: '' }
    return { ok: false, message: 'Enter a value.' }
  }
  if (field.type === 'number') {
    const value = Number(input)
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, message: 'Enter a number.' }
  }
  if (field.type === 'array' || field.type === 'json') {
    try {
      const value: unknown = JSON.parse(input)
      if (field.type === 'array' && !Array.isArray(value)) return { ok: false, message: 'Enter a JSON list, like ["a", "b"].' }
      return { ok: true, value }
    } catch {
      return { ok: false, message: 'Enter valid JSON.' }
    }
  }
  return { ok: true, value: input }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The map's client-side hints (`min`, `max`, `email`). Pane still validates every write. */
export function recordValidationMessages(field: MapField, value: unknown): string[] {
  const messages: string[] = []
  if (value === null || value === undefined) return messages
  for (const validation of field.validations) {
    const limit = Number(validation.value)
    let failed = false
    if (validation.rule === 'email') {
      failed = typeof value === 'string' && value !== '' && !emailPattern.test(value)
    } else if (Number.isFinite(limit)) {
      const size = typeof value === 'number' ? value : typeof value === 'string' ? value.length : null
      if (size !== null) failed = validation.rule === 'min' ? size < limit : size > limit
    }
    if (!failed) continue
    if (validation.message) messages.push(validation.message)
    else if (validation.rule === 'email') messages.push('Enter an email address.')
    else if (typeof value === 'number') messages.push(`${validation.rule === 'min' ? 'At least' : 'At most'} ${limit}.`)
    else messages.push(`${validation.rule === 'min' ? 'At least' : 'At most'} ${limit} characters.`)
  }
  return messages
}

/** A value as list-cell text. */
export function formatRecordValue(field: MapField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field.type === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export type RecordWriteFailure =
  | { kind: 'validation'; message: string; fields: Record<string, string[]> }
  | { kind: 'denied'; message: string }
  | { kind: 'not_found'; message: string }
  | { kind: 'conflict'; message: string }
  | { kind: 'unknown'; message: string }

type PaneErrorDetails = { error?: { message?: unknown; details?: { fields?: unknown } } }

function validationFields(error: unknown): Record<string, string[]> {
  const body = (error as { response?: { data?: PaneErrorDetails } }).response?.data
  const fields = body?.error?.details?.fields
  if (!fields || typeof fields !== 'object') return {}
  const result: Record<string, string[]> = {}
  for (const [name, messages] of Object.entries(fields)) {
    const list = Array.isArray(messages) ? messages : [messages]
    const text = list.filter((message): message is string => typeof message === 'string' && message !== '')
    if (text.length > 0) result[name] = text
  }
  return result
}

/** What went wrong with a record write or read, in words the screen can show. */
export function recordWriteFailure(error: unknown): RecordWriteFailure {
  if (error instanceof PaneAccessError) return { kind: 'denied', message: error.failure.message }
  const status = paneErrorStatus(error)
  const code = paneErrorCode(error)
  if (status === 422 || code === 'validation_failed') {
    const body = (error as { response?: { data?: PaneErrorDetails } }).response?.data
    const message = typeof body?.error?.message === 'string' ? body.error.message : 'Some values are not valid.'
    return { kind: 'validation', message, fields: validationFields(error) }
  }
  if (status === 403 || code === 'permission_denied') {
    return { kind: 'denied', message: 'You are not allowed to make this change.' }
  }
  if (status === 404) {
    return { kind: 'not_found', message: 'This record is not available. It may have been deleted.' }
  }
  if (status === 412 || code === 'version_conflict') {
    return { kind: 'conflict', message: 'Someone else changed this record. Reload it and try again.' }
  }
  return { kind: 'unknown', message: 'Pane could not complete the request. Try again.' }
}
