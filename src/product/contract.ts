import type { AxiosInstance } from 'axios'
import {
  createAuthService,
  createDataService,
  createMapsService,
  createPaneClient,
  createOrganizationRouter,
  createRowService,
  type LatteRuntimeConfig,
  type LatteSession,
  type MapFunctionKey,
  type UserRole,
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
  maps: ReturnType<typeof createMapsService>
  data: ReturnType<typeof createDataService>
  rows: ReturnType<typeof createRowService>
  organization: ReturnType<typeof createOrganizationRouter>
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
  roles?: readonly UserRole[]
  // The maps function this page belongs to: hidden while the install has it switched off.
  function?: MapFunctionKey
}

// Always-on entries shown next to the maps menu, whatever the install switched off.
export type NavigationItem = {
  id: string
  label: string
  path: `/${string}`
  roles?: readonly UserRole[]
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
  const platform = {
    config,
    pane,
    maps: createMapsService(pane, config),
    data: createDataService(pane, config),
    organization: createOrganizationRouter(config),
    rows: createRowService(pane, config),
  }

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

  const functionRoutes = new Set<string>()
  for (const route of product.routes) {
    if (!route.function || route.path.includes('/:')) continue
    if (functionRoutes.has(route.function)) {
      throw new Error(`More than one route opens the ${route.function} function.`)
    }
    functionRoutes.add(route.function)
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
    const route = product.routes.find((candidate) => matchRoutePattern(candidate.path, item.path))
    if (!route) {
      throw new Error(`Navigation item ${item.id} points to an undeclared route.`)
    }
    if (route.function) {
      throw new Error(`Navigation item ${item.id} is always on, so it cannot open the switchable ${route.function} function.`)
    }
  }

  return product
}
