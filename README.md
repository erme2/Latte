# Burro

React and TypeScript demo app for Pane authentication through WorkOS.

## Setup

Create `.env`:

```dotenv
VITE_PANE_BASE_URL=http://localhost:8000
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

Open `http://localhost:5173`. Burro checks `GET /auth/user` on Pane. If there is no active Laravel session, it redirects to `GET /auth/login` on Pane, which starts the WorkOS AuthKit login flow. After login, Pane redirects back to `/dashboard`.
