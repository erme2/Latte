import { createInvitationsService } from '@erme2/latte'
import type { PlatformContext } from './contract'

export type ProductServices = ReturnType<typeof createServices>

export function createServices(platform: PlatformContext) {
  return {
    invitations: createInvitationsService(platform.pane),
  }
}
