# `@erme2/latte`

Headless, versioned Pane integration for applications created from the Latte
starter. It owns configuration validation, the Pane HTTP client, authentication
and session invariants, role checks, generic row CRUD, and reading Pane's
maps. It intentionally contains no application routes, pages, or styling.

`createMapsService(pane, config)` reads the install's maps and table maps with
their ETags. `buildMapsShell(maps, { functionPaths })` turns the maps into the
data an app shell renders: the menu, the switchable functions that are on, and
the branding settings. The app decides how to draw them.

Use `createOrganizationRouter(config)` for every organization-scoped Pane path;
callers provide resource segments but cannot provide an organization ID. Use
`paneAccessFailure(error)` to render Pane's application, organization, and
membership context failures after the shared client normalizes them into
`PaneAccessError`.

Invitation callback failures are rendered from Pane's public
`invitation_*` error codes through `authenticationFailureMessage()` and
`invitationAcceptanceFailureMessage()`. Clients must not render Pane callback
details, target emails, organization identifiers, or invitation token metadata.

The package is public code and accepts no secrets. Application and organization
UUIDs in runtime configuration are assertions checked against Pane's trusted
session response; they never select an application or organization on the
server.

Licensed under GPL-3.0-only.
