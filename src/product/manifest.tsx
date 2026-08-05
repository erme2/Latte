import { defineLatteProduct } from './contract'
import { Connection, Dashboard, Forbidden, NotFound, OrganizationAdministration } from './pages'
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
    },
  ],
  navigation: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
    },
    {
      id: 'organization-administration',
      label: 'Organization',
      path: '/organization',
      roles: ['organization_administrator'],
    },
  ],
  forbiddenPage: Forbidden,
  notFoundPage: NotFound,
})
