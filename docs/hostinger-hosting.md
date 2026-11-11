# Hostinger hosting for the Latte alpha

Latte's first alpha release is a static Vite SPA deployed to Hostinger at
`https://latte.erme2.com`. Pane remains the backend and API authority at
`https://pane.erme2.com`.

## Hosting target

Use the Hostinger subdomain directory under the main `erme2.com` document root:

```text
/home/u253124519/domains/erme2.com/public_html/latte
```

The main `erme2.com` deploy must preserve this directory. It uses `rsync
--delete` for the root site, so its release workflow must keep `/latte` and
other sibling application directories excluded from deletion.

## Domain and TLS

Configure `latte.erme2.com` in Hostinger as a subdomain rooted at the Latte
target directory. Enable Hostinger TLS for the subdomain before running release
smoke checks.

Pane must trust the Latte frontend origin and WorkOS callback:

```dotenv
FRONTEND_URL=https://latte.erme2.com
WORKOS_REDIRECT_URI=https://latte.erme2.com/auth/callback
WORKOS_RETURN_TO=https://latte.erme2.com
```

## Runtime configuration

Latte deployments serve `/latte-config.json` before React starts. Start from
`docs/examples/latte-config.hostinger.json`, replace the application and
organization UUIDs with the public values registered in Pane, then deploy it as
`latte-config.json`.

Production Latte configuration for the alpha should use:

```json
{
  "paneBaseUrl": "https://pane.erme2.com",
  "expectedApplicationId": "REPLACE_WITH_PANE_APPLICATION_UUID",
  "expectedOrganizationId": "REPLACE_WITH_PANE_ORGANIZATION_UUID",
  "expectedOrigin": "https://latte.erme2.com"
}
```

This file is public assertion data. It must never contain passwords, API keys,
database credentials, WorkOS secrets, invitation tokens, or user-specific
session data.

## Release version

The deploy (erme2/deploy) also writes `/latte-release.json` with the
version, ref, commit and build time, for example
`{"version":"0.1.3","ref":"v0.1.3","commit":"400c9dd…","built_at":"…"}`.
Latte shows it at the bottom right of every screen, including loading,
redirect and configuration-error screens: `v0.1.3` for a tagged release,
`dev · 400c9dd` for an untagged deploy, `dev` for local builds without the file.
Hover it for the ref, commit and build time. The file holds no secrets.

The Vite `VITE_PANE_PROXY_*` variables are for local development only. They are
not used by the static Hostinger build.

## Build and upload shape

Build locally or in CI with:

```bash
npm ci
npm run build
```

Deploy the generated `dist/` directory to the Hostinger target directory. The
upload step should preserve Hostinger-managed files and unrelated sibling
deployments, and it should not print secret values. The release deploy script in
Latte #46 will make this repeatable.

The committed `public/.htaccess` is copied into `dist/` by Vite and provides:

- direct SPA route refresh fallback to `index.html`;
- no-store cache headers for `index.html` and `latte-config.json`;
- long-lived immutable caching only for Vite's hashed build output
  (`assets/<name>-<hash>.<ext>`), where Hostinger allows Apache headers;
- revalidation (`max-age=0, must-revalidate`) for static files served at a
  fixed URL, such as `favicon.svg` and `icons.svg`, so a release that changes
  them is picked up.

## Smoke checks

After deployment, verify:

- `https://latte.erme2.com/` loads the app shell.
- `https://latte.erme2.com/dashboard` refreshes directly and serves the SPA.
- `https://latte.erme2.com/auth/callback` refreshes directly and serves the SPA.
- `https://latte.erme2.com/latte-config.json` returns the production public
  configuration with `expectedOrigin` set to `https://latte.erme2.com`.
- The bottom-right badge shows the deployed version, matching
  `https://latte.erme2.com/latte-release.json`.
- Browser requests use Pane at `https://pane.erme2.com`.
- `https://pane.erme2.com` still resolves after the Latte upload.
- `https://erme2.com` deploys do not delete the `/latte` directory.
