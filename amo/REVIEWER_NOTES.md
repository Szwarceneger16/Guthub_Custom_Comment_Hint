# AMO reviewer notes

GitHub Custom Comment Hint 1.0.0 targets Firefox Desktop 140+ only. It adds
configurable text-insertion buttons above Write/Preview in the main new-comment
form on github.com pull requests and issues. It never submits a comment, invokes
GitHub APIs, or accesses authentication tokens. Existing-comment edit forms and
inline code-review editors are excluded. Ambiguous main editors are left alone.

Required permissions:

- `storage`: save one configuration and a local owner/repository suggestion catalog.
- `https://github.com/*`: identify the main new-comment editor, insert text on a
  user's click, and remember owner/repository names from nonprivate GitHub visits.

Optional permission:

- `history`: requested only by **Import GitHub history** in Assignments. Each click
  searches retained history for HTTPS github.com entries and filters the exact
  origin and repository routes. The browser grants history access globally, but
  the extension only keeps GitHub owner/repository pairs. No ongoing history
  listener, full URLs, page titles, timestamps, or comment bodies are stored.
  Denying the permission leaves manual configuration available. Private-window
  visits are not added to the suggestion catalog.

Configuration, catalog and imported history remain local. JSON export contains
configuration only. The previous comment text/selection used by Undo exists only
in memory. There are no network requests, analytics, telemetry, remote scripts,
runtime third-party libraries, credentials, or automatic comment publication.
The manifest therefore declares `data_collection_permissions.required: ["none"]`.

## Source and reproduction

The matching source ZIP includes original modules, all build inputs, pinned
dependencies and `SOURCE_BUILD.md`. Use Node 24.21.0 and PNPM 12.9.1, install
with the frozen lockfile, and run `pnpm prepare:extension`. The resulting files
in `dist/extension/` must match `runtime-sha256.json` in the source ZIP. Bundling
uses esbuild 0.28.2 with readable output; there is no minification, obfuscation,
downloaded runtime code or generated source dependency. Icons are supplied as
source SVG and ready-to-use PNGs; rebuilding does not need a browser.

The source ZIP omits development caches, profiles, credentials and unrelated
documents. These are not build inputs. The public package starts
with example layouts and no owner/repository assignments. Existing configuration
is preserved during updates, including invalid or unsupported stored versions.

## Functional review

1. Install the add-on and click its toolbar icon to open settings in a new tab.
2. Open **Assignments**, manually enter an owner/repository accessible to your
   GitHub account, add it, assign `codex` and/or `ci`, and click **Save**.
3. In a logged-in PR/issue conversation, find **Add a comment**. The grid appears
   above Write/Preview. Click a hint to insert text and **Undo** to restore it.
   You can test insertion without submitting a comment.
4. Edit a layout or assignment and save. The open conversation should update the
   buttons without changing comment text or reloading GitHub.
5. Optionally test importing history, denying its permission, clearing remembered
   repositories, JSON import/export, and switching between the three settings views.

PR/issue commenting requires a GitHub login; no developer account credentials are
supplied. Screenshots use synthetic local fixtures and the actual bundled UI;
they are not evidence of an authenticated browser session.

Local Firefox fixture tests are separate from minimum-version and Mozilla
signing acceptance. web-ext 10.0.0 reports one
known Android minimum-version warning for the data-consent field. This add-on
does not declare `gecko_android` and must remain Desktop-only. The full warning
is retained; all other warnings and errors fail local lint.
