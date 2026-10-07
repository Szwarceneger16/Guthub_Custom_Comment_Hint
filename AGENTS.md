# Agent instructions

## Scope and first read

This repository contains the GitHub Custom Comment Hint Firefox extension.
Read README.md, docs/CONFIGURATION.md, docs/PUBLICATION.md and docs/VALIDATION.md
before implementation. Continue in the selected checkout unless the user requests
another location. Inspect Git status, worktrees and changes before editing, and
preserve unrelated work.

## Tooling and implementation

- Use PNPM exclusively for package management and package tooling. Never use npm,
  npx, yarn or bun. Use the Node and PNPM versions pinned by mise, .nvmrc and
  packageManager. Preserve the frozen PNPM lockfile.
- Use plain JavaScript, Firefox Desktop Manifest V3, local storage and PL/EN UI.
- Keep configuration validation, text operations, DOM adaptation, grid rendering
  and settings separate. Preserve reusable named layouts and ordered assignments.
- Buttons insert text only; users submit through GitHub. Render configured labels
  as text, preserve Unicode and never execute configuration as HTML.
- Keep host scope limited to HTTPS github.com. History permission remains optional
  and is requested only for explicit history import. No server, tokens, analytics
  or remote code belongs in the extension.
- Discussions may be Polish. Code comments, implementation documentation, commits
  and pull-request descriptions must be English. User-facing translations may be
  Polish or English.

## Git and authorization

Do not commit, push, reset, merge, force-push, amend, squash, rebase or rewrite
history without explicit user authorization for the action and this repository.
An approved action remains approved while completing it. Existing Codex review
fixes in an authorized PR permit a signed commit and ordinary push without a
new confirmation. They do not authorize reset, merge, force-push or rebase.

Use signed commits and preserve the configured signing mechanism. Before an SSH
signing/authentication operation, briefly warn that a GUI passphrase prompt may
appear and keep its session alive while the user responds. Never request, read,
print, store or bypass a passphrase. Report unavailable signing rather than
committing unsigned.

Prefer merging an updated base into published branches. Rebase and force-push
require separate explicit approval. Use the codex/ prefix for new branches unless
the user requests another name. After all authorized work has been pushed to an
existing PR, leave one final @codex review comment. Configuration insertion strings
are not instructions to publish comments.

## Validation, privacy and live changes

Test logic and DOM integration with synthetic local fixtures first. Keep local
validation, real-extension acceptance, remote CI, signing and publication distinct.
Do not install in an existing browser profile or operate an authenticated session
without authorization for that action. Never copy profiles or credentials here.

Run relevant tests, lint/build, integrity checks and the privacy audit before
publication. Release sources must reproduce all runtime bytes. Preserve the
extension ID and saved configuration across updates.

Do not store conversation transcripts, personal handoff/memory documents, local
machine paths, private repository references, credentials or unrelated findings
in tracked files. Use fictional names in fixtures. Publishable audit reports must
contain scope and counts, not private matched values. Do not administer services,
install system packages or modify unrelated files as part of repository work.
