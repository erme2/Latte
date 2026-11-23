# Latte

Latte is the admin frontend over [Pane](https://github.com/erme2/Pane)'s REST API:
a React and TypeScript application, built with Vite and served as static files.
It signs in through Pane with the same login as the product apps (for example
Sweegly) and uses Pane as its only data-access layer.

What Latte offers (MVP roadmap, owner decisions of 2026-11-18):

- **Invitations and members** for administrators and users (`/members`).
- **Records**: list, create, edit and delete rows through Pane's Story/Action/Mapper
  CRUD route, from the menu and table maps Pane serves (Latte#81).
- **Views drawn from the maps**: the menu and the list and edit views come from the
  maps Pane serves (Latte#81), and a **maps editor** edits the exposed fields, labels,
  validation and views (Latte#71). Migrations stay the source of truth for table
  structure; Latte edits maps and data, never tables.

There are no organizations and no managed database connections: one Pane install
serves one product, and Latte never connects to a database directly. Pane owns
authentication, authorization and data access. See the
[Pane, Latte and product architecture](docs/product-architecture.md) for the agreed
boundaries.

Latte is both a project starter and the home of the public, headless
`@erme2/latte` package. Derived applications own their appearance and product
pages while upgrading the package to receive shared authentication, Pane API,
configuration and authorization-state fixes. See the
[template and extension contract](docs/template-contract.md).

To find where a change belongs and which contracts it must keep, read the
[Latte architecture](docs/architecture.md): code map, sign-in and data flows,
trust boundaries, current versus target design, and a checklist before making
changes.

## Setup

Create a local env file for running Latte outside Docker:

```bash
cp .env.example .env
```

The default local values point the Vite proxy at Pane on `http://localhost:8000`.

Latte only allows the Vite `/pane` proxy to target expected local Pane endpoints. Invalid proxy targets fail during Vite startup instead of silently routing authenticated Pane traffic elsewhere. These `VITE_PANE_PROXY_*` values are only used when running Vite directly with `npm run dev`; Docker routes `/pane` through Latte's Nginx service instead.

| Environment | `VITE_PANE_PROXY_TARGET` | `VITE_PANE_PROXY_HOST` | `VITE_PANE_PROXY_VERIFY_TLS` |
| --- | --- | --- | --- |
| Host Vite dev server | `http://localhost:8000` | empty | `true` |
| Host Vite against Pane HTTPS | `https://pane.localhost` | `pane.localhost` | `false` only for self-signed local certs |

`VITE_PANE_PROXY_TARGET` must be an `http` or `https` origin for an expected local Pane host. `VITE_PANE_PROXY_HOST` is optional, but when set it must be an expected Pane Host header such as `pane.localhost`. `VITE_PANE_PROXY_VERIFY_TLS` defaults to `true`; set it to `false` only for local development targets that use a self-signed certificate or a container DNS name that cannot pass normal certificate verification.

Latte validates the login URL returned by Pane before redirecting the browser.
The product manifest allows `api.workos.com` and `*.authkit.app` by default;
derived applications add custom authentication domains to that typed allowlist.

Pane should also allow the Latte-derived application as its frontend origin:

```dotenv
FRONTEND_URL=http://localhost:5173
```

For Docker HTTPS development, Pane should instead trust Latte's local HTTPS
origin and callback:

```dotenv
FRONTEND_URL=https://latte.localhost
WORKOS_REDIRECT_URI=https://latte.localhost/auth/callback
WORKOS_RETURN_TO=https://latte.localhost
```

Copy `public/latte-config.json` for each deployment and replace its example
application UUID with the public value from the Pane registration. The committed local Docker example uses
`expectedOrigin=https://latte.localhost`; if you run Vite directly at
`http://localhost:5173`, change `expectedOrigin` to that exact origin before
starting the app. The file contains assertions only and must never contain
secrets.

To run an install as an admin-only console, add
`"adminOnly": { "productAppUrl": "https://app.example.test/" }`: signed-in
members who are not administrators are redirected to that product
app instead of seeing the console. See
[admin-only console mode](docs/template-contract.md#admin-only-console-mode).

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Latte calls Pane through Vite's `/pane` proxy,
loads `GET /api/v1/session`, creates a login intent when authentication is
required, and forwards the WorkOS callback to Pane. Pane owns the application,
OAuth state, and authenticated session.

Pane owns server-side OAuth state validation. Latte forwards the callback state to Pane, and Pane rejects missing or mismatched state before completing login.

Pane's CSRF protection expects mutating browser requests to echo Pane's encrypted `XSRF-TOKEN` cookie in the `X-XSRF-TOKEN` header. Latte configures its Pane Axios client to send that header automatically for requests through the `/pane` proxy.

See [WorkOS Authentication Flow](docs/workos-auth.md) for the full Latte and Pane auth sequence.

## Run With Docker For Local Development

Create the Docker env file:

```bash
cp .env.docker.example .env.docker
```

Install `mkcert`, then generate Latte's local certificate:

```bash
./bash/generate-certs.sh
```

Add `latte.localhost` to your local hosts file if your system does not already
resolve `*.localhost` to loopback:

```text
127.0.0.1 latte.localhost
```

Start Pane first so its `app` PHP-FPM service is attached to the
shared `pane_laravel` Docker network. Then start Latte:

```bash
docker compose up
```

Open `https://latte.localhost`. Latte's local Nginx service terminates TLS,
serves the Vite app, and proxies `/pane/*` to Pane's `app:9000`
backend on the shared Docker network. Pane remains backend-only and does not
own a Latte frontend vhost.

Docker uses `.env.docker` for Latte's Vite service while local host development
keeps using `.env`. Both files are ignored by Git; only the example templates
should be committed.

The explicitly named `Dockerfile.dev`, `docker-compose.dev.yml`, and default
`docker-compose.yml` are only for local development. The default Compose file
exists only so `docker compose up` starts the local HTTPS proxy. Do not treat
the Vite development server as a production runtime.

The development container runs as the image-provided `node` user. The source tree is bind-mounted at `/app`, and the writable dependency directory is the container-managed `/app/node_modules` volume.

The development container runs Vite behind Latte's Nginx service and does not
publish the Vite port to the host. On startup it verifies the container-managed
`/app/node_modules` volume contains the local `@erme2/latte` workspace link and
builds that workspace before starting Vite, so the starter can import the
package through the same public package boundary used by derived apps. Do not
deploy this Compose service or use it as a production runtime. A production
deployment must run `npm run build` and serve the generated `dist/` assets with
a production web server.

## Hostinger Alpha Hosting

The first Latte alpha deploys the static Vite build to Hostinger at
`https://latte.erme2.com`, with Pane at `https://pane.erme2.com`. See
[Hostinger hosting for the Latte alpha](docs/hostinger-hosting.md) for the
target directory, public runtime configuration, SPA fallback, cache behavior,
and smoke checks.

## Releases

Every merge to `main` runs the [Release workflow](.github/workflows/release.yml):
tests, lint and build, then the merge commit is tagged with the next patch
version (`v0.1.0` first, then `v0.1.1`, `v0.1.2`...). A commit that already has
a `vX.Y.Z` tag is not tagged again, and a failed check creates no tag. Release
runs queue and execute one at a time. GitHub does not guarantee they run in
merge order, so if a newer merge is tagged first, the older commit is not
tagged on its own: it ships in the newer tag, and a higher tag never points at
older code. Deploys from `erme2/deploy` use the latest tag
by default.

For a minor or major release, tag the merge commit by hand; later merges bump
the patch from it:

```bash
git tag v0.2.0 <commit on main>
git push origin v0.2.0
```

## Repository transition

This repository continues the complete history of the original `erme2/Burro`
repository under the canonical name `erme2/Latte`. Do not use GitHub's
old-name redirect as a permanent dependency. See the
[repository rename record](docs/repository-rename.md) for the migration and
verification checklist.

## License

Latte is licensed under GPL-3.0-only.
