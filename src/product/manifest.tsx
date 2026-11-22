import { defineLatteProduct } from './contract'
import { Members } from './members/Members'
import { Settings } from './settings/Settings'
import { Connection, Dashboard, Forbidden, NotFound } from './pages'
import { createServices, type ProductServices } from './services'

export const product = defineLatteProduct<ProductServices>({
  brand: {
    name: 'My Latte application',
    tagline: 'Replace this product manifest',
  },
  authenticationHosts: ['api.workos.com', '*.authkit.app'],
  defaultPath: '/dashboard',
  createServices,
  routes: [
    {
      id: 'dashboard',
      path: '/dashboard',
      component: Dashboard,
      function: 'dashboard',
    },
    {
      id: 'members',
      path: '/members',
      component: Members,
      roles: ['admin'],
      function: 'members',
    },
    {
      id: 'settings',
      path: '/settings',
      component: Settings,
      roles: ['admin'],
    },
    {
      id: 'connection',
      path: '/connections/:connectionId',
      component: Connection,
      roles: ['admin'],
    },
  ],
  // The menu comes from the install's maps. List here only the always-on
  // entries, such as the maps, menu and settings editors.
  navigation: [{ id: 'settings', label: 'Settings', path: '/settings', roles: ['admin'] }],
  // Fixed menu for the Story/Action/Mapper CRUD route. Hidden for now: the record views
  // still call Pane's removed /data routes; the entries come back when they use /crud (Latte#80).
  recordMenu: [],
  forbiddenPage: Forbidden,
  notFoundPage: NotFound,
})
