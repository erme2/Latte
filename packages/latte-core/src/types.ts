export const organizationRoles = [
  'organization_administrator',
  'organization_user',
] as const

export type OrganizationRole = (typeof organizationRoles)[number]

/** Pane's user role: admins use the console and the product app; users use the product app. */
export const userRoles = ['admin', 'user'] as const

export type UserRole = (typeof userRoles)[number]

export type LatteAdminOnlyConfig = {
  productAppUrl: string
  loginUrl?: string
}

export type LatteRuntimeConfig = {
  paneBaseUrl: string
  expectedApplicationId: string
  expectedOrigin: string
  adminOnly?: LatteAdminOnlyConfig
}

export type Resource<TType extends string, TAttributes> = {
  id: string
  type: TType
  attributes: TAttributes
}

export type LatteSession = {
  data: {
    mode: 'latte'
    user: Resource<'user', { email: string; name: string; role: UserRole }>
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
