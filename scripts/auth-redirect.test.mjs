import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAuthRedirectUrl } from '../src/helpers/auth-redirect.mjs';

assert.equal(
  validateAuthRedirectUrl('https://api.workos.com/user_management/authorize?client_id=client_123'),
  'https://api.workos.com/user_management/authorize?client_id=client_123',
);
assert.equal(
  validateAuthRedirectUrl('https://example.authkit.app/login?state=abc'),
  'https://example.authkit.app/login?state=abc',
);
assert.equal(
  validateAuthRedirectUrl(
    'https://login.example.com/oauth2/authorize',
    'login.example.com,*.trusted-auth.example',
  ),
  'https://login.example.com/oauth2/authorize',
);
assert.equal(
  validateAuthRedirectUrl(
    'https://tenant.trusted-auth.example/oauth2/authorize',
    'login.example.com,*.trusted-auth.example',
  ),
  'https://tenant.trusted-auth.example/oauth2/authorize',
);

for (const redirectUrl of [
  '',
  'not-a-url',
  'http://api.workos.com/user_management/authorize',
  'https://evil.example/login',
  'https://api.workos.com.evil.example/login',
  'https://api.workos.com:444/login',
  'https://user:pass@api.workos.com/login',
]) {
  assert.throws(() => validateAuthRedirectUrl(redirectUrl), /authentication redirect URL/);
}

for (const allowedHosts of [
  'https://login.example.com',
  'login.example.com/path',
  'login.*.example.com',
  'login.example.com:443',
]) {
  assert.throws(
    () => validateAuthRedirectUrl('https://login.example.com/oauth2/authorize', allowedHosts),
    /VITE_AUTH_REDIRECT_ALLOWED_HOSTS/,
  );
}

const auth = readFileSync('src/helpers/auth.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const workosDoc = readFileSync('docs/workos-auth.md', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');
const dockerEnvExample = readFileSync('.env.docker.example', 'utf8');

assert.match(auth, /validateAuthRedirectUrl\(\s*data\.authorization_url/s);
assert.match(auth, /VITE_AUTH_REDIRECT_ALLOWED_HOSTS/);
assert.match(app, /catch \(loginError\)/);
assert.match(app, /Unable to start WorkOS login/);
assert.match(readme, /VITE_AUTH_REDIRECT_ALLOWED_HOSTS/);
assert.match(workosDoc, /trusted authentication redirect host/);
assert.match(envExample, /VITE_AUTH_REDIRECT_ALLOWED_HOSTS=/);
assert.match(dockerEnvExample, /VITE_AUTH_REDIRECT_ALLOWED_HOSTS=/);
