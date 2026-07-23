# `@erme2/latte`

Headless, versioned Pane integration for applications created from the Latte
starter. It owns configuration validation, the Pane HTTP client, authentication
and session invariants, role checks, and generic row CRUD. It intentionally
contains no application routes, navigation, pages, branding, or styling.

Use `createOrganizationRouter(config)` for every organization-scoped Pane path;
callers provide resource segments but cannot provide an organization ID. Use
`paneAccessFailure(error)` to map Pane's application, organization, and
membership context failures to stable messages safe for presentation.

The package is public code and accepts no secrets. Application and organization
UUIDs in runtime configuration are assertions checked against Pane's trusted
session response; they never select an application or organization on the
server.

Licensed under Apache-2.0.
