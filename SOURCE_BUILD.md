# Reproduce the submitted Firefox extension

This source archive contains all inputs needed to reproduce the runtime files
for GitHub Custom Comment Hint 1.0.0. Do not run a signing command to rebuild it.

## Tools

- Node.js **24.21.0**, also pinned by `.nvmrc` and `mise.toml`.
- PNPM **12.9.1**, pinned by `packageManager` and `mise.toml`.
- esbuild **0.28.2**, pinned by `package.json` and `pnpm-lock.yaml`.
- web-ext **10.0.0**, pinned by `package.json` and the lockfile.

Use PNPM exclusively. Ubuntu/Linux is suitable; the archive needs no Firefox
installation, existing browser profile, system service, credentials or external
repository. PNPM initially needs network access to fetch locked dependencies.
Only esbuild's dependency build script is allowed by `pnpm-workspace.yaml`.

If mise is available, review and trust this archive's `mise.toml`, install its
tools, then run commands through `mise exec --`:

```sh
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile --store-dir .pnpm-store --state-dir .cache/pnpm
mise exec -- pnpm prepare:extension
mise exec -- pnpm source:check
```

Alternatively, with the exact Node and PNPM versions already on PATH:

```sh
pnpm install --frozen-lockfile --store-dir .pnpm-store --state-dir .cache/pnpm
pnpm prepare:extension
pnpm source:check
```

`prepare:extension` recreates `dist/extension/`, copies runtime HTML/CSS,
manifest, locales, icons and license, and bundles the background/content/settings
entrypoints. All default configuration is inside `src/`; no external documents
or user repository assignments are needed. Output is readable UTF-8 JavaScript
targeting Firefox 140. No timestamps or absolute paths enter the output.

`source:check` compares every generated runtime file and its SHA-256 with
`runtime-sha256.json` at the archive root, failing on changed, missing or extra
files. Compare these runtime files with the unsigned ZIP submitted alongside
this source archive. ZIP timestamps/compression and Mozilla's later signature
are not part of the runtime-byte comparison.

The archive includes the build and byte-verification scripts. Other development
commands retained in `package.json` belong to the full repository and are not
needed for reviewer reproduction. Browser fixtures, release tooling and publication screenshots are omitted from this build-only archive.
