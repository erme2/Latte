# Latte

Latte is the reusable React and TypeScript frontend template for
organization-specific applications that authenticate through Pane and use Pane
as their only data-access layer.

Pane is an independently installable, multi-organization backend. It owns
authentication, authorization, invitations, encrypted database connections,
catalog discovery, descriptions, and data access. Each Latte-derived
application is linked to one organization in one Pane installation and never
connects directly to a managed database.

Pane supports one or more MySQL or MariaDB connections per organization,
discovers table metadata through database system catalogs, and exposes
controlled CRUD as its first capability, not its final scope.

A new **Burro** application will be created from Latte as the private
administration console for Pane administrators. See
[Pane, Latte, and Burro Product Architecture](docs/product-architecture.md) for
the agreed phase-one product and security boundaries.

## Setup

Create a local env file for running Latte outside Docker:

```bash
cp .env.example .env
```

The default local values point the Vite proxy at Pane on `http://localhost:8000`.

Latte only allows the Vite `/pane` proxy to target expected local Pane endpoints. Invalid proxy targets fail during Vite startup instead of silently routing authenticated Pane traffic elsewhere.

| Environment | `VITE_PANE_PROXY_TARGET` | `VITE_PANE_PROXY_HOST` | `VITE_PANE_PROXY_VERIFY_TLS` |
| --- | --- | --- | --- |
| Local host | `http://localhost:8000` | empty | `true` |
| Docker | `https://nginx` | `pane.localhost` | `false` |

`VITE_PANE_PROXY_TARGET` must be an `http` or `https` origin for an expected local Pane host. `VITE_PANE_PROXY_HOST` is optional, but when set it must be an expected Pane Host header such as `pane.localhost`. `VITE_PANE_PROXY_VERIFY_TLS` defaults to `true`; set it to `false` only for local development targets that use a self-signed certificate or a container DNS name that cannot pass normal certificate verification.

Latte validates the login URL returned by Pane before redirecting the browser. By default, redirects are allowed only to `https://api.workos.com` and `https://*.authkit.app`. Set `VITE_AUTH_REDIRECT_ALLOWED_HOSTS` to a comma-separated list of extra trusted authentication hosts when using a custom WorkOS/AuthKit domain, for example `login.example.com,*.auth.example.com`.

Pane should also allow the Latte-derived application as its frontend origin:

```dotenv
FRONTEND_URL=http://localhost:5173
```

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Latte calls Pane through Vite's `/pane` proxy, avoiding cross-origin browser requests. It checks `GET /auth/user`; if there is no active Laravel session, it calls `GET /auth/login-url`, redirects the browser to the returned WorkOS AuthKit URL, receives the WorkOS callback, and posts the callback params to `POST /auth/callback`. Pane then creates the Laravel session and Latte stores a small user snapshot in `sessionStorage`.

Pane owns server-side OAuth state validation. Latte forwards the callback state to Pane, and Pane rejects missing or mismatched state before completing login.

Pane's CSRF protection expects mutating browser requests to echo Pane's encrypted `XSRF-TOKEN` cookie in the `X-XSRF-TOKEN` header. Latte configures its Pane Axios client to send that header automatically for requests through the `/pane` proxy.

See [WorkOS Authentication Flow](docs/workos-auth.md) for the full Latte and Pane auth sequence.

## Run With Docker For Local Development

Create the Docker env file:

```bash
cp .env.docker.example .env.docker
```

Then start the container:

```bash
docker compose -f docker-compose.dev.yml up
```

Docker uses `.env.docker` so its Pane proxy can target the `pane_laravel` network while local development keeps using `.env`. Both files are ignored by Git; only the example templates should be committed.

The explicitly named `Dockerfile.dev` and `docker-compose.dev.yml` files are only for local development. Latte intentionally has no default `Dockerfile` or `docker-compose.yml`, so generic Docker commands cannot accidentally treat the Vite development server as a production runtime.

The development container runs as the image-provided `node` user. The source tree is bind-mounted at `/app`, and the writable dependency directory is the container-managed `/app/node_modules` volume.

The development container runs Vite and publishes it only on `127.0.0.1:5173`. Do not deploy this Compose service or use it as a production runtime. A production deployment must run `npm run build` and serve the generated `dist/` assets with a production web server.

## Repository transition

This repository continues the complete history of the original `erme2/Burro`
repository under the canonical name `erme2/Latte`. Do not use GitHub's
old-name redirect as a permanent dependency. See the
[repository rename record](docs/repository-rename.md) for the migration and
verification checklist.
