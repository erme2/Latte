# Pane, Latte and product architecture

This document records the agreed MVP boundaries between Pane, Latte and the product
apps. It follows the owner decisions of 2026-11-18 (yaup
`plans/2026-11-18-sweegly-mvp-roadmap.yaml`) and replaces the earlier multi-organization
design, which is retired. Pane's side is in
[Pane architecture](https://github.com/erme2/Pane/blob/main/docs/architecture.md) and the
[Pane API v1 contract](https://github.com/erme2/Pane/blob/main/docs/api-v1.md).

## Components

- **Pane** is a headless REST API with map-driven (dynamic) CRUD endpoints, plus
  hand-written (static) endpoints where maps cannot express something (session,
  invitations, roles, sharing), one ticket each. It owns authentication, authorization,
  invitations, the maps and data access.
- **Latte** is the admin frontend over the same Pane API and the same login. It holds
  invitations, record list and edit views, a maps editor and views drawn from the maps.
- **Product apps** (for example Sweegly) are separate frontends over the same Pane
  install. Each keeps its own hand-made screens over the same endpoints.

There are no organizations and no managed database connections. One Pane install serves
one product; its tables live in the product's own database, defined by the product's
migrations, and Pane's `app:install` command installs the product's data folder
(migrations, then maps).

## Identity and roles

A user identity belongs to one Pane install. A user is an `admin` or a `user`. Sweegly is
invite only: administrators invite users and other administrators from Latte
(`/members`), and Pane sends and consumes the invitation.

- Administrators can sign in to Latte, invite people, and create, change and delete
  records.
- Users read what Pane opens to them, and on tables with a members rule only their own
  rows. They are sent to the product app when Latte runs in admin-only mode.

Hiding a route or a button in Latte is a usability measure only. Pane checks every
request.

## Trust boundaries

- Pane owns OAuth state, identity, the session cookie and the application binding. Latte
  forwards the WorkOS `code` and `state` to Pane without reading them.
- `latte-config.json` is public. It holds assertions only (the application UUID and the
  expected origin), never secrets, and never selects anything on the server.
- The browser is untrusted: Latte never holds database credentials, never sends raw SQL,
  and never chooses column names outside the map.
- Latte shows only fixed messages chosen from Pane's `error.code`.

## What Latte may change

- **Data**: rows of any table the maps expose, through Pane's CRUD route, subject to
  Pane's access rules.
- **Maps**: exposed fields, labels, validation and views, through Pane's maps admin API
  (Latte#71). Administrators open `/maps`, pick a table and edit its label, description, list
  columns and default sort, and each field's label, help text, visibility, `max`/`min`/`email`
  rules and form order. Saving sends the whole map with `PUT /maps/{source}/{table}` and the
  `If-Match` ETag it was read with: a stale edit answers `412 version_conflict` and asks for a
  reload; system maps (`409 system_map_protected`) open read-only.
- **Not table structure.** Migrations are the source of truth. Pane creating tables from
  Latte (Pane#187) comes later.

## Open decisions

The exact response envelope of Pane's legacy `/crud` route, how a map's `source` and
`table` map to a `/crud` subject, and which tables the first record menu lists are open
and tracked in Latte#80.
