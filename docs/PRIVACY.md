# Privacy

GitHub Custom Comment Hint has no telemetry, analytics, external requests,
credentials, GitHub token, background server, or remote code. Its configuration
is stored with `browser.storage.local` in the local Firefox profile. Import/export
occurs only when the user selects a file or requests a download.

On `https://github.com/*`, the content script reads the URL to select an assignment,
examines the page DOM to identify the main new-comment form, and writes configured
text into its textarea when a button is clicked. The previous text and selection
are kept in memory for one-step Undo; they are not stored in configuration or logged.
The user sends the comment using GitHub's existing Comment button. That submission
is handled by GitHub and governed by GitHub's policies.

The required API permission is `storage`. Site access is limited to GitHub over
HTTPS, with no subdomain, Enterprise host, or other host permission. The extension
also declares optional `history` access. Firefox asks for it only when the user
clicks **Import GitHub history** in Assignments. Firefox's history permission is
browser-wide; the extension searches for `https://github.com/` across all retained
history, checks the exact origin, and discards nonrepository/global routes. It does
not enumerate open tabs, read cookies, or alter Firefox history. The import reads
history once per button click. The optional grant remains until revoked in Firefox's
extension permissions; there is no ongoing history listener.

The content script remembers repositories visited on GitHub, including repository
home, file, tree, actions, PR and issue pages. This works without history permission
and does not depend on whether tabs stay open. Private-window visits are excluded.
Repository suggestions are stored as independent `repositoryCatalog:owner/repo`
keys with only `{ owner, repo }` values. Full page URLs, titles, visit times and
comments are not persisted in this catalog. Import and clearing suggestions do
not alter the configuration draft or saved assignments. **Clear remembered
repositories** removes this catalog; configured assignments remain and later
visits/imports can add suggestions again. JSON export includes only configuration.

Firefox data collection permissions declare `required: ["none"]`: all of the
above stays local and is not transmitted to a server. Removing the extension
removes its local storage through Firefox; exported JSON files remain wherever
the user saved them.

Development fixtures intercept browser requests and use synthetic comments and
configuration. They do not access authenticated sessions or copy profile data.
