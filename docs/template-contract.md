# Latte template and extension contract

Latte has two deliberately different distribution boundaries:

- this repository is a starter used to create a new, independently branded
  application repository;
- the public [`@erme2/latte`](../packages/latte-core/README.md) npm package is
  the versioned, headless Pane integration upgraded by every derived app.

This avoids copying security-sensitive integration code into repositories that
then drift apart. It also avoids putting product pages and visual identity into
a shared dependency.

## Ownership boundary

`@erme2/latte` owns:

- loading and validating public deployment configuration;
- the credentialed Pane `/api/v1` HTTP client and CSRF behavior;
- login intents, callbacks, session loading, and logout;
- verification that Pane's trusted session application and organization match
  the deployment's public expectations;
- organization role helpers and generic Pane row CRUD services;
- fixed-organization route generation and presentation-safe Pane access errors.

Row create and update operations send Pane's exact `{ "values": ... }` write
shape. Item reads and writes return both the response document and its strong
`ETag`; callers pass that validator back for update and delete preconditions.

The derived application owns `src/product/manifest.tsx`, its page components,
styles, assets, product API services, and tests. The typed manifest is the
stable extension point for branding, authentication redirect hosts, routes,
navigation, pages, role-aware visibility, and an explicit `createServices`
factory. Latte calls that factory once after validated configuration and Pane
client creation, then injects its inferred service type into every page.
Normal product work must not edit package authentication, session, tenant
validation, or Pane client internals.

The app shell's sign-in lifecycle (startup, invitation links, expired sessions,
sign out and retry) lives in `src/auth/`: `lifecycle.mjs` holds the steps and is
tested without React, and `useLatteAuthentication` wires it into `App.tsx`.
Product pages and their state live under `src/product/`, one folder per feature
(for example `src/product/organization/`).

## Shell from Pane maps

One Latte build serves every install: the menu, the switchable functions and
the branding come from Pane's maps (`GET /organizations/{organization_id}/maps`,
Pane#154) instead of code. After sign-in, `src/shell/useMapsShell.ts` loads them
through `platform.maps` (`createMapsService`) and `buildMapsShell` from
`@erme2/latte` turns them into:

- the menu, sorted by `position`, with one level of nesting. A `function` item
  opens the route tagged with that function; a `table` item opens
  `/records/{source}/{table}`. Items are left out when their function is off,
  when the app has no route for it, when `records` is off (table items), or
  when the caller can't see the table; children of a hidden item go with it;
- the set of functions switched on (`records`, `members`, `dashboard`). A route
  with `function: '<key>'` in the manifest renders `notFoundPage` while that
  function is off, and before the maps have loaded or when they fail;
- the brand, from the public settings `brand_name`, `brand_tagline` and
  `brand_logo_url` (an HTTPS URL or a same-origin path). Missing values fall
  back to the manifest's `brand` and `/latte-logo.svg`.

The manifest's `navigation` lists only always-on entries, such as the maps,
menu and settings editors: they show next to the maps menu whatever the install
switched off, so they can't point at a function route. Pages read table maps
with `context.maps.getTableMap(source, table)`, which accepts only stable map
names. Hiding is a usability boundary: Pane still decides what each caller may
read and write. `scripts/fixtures/maps-install-*.json` holds two installs used
by the tests.

### Record views

With `records` on, a table item opens three routes from the manifest:
`/records/:source/:table` lists rows (`src/product/records/RecordList.tsx`),
`/records/:source/:table/new` creates one and `/records/:source/:table/:rowKey`
edits or deletes one (`RecordEditor.tsx`). The `new` route is declared before
the edit route so it wins. Both read the table map, then talk to Pane's `/data`
routes (Pane#156) through `platform.data` (`createDataService`), which checks
map names, row keys and the sort before any request and sends the row's ETag in
`If-Match` on update and delete.

What the screens show comes from the map's `ui` part, through helpers in
`@erme2/latte`: `recordListColumns` (`ui.list.columns`, else the first five
visible fields), `recordListSort` (`ui.list.default_sort` when that field is
`sortable`), `recordFormFields` (no computed fields, and no primary key on
edit), `recordFieldWidget` (a known `ui.widget`, else one for the field type),
and `recordFieldLabel`. Fields with `ui.hidden` and password fields are never
listed. The map's `min`, `max` and `email` hints are checked in the browser;
Pane still validates every write. `recordWriteFailure` turns Pane's answers
into messages: `422 validation_failed` with `details.fields` marks each field,
`403` says the change isn't allowed, `404` says the record is gone and `412`
asks to reload. Filters wait for named queries (Pane#160), and the table maps
don't expose the access policy yet, so write actions show for everyone and a
denied write is reported when Pane refuses it. `scripts/fixtures/data-products-*.json`
holds the contract fixtures the tests use.

Route patterns use named whole-segment parameters such as
`/connections/:connectionId`. Page context receives decoded values in
`context.params`. Invalid encodings and unmatched paths render the product's
`notFoundPage`; role mismatches render `forbiddenPage` without invoking the
page. Navigation targets are concrete paths that must match a declared route.

Role-aware routes and navigation are a usability boundary only. Pane remains
the sole authorization authority for every API request.

## Runtime configuration

Deployments serve `/latte-config.json` before React starts:

```json
{
  "paneBaseUrl": "/pane",
  "expectedApplicationId": "01900000-0000-7000-8000-000000000001",
  "expectedOrigin": "https://app.example.test"
}
```

These four fields are required; `adminOnly` (below) is optional. Unknown fields, invalid UUIDs, non-canonical origins,
non-loopback HTTP origins, and unusable Pane URLs stop startup with a configuration error. Configuration
is intentionally public and must contain no passwords, API keys, connection
credentials, WorkOS secrets, or invitation tokens.

### Admin-only console mode

An install can run as an admin-only console, for example a Sweegly admin
console at `https://admin.dev.sweegly.co.uk` next to the product app at
`https://dev.sweegly.co.uk/`:

```json
{
  "paneBaseUrl": "/pane",
  "expectedApplicationId": "01900000-0000-7000-8000-000000000001",
  "expectedOrigin": "https://admin.dev.sweegly.co.uk",
  "adminOnly": { "productAppUrl": "https://dev.sweegly.co.uk/" }
}
```

After Pane returns the session, a membership whose role is not
`organization_administrator` is sent to `productAppUrl` with
`window.location.replace`, before any console screen renders. Organization
administrators use the console as usual. Without `adminOnly`, every active
member can use the console, as before.

A signed-out visitor starts their own login from the console, unless
`adminOnly.loginUrl` is set. Then the console sends them to `loginUrl` with
`next` set to the console page they opened (origin, path and query), and the
console never starts a login of its own. For the Sweegly dev install, where
login lives in the Sweegly app (see `hostinger-hosting.md` for the full
`PUBLIC_CONFIG_JSON`):

```json
"adminOnly": {
  "productAppUrl": "https://appdev.sweegly.co.uk/",
  "loginUrl": "https://appdev.sweegly.co.uk/login"
}
```

`productAppUrl` and `loginUrl` must each be a credential-free HTTPS URL (HTTP
only for loopback development hosts) without a fragment, on a different origin
than `expectedOrigin`. This is a frontend gate only: Pane still enforces
admin-only actions such as invitations and membership management server side.

Root-relative Pane bases use one leading slash and contain no authority, dot
segments, query, or fragment. Absolute bases are canonical HTTPS URLs, with
HTTP limited to loopback development hosts.

These values are assertions, not authority. `expectedOrigin` is compared with
the browser's actual origin. Application and organization UUIDs are compared
with Pane's `GET /api/v1/session` response. Runtime configuration never selects
an application or organization: Pane resolves the application from trusted
Origin/session state and fixes the organization server-side.

Product services receive `platform.organization`. Every organization-scoped
Pane request must use `platform.organization.path(...)`; it inserts the fixed
deployment organization and accepts only the remaining resource segments.
Route, query, form, and browser-storage values therefore cannot select or
override an organization. Pane still treats the client value as an assertion
and rejects modified, stale, mismatched, or revoked deployment context.

The shared Pane client and row service normalize Pane's fixed-organization 403
codes for application mismatch/revocation, organization mismatch/inactivity,
and missing or inactive membership into `PaneAccessError`. Use
`paneAccessFailure(error)` to render that state without exposing the
server-provided message. Other failures remain the product's responsibility,
including ordinary role permission denials.

The same built assets can therefore be deployed in multiple environments by
replacing only this public file. Vite's `VITE_PANE_PROXY_*` variables remain
host development-server configuration and are not application runtime state.
Docker local development routes `/pane` through Latte's Nginx service instead
of through Vite's proxy.

## Creating a derived application

1. Use GitHub's **Use this template** action on `erme2/Latte` to create an
   independent repository, then clone it.
2. Replace the root package name, `src/product/manifest.tsx`, page components,
   public assets, styles, and the example runtime configuration.
3. After the first public package version is published, replace
   `"@erme2/latte": "file:packages/latte-core"` with the intended compatible
   npm range (initially `"^0.1.0"`), remove the root `workspaces` entry, delete
   the copied `packages/latte-core` directory, and run `npm install`. Confirm
   `npm ls @erme2/latte` resolves from npm rather than a workspace link.
4. Register each deployment origin, redirect URI, fixed organization, and
   application in Pane. Copy the resulting public UUID expectations into the
   deployment configuration.
5. Run `npm test`, `npm run lint`, and `npm run build` before deployment.

Derived repositories do not retain Burro identity or installation-administrator
behavior. Burro is a separate Latte-derived product with its own manifest.

## Receiving Latte updates

Shared behavior follows semantic versions of the npm package. A derived app
updates with:

```bash
npm update @erme2/latte
npm test
npm run build
```

Patch releases contain compatible fixes, minor releases add compatible APIs,
and major releases may require a documented migration. Dependency automation
may open these upgrades across all derived repositories. Security fixes should
be released as a new package version rather than copied between applications.

Starter-only improvements are intentionally opt-in. They are documented as
small migration recipes rather than merging the entire Latte repository into
every product. Product repositories may add Latte as a read-only upstream for
inspection, but package upgrades are the supported shared-update mechanism.
