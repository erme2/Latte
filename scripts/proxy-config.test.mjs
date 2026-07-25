import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPaneProxyOptions,
  validatePaneProxyHost,
  validatePaneProxyTarget,
  validatePaneProxyVerifyTls,
} from '../vite-pane-proxy.mjs';

const readme = readFileSync('README.md', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');
const dockerEnvExample = readFileSync('.env.docker.example', 'utf8');

assert.equal(validatePaneProxyTarget(undefined), 'http://localhost:8000');
assert.equal(validatePaneProxyTarget('http://localhost:8000'), 'http://localhost:8000');
assert.equal(validatePaneProxyTarget('https://pane.localhost'), 'https://pane.localhost');

for (const target of [
  'ftp://localhost',
  'https://nginx',
  'https://evil.example',
  'https://localhost/pane',
  'https://localhost?target=evil',
  'https://user:pass@localhost',
  'not-a-url',
]) {
  assert.throws(() => validatePaneProxyTarget(target), /VITE_PANE_PROXY_TARGET/);
}

assert.equal(validatePaneProxyHost(undefined), undefined);
assert.equal(validatePaneProxyHost(''), undefined);
assert.equal(validatePaneProxyHost('pane.localhost'), 'pane.localhost');
assert.equal(validatePaneProxyHost('localhost:8000'), 'localhost:8000');

for (const host of [
  'evil.example',
  'https://pane.localhost',
  'pane.localhost/path',
  'pane.localhost?x=1',
  'user@pane.localhost',
]) {
  assert.throws(() => validatePaneProxyHost(host), /VITE_PANE_PROXY_HOST/);
}

assert.equal(validatePaneProxyVerifyTls(undefined), true);
assert.equal(validatePaneProxyVerifyTls(''), true);
assert.equal(validatePaneProxyVerifyTls('true'), true);
assert.equal(validatePaneProxyVerifyTls('1'), true);
assert.equal(validatePaneProxyVerifyTls('yes'), true);
assert.equal(validatePaneProxyVerifyTls('false'), false);
assert.equal(validatePaneProxyVerifyTls('0'), false);
assert.equal(validatePaneProxyVerifyTls('off'), false);
assert.throws(() => validatePaneProxyVerifyTls('maybe'), /VITE_PANE_PROXY_VERIFY_TLS/);

const localProxy = createPaneProxyOptions({});
assert.equal(localProxy.target, 'http://localhost:8000');
assert.equal(localProxy.secure, true);
assert.equal(localProxy.headers, undefined);
assert.equal(localProxy.rewrite('/pane/auth/user'), '/auth/user');

const paneHttpsProxy = createPaneProxyOptions({
  VITE_PANE_PROXY_TARGET: 'https://pane.localhost',
  VITE_PANE_PROXY_HOST: 'pane.localhost',
  VITE_PANE_PROXY_VERIFY_TLS: 'false',
});
assert.equal(paneHttpsProxy.target, 'https://pane.localhost');
assert.equal(paneHttpsProxy.secure, false);
assert.deepEqual(paneHttpsProxy.headers, { Host: 'pane.localhost' });

assert.equal(envExample.includes('VITE_PANE_PROXY_TARGET=http://localhost:8000'), true);
assert.equal(envExample.includes('VITE_PANE_PROXY_HOST='), true);
assert.equal(envExample.includes('VITE_PANE_PROXY_VERIFY_TLS=true'), true);
assert.equal(dockerEnvExample.includes('VITE_PANE_BASE_URL=/pane'), true);
assert.equal(dockerEnvExample.includes('VITE_PANE_PROXY_TARGET='), false);
assert.equal(dockerEnvExample.includes('VITE_PANE_PROXY_HOST='), false);
assert.equal(dockerEnvExample.includes('VITE_PANE_PROXY_VERIFY_TLS='), false);
assert.match(readme, /VITE_PANE_PROXY_TARGET/);
assert.match(readme, /VITE_PANE_PROXY_HOST/);
assert.match(readme, /VITE_PANE_PROXY_VERIFY_TLS/);
assert.match(readme, /Invalid proxy targets fail during Vite startup/);
assert.match(readme, /Docker routes `\/pane` through Latte's Nginx service/);
