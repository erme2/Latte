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
- organization role helpers and generic Pane row CRUD services.

Row create and update operations send Pane's exact `{ "values": ... }` write
shape. Item reads and writes return both the response document and its strong
`ETag`; callers pass that validator back for update and delete preconditions.

The derived application owns `src/product/manifest.tsx`, its page components,
styles, assets, product API services, and tests. The typed manifest is the
stable extension point for branding, authentication redirect hosts, routes,
navigation, pages, and role-aware visibility. Normal product work must not edit
package authentication, session, tenant validation, or Pane client internals.

Role-aware routes and navigation are a usability boundary only. Pane remains
the sole authorization authority for every API request.

## Runtime configuration

Deployments serve `/latte-config.json` before React starts:

```json
{
  "paneBaseUrl": "/pane",
  "expectedApplicationId": "01900000-0000-7000-8000-000000000001",
  "expectedOrganizationId": "01900000-0000-7000-8000-000000000002",
  "expectedOrigin": "https://app.example.test"
}
```

All fields are required. Unknown fields, invalid UUIDs, non-canonical origins,
non-loopback HTTP origins, and unusable Pane URLs stop startup with a configuration error. Configuration
is intentionally public and must contain no passwords, API keys, connection
credentials, WorkOS secrets, or invitation tokens.

These values are assertions, not authority. `expectedOrigin` is compared with
the browser's actual origin. Application and organization UUIDs are compared
with Pane's `GET /api/v1/session` response. Runtime configuration never selects
an application or organization: Pane resolves the application from trusted
Origin/session state and fixes the organization server-side.

The same built assets can therefore be deployed in multiple environments by
replacing only this public file. Vite's `VITE_PANE_PROXY_*` variables remain
development-server configuration and are not application runtime state.

## Creating a derived application

1. Create a new repository from Latte's GitHub template and clone it.
2. Replace the root package name, `src/product/manifest.tsx`, page components,
   public assets, styles, and the example runtime configuration.
3. Keep `@erme2/latte` as a normal npm dependency once the first public version
   is published; remove the starter's local `file:packages/latte-core` link.
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
