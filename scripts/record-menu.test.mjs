import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The static record menu (Latte#80): a fixed list in Latte code, no Pane menu route.
const manifest = readFileSync('src/product/manifest.tsx', 'utf8')
const contract = readFileSync('src/product/contract.ts', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')

const entries = [...manifest.matchAll(/\{ id: '([^']+)', label: '([^']+)', source: '([^']+)', table: '([^']+)' \}/g)]
  .map(([, id, label, source, table]) => ({ id, label, source, table }))

// Hidden until the record views use Pane's /crud route (Latte#85 review): no entries are exposed.
assert.equal(entries.length, 0, 'no record menu entries are exposed before the /crud record views ship')

assert.match(contract, /recordMenu\?: readonly RecordMenuItem\[\]/)
assert.match(contract, /Duplicate record menu item/)
assert.match(contract, /needs stable map names/)
// Entries open the existing record list route, and only while the records function is on.
assert.match(app, /enabledFunctions\.has\('records'\)/)
assert.match(app, /mapsRecordPath\(item\.source, item\.table\)/)
console.log('record menu ok')
