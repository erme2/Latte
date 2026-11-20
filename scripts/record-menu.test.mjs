import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isMapName } from '../packages/latte-core/dist/index.js'

// The static record menu (Latte#80): a fixed list in Latte code, no Pane menu route.
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
const contract = readFileSync('src/product/contract.ts', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')

const entries = [...manifest.matchAll(/\{ id: '([^']+)', label: '([^']+)', source: '([^']+)', table: '([^']+)' \}/g)]
  .map(([, id, label, source, table]) => ({ id, label, source, table }))

assert.ok(entries.length >= 6, 'the menu lists system tables, maps and the Sweegly data tables')
assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, 'menu ids are unique')
for (const entry of entries) {
  assert.ok(isMapName(entry.source) && isMapName(entry.table), `${entry.id} uses stable map names`)
}
for (const table of ['maps_tables', 'lists', 'products']) {
  assert.ok(entries.some((entry) => entry.table === table), `${table} has a menu entry`)
}

assert.match(contract, /recordMenu\?: readonly RecordMenuItem\[\]/)
assert.match(contract, /Duplicate record menu item/)
assert.match(contract, /needs stable map names/)
// Entries open the existing record list route, and only while the records function is on.
assert.match(app, /enabledFunctions\.has\('records'\)/)
assert.match(app, /mapsRecordPath\(item\.source, item\.table\)/)
console.log('record menu ok')
