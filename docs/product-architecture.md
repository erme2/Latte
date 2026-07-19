# Pane, Latte, and Burro Product Architecture

Status: phase-one product decisions

This document records the initial product and security boundaries for Pane,
Latte, Burro, and applications created from Latte. It is intentionally a
phase-one contract. Later phases may add more data-source types, finer-grained
permissions, and external database support without weakening these boundaries.

## Product names and responsibilities

- **Pane** is the installable backend. It owns authentication, authorization,
  organizations, invitations, quotas, encrypted database connections, catalog
  discovery, descriptions, data access, impersonation, and auditing.
- **Latte** is the reusable React and TypeScript frontend template. The current
  Burro repository is intended to be renamed to Latte.
- **Burro** will be a new Latte-derived application used privately by Pane
  administrators as the operational console for one Pane installation.
- **Latte-derived applications** provide organization-specific product
  experiences and their own organization-administration panels.

Pane is the sole source of authorization decisions. Frontends never receive
database credentials and never connect directly to a managed database.

## Independent Pane installations

Each Pane installation is an independent, atomic universe. Installations do
not share or discover users, organizations, sessions, encryption keys,
connections, applications, or audit history.

A person using two Pane installations has two unrelated local user records,
even when WorkOS returns the same email or identity in both installations.
There is no global Pane registry or cross-installation administration layer.

An installation may contain multiple unrelated organizations. Pane enforces
organization isolation on the server for every organization-scoped operation.

## Identity, organizations, and memberships

A user identity belongs to one Pane installation. Users and organizations have
a many-to-many relationship through organization memberships.

An organization membership contains at least:

- the organization and user identifiers;
- the organization role;
- active or suspended status;
- inviter and invitation acceptance metadata;
- a stable public membership UUID;
- creation and update timestamps.

The stable membership UUID identifies ownership of rows in phase-one connected
databases. It is scoped to one organization membership rather than the user,
because one user may belong to several organizations.

Organizations are invisible to ordinary users until they accept an invitation
to that organization. A user invited to Acme learns nothing about Beta. If the
same user later accepts a Beta invitation, Pane reuses the installation-local
user identity but creates a separate Beta membership with independent role,
status, grants, and data ownership.

Removing a member suspends the membership instead of deleting it. Suspension
immediately removes access while preserving the membership UUID and owned
rows. Reinviting the same user reactivates the membership. Permanent erasure
is deferred to a later audited data-retention workflow.

## Roles

Phase one has three roles.

### Pane administrator

Pane administrators operate one entire Pane installation. They can:

- create, edit, suspend, close, reopen, and inspect organizations;
- set organization database limits;
- invite the first administrator of an organization;
- invite and manage other Pane administrators;
- view installation-wide audit and operational information;
- start audited impersonation sessions.

Pane administrators do not directly change organization connections,
memberships, grants, descriptions, or connected data. They must impersonate an
organization administrator or user for organization-scoped changes.

The first Pane administrator is created using a server-side installation
command. Existing Pane administrators invite additional Pane administrators.
The final active Pane administrator cannot be removed or demoted.

### Organization administrator

Organization administrators can:

- invite new organization users or administrators;
- promote, demote, suspend, reactivate, and remove organization members;
- manage database connections within the organization's limit;
- assign connection-level access to organization users;
- refresh the discovered catalog and manage descriptions;
- access all rows in all organization connections;
- view organization audit history.

An organization cannot lose its final active organization administrator.

### Organization user

Organization users can:

- access only connections explicitly granted to their membership;
- view discovered catalog information and descriptions for those connections;
- edit descriptions when their grant allows it;
- create, read, update, and soft-delete only rows owned by their membership.

Organization users cannot access connection configuration or credentials.

## Burro and Latte-derived application deployment

Burro is a private Pane-administrator console. Only Pane administrators may
enter it. Organization administrators and users receive no Burro access.

Every Latte-derived application deployment is registered with exactly one Pane
installation and permanently linked to exactly one organization. It must not
list, resolve, switch to, or reveal any other organization.

An application registration contains the fixed organization identifier and
trusted origin and redirect configuration. The browser cannot choose or
override the organization identifier. Pane rejects a user who does not have an
active membership in the application's linked organization.

Every organization-scoped API route includes an explicit organization
identifier. Pane resolves the calling application's registration and verifies
that the route organization matches the application's registered organization
before resolving any organization-owned resource. The route value provides
explicit server-side scope; it does not let the browser discover or switch
organizations.

Several Latte-derived applications may be linked to the same organization. A
membership works in every trusted application linked to that organization,
using the same connection grants. It reveals no membership or organization
outside the application's fixed organization.

Each Latte-derived application owns its product-specific organization-admin
interface. Latte provides reusable authentication, invitation acceptance,
role-aware UI, Pane API integration, connection management, grant management,
catalog, description, and authorization-state foundations.

## API routing invariants

- Every organization-scoped API route identifies its organization explicitly.
- The route organization must match the calling application's permanently
  registered organization.
- Pane validates the application, fixed organization, active membership, role,
  grant, requested operation, and row ownership; a route identifier alone never
  grants access.
- A mismatch is rejected before Pane resolves or reveals an
  organization-owned resource.
- Installation-scoped Pane-administrator routes do not require an organization
  identifier. Organization-scoped changes still require the Pane administrator
  to impersonate an organization administrator or user.
- The exact route prefix, organization identifier form, and API version syntax
  remain implementation decisions. They must not weaken these invariants.

## Invitations

Pane owns invitation state and lifecycle. WorkOS is responsible only for
authenticating the recipient and proving their identity.

An organization invitation:

- belongs to exactly one organization;
- targets one normalized email address and one role;
- uses a cryptographically random, single-use token stored only as a hash;
- requires the verified WorkOS email to match the invitation email;
- records the inviter, expiry, acceptance, revocation, and audit metadata;
- reactivates an existing suspended membership instead of creating a duplicate;
- never reveals any other organization.

Resending an invitation invalidates the previous token. Revocation takes
effect immediately. Expired invitations remain as audit records but cannot be
accepted.

Organization invitations expire after seven days by default. Organization
administrators may override that value for their organization within limits
defined by the Pane administrator. Pane-administrator invitations expire after
24 hours by default and are controlled only at installation scope.

## Typed settings and overrides

Settings resolve in this order:

1. organization override, when that setting is organization-overridable;
2. installation override;
3. versioned code default.

Each supported setting is declared in a typed registry with its type, default,
validation, allowed scope, and permitted administrator. Arbitrary unregistered
settings are rejected. Setting changes are audited.

The phase-one registry includes organization invitation expiry. Pane-admin
invitation expiry is installation-only. Exact minimum and maximum invitation
expiry bounds remain an implementation decision for the Pane administrator.

## Organization lifecycle and database quotas

Organizations have `active`, `suspended`, or `closed` status.

- Active organizations operate normally.
- Suspended organizations retain configuration and history but cannot use
  invitations, connections, or organization APIs.
- Closed organizations are logically retired and remain inaccessible.

Suspension and closure immediately invalidate organization access in existing
sessions. Pane administrators may reopen suspended or closed organizations in
phase one. Pane never deletes or changes a connected external database as part
of organization closure. Permanent erasure is out of scope.

Pane administrators assign a database limit to each organization. Only active
connections count toward the limit. Creating or reactivating a connection
consumes capacity; removing one releases capacity.

Lowering a limit below current usage preserves every existing connection. The
organization becomes over quota and cannot create or reactivate connections
until usage returns within the limit. Pane never chooses or suspends excess
connections automatically.

## Phase-one data sources

Phase one supports MySQL and MariaDB databases controlled by the product. It
does not support arbitrary third-party databases.

One Pane data source represents exactly one logical database. The database name
is mandatory, discovery is restricted to it, and it consumes one organization
quota unit. A credential that can see several logical databases does not expose
those other databases through the same data source.

Pane does not provision servers, databases, tables, columns, indexes, or
migrations. Infrastructure and project migrations prepare the database. Pane
tests the connection, discovers the catalog, validates the phase-one table
contract, and enables compliant tables for CRUD.

Each connection uses a dedicated database account restricted to its configured
logical database. It may read required system catalog metadata and perform
`SELECT`, `INSERT`, `UPDATE`, and `DELETE`. It must not have DDL, file, grant,
user-management, server-administration, or other-database privileges. Pane
reports missing or excessive privileges during connection testing.

## Connection configuration and network policy

A data-source profile contains non-secret metadata such as engine, display
name, description, host, port, database name, username, TLS mode, organization,
status, and audit timestamps.

Password and private certificate material are stored separately as encrypted,
write-only secrets. API responses never return them.

Pane administrators control an installation-level database egress policy.
Loopback, link-local, multicast, cloud metadata, and private network ranges are
denied by default. Pane administrators may explicitly allow required private
CIDRs or host patterns. Organization administrators cannot override the egress
policy. Hostname resolution is validated against DNS rebinding, and connection
and query operations use strict timeouts.

## Credential encryption

Each Pane installation has a dedicated, versioned credential-encryption key
stored outside Pane's primary database and separate from Laravel's `APP_KEY`.

The active key encrypts and authenticates credentials before persistence.
Previous key versions may remain available during rotation and gradual
re-encryption. Database backups cannot recover credentials without the
external keys.

Secrets are decrypted only in memory when required. Passwords, tokens,
certificates, and decrypted values are excluded from responses, logs,
exceptions, queued payloads, and audit events. Updating credentials replaces
them without displaying previous values.

## Catalog and descriptions

The connected database is the source of truth for physical schema. Pane reads
MySQL or MariaDB `information_schema` and stores a discovered catalog snapshot
in its primary database.

Pane stores human descriptions alongside its catalog records, not in the
connected database. Refreshing discovery updates structural metadata without
overwriting descriptions. New objects are added. Missing objects are marked
missing rather than deleted immediately. Phase one treats a rename as one
missing object and one new object.

Description updates use optimistic concurrency so a stale editor cannot
silently overwrite a newer change. Edits require an appropriate connection
grant and are audited.

## Connection grants

Organization administrators have implicit full access to every connection in
their organization. Standard users have no connection access by default.

Organization administrators assign one of these phase-one connection-level
presets:

- **Viewer:** read catalog, descriptions, and owned rows;
- **Editor:** Viewer plus create and update owned rows and edit descriptions;
- **Manager:** Editor plus soft-delete owned rows.

Grants are limited to one membership and one connection. Revocation takes
effect immediately. New connections grant no standard user access
automatically. Table-level permissions are deferred, but authorization is
implemented behind policies so finer granularity can be added later.

## Phase-one table and CRUD contract

Only explicitly enabled, discovered tables that satisfy the phase-one contract
are exposed to standard-user CRUD. Each user-owned table requires:

- one single-column primary key;
- a non-null, indexed, immutable `pane_membership_id` UUID;
- `created_at` and `updated_at` timestamps;
- a nullable `deleted_at` timestamp.

Pane injects the authenticated membership UUID during create. It never accepts
row ownership from the frontend. Read, update, and delete operations include a
server-enforced ownership predicate. Standard users cannot transfer ownership.

Delete is soft deletion. Deleted rows are absent from ordinary reads.
Organization administrators may inspect and restore deleted rows. Generic
hard deletion is not exposed in phase one. `updated_at` supports optimistic
concurrency for row updates.

Organization administrators may CRUD all rows in their organization's
connections. Pane uses discovered, allowlisted table and column identifiers
and parameterized values. It never accepts raw SQL or arbitrary client-supplied
identifiers. Composite primary keys, third-party ownership mapping, schema
editing, and database provisioning are deferred.

## Impersonation

Only Pane administrators may impersonate organization administrators or
users. Pane administrators cannot impersonate other Pane administrators.

Impersonation requires a reason, has a short expiry, cannot renew silently,
and displays a persistent banner with an explicit exit action. Sensitive
credential operations remain unavailable during impersonation.

Audit events preserve both the real Pane-admin actor and effective impersonated
user, together with organization, reason, session identifier, start, expiry,
IP address, and user agent. All changes made while impersonating are marked as
such.

## Audit history

Pane stores an append-only audit history in its primary database. Events record
the real actor, effective user, organization, action, outcome, resource type
and identifier, connection and table where applicable, row primary key,
changed column names, request identifier, IP address, user agent, and timestamp.

Audit events do not store connection secrets, invitation tokens, certificates,
or complete database row values.

Pane administrators can view installation-wide history through Burro.
Organization administrators can view their organization's history through
their Latte-derived application. Impersonated activity remains visible and
identifies the responsible Pane administrator. Phase one retains audit events
indefinitely; configurable retention and export may be added later.

## Deferred work

The following are explicitly outside phase one:

- cross-installation identity, discovery, or administration;
- third-party databases and ownership mappings;
- data-source types beyond MySQL and MariaDB;
- connections exposing multiple logical databases;
- table-level and row-policy configuration beyond membership ownership;
- composite primary keys;
- hard-delete and permanent organization or membership erasure workflows;
- database and schema provisioning;
- KMS or Vault integration beyond the versioned encryption-key abstraction;
- automatic catalog rename detection;
- configurable audit retention and export.

## Repository transition

The current Burro repository will become Latte. A new Burro repository will be
created from Latte for the Pane-administrator console. The rename and creation
must use a dedicated migration plan covering Git remotes, links, package
metadata, deployment configuration, trusted origins, issue ownership, and
documentation. Redirects from the former repository name must not be treated
as the permanent integration contract.
