import { defineLatteProduct } from './contract'
import { Dashboard, Forbidden } from './pages'

export const product = defineLatteProduct({
  brand: {
    name: 'My Latte application',
    tagline: 'Replace this product manifest',
  },
  authenticationHosts: ['api.workos.com', '*.authkit.app'],
  defaultPath: '/dashboard',
  routes: [
    {
      id: 'dashboard',
      path: '/dashboard',
      component: Dashboard,
    },
  ],
  navigation: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
    },
  ],
  forbiddenPage: Forbidden,
})
