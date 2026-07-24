# WorkOS authentication through Pane

Latte owns browser presentation and Pane owns authentication, application
resolution, organization binding, OAuth state, and the server-side session.
The shared implementation lives in the public `@erme2/latte` package so normal
product features never need to modify authentication internals.

1. Latte loads and validates `/latte-config.json` before rendering.
2. It calls `GET /api/v1/session` through the credentialed Pane client.
3. A `401` starts login by bootstrapping CSRF with `POST /api/v1/csrf-cookie`
   and creating a login intent at `POST /api/v1/auth/login-intents`.
4. Pane resolves the registered application from the browser Origin, fixes its
   organization, stores OAuth state server-side, and returns a trusted WorkOS
   authorization URL.
5. WorkOS redirects to the Latte callback with `code` and `state`. Latte sends
   both to `POST /api/v1/auth/callback` without interpreting the state.
   Provider error or incomplete callbacks stop locally with a safe message and
   make no Pane request until the user explicitly retries.
6. Pane validates state and identity, creates the session, and returns the
   Latte session resource.
7. Latte verifies that the returned application and organization UUIDs match
   its public deployment expectations. They are assertions only; Latte never
   asks Pane to select an application or organization.

Callback exchange is single-flight by code and state so React development
effect replay cannot consume a one-time code twice. A failed callback retry
removes callback parameters before reloading; Latte then uses an existing Pane
session or starts a fresh login instead of resubmitting the consumed code.

Invitation links are consumed only by Pane. Latte reads `invitation_token` from
the initial URL, forwards it to `POST /api/v1/auth/login-intents`, and never
persists it in runtime configuration, storage, or the post-login redirect URL.
If Pane rejects the callback with one of its public invitation codes, Latte
renders only a local message selected from `error.code`:
`invitation_invalid`, `invitation_expired`, `invitation_revoked`,
`invitation_already_accepted`, `invitation_email_mismatch`, or
`invitation_organization_mismatch`. Latte does not render server details, target
emails, organization identifiers, or token metadata.

The Pane Axios client sends cookies and mirrors the encrypted `XSRF-TOKEN`
cookie in `X-XSRF-TOKEN` for mutations. Authentication URLs must use HTTPS and
match the exact or wildcard hosts declared by the product manifest. Secrets,
OAuth state, application selection, and organization selection are never kept
in browser configuration or product code.
