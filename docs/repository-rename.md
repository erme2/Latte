# Burro-to-Latte Repository Rename Record

This record controls the one-time rename of the original `erme2/Burro`
repository to `erme2/Latte`. It separates the reusable Latte template from the
future, new Burro Pane-administrator console.

GitHub redirects from the former repository name are temporary migration aids.
No maintained integration may depend on them, and `erme2/Burro` must not be
reused until every canonical reference has moved to `erme2/Latte`.

## Before the GitHub rename

- [ ] Merge or explicitly close every outstanding pull request whose work must
  survive the rename.
- [ ] Record open issues that will remain Latte work and the Burro-console
  issues that will later be transferred to the new repository.
- [ ] Confirm the default branch, protected branches, repository visibility,
  collaborators, releases, environments, webhooks, deploy keys, Actions
  variables, and Actions secrets.
- [x] Rename package metadata, runtime copy, browser title, session-storage key,
  Docker service/container names, documentation, and local URL examples.
- [x] Preserve the name Burro in product documentation only for the future
  Pane-administrator console.

## GitHub and local migration

- [ ] Rename the existing repository in place from `erme2/Burro` to
  `erme2/Latte`; do not create a replacement repository.
- [ ] Confirm issues, pull requests, branches, tags, releases, and commit history
  remain available at `erme2/Latte`.
- [ ] Update each local clone with
  `git remote set-url origin git@github.com:erme2/Latte.git` and verify
  `git fetch origin` succeeds without relying on the old-name redirect.
- [ ] Update CI badges, branch protection, environments, Actions permissions,
  secrets, variables, webhooks, deploy keys, package publishing, deployment
  jobs, and any external automation to use the canonical Latte repository.
- [ ] Update trusted frontend origins and WorkOS callback URLs from
  `burro.localhost` or deployed Burro-template hosts to their Latte equivalents.

## Related repositories and project tracking

- [ ] Update Pane documentation and links to use `erme2/Latte` while retaining
  Burro as the name of the future Pane-administrator console.
- [ ] Update Yaup project items and saved views so template work resolves to the
  renamed Latte repository.
- [ ] Search maintained repositories and deployment configuration for
  `erme2/Burro`, `github.com/erme2/Burro`, `burro.localhost`, and clone URLs;
  resolve every occurrence that refers to the template.

## Completion gate

- [ ] Run Latte tests, lint, and production build successfully after the rename.
- [ ] Verify branch protection, Actions, secrets, variables, webhooks, and
  deployment integrations against `erme2/Latte` after the rename.
- [ ] Confirm no maintained dependency requires GitHub's old-name redirect.
- [ ] Confirm `erme2/Burro` is safe to reuse, then create the new Burro console
  only through its dedicated delivery ticket.

Record the verification date and operator here when every box is checked:

- Date: pending
- Operator: pending
