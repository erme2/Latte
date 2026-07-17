# Burro

React and TypeScript demo app for Pane authentication through WorkOS.

## Setup

Create a local env file for running Burro outside Docker:

```bash
cp .env.example .env
```

The default local values point the Vite proxy at Pane on `http://localhost:8000`.

Burro only allows the Vite `/pane` proxy to target expected local Pane endpoints. Invalid proxy targets fail during Vite startup instead of silently routing authenticated Pane traffic elsewhere.

| Environment | `VITE_PANE_PROXY_TARGET` | `VITE_PANE_PROXY_HOST` |
| --- | --- | --- |
| Local host | `http://localhost:8000` | empty |
| Docker | `https://nginx` | `pane.localhost` |

`VITE_PANE_PROXY_TARGET` must be an `http` or `https` origin for an expected local Pane host. `VITE_PANE_PROXY_HOST` is optional, but when set it must be an expected Pane Host header such as `pane.localhost`.

Pane should also allow Burro as its frontend origin:

```dotenv
FRONTEND_URL=http://localhost:5173
```

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Burro calls Pane through Vite's `/pane` proxy, avoiding cross-origin browser requests. It checks `GET /auth/user`; if there is no active Laravel session, it calls `GET /auth/login-url`, redirects the browser to the returned WorkOS AuthKit URL, receives the WorkOS callback, and posts the callback params to `POST /auth/callback`. Pane then creates the Laravel session and Burro stores a small user snapshot in `sessionStorage`.

Pane owns server-side OAuth state validation. Burro forwards the callback state to Pane, and Pane rejects missing or mismatched state before completing login.

Pane's CSRF protection expects mutating browser requests to echo Pane's encrypted `XSRF-TOKEN` cookie in the `X-XSRF-TOKEN` header. Burro configures its Pane Axios client to send that header automatically for requests through the `/pane` proxy.

See [WorkOS Authentication Flow](docs/workos-auth.md) for the full Burro and Pane auth sequence.

## Run With Docker For Local Development

Create the Docker env file:

```bash
cp .env.docker.example .env.docker
```

Then start the container:

```bash
docker compose up
```

Docker uses `.env.docker` so its Pane proxy can target the `pane_laravel` network while local development keeps using `.env`. Both files are ignored by Git; only the example templates should be committed.

The Docker setup runs the Vite development server and publishes it only on `127.0.0.1:5173`. Do not use this Compose service as a production runtime.
