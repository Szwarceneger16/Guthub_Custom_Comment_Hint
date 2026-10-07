# GitHub Custom Comment Hint

A Firefox Desktop extension that adds configurable text buttons above
Write/Preview in GitHub pull request and issue comment editors. Create named
layouts, share them across repositories, append or replace text, and undo the
last insertion. You submit the comment with GitHub's existing Comment button.

## Getting started

1. Open settings with the extension's toolbar icon.
2. In **Assignments**, add a GitHub owner and repository.
3. Assign one or more layouts in the desired order and click **Save**.
4. Open a PR or issue where you can comment. Buttons appear above Write/Preview
   in the main **Add a comment** editor.

Fresh installations include editable `ci` and `codex` examples without repository
assignments. `/ci-now` and `@codex review` are insertion strings; their effect
when submitted depends on your repository's integrations. The add-on provides
no CI service or Codex account. Updates preserve saved configuration.

## Features

- Reusable named layouts and ordered owner/repository assignments.
- Exact replacement, append with newline separation, and single-step Undo.
- Layouts, Assignments and JSON views with a shared configuration draft.
- UTF-8 import/export, validation and preservation of invalid stored data.
- Local repository suggestions from visits and optional GitHub history import.
- Three-column grid, light/dark themes, Unicode/emoji and keyboard access.
- Polish and English UI; configurable labels and values remain unchanged.

Firefox Desktop 140+ and github.com are supported. Existing-comment edit forms,
inline code-review editors, GitHub Enterprise hosts and Android are outside this
version's scope. The adapter leaves unknown or ambiguous editors untouched.

## Development

Use **PNPM exclusively**. Node **24.21.0** and PNPM **12.9.1** are pinned in
`mise.toml`; `.nvmrc` matches Node and `packageManager` matches PNPM.

```sh
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile --store-dir .pnpm-store --state-dir .cache/pnpm
mise exec -- pnpm browser:install
mise exec -- pnpm test
mise exec -- pnpm test:browser
mise exec -- pnpm lint
mise exec -- pnpm build
mise exec -- pnpm check:integrity
mise exec -- pnpm audit:privacy
```

The fixture browser is downloaded into this project's cache. It uses synthetic
pages and mocked WebExtension APIs, not an existing browser profile. Source
modules are plain JavaScript. esbuild bundles browser entrypoints into
`dist/extension/`, and web-ext creates the runtime ZIP in `artifacts/`.
Dependencies and permitted install scripts are fixed by the PNPM lockfile and
workspace configuration.

Lint fails all errors and warnings except the retained web-ext 10.0.0 Android
minimum-version warning for a Desktop-only add-on. The complete JSON lint report
is saved. This exception does not hide unrelated messages.

## AMO submission

Version **1.0.0** uses the **MIT** license and stable add-on ID
`github-custom-comment-hint@szwarceneger16`.

```sh
mise exec -- pnpm release:prepare
mise exec -- pnpm release:verify
mise exec -- pnpm release:check-signing
mise exec -- pnpm audit:privacy --history --packages
```

Preparation produces unsigned runtime, reviewer-source and listing-materials
ZIPs with hashes. Source verification extracts the source archive, rebuilds with
the frozen lockfile and compares every runtime byte. Signing checks intercept
the signer subprocess and use dummy credentials; they cannot contact AMO.

`sign:listed` and `sign:unlisted` submit the extension to Mozilla and require
publication authorization. Store assets can be regenerated with `pnpm assets:amo`
using the dedicated fixture Firefox. Ordinary builds and reviewer reproduction
use checked-in PNGs and need no browser. Never publish local caches or profiles.

## Documentation

- [Configuration](docs/CONFIGURATION.md): JSON, layout sharing and text behavior.
- [Installation](docs/INSTALLATION.md): temporary installation and live acceptance.
- [Privacy](docs/PRIVACY.md): local data and permission scope.
- [Publication](docs/PUBLICATION.md): AMO materials and submission instructions.
- [Validation](docs/VALIDATION.md): actual local checks and remaining acceptance.
- [Source reproduction](SOURCE_BUILD.md): instructions included in reviewer sources.
- [Repository privacy](docs/REPOSITORY_PRIVACY.md): audit scope and public-release checks.
- [Agent instructions](AGENTS.md): repository conventions and authorization rules.
