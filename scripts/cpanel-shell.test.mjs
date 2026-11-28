import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync('src/App.tsx', 'utf8')
const css = readFileSync('src/App.css', 'utf8')

// Sidebar with a landmark, collapse control and a per-session state.
assert.match(app, /<aside className="sidebar"/)
assert.match(app, /<nav aria-label="Primary navigation"/)
assert.match(app, /sessionStorage/)
assert.match(app, /Expand sidebar/)

// Phone menu button: named, with aria-expanded, closes on navigation and Escape.
assert.match(app, /className="menu-button"/)
assert.match(app, /aria-expanded=\{menuOpen\}/)
assert.match(app, /closest\('a'\)/)
assert.match(app, /event\.key === 'Escape'/)

// Drawer focus: focus moves into the drawer, the page behind is inert, focus returns to Menu.
assert.match(app, /<div className="shell-main" inert=\{menuOpen\}>/)
assert.match(app, /sidebarRef\.current\?\.querySelector<HTMLElement>\('nav a, nav button'\)\?\.focus\(\)/)
assert.match(app, /menuButtonRef\.current\?\.focus\(\)/)

// Top bar with the organization and the account; sign-out kept.
assert.match(app, /className="topbar-org"/)
assert.match(app, /Sign out/)

// Layout: 240px sidebar, 16px phone gutter.
assert.match(css, /grid-template-columns: 240px minmax\(0, 1fr\)/)
assert.match(css, /@media \(max-width: 820px\)[\s\S]*padding: 24px 16px/)
console.log('cpanel shell contract ok')
