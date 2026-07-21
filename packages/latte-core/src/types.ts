export const organizationRoles = [
  'organization_administrator',
  'organization_user',
] as const

export type OrganizationRole = (typeof organizationRoles)[number]

export type LatteRuntimeConfig = {
  paneBaseUrl: string
  expectedApplicationId: string
  expectedOrganizationId: string
  expectedOrigin: string
}

export type Resource<TType extends string, TAttributes> = {
  id: string
  type: TType
  attributes: TAttributes
}

export type LatteSession = {
  data: {
    mode: 'latte'
    user: Resource<'user', Record<string, unknown>>
    application: Resource<
      'application',
      {
        kind: 'latte'
        organization_id: string
        name: string
        status: 'active'
      }
    >
    organization: Resource<
      'organization',
      { name: string; slug: string; status: 'active' }
    >
    membership: Resource<
      'membership',
      { organization_id: string; role: OrganizationRole; status: 'active' }
    >
  }
  meta: { request_id: string }
}

export type CollectionResponse<T> = {
  data: T[]
  meta: {
    request_id: string
    page: { next_cursor: string | null; has_more: boolean }
  }
}

export type ItemResponse<T> = {
  data: T
  meta: { request_id: string }
}
