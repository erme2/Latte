import { createCrudService, createInvitationsService, createSettingsService } from '@erme2/latte'
import type { PlatformContext } from './contract'

export type ProductServices = ReturnType<typeof createServices>

export function createServices(platform: PlatformContext) {
  return {
    crud: createCrudService(platform.pane, platform.config),
    invitations: createInvitationsService(platform.pane),
    settings: createSettingsService(platform.pane),
  }
}
