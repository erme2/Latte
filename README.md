# Burro

React and TypeScript demo app for Pane authentication through WorkOS.

## Setup

Create `.env`:

```dotenv
VITE_PANE_BASE_URL=/pane
VITE_PANE_PROXY_TARGET=http://localhost:8000
```

Pane should also allow Burro as its frontend origin:

```dotenv
FRONTEND_URL=http://localhost:5173
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Burro calls Pane through Vite's `/pane` proxy, avoiding cross-origin browser requests. It checks `GET /auth/user`; if there is no active Laravel session, it calls `GET /auth/login-url`, redirects the browser to the returned WorkOS AuthKit URL, receives the WorkOS callback, and posts the callback params to `POST /auth/callback`. Pane then creates the Laravel session and Burro stores a small user snapshot in `sessionStorage`.
