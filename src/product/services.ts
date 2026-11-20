import type { PlatformContext } from './contract'

export type ProductServices = ReturnType<typeof createServices>

export function createServices(_platform: PlatformContext) {
  return {}
}
