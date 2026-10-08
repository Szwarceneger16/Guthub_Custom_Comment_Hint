# Temporary installation and live acceptance

## AMO candidate 1.0.0

The new local submission package is `artifacts/github_custom_comment_hint-1.0.0.zip`.
It is unsigned and must not be described as an AMO-installed release. Use the
temporary-install procedure below for development; normal Firefox installation
requires Mozilla signing. The matching `-source.zip` is for reviewers, and the
`-amo-listing.zip` contains listing materials, not an installable extension.
See PUBLICATION.md for all submission steps and separate publication approval.

Fresh installations have no repository assignments. Open settings with the
toolbar icon, add your owner/repository, assign layouts, then Save. A reload/update
of the existing add-on preserves its stored configuration because its ID is stable.

The target is Firefox Desktop 140+. The local ZIP is unsigned. Temporary loading
is appropriate for development; signing and distribution through Mozilla are
separate work and have not been performed.

## Load locally

1. Build with `mise exec -- pnpm build` after the setup described in README.
2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select `dist/extension/manifest.json`,
   or choose the generated ZIP in `artifacts/`.
4. Allow access to GitHub if Firefox requests it. Click the extension icon to open
   the settings tab. Confirm the Layouts, Assignments and JSON views.

Temporary installation lasts until Firefox restarts. Export your configuration
before removing/reinstalling the temporary add-on; removal can clear extension
storage. Extension updates with the same ID preserve configuration, but a fresh
temporary install after removal is a different lifecycle.

For an isolated development session, `mise exec -- pnpm exec web-ext run
--source-dir dist/extension --no-config-discovery` creates a new temporary profile.
Do not pass an existing profile or use `--keep-profile-changes`. Log in manually
in the dedicated profile if conducting live acceptance there.

## Authenticated GitHub checklist

Use a PR and an Issue for which your configuration has assignments. Local fixtures
do not establish these live results. Use a dedicated Firefox profile, or explicitly
authorize an agent before it operates an existing browser/session.

1. Confirm exactly one grid above Write/Preview at the main new-comment editor.
   Existing-comment edit forms and code-review threads must have no toolbar.
2. Test `/ci-now` replacement and multiline append in an empty and populated
   comment. Verify one separator newline and no automatic submission.
3. Select part of the old text, insert, and Undo. Check restored selection, manual
   edit invalidation, and invalidation after using GitHub's submission action.
   A real submission should only be done when you intend to publish that comment.
4. Switch Write → Preview → Write and confirm the text remains intact. Fixture
   success alone does not establish compatibility with GitHub's live editor state.
5. Navigate between assigned repositories and between PRs/Issues without reloading.
   Check the selected buttons and lack of stale Undo/duplicate toolbars.
6. Save a shared layout change in settings while GitHub remains open. Confirm all
   assigned pages update without reloading or changing drafted comments.
7. Check light/dark theme, three columns in a narrow window, long two-line labels,
   emoji and Polish characters, Tab/Enter, focus outline and full-label tooltip.
8. Record Firefox version, date, page type, observed outcome and any selectors that
   differ from the supported fixtures. Do not include comment content, credentials
   or profile files in a bug report.

## Editor compatibility

The adapter supports a single textarea in the main `new_comment` /
`js-new-comment-form`, a recognized previewable editor wrapper, and a same-repository
`issue_comments`, numbered issue comments, or the current conversation's
`pull/number/comment` / `issues/number/comment` form action. Query parameters are
ignored for this check; the host, repository, conversation kind and number remain
constrained. It excludes edit/review
forms and fails closed for ambiguous or unknown structures. This is a deliberate
compatibility boundary: if GitHub changes the editor structure, no toolbar is safer
than modifying an unrelated field. Report a structure mismatch for a fixture update.

Android, GitHub Enterprise, rich-text/contenteditable editors, inline review comments,
existing-comment editors and automatic comment publication are outside v1.

History permission prompts, catalog persistence after closing tabs, and authenticated
GitHub behavior remain actual-extension acceptance cases. Local fixtures use mocked
APIs and do not read the user's history or operate their authenticated browser.
