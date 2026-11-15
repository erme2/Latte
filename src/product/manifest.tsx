import { defineLatteProduct } from './contract'
import { OrganizationAdministration } from './organization/OrganizationAdministration'
import { Connection, Dashboard, Forbidden, NotFound, Records } from './pages'
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
      id: 'records',
      path: '/records/:source/:table',
      component: Records,
      function: 'records',
    },
    {
      id: 'connection',
      path: '/connections/:connectionId',
      component: Connection,
      roles: ['organization_administrator'],
    },
    {
      id: 'organization-administration',
      path: '/organization',
      component: OrganizationAdministration,
      roles: ['organization_administrator'],
      function: 'members',
    },
  ],
  // The menu comes from the install's maps. List here only the always-on
  // entries, such as the maps, menu and settings editors.
  navigation: [],
  forbiddenPage: Forbidden,
  notFoundPage: NotFound,
})
