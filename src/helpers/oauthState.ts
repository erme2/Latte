const oauthStateKey = 'burro.oauth_state'

type OAuthStateStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export function storeExpectedOAuthState(storage: OAuthStateStorage, state: string): void {
  if (!state) {
    throw new Error('Missing WorkOS login state')
  }

  storage.setItem(oauthStateKey, state)
}

export function consumeExpectedOAuthState(storage: OAuthStateStorage): string | null {
  const state = storage.getItem(oauthStateKey)
  storage.removeItem(oauthStateKey)

  return state
}

export function clearExpectedOAuthState(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(oauthStateKey)
}

export function assertOAuthStateMatches(expectedState: string | null, callbackState: string | null): void {
  if (!expectedState || !callbackState || expectedState !== callbackState) {
    throw new Error('Invalid WorkOS login state')
  }
}
