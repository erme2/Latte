import assert from 'node:assert/strict'
import { validateAuthRedirectUrl } from '../packages/latte-core/dist/index.js'

const hosts = ['api.workos.com', '*.authkit.app', 'login.example.com', '*.trusted-auth.example']

assert.equal(
  validateAuthRedirectUrl(
    'https://api.workos.com/user_management/authorize?client_id=client_123',
    hosts,
  ),
  'https://api.workos.com/user_management/authorize?client_id=client_123',
)
assert.equal(
  validateAuthRedirectUrl('https://example.authkit.app/login?state=abc', hosts),
  'https://example.authkit.app/login?state=abc',
)
assert.equal(
  validateAuthRedirectUrl('https://tenant.trusted-auth.example/oauth2/authorize', hosts),
  'https://tenant.trusted-auth.example/oauth2/authorize',
)

for (const redirectUrl of [
  '',
  'not-a-url',
  'http://api.workos.com/user_management/authorize',
  'https://evil.example/login',
  'https://api.workos.com.evil.example/login',
  'https://api.workos.com:444/login',
  'https://user:pass@api.workos.com/login',
]) {
  assert.throws(() => validateAuthRedirectUrl(redirectUrl, hosts), /untrusted/)
}
