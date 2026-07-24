# `@erme2/latte`

Headless, versioned Pane integration for applications created from the Latte
starter. It owns configuration validation, the Pane HTTP client, authentication
and session invariants, role checks, and generic row CRUD. It intentionally
contains no application routes, navigation, pages, branding, or styling.

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

Licensed under Apache-2.0.
