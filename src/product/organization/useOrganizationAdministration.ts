import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  MembershipUpdate,
  OrganizationInvitationCreate,
  OrganizationInvitationResource,
  OrganizationMembershipResource,
} from '@erme2/latte'
import type { ProductServices } from '../services'
import { actionFailureMessage } from './presentation'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

// Members and invitations of the organization, and the administrator's actions on them.
// Every write re-reads the record first so it sends Pane's current ETag.
export function useOrganizationAdministration(administration: ProductServices['administration']) {
  const copyResetTimer = useRef<number | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<OrganizationMembershipResource[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitationResource[]>([])
  const [deliveryUrl, setDeliveryUrl] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const activeAdministratorCount = useMemo(
    () => memberships.filter((membership) =>
      membership.attributes.status === 'active' &&
      membership.attributes.role === 'organization_administrator'
    ).length,
    [memberships],
  )

  const refresh = useCallback(async (): Promise<void> => {
    setLoadState('loading')
    setMessage(null)

    try {
      const [membershipList, invitationList] = await Promise.all([
        administration.listMemberships(),
        administration.listInvitations(),
      ])

      setMemberships(membershipList.data)
      setInvitations(invitationList.data)
      setLoadState('ready')
    } catch (error) {
      setLoadState('error')
      setMessage(actionFailureMessage(error))
    }
  }, [administration])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => () => {
    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current)
    }
  }, [])

  useEffect(() => {
    setCopyState('idle')

    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current)
      copyResetTimer.current = null
    }
  }, [deliveryUrl])

  async function updateMembership(
    membership: OrganizationMembershipResource,
    update: MembershipUpdate,
  ): Promise<void> {
    setMessage(null)

    try {
      const current = await administration.getMembership(membership.id)
      await administration.updateMembership(membership.id, update, current.etag)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function inviteMember(input: OrganizationInvitationCreate, onCreated: () => void): Promise<void> {
    setMessage(null)
    setDeliveryUrl(null)

    try {
      const created = await administration.createInvitation(input)
      onCreated()
      setDeliveryUrl(created.invitationUrl)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function resendInvitation(invitation: OrganizationInvitationResource): Promise<void> {
    setMessage(null)
    setDeliveryUrl(null)

    try {
      const current = await administration.getInvitation(invitation.id)
      const replacement = await administration.resendInvitation(invitation.id, current.etag)
      setDeliveryUrl(replacement.invitationUrl)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function revokeInvitation(invitation: OrganizationInvitationResource): Promise<void> {
    setMessage(null)

    try {
      const current = await administration.getInvitation(invitation.id)
      await administration.revokeInvitation(invitation.id, current.etag)
      await refresh()
    } catch (error) {
      setMessage(actionFailureMessage(error))
    }
  }

  async function copyDeliveryUrl(): Promise<void> {
    if (!deliveryUrl || copyState === 'copied') return

    try {
      await navigator.clipboard.writeText(deliveryUrl)
      setCopyState('copied')

      copyResetTimer.current = window.setTimeout(() => {
        setCopyState('idle')
        copyResetTimer.current = null
      }, 5000)
    } catch {
      setMessage('Unable to copy the invitation link.')
    }
  }

  return {
    loadState,
    message,
    memberships,
    invitations,
    deliveryUrl,
    copyState,
    activeAdministratorCount,
    refresh,
    updateMembership,
    inviteMember,
    resendInvitation,
    revokeInvitation,
    copyDeliveryUrl,
  }
}
