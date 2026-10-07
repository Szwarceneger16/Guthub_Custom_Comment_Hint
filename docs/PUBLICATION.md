# AMO publication preparation — 1.0.0

This document describes the local submission candidate. AMO signing, review
and public availability must be verified after submission.

## Release identity and materials

- Name: **GitHub Custom Comment Hint**.
- Version: **1.0.0**, synchronized between package and manifest.
- Stable add-on ID: `github-custom-comment-hint@szwarceneger16`.
- Platform: Firefox **Desktop 140+** only, Manifest V3.
- License: **MIT**, consistent in LICENSE, package and AMO metadata.
- Distribution prepared for AMO **listed**; `unlisted` remains an alternative.
- Category: **Web Development**; listing languages: **en-US / pl**.
- Default configuration: example `ci` and `codex` layouts, no repository
  assignments. Saved configuration is never replaced during an update.

| Material | Location | Use |
| --- | --- | --- |
| Unsigned runtime ZIP | `artifacts/github_custom_comment_hint-1.0.0.zip` | Upload as the add-on file. |
| Matching source ZIP | `artifacts/github_custom_comment_hint-1.0.0-source.zip` | Upload separately as source code for review. |
| Listing materials ZIP | `artifacts/github_custom_comment_hint-1.0.0-amo-listing.zip` | Local handoff of descriptions, policy, notes and artwork; do not upload as the add-on. |
| Hashes | `artifacts/SHA256SUMS-1.0.0.txt` | Check all three prepared archives. |
| Reproduction report | `artifacts/release-report.json` | Runtime/source hashes and extracted-source build proof. |
| API metadata | `amo/metadata/listed.json` | Name, summary, description, category, license, release/reviewer notes. |
| Reviewer notes | `amo/REVIEWER_NOTES.md` | Build, permissions and functional review instructions. |
| Descriptions | `amo/listing.en-US.md`, `amo/listing.pl.md` | Text ready for the AMO listing. |
| Privacy policy | `amo/privacy.en-US.md`, `amo/privacy.pl.md`, `amo/metadata/eula-policy.json` | Add both translations in listing details. |
| Store icon | `amo/assets/icon-128.png` | Upload the 128×128 original icon. |
| Screenshots and captions | `amo/assets/` | Actual bundled UI on synthetic local fixtures; upload selected PNGs and their PL/EN captions. |

No support URL or email is assigned in listing metadata. Add a public support
contact in AMO if desired. Source packaging uses an explicit build-input allowlist
and excludes local caches, credentials and unrelated documents. Fresh-install
configuration contains no owner/repository assignments.

## Reproduce and check the candidate

Use the project's exact mise and PNPM pins. Initial setup is documented in README.

```sh
mise exec -- pnpm install --frozen-lockfile --store-dir .pnpm-store --state-dir .cache/pnpm
mise exec -- pnpm test
mise exec -- pnpm test:browser
mise exec -- pnpm release:prepare
mise exec -- pnpm release:verify
mise exec -- pnpm check:integrity
```

`release:prepare` runs lint, builds the unsigned runtime ZIP, packages an explicit
source allowlist and the listing materials, checks ZIP contents against runtime
bytes, and writes hashes. `release:verify` extracts the source ZIP to a fresh
project-local cache directory, installs from the frozen lockfile using the local
PNPM store, rebuilds and compares every runtime file with the submitted package.
Reviewers can use a normal online frozen install as described in SOURCE_BUILD.md.
Source reproduction requires no browser or private repository access.

To regenerate PNGs and demonstration screenshots, first install the dedicated
fixture Firefox with `pnpm browser:install`, then run `pnpm assets:amo`. The
script renders the existing SVG, blocks page network requests, mocks extension
APIs and uses no existing profile. PNG icons are checked in, so ordinary builds
and reviewer reproduction do not need Playwright Firefox. After changing inputs
or assets, repeat release preparation and reproduction; signing refuses a stale
or unverified candidate.

Local lint retains one known web-ext 10 Android data-consent/minimum-version
warning. Desktop-only compatibility is explicit. All other warnings and errors
fail. See VALIDATION.md for local evidence and separate live acceptance limits.

## Submit using the developer website

After explicit publication approval, sign in to your AMO developer account and
choose **Submit a New Add-on → On this site** in the Developer Hub.

1. Upload the unsigned runtime ZIP, then the matching source ZIP when asked.
2. Review the validation results and keep compatibility Desktop-only.
3. Use the prepared name, summary, description, MIT license and Web Development
   category. Add the English and Polish translations.
4. Paste REVIEWER_NOTES.md into Notes for Reviewers and the corresponding release
   notes from the listing files into version notes.
5. Add both privacy-policy translations, the 128×128 icon, and screenshots with
   the matching captions. The fixtures are visibly labeled local demonstrations.
6. Inspect the completed listing and submit it. Record AMO's add-on URL, submission
   status, resulting signed XPI and its hash only after those actually exist.

Signing/review may complete asynchronously. A successful upload or local lint
does not establish public availability. Test the signed add-on in a dedicated
Firefox profile and follow INSTALLATION.md before claiming release acceptance.

## Submit using web-ext

These commands **contact Mozilla and submit the add-on** and require
separate publication authorization:

```sh
mise exec -- pnpm sign:listed
# Alternative distribution channel; choose one channel for a submission:
mise exec -- pnpm sign:unlisted
```

Provide `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` in the local environment using
AMO's API credentials page. Never put their values in source control, command
arguments, screenshots, reports, or chat. Configuration discovery is disabled;
the command does not read a global web-ext config. Both channels attach the
matching source ZIP. `listed` also sends `amo/metadata/listed.json`.

web-ext signs/uploads the add-on and source and sends listing/version metadata.
It does not upload our gallery images or set the separate privacy-policy field.
Complete those fields in the Developer Hub using the prepared files. Do not run
both aliases blindly for the same version: version identity is shared between
channels. Preserve the add-on ID for future updates and increase versions.

## Primary publication requirements

Primary requirements checked during preparation:

- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/).
- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).
- [web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/).
- [AMO API metadata](https://mozilla.github.io/addons-server/topics/api/addons.html).
- [Firefox built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).
- [MIT license](https://opensource.org/license/mit).

Keep Git publication, AMO submission, signing and real-extension acceptance as
separate gates. See REPOSITORY_PRIVACY.md before making a source repository public.
