import type { AxiosInstance } from 'axios'
import {
  createAuthService,
  createPaneClient,
  createRowService,
  type LatteRuntimeConfig,
  type LatteSession,
  type OrganizationRole,
} from '@erme2/latte'
import type { ComponentType } from 'react'
import {
  createProductServices,
  matchRoutePattern,
  validateRoutePattern,
} from './runtime.mjs'

export type PlatformContext = {
  config: LatteRuntimeConfig
  pane: AxiosInstance
  rows: ReturnType<typeof createRowService>
}

export type ProductContext<Services extends object> = PlatformContext & {
  services: Services
  session: LatteSession
  params: Readonly<Record<string, string>>
}

export type ProductPageProps<Services extends object> = {
  context: ProductContext<Services>
}

export type ProductRoute<Services extends object> = {
  id: string
  path: `/${string}`
  component: ComponentType<ProductPageProps<Services>>
  roles?: readonly OrganizationRole[]
}

export type NavigationItem = {
  id: string
  label: string
  path: `/${string}`
  roles?: readonly OrganizationRole[]
}

export type LatteProduct<Services extends object> = {
  brand: { name: string; tagline: string }
  authenticationHosts: readonly string[]
  defaultPath: `/${string}`
  createServices(platform: PlatformContext): Services
  routes: readonly ProductRoute<Services>[]
  navigation: readonly NavigationItem[]
  forbiddenPage: ComponentType<ProductPageProps<Services>>
  notFoundPage: ComponentType<ProductPageProps<Services>>
}

export type LatteRuntime<Services extends object> = PlatformContext & {
  auth: ReturnType<typeof createAuthService>
  services: Services
}

export function createLatteRuntime<Services extends object>(
  config: LatteRuntimeConfig,
  product: LatteProduct<Services>,
): LatteRuntime<Services> {
  const pane = createPaneClient(config)
  const platform = { config, pane, rows: createRowService(pane, config) }

  return {
    ...platform,
    auth: createAuthService(pane, config, product.authenticationHosts),
    services: createProductServices(product.createServices, platform),
  }
}

export function defineLatteProduct<Services extends object>(
  product: LatteProduct<Services>,
): LatteProduct<Services> {
  const routeIds = new Set<string>()
  const routePaths = new Set<string>()

  for (const route of product.routes) {
    validateRoutePattern(route.path)
    if (routeIds.has(route.id) || routePaths.has(route.path)) {
      throw new Error(`Duplicate product route: ${route.id} (${route.path}).`)
    }
    routeIds.add(route.id)
    routePaths.add(route.path)
  }

  if (!product.routes.some((route) => matchRoutePattern(route.path, product.defaultPath))) {
    throw new Error('The product defaultPath must match a declared route.')
  }

  const navigationIds = new Set<string>()
  for (const item of product.navigation) {
    if (navigationIds.has(item.id)) {
      throw new Error(`Duplicate navigation item: ${item.id}.`)
    }
    navigationIds.add(item.id)
    if (!product.routes.some((route) => matchRoutePattern(route.path, item.path))) {
      throw new Error(`Navigation item ${item.id} points to an undeclared route.`)
    }
  }

  return product
}
