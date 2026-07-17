const DEFAULT_PANE_PROXY_TARGET = 'http://localhost:8000';

const ALLOWED_PANE_PROXY_TARGET_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'pane.localhost',
  'nginx',
]);

const ALLOWED_PANE_PROXY_HOST_HEADERS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'pane.localhost',
]);

function allowedList(values) {
  return Array.from(values).sort().join(', ');
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function hasValue(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export function validatePaneProxyTarget(value = DEFAULT_PANE_PROXY_TARGET) {
  const rawTarget = hasValue(value) ? value.trim() : DEFAULT_PANE_PROXY_TARGET;
  let target;

  try {
    target = new URL(rawTarget);
  } catch {
    throw new Error('VITE_PANE_PROXY_TARGET must be an absolute http(s) URL.');
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('VITE_PANE_PROXY_TARGET must use http or https.');
  }

  if (target.username !== '' || target.password !== '') {
    throw new Error('VITE_PANE_PROXY_TARGET must not include credentials.');
  }

  if (target.pathname !== '/' || target.search !== '' || target.hash !== '') {
    throw new Error('VITE_PANE_PROXY_TARGET must be an origin without a path, query, or hash.');
  }

  const hostname = normalizeHostname(target.hostname);

  if (!ALLOWED_PANE_PROXY_TARGET_HOSTS.has(hostname)) {
    throw new Error(
      'VITE_PANE_PROXY_TARGET must point to an expected local Pane host: ' +
        allowedList(ALLOWED_PANE_PROXY_TARGET_HOSTS) +
        '.',
    );
  }

  return target.origin;
}

export function validatePaneProxyHost(value) {
  if (!hasValue(value)) {
    return undefined;
  }

  const rawHost = value.trim();

  if (/\s|[/?#@]/.test(rawHost) || rawHost.includes('://')) {
    throw new Error('VITE_PANE_PROXY_HOST must be a host name, optionally with a port.');
  }

  let host;

  try {
    host = new URL('http://' + rawHost);
  } catch {
    throw new Error('VITE_PANE_PROXY_HOST must be a valid host name, optionally with a port.');
  }

  const hostname = normalizeHostname(host.hostname);

  if (!ALLOWED_PANE_PROXY_HOST_HEADERS.has(hostname)) {
    throw new Error(
      'VITE_PANE_PROXY_HOST must be an expected Pane host header: ' +
        allowedList(ALLOWED_PANE_PROXY_HOST_HEADERS) +
        '.',
    );
  }

  return rawHost;
}

export function createPaneProxyOptions(env) {
  const target = validatePaneProxyTarget(env.VITE_PANE_PROXY_TARGET);
  const host = validatePaneProxyHost(env.VITE_PANE_PROXY_HOST);

  return {
    target,
    changeOrigin: true,
    secure: false,
    headers: host
      ? {
          Host: host,
        }
      : undefined,
    rewrite: (path) => path.replace(/^\/pane/, ''),
  };
}
