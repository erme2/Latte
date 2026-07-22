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
    user: Resource<'user', { email: string; name: string }>
    application: Resource<
      'application',
      {
        kind: 'latte'
        name: string
        trusted_origin: string
        redirect_uris: string[]
        status: 'active' | 'disabled'
        created_at: string
        updated_at: string
      }
    >
    organization: Resource<
      'organization',
      {
        name: string
        slug: string
        status: 'active' | 'suspended' | 'closed'
        database_limit: number
        created_at: string
        updated_at: string
      }
    >
    membership: Resource<
      'membership',
      {
        role: OrganizationRole
        status: 'active' | 'suspended'
        created_at: string
        updated_at: string
      }
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

export type VersionedItemResponse<T> = {
  document: ItemResponse<T>
  etag: string
}
