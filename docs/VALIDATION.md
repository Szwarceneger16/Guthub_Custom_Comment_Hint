# Local validation — 1.0.0

This document records local verification of the current submission candidate.
It does not establish AMO signing, public availability, remote CI or acceptance
on an authenticated GitHub session.

## Environment and scope

Node 24.21.0 and PNPM 12.9.1 are pinned by mise, .nvmrc and packageManager.
Dependencies: esbuild 0.28.2, web-ext 10.0.0, Playwright 1.63.0 and development-only
fflate 0.8.3. Firefox fixture tests use the project-local Playwright Firefox 155.
No existing browser profile or authentication data is used.

All DOM requests are intercepted, and extension APIs are mocked. Fixture owners,
repository names, comment bodies and configuration are fictional. Original SVG
and generated PNG icons contain no user data. Store screenshots show the actual
bundled UI using demonstration data and were visually inspected.

## Verification commands

Run through mise and PNPM from the repository root:

```sh
mise exec -- pnpm test
mise exec -- pnpm test:browser
mise exec -- pnpm release:prepare
mise exec -- pnpm release:verify
mise exec -- pnpm release:check-signing
mise exec -- pnpm check:integrity
mise exec -- pnpm audit:privacy --history --packages
```

The current run passed 23 logic/privacy tests, 32 Firefox fixture tests and six
intercepted signing checks. The Firefox run took 25.6 seconds. Source reproduction
matched all 15 runtime files, and lint returned zero errors/notices with the
known Desktop-only warning. Audit scope is summarized in REPOSITORY_PRIVACY.md.
Detailed generated evidence remains in ignored `artifacts/`: release-report.json,
lint-report.json, privacy-audit.json and versioned SHA256SUMS.

The logic suite covers shared layouts, ordering, rename/delete, invalid schema,
Unicode/UTF-8, URL boundaries, storage preservation, common drafts, text insertion,
Undo and privacy-rule behavior. Firefox fixtures cover main PR/issue editors,
exclusions, ambiguity, SPA navigation, form replacement, live settings changes,
text/selection preservation, Write/Preview, themes, geometry, keyboard use and
settings import/export/failure paths.

Signing checks intercept the PNPM signer subprocess and use dummy credentials.
They verify both channels, source attachment, no credentials in arguments,
missing-credential refusal and stale runtime/source/listing refusal. They make
no AMO request.

## Lint and packages

Lint reports zero errors and notices with one explicitly retained
KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION warning. web-ext 10 checks
Android support for the data-consent field against the inherited minimum.
The manifest omits gecko_android and targets Desktop only. The wrapper allows
exactly this warning; all other warnings and all errors fail.

The runtime ZIP must match every prepared runtime file. The matching source ZIP
contains all original build inputs, a frozen lockfile, SOURCE_BUILD.md and expected
runtime hashes. Source verification extracts it into a new local directory,
installs offline from the locked local store, rebuilds and compares every byte.
ZIP timestamps and later Mozilla signature files are outside that comparison.

## Remaining acceptance

- Firefox Desktop 140 acceptance; the fixture browser is newer.
- Real-extension background/storage lifecycle and optional history prompts.
- Current authenticated GitHub DOM, navigation, Write/Preview and submission.
- Mozilla signing, reviewer approval and public distribution.
- Remote CI, which is separate from local checks.

Use INSTALLATION.md for the live checklist and PUBLICATION.md for AMO steps.
