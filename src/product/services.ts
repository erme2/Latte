import type { PlatformContext } from './contract'

export type ProductServices = ReturnType<typeof createServices>

export function createServices({ config, pane }: PlatformContext) {
  const connectionsPath =
    `/organizations/${encodeURIComponent(config.expectedOrganizationId)}/connections`

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
