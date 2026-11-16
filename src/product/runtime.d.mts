export type RouteLike = {
  path: string
  roles?: readonly string[]
  function?: string
}

export function validateRoutePattern<T extends string>(pattern: T): T
export function matchRoutePattern(pattern: string, pathname: string): Record<string, string> | null
export function resolveProductRoute<Route extends RouteLike>(
  routes: readonly Route[],
  pathname: string,
  role: string,
  enabledFunctions?: ReadonlySet<string> | null,
):
  | { status: 'matched'; route: Route; params: Record<string, string> }
  | { status: 'forbidden'; route: Route; params: Record<string, string> }
  | { status: 'not_found' }
export function functionPathsFromRoutes<Route extends RouteLike>(
  routes: readonly Route[],
): Partial<Record<NonNullable<Route['function']>, string>>
export function createProductServices<Platform, Services>(
  factory: (platform: Platform) => Services,
  platform: Platform,
): Services
