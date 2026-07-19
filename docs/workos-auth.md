# WorkOS Authentication Flow

This document describes how Latte-derived applications and Pane cooperate during WorkOS AuthKit login.

## Ownership

Latte owns the browser experience:

- Checks whether the user already has a Pane session.
- Requests a WorkOS login URL from Pane when no session exists.
- Redirects the browser to WorkOS AuthKit.
- Receives the browser back on the Latte application's callback URL.
- Forwards the WorkOS callback parameters to Pane.
- Stores a small authenticated user snapshot in `sessionStorage` after Pane confirms login.

Pane owns authentication and session security:

- Creates the WorkOS authorization URL.
- Generates and stores the OAuth `state`.
- Validates the returned `state`.
- Exchanges the WorkOS authorization code.
- Creates or updates the local Pane user.
- Creates the Laravel session.
- Rejects callbacks with missing or mismatched state.

Latte does not validate OAuth state itself. It forwards the callback `state` to Pane because Pane is the system that generated the state and owns the Laravel session/cookie state needed to validate it.

## Login Sequence

1. Latte starts by calling Pane through the Vite proxy:

   ```http
   GET /pane/auth/user
   ```

2. If Pane returns `401` or `403`, Latte asks Pane for a WorkOS login URL:

   ```http
   GET /pane/auth/login-url?redirect_to=<latte-dashboard-url>
   ```

3. Pane generates a random WorkOS `state`, stores it in the Laravel session, and returns:

   ```json
   {
     "authorization_url": "https://api.workos.com/...",
     "state": "..."
   }
   ```

   Pane may also set a short-lived `pane_workos_state` cookie so JSON callback requests can still be validated if the session state is not available in the normal way.

4. Latte validates that `authorization_url` uses a trusted authentication redirect host, then redirects the browser to it. The default trusted hosts are `api.workos.com` and `*.authkit.app`; custom WorkOS/AuthKit domains can be added with `VITE_AUTH_REDIRECT_ALLOWED_HOSTS`.

5. WorkOS redirects back to Latte with callback parameters:

   ```text
   /auth/callback?code=...&state=...
   ```

6. Latte posts those parameters to Pane. Latte keeps an in-flight guard around this request so React development remounts or repeated callback renders reuse the same promise instead of exchanging the one-time WorkOS code twice:

   ```http
   POST /pane/auth/callback
   Content-Type: application/json

   {
     "code": "...",
     "state": "..."
   }
   ```

7. Pane validates that the returned `state` matches the server-side state it created earlier.

8. If state is valid, Pane exchanges the code with WorkOS, syncs the user, logs the user into Laravel, and returns the authenticated user payload.

9. Latte stores that user payload in `sessionStorage` and shows the dashboard.

## CSRF for Pane Requests

Latte sends Pane requests with credentials through the `/pane` proxy. Axios is configured to read Pane's encrypted `XSRF-TOKEN` cookie and send it as the `X-XSRF-TOKEN` header. Pane uses that header for CSRF validation on mutating CRUD requests.

The WorkOS callback POST is exempt from CSRF in Pane because it completes an external OAuth redirect before the user has an authenticated Pane session. Pane still validates the WorkOS `state` value on that route.

## Invalid State Behavior

If the callback `state` is missing or does not match Pane's expected state, Pane returns:

```json
{
  "message": "Invalid WorkOS state."
}
```

Latte treats that as an authentication error and does not create a client-side authenticated state.

## Local Development URLs

In local Vite mode, Latte usually runs at:

```text
http://localhost:5173
```

In Docker/local HTTPS mode, Latte usually runs at:

```text
https://latte.localhost
```

Latte sends Pane requests through its `/pane` proxy. The Docker env file points the proxy at Pane's Docker network service:

```dotenv
VITE_PANE_BASE_URL=/pane
VITE_PANE_PROXY_TARGET=https://nginx
VITE_PANE_PROXY_HOST=pane.localhost
```

Pane must be configured with a WorkOS redirect URI that returns the browser to Latte's callback route, for example:

```dotenv
WORKOS_REDIRECT_URI=https://latte.localhost/auth/callback
FRONTEND_URL=https://latte.localhost
```

The exact values can differ by environment, but the important rule is that WorkOS returns the browser to Latte, and Latte forwards the callback to Pane.
