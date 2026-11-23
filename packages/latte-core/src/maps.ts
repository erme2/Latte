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
