import type { AxiosInstance } from 'axios'
import type { ItemResponse, LatteRuntimeConfig, VersionedItemResponse } from './types.js'
import { rejectPaneAccessFailure } from './errors.js'
import { versionedItemResponse as versioned } from './versioned.js'

// Shapes of Pane's maps read API (`getMaps` and `getTableMap` in contracts/pane-v1.json, Pane#154).

export const mapFunctionKeys = ['records', 'members', 'dashboard'] as const

export type MapFunctionKey = (typeof mapFunctionKeys)[number]

export type MapMenuTarget =
  | { type: 'table'; source: string; table: string }
  | { type: 'function'; function: MapFunctionKey }

export type MapMenuItem = {
  key: string
  label: string
  icon: string | null
  target: MapMenuTarget
  parent: string | null
  position: number
}

export type MapFunction = { key: MapFunctionKey; enabled: boolean }

export type MapPublicSetting = { key: string; type: string; value: unknown }

export type MapTableUi = {
  label?: string
  description?: string
  list?: { columns?: string[]; default_sort?: string; [key: string]: unknown }
  dashboard?: MapTableDashboard
  [key: string]: unknown
}

// A table's dashboard card (Latte convention in the table's `ui`; Pane keeps `ui` open):
// `count` shows the row total, `recent` (1 to 10) lists that many rows ordered by `sort`, newest first (`recent` is ignored without a valid `sort`).
export type MapTableDashboard = { count?: boolean; recent?: number; sort?: string; position?: number }

export type MapFieldUi = {
  label?: string
  widget?: string
  help?: string
  hidden?: boolean
  [key: string]: unknown
}

export type MapTableSummary = {
  source: string
  table: string
  description: string | null
  system: boolean
  version: number
  ui: MapTableUi | null
}

export type MapFieldValidation = {
  rule: 'max' | 'min' | 'email'
  value?: string | number | boolean | null
  message?: string
}

export type MapField = {
  name: string
  type: 'number' | 'string' | 'text' | 'boolean' | 'date' | 'array' | 'password' | 'json'
  description: string | null
  format: string | null
  primary: boolean
  nullable: boolean
  sortable: boolean
  computed: boolean
  default: unknown
  validations: MapFieldValidation[]
  ui: MapFieldUi | null
}

export type MapsAttributes = {
  version: number
  menu: MapMenuItem[]
  functions: MapFunction[]
  settings: MapPublicSetting[]
  tables: MapTableSummary[]
}

export type MapsResource = { type: 'maps'; attributes: MapsAttributes }

export type TableMapResource = {
  type: 'table_map'
  attributes: MapTableSummary & { fields: MapField[] }
}

const mapNamePattern = /^[a-z][a-z0-9_]{0,63}$/

export function isMapName(value: unknown): value is string {
  return typeof value === 'string' && mapNamePattern.test(value)
}

export function createMapsService(pane: AxiosInstance, _config: LatteRuntimeConfig) {
  return {
    async getMaps(): Promise<VersionedItemResponse<MapsResource>> {
      const response = await pane
        .get<ItemResponse<MapsResource>>('/maps')
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    // Replaces a whole table map (maps admin API, Pane#157). `etag` is the one `getTableMap` returned, so a stale edit
    // fails with 412 `version_conflict` instead of overwriting; system maps answer 409 `system_map_protected`.
    async saveTableMap(
      source: string,
      table: string,
      etag: string,
      body: TableMapBody,
    ): Promise<VersionedItemResponse<TableMapResource>> {
      if (!isMapName(source) || !isMapName(table)) {
        throw new Error('Table maps are addressed by stable map names.')
      }

      const response = await pane
        .put<ItemResponse<TableMapResource>>(`/maps/${source}/${table}`, body, { headers: { 'If-Match': etag } })
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },

    // source and table usually come from the page URL, so they are checked before any request.
    async getTableMap(source: string, table: string): Promise<VersionedItemResponse<TableMapResource>> {
      if (!isMapName(source) || !isMapName(table)) {
        throw new Error('Table maps are addressed by stable map names.')
      }

      const response = await pane
        .get<ItemResponse<TableMapResource>>(`/maps/${source}/${table}`)
        .catch(rejectPaneAccessFailure)
      return versioned(response)
    },
  }
}

export type MapsService = ReturnType<typeof createMapsService>

/** What the maps editor changes of a table map; everything else is sent back as read. */
export type MapFieldEdit = {
  name: string
  label: string
  help: string
  hidden: boolean
  /** Only `max`, `min` and `email` are edited; other rules (`unique`, `exists`) stay as they are. */
  validations: { rule: 'max' | 'min' | 'email'; value: string; message: string }[]
}

export type MapEdit = {
  label: string
  description: string
  /** Field names, in list order. */
  columns: string[]
  /** Field name, or '' for none. */
  sortField: string
  sortDescending: boolean
  /** Every field of the map, in form order. */
  fields: MapFieldEdit[]
}

export type TableMapBody = {
  description: string | null
  ui: MapTableUi | null
  fields: (Omit<MapField, 'computed'> & { computed: null })[]
}

/**
 * What a save would drop. Pane's read of a map is lossy: it hides private `unique` and `exists` rules, SQL aliases,
 * access rules and the definition of computed fields, and the save replaces the whole map. Only computed fields
 * can be told from the read; the rest cannot be seen, so every save carries this warning (owner decision, Latte#71).
 */
export type MapSaveLoss = { field: string; rule: string }

export function mapSaveLosses(table: TableMapResource['attributes']): MapSaveLoss[] {
  return table.fields.filter((field) => field.computed).map((field) => ({ field: field.name, rule: 'computed definition' }))
}

/** A save is blocked until the owner chooses to override, because private rules may always be dropped. */
export function mapSaveAllowed(override: boolean): boolean {
  return override
}

const editableRules = ['max', 'min', 'email'] as const

/** The starting values of the maps editor, from a table's map. */
export function buildMapEdit(table: TableMapResource['attributes']): MapEdit {
  const fields = table.fields.filter((field) => isMapName(field.name))
  const names = new Set(fields.map((field) => field.name))
  const rawSort = typeof table.ui?.list?.default_sort === 'string' ? table.ui.list.default_sort : ''
  const sortName = rawSort.startsWith('-') ? rawSort.slice(1) : rawSort

  return {
    label: table.ui?.label ?? '',
    description: table.description ?? '',
    columns: Array.isArray(table.ui?.list?.columns)
      ? table.ui.list.columns.filter((name): name is string => typeof name === 'string' && names.has(name))
      : [],
    sortField: names.has(sortName) ? sortName : '',
    sortDescending: names.has(sortName) && rawSort.startsWith('-'),
    fields: fields.map((field) => ({
      name: field.name,
      label: field.ui?.label ?? '',
      help: typeof field.ui?.help === 'string' ? field.ui.help : '',
      hidden: field.ui?.hidden === true,
      validations: field.validations.flatMap((rule) =>
        (editableRules as readonly string[]).includes(rule.rule)
          ? [{ rule: rule.rule, value: rule.value === undefined || rule.value === null ? '' : String(rule.value), message: rule.message ?? '' }]
          : []),
    })),
  }
}

// Sets or drops a key of a `ui` object; an object left empty becomes null.
function withKey<T extends Record<string, unknown>>(ui: T | null | undefined, key: string, value: unknown): T | null {
  const next: Record<string, unknown> = { ...(ui ?? {}) }
  if (value === '' || value === undefined || value === null || value === false) delete next[key]
  else next[key] = value
  return Object.keys(next).length > 0 ? (next as T) : null
}

/**
 * The request body for Pane's `PUT /maps/{source}/{table}` from the editor's values: the whole map, with the
 * edited parts replaced and everything else (types, keys, other `ui` keys, other rules) as it was read.
 * `errors` are field problems found before sending (a `max` or `min` rule needs a number, a column must exist, ...),
 * keyed by `table`, `columns`, `sort` or `<field>.validations.<n>`.
 */
export function buildMapBody(
  table: TableMapResource['attributes'],
  edit: MapEdit,
): { body: TableMapBody; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const original = new Map(table.fields.map((field) => [field.name, field]))
  const known = new Set(edit.fields.map((field) => field.name))

  if (edit.columns.some((name) => !known.has(name))) errors.columns = 'A list column must be one of the fields.'
  if (new Set(edit.columns).size !== edit.columns.length) errors.columns = 'A list column can be shown only once.'
  if (edit.sortField !== '' && !known.has(edit.sortField)) errors.sort = 'Sort by one of the fields.'

  const fields: TableMapBody['fields'] = []
  for (const item of edit.fields) {
    const field = original.get(item.name)
    if (!field) continue
    const kept = field.validations.filter((rule) => !(editableRules as readonly string[]).includes(rule.rule))
    const edited: MapFieldValidation[] = []
    item.validations.forEach((rule, index) => {
      const result: MapFieldValidation = { rule: rule.rule }
      if (rule.rule !== 'email') {
        const value = Number(rule.value)
        if (rule.value.trim() === '' || !Number.isFinite(value)) {
          errors[`${item.name}.validations.${index}`] = 'Enter a number.'
          return
        }
        result.value = value
      }
      if (rule.message.trim() !== '') result.message = rule.message.trim()
      edited.push(result)
    })

    let ui = withKey(field.ui, 'label', item.label.trim())
    ui = withKey(ui, 'help', item.help.trim())
    ui = withKey(ui, 'hidden', item.hidden)
    // Pane reads `computed` as a boolean but only accepts an object or null on save: the definition is not readable, so it is not sent.
    fields.push({ ...field, computed: null, validations: [...kept, ...edited], ui })
  }

  let ui = withKey(table.ui, 'label', edit.label.trim())
  const list: Record<string, unknown> = { ...(table.ui?.list ?? {}) }
  if (edit.columns.length > 0) list.columns = edit.columns
  else delete list.columns
  if (edit.sortField !== '') list.default_sort = `${edit.sortDescending ? '-' : ''}${edit.sortField}`
  else delete list.default_sort
  ui = withKey(ui, 'list', Object.keys(list).length > 0 ? list : null)

  return { body: { description: edit.description.trim() || null, ui, fields }, errors }
}

export type MapsShellMenuItem = {
  key: string
  label: string
  icon: string | null
  path: string
  children: MapsShellMenuItem[]
}

export type MapsShellBrand = {
  name?: string
  tagline?: string
  logoUrl?: string
}

export type MapsShell = {
  menu: MapsShellMenuItem[]
  enabledFunctions: ReadonlySet<MapFunctionKey>
  brand: MapsShellBrand
}

export type MapsShellOptions = {
  // Where the app serves each function. A function without a path has no menu entry.
  functionPaths: Partial<Record<MapFunctionKey, string>>
}

// Public settings the shell reads for its branding. Anything else is left to the product.
export const mapsBrandSettingKeys = {
  name: 'brand_name',
  tagline: 'brand_tagline',
  logoUrl: 'brand_logo_url',
} as const

export function mapsRecordPath(source: string, table: string): string {
  return `/records/${encodeURIComponent(source)}/${encodeURIComponent(table)}`
}

export type DashboardCard = {
  source: string
  table: string
  label: string
  count: boolean
  recent: number
  sort: string | null
  columns: string[]
}

export const dashboardRecentMax = 10

/**
 * The dashboard's cards, from the `ui.dashboard` part of the tables the caller can see:
 * ordered by `position` then label. A table with neither a count nor recent rows, or
 * a malformed config, gets no card. System tables never do.
 */
export function buildDashboardCards(tables: readonly MapTableSummary[]): DashboardCard[] {
  const cards: (DashboardCard & { position: number })[] = []

  for (const table of tables) {
    const config = table.ui?.dashboard
    if (table.system || typeof config !== 'object' || config === null) continue
    if (!isMapName(table.source) || !isMapName(table.table)) continue

    const count = config.count === true
    const sort = isMapName(config.sort) ? config.sort : null
    // Recent rows need a sort to be newest first (Pane's default order is oldest first), so without one the card keeps its count only.
    const recent = sort !== null && Number.isInteger(config.recent) ? Math.min(Math.max(config.recent as number, 0), dashboardRecentMax) : 0
    if (!count && recent === 0) continue

    const columns = Array.isArray(table.ui?.list?.columns)
      ? table.ui.list.columns.filter((name): name is string => isMapName(name)).slice(0, 3)
      : []

    cards.push({
      source: table.source,
      table: table.table,
      label: table.ui?.label?.trim() || table.table,
      count,
      recent,
      sort,
      columns,
      position: typeof config.position === 'number' && Number.isFinite(config.position) ? config.position : 0,
    })
  }

  return cards
    .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label))
    .map(({ position: _position, ...card }) => card)
}

export type RecordFormField = {
  name: string
  label: string
  help: string | null
  input: 'text' | 'email' | 'number' | 'checkbox' | 'textarea' | 'date' | 'password' | 'json'
  /** For a `json` input: Pane's `array` type takes a native array, its `json` type a JSON string. */
  wire: 'array' | 'json' | null
  readOnly: boolean
}

export type RecordView = {
  title: string
  primaryKey: string | null
  columns: { name: string; label: string; sortable: boolean }[]
  sort: { name: string; order: 'asc' | 'desc' } | null
  fields: RecordFormField[]
}

const listColumnsMax = 6

/**
 * The generic list and edit view of one table, from its map: the columns (`ui.list.columns`,
 * else the first visible fields), the default sort (`ui.list.default_sort`, `-name` for descending)
 * and the form fields with their input kind. Hidden and computed fields are left out of the
 * form; the primary key is shown read-only on edit and left out on create (Pane assigns it).
 */
export function buildRecordView(table: TableMapResource['attributes']): RecordView {
  const fields = table.fields.filter((field) => isMapName(field.name))
  const visible = fields.filter((field) => field.ui?.hidden !== true)
  const label = (field: MapField) => field.ui?.label?.trim() || field.name
  const byName = new Map(fields.map((field) => [field.name, field]))

  const configured = Array.isArray(table.ui?.list?.columns)
    ? table.ui.list.columns.filter((name): name is string => typeof name === 'string' && byName.has(name))
    : []
  const columnFields = (configured.length > 0
    ? configured.map((name) => byName.get(name) as MapField)
    : visible.filter((field) => field.type !== 'password').slice(0, listColumnsMax))

  const rawSort = typeof table.ui?.list?.default_sort === 'string' ? table.ui.list.default_sort : ''
  const sortName = rawSort.startsWith('-') ? rawSort.slice(1) : rawSort
  const sortField = byName.get(sortName)
  const primary = fields.find((field) => field.primary) ?? null

  const input = (field: MapField): RecordFormField['input'] => {
    const widget = field.ui?.widget
    if (widget === 'textarea') return 'textarea'
    switch (field.type) {
      case 'number': return 'number'
      case 'boolean': return 'checkbox'
      case 'text': return 'textarea'
      case 'date': return 'date'
      case 'password': return 'password'
      case 'array':
      case 'json': return 'json'
      default: return field.format === 'email' || field.validations.some((rule) => rule.rule === 'email') ? 'email' : 'text'
    }
  }

  return {
    title: table.ui?.label?.trim() || table.table,
    primaryKey: primary?.name ?? null,
    columns: columnFields.map((field) => ({ name: field.name, label: label(field), sortable: field.sortable })),
    sort: sortField ? { name: sortField.name, order: rawSort.startsWith('-') ? 'desc' : 'asc' } : null,
    fields: visible
      .filter((field) => !field.computed)
      .map((field) => ({
        name: field.name,
        label: label(field),
        help: typeof field.ui?.help === 'string' ? field.ui.help : null,
        input: input(field),
        wire: field.type === 'array' ? 'array' : field.type === 'json' ? 'json' : null,
        readOnly: field.primary,
      })),
  }
}

// Pane serialises a date as `{date: 'YYYY-MM-DD HH:MM:SS.ffffff', timezone_type, timezone}`.
function dateInputValue(value: unknown): string {
  const raw = typeof value === 'object' && value !== null ? (value as { date?: unknown }).date : value
  const match = typeof raw === 'string' ? /^\d{4}-\d{2}-\d{2}/.exec(raw) : null
  return match ? match[0] : ''
}

/** The starting value of a form control for a field, from the row being edited (or none). */
export function recordFieldValue(field: RecordFormField, row: Record<string, unknown> | null): string | boolean {
  const value = row?.[field.name]
  if (field.input === 'checkbox') return value === true || value === 1 || value === '1'
  if (value === null || value === undefined) return ''
  if (field.input === 'date') return dateInputValue(value)
  // Pane already json_decodes a `json` value, so a string here is the JSON value itself: always encode it.
  if (field.input === 'json') return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * The request body Pane expects from the form values. A JSON field that does not parse is a
 * field error; a `json` field is sent as a JSON string and an `array` field as a native array.
 */
export function recordFormBody(
  fields: readonly RecordFormField[],
  values: Record<string, string | boolean>,
): { body: Record<string, unknown>; errors: Record<string, string> } {
  const body: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  for (const field of fields) {
    if (field.readOnly) continue
    const value = values[field.name]
    if (field.input === 'checkbox') body[field.name] = value === true
    else if (value === '') body[field.name] = null
    else if (field.input === 'number') body[field.name] = Number(value)
    else if (field.input === 'json') {
      try {
        const parsed: unknown = JSON.parse(String(value))
        if (field.wire === 'array' && !Array.isArray(parsed)) errors[field.name] = 'Enter a JSON array.'
        else body[field.name] = field.wire === 'array' ? parsed : JSON.stringify(parsed)
      } catch { errors[field.name] = 'Enter valid JSON.' }
    } else body[field.name] = value
  }
  return { body, errors }
}

function textSetting(settings: readonly MapPublicSetting[], key: string): string | undefined {
  const value = settings.find((setting) => setting.key === key)?.value
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

// A logo is an image URL the browser will load, so only HTTPS or same-origin paths are used.
function logoSetting(settings: readonly MapPublicSetting[]): string | undefined {
  // An image setting stores `{path, url, mime, size}`; a text setting stores the URL itself.
  const raw = settings.find((setting) => setting.key === mapsBrandSettingKeys.logoUrl)?.value
  const stored = typeof raw === 'object' && raw !== null ? (raw as { url?: unknown }).url : raw
  const value = typeof stored === 'string' && stored.trim() !== '' ? stored.trim() : undefined
  if (!value) return undefined
  if (value.startsWith('/') && !value.startsWith('//')) return value
  return value.startsWith('https://') ? value : undefined
}

function byPosition(left: MapMenuItem, right: MapMenuItem): number {
  return left.position - right.position || left.key.localeCompare(right.key)
}

/**
 * Turns the install's maps into the app shell: the menu (sorted, one level of
 * nesting), the switchable functions that are on, and the branding settings.
 * Menu items whose function is off, unknown to the app, or whose table the
 * caller can't see are left out, together with their children.
 */
export function buildMapsShell(maps: MapsAttributes, options: MapsShellOptions): MapsShell {
  const enabledFunctions = new Set<MapFunctionKey>(
    maps.functions
      .filter((item) => item.enabled && (mapFunctionKeys as readonly string[]).includes(item.key))
      .map((item) => item.key),
  )
  const visibleTables = new Set(maps.tables.map((table) => `${table.source}/${table.table}`))

  const pathFor = (item: MapMenuItem): string | null => {
    const { target } = item
    if (target.type === 'function') {
      return enabledFunctions.has(target.function) ? options.functionPaths[target.function] ?? null : null
    }
    if (target.type === 'table') {
      return enabledFunctions.has('records') && visibleTables.has(`${target.source}/${target.table}`)
        ? mapsRecordPath(target.source, target.table)
        : null
    }
    return null
  }

  const entry = (item: MapMenuItem, path: string): MapsShellMenuItem => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    path,
    children: [],
  })

  const sorted = [...maps.menu].sort(byPosition)
  const menu: MapsShellMenuItem[] = []
  const topLevel = new Map<string, MapsShellMenuItem>()

  for (const item of sorted) {
    if (item.parent !== null) continue
    const path = pathFor(item)
    if (path === null) continue
    const shellItem = entry(item, path)
    menu.push(shellItem)
    topLevel.set(item.key, shellItem)
  }

  for (const item of sorted) {
    if (item.parent === null) continue
    const parent = topLevel.get(item.parent)
    const path = pathFor(item)
    if (!parent || path === null) continue
    parent.children.push(entry(item, path))
  }

  const brand: MapsShellBrand = {}
  const name = textSetting(maps.settings, mapsBrandSettingKeys.name)
  const tagline = textSetting(maps.settings, mapsBrandSettingKeys.tagline)
  const logoUrl = logoSetting(maps.settings)
  if (name) brand.name = name
  if (tagline) brand.tagline = tagline
  if (logoUrl) brand.logoUrl = logoUrl

  return { menu, enabledFunctions, brand }
}
