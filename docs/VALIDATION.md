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

The current run passed 31 logic/privacy tests, 56 Firefox fixture tests and six
intercepted signing checks. Source reproduction matched all 15 runtime files,
and lint returned zero errors/notices with the
known Desktop-only warning. Audit scope is summarized in REPOSITORY_PRIVACY.md.
Detailed generated evidence remains in ignored `artifacts/`: release-report.json,
lint-report.json, privacy-audit.json and versioned SHA256SUMS.

The logic suite covers shared layouts, ordering, rename/delete, invalid schema,
Unicode/UTF-8, URL boundaries, storage preservation, common drafts, text insertion,
Undo and privacy-rule behavior. Firefox fixtures cover main PR/issue editors,
exclusions, ambiguity, SPA navigation, form replacement, live settings changes,
text/selection preservation, Write/Preview, themes, geometry, keyboard use and
settings import/export/failure paths.

Regression tests first reproduced the review findings on the previous PR head.
They now cover synthetic insertion/Undo refusal, enterprise-account exclusion
from visits/history/catalog suggestions, concurrent saves (including removed or
invalid storage, late notifications, stale reads and verification failures), and
retained generic editors across conversation changes. Real mouse/keyboard
activation and conversation-specific action recovery remain covered.

Further regressions cover account Stars URLs (including lists and case variants)
through URL discovery, background messages, history imports and existing catalogs;
a real repository named `stars` remains discoverable. PNGs now receive all general
privacy patterns in addition to metadata checks. Tests cover trailers, metadata
and other chunk content, truncated/oversized chunks, and an isolated audit run
against a worktree file, an unreachable Git blob and a ZIP entry. Audit reports
and console output contain finding types rather than the synthetic matched value.
Related checks also exposed and fixed quoted JSON credential keys being missed
by the literal-secret rule; quoted and unquoted keys and values are covered,
including environment/YAML syntax and the existing placeholder exclusions.

Marketing prefixes `solutions` and `resources` are excluded by the same shared
filter as other global routes. Regressions cover visits, background messages,
history imports and existing catalogs while preserving ordinary repositories
with those names. Content-script startup tests settle a deferred initial read
with success or failure after valid, invalid or removal events; the newer event
always wins and preserves an active toolbar's draft and Undo state. A failure
without a newer event remains inactive and recovers after a later valid event.

Firefox tests cover CRLF, lone CR and mixed line endings in replace/append,
empty/nonempty Unicode drafts, end-of-text cursor placement, selection restoration,
consecutive insertions and silent page edits. Windows-authored JSON survives BOM
import, view changes, unrelated form edits, Save and export with its original
strings. Only the textarea's native LF representation is used for Undo comparison.

The main-comment fixture models GitHub's required textarea, disabled submit
control and validity listener installed on focus. Its behavior follows the
[public GitHub validation bundle](https://github.githubassets.com/assets/0pd-c46d8dfae89c2b64.js):
input updates depend on a validity transition, while bubbling change refreshes
the form. Regression tests reproduced the disabled Comment button before the fix
on both PRs and issues, as well as stale submit state after Undo. They now check
replace/append, keyboard activation, insertion from Preview, empty replacement,
Undo and preservation of other invalid fields. Focus precedes mutation; input
and change are dispatched while extension writes are excluded from manual-edit
Undo invalidation. The extension never changes the submit button itself.

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
