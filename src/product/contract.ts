import type { AxiosInstance } from 'axios'
import type {
  createRowService,
  LatteRuntimeConfig,
  LatteSession,
  OrganizationRole,
} from '@erme2/latte'
import type { ComponentType } from 'react'

export type ProductContext = {
  config: LatteRuntimeConfig
  pane: AxiosInstance
  rows: ReturnType<typeof createRowService>
  session: LatteSession
}

export type ProductPageProps = { context: ProductContext }

export type ProductRoute = {
  id: string
  path: `/${string}`
  component: ComponentType<ProductPageProps>
  roles?: readonly OrganizationRole[]
}

export type NavigationItem = {
  id: string
  label: string
  path: `/${string}`
  roles?: readonly OrganizationRole[]
}

export type LatteProduct = {
  brand: { name: string; tagline: string }
  authenticationHosts: readonly string[]
  defaultPath: `/${string}`
  routes: readonly ProductRoute[]
  navigation: readonly NavigationItem[]
  forbiddenPage: ComponentType<ProductPageProps>
}

export function defineLatteProduct(product: LatteProduct): LatteProduct {
  const routeIds = new Set<string>()
  const routePaths = new Set<string>()

  for (const route of product.routes) {
    if (routeIds.has(route.id) || routePaths.has(route.path)) {
      throw new Error(`Duplicate product route: ${route.id} (${route.path}).`)
    }
    routeIds.add(route.id)
    routePaths.add(route.path)
  }

  if (!routePaths.has(product.defaultPath)) {
    throw new Error('The product defaultPath must identify a declared route.')
  }

  for (const item of product.navigation) {
    if (!routePaths.has(item.path)) {
      throw new Error(`Navigation item ${item.id} points to an undeclared route.`)
    }
  }

  return product
}
