import type { PlatformContext } from './contract'

export type ProductServices = ReturnType<typeof createServices>

export function createServices({ organization, pane }: PlatformContext) {
  const connectionsPath = organization.path('connections')

  return {
    connections: {
      path: connectionsPath,
      async list(): Promise<unknown> {
        const { data } = await pane.get(connectionsPath)
        return data
      },
    },
  }
}
