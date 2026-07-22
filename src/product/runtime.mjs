function pathSegments(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('?') || path.includes('#')) {
    return null
  }

  if (path === '/') return []
  return path.slice(1).split('/')
}

export function validateRoutePattern(pattern) {
  const segments = pathSegments(pattern)

  if (!segments || segments.some((segment) => segment === '')) {
    throw new Error(`Invalid product route pattern: ${pattern}.`)
  }

  const parameters = new Set()
  for (const segment of segments) {
    if (!segment.startsWith(':')) continue
    const name = segment.slice(1)
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || parameters.has(name)) {
      throw new Error(`Invalid product route parameter in ${pattern}.`)
    }
    parameters.add(name)
  }

  return pattern
}

export function matchRoutePattern(pattern, pathname) {
  validateRoutePattern(pattern)
  const patternSegments = pathSegments(pattern)
  const encodedSegments = pathSegments(pathname)

  if (!encodedSegments || patternSegments.length !== encodedSegments.length) return null

  const params = {}
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index]
    let value
    try {
      value = decodeURIComponent(encodedSegments[index])
    } catch {
      return null
    }

    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = value
    } else if (patternSegment !== value) {
      return null
    }
  }

  return params
}

export function resolveProductRoute(routes, pathname, role) {
  for (const route of routes) {
    const params = matchRoutePattern(route.path, pathname)
    if (params === null) continue

    if (route.roles && !route.roles.includes(role)) {
      return { status: 'forbidden', route, params }
    }

    return { status: 'matched', route, params }
  }

  return { status: 'not_found' }
}

export function createProductServices(factory, platform) {
  return factory(platform)
}
