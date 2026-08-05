import { createOrganizationAdministrationService, rejectPaneAccessFailure } from '@erme2/latte'
import type { PlatformContext } from './contract'

export type ProductServices = ReturnType<typeof createServices>

export function createServices({ config, organization, pane }: PlatformContext) {
  const connectionsPath = organization.path('connections')

  return {
    administration: createOrganizationAdministrationService(pane, config),
    connections: {
      path: connectionsPath,
      async list(): Promise<unknown> {
        const { data } = await pane.get(connectionsPath).catch(rejectPaneAccessFailure)
        return data
      },
    },
  }
}
