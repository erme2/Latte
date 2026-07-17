const DEFAULT_AUTH_REDIRECT_ALLOWED_HOSTS = ['api.workos.com', '*.authkit.app'];

function hasValue(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function parseAllowedHostPattern(value) {
  const rawPattern = value.trim().toLowerCase();

  if (!hasValue(rawPattern)) {
    return null;
  }

  if (/\s|[/:?#@]/.test(rawPattern) || rawPattern.includes('://')) {
    throw new Error('VITE_AUTH_REDIRECT_ALLOWED_HOSTS must contain host names only.');
  }

  if (rawPattern.startsWith('*.')) {
    return {
      type: 'subdomain',
      hostname: rawPattern.slice(2),
    };
  }

  if (rawPattern.includes('*')) {
    throw new Error('VITE_AUTH_REDIRECT_ALLOWED_HOSTS wildcards must use the form *.example.com.');
  }

  return {
    type: 'exact',
    hostname: rawPattern,
  };
}

function allowedHostPatterns(value) {
  const configuredHosts = hasValue(value) ? value.split(',') : [];

  return [...DEFAULT_AUTH_REDIRECT_ALLOWED_HOSTS, ...configuredHosts]
    .map(parseAllowedHostPattern)
    .filter(Boolean);
}

function isAllowedHost(hostname, allowedHosts) {
  return allowedHosts.some((allowedHost) => {
    if (allowedHost.type === 'exact') {
      return hostname === allowedHost.hostname;
    }

    return hostname.endsWith('.' + allowedHost.hostname);
  });
}

export function validateAuthRedirectUrl(value, configuredAllowedHosts) {
  if (!hasValue(value)) {
    throw new Error('Pane returned an invalid authentication redirect URL.');
  }

  let redirectUrl;

  try {
    redirectUrl = new URL(value.trim());
  } catch {
    throw new Error('Pane returned an invalid authentication redirect URL.');
  }

  if (redirectUrl.protocol !== 'https:') {
    throw new Error('Pane returned an untrusted authentication redirect URL.');
  }

  if (redirectUrl.username !== '' || redirectUrl.password !== '' || redirectUrl.port !== '') {
    throw new Error('Pane returned an untrusted authentication redirect URL.');
  }

  const hostname = normalizeHostname(redirectUrl.hostname);

  if (!isAllowedHost(hostname, allowedHostPatterns(configuredAllowedHosts))) {
    throw new Error('Pane returned an untrusted authentication redirect URL.');
  }

  return redirectUrl.toString();
}
