# Burro

React and TypeScript demo app for Pane authentication through WorkOS.

## Setup

Create a local env file for running Burro outside Docker:

```bash
cp .env.example .env
```

The default local values point the Vite proxy at Pane on `http://localhost:8000`.

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

## Run With Docker

Create the Docker env file:

```bash
cp .env.docker.example .env.docker
```

Then start the container:

```bash
docker compose up
```

Docker uses `.env.docker` so its Pane proxy can target the `pane_laravel` network while local development keeps using `.env`. Both files are ignored by Git; only the example templates should be committed.
