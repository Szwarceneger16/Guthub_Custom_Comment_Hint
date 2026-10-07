# GitHub Custom Comment Hint

## Summary

Add reusable text buttons above GitHub's PR and issue comment editor. Share layouts across repositories, append or replace text, and undo the last insertion. All settings stay local.

## Description

Keep the comment text you use often one click away. GitHub Custom Comment Hint
adds your configurable buttons above Write/Preview in the main new-comment
editor on github.com pull requests and issues.

- Create named layouts and reuse them across multiple repositories.
- Combine layouts in your preferred order in a three-column grid.
- Replace the draft with exact text or append text at the end.
- Undo the last insertion, including the previous cursor selection.
- Use emoji, Unicode and multiline values with light and dark themes.
- Edit layouts, repository assignments or JSON in one shared settings draft.
- Import and export UTF-8 JSON configuration.
- Choose repositories from local suggestions or enter them manually. Optionally
  import GitHub repositories from retained Firefox history.
- Use the interface in English or Polish and activate buttons with the keyboard.

## Getting started

Click the extension's toolbar icon to open settings. In Assignments, add your
GitHub owner and repository, assign one or more layouts, and click Save. Visit
a pull request or issue where your GitHub account can comment. Hint buttons
appear above Write/Preview in the main Add a comment editor.

The included `ci` and `codex` layouts are editable examples. `/ci-now` and
`@codex review` are plain insertion strings; their effect after you submit
depends on the integrations in your repository. The add-on does not provide a
CI service or a Codex account. No repository is assigned on a fresh installation.

Buttons insert text only. You publish it with GitHub's existing Comment button.
Editing or submitting a comment clears Undo. Existing-comment edit forms and
inline code-review editors are excluded.

## Permissions and privacy

Settings and remembered owner/repository names stay in Firefox's local extension
storage. The extension makes no network requests and has no telemetry, tokens,
remote code or server. GitHub site access is needed to add buttons and remember
visited repositories. The optional history permission is requested only when
you click Import GitHub history. Denying it does not prevent manual setup.
Private-window visits are not added to repository suggestions.

Firefox Desktop 140 or later is required. This version supports github.com;
GitHub Enterprise hosts and Firefox for Android are outside its scope.

GitHub Custom Comment Hint is an independent extension and is not affiliated
with or endorsed by GitHub, Mozilla or OpenAI.

## Release notes — 1.0.0

First prepared public release: reusable layouts, ordered repository assignments,
append/replace insertion, single-step Undo, English/Polish settings, JSON
import/export, local repository suggestions and optional GitHub history import.
