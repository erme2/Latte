export type RouteLike = {
  path: string
  roles?: readonly string[]
}

export function validateRoutePattern<T extends string>(pattern: T): T
export function matchRoutePattern(pattern: string, pathname: string): Record<string, string> | null
export function resolveProductRoute<Route extends RouteLike>(
  routes: readonly Route[],
  pathname: string,
  role: string,
):
  | { status: 'matched'; route: Route; params: Record<string, string> }
  | { status: 'forbidden'; route: Route; params: Record<string, string> }
  | { status: 'not_found' }
export function createProductServices<Platform, Services>(
  factory: (platform: Platform) => Services,
  platform: Platform,
): Services
