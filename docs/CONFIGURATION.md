# Configuration

The extension stores one JSON document under `config` in `browser.storage.local`.
Configuration is local to the Firefox profile. It is not synchronized or sent
to GitHub. The release defaults in `src/lib/default-config.json` are installed only when
the key is absent; updates do not overwrite existing data, including invalid data.

## Public-release defaults

As of the 1.0.0 submission candidate, fresh installations use
`src/lib/default-config.json`: the editable example `ci` and `codex` layouts
with an empty `repositories` object. Add an owner/repository, assign layouts and
Save before expecting buttons. Updates do not replace any saved configuration.
`docs/config.example.json` illustrates shared layouts using fictional repository
names. It is documentation and a test fixture, not a fresh-install assignment.

## Version 1

`version` must be the number `1`. `layouts` maps a nonempty layout ID to an
ordered array of buttons. Each button has string fields `label` and `value`,
and a `mode` of `append` or `replace`. Layout IDs are case-sensitive and reusable.
Labels and values support emoji, Polish characters, empty strings and multiple
lines. They are rendered as text, never HTML.

`repositories` maps an owner to repository names, each containing an ordered
array of layout IDs. Owner and repository names match exact URL segments without
regard to letter case. Whitespace, slashes, backslashes, query/fragment markers,
percent escapes and empty names are rejected. Names differing only by case in
the same owner/repository map are rejected. An assigned layout must exist and
must not occur twice in the same repository. Empty assignments and empty layouts
are valid and produce no buttons.

The combined grid follows assignment order, then button order inside each layout.
For example, `["ci", "codex"]` places CI buttons before Codex buttons. Editing
one layout updates every assigned repository when the configuration is saved.
Renaming updates all references. Deleting an assigned layout asks for confirmation
and removes its references, leaving any remaining assignments in order.

## Settings and files

Layouts, Assignments and JSON share one in-memory draft. A common **Save** validates
and writes the complete document. Switching views preserves the draft. Invalid
JSON or invalid schema blocks returning to forms. **Discard JSON edits** returns
to the last valid draft; **Discard changes** loads the latest saved configuration.

Import validates a file before replacing the draft. It accepts UTF-8 with or
without a BOM and rejects malformed UTF-8. Import does not save automatically.
Export writes the current valid draft as UTF-8 without a BOM, even before Save.
Invalid imports, failed writes and external storage changes preserve an unsaved
draft. Closing the settings tab with unsaved changes requests browser confirmation;
the draft is not persisted across closing/reopening the tab.

Save verifies the configuration in storage after writing. If another settings tab
wins a concurrent save, the local draft remains available with an unsaved-change
warning. Save again to replace storage, or Discard changes to load its latest value.
A failed verification reports that uncertainty rather than a confirmed save.
Discard also reconciles storage notifications received during its read, including
invalid or removed values, so an older snapshot cannot become the clean state.
Edits made while a discard read is pending supersede that read; a failed read
preserves the draft for retry.

Unknown configuration versions remain available in JSON for correction or export
through Firefox tools; this version does not automatically migrate them. Unknown
extra JSON fields are retained and have no operational effect. Use JSON to change
an existing owner/repository name, or remove and recreate its assignment in forms.

## Comment behavior

`replace` replaces the editor text. `append` adds text at the end, inserting one
newline when the existing text is nonempty and does not already end in a newline.
The configured value is not trimmed. Firefox's textarea API represents line endings
as LF; configuration import/export preserves the original string values.

Undo compares against the textarea's actual LF-normalized value, so CRLF and
lone-CR configuration strings remain undoable without rewriting the configuration.
Undo restores the text and selection before the most recent insertion. It is a
single step, cleared by manual editing, submission, reset, navigation, or editor
replacement. Rebuilding a toolbar after button changes also clears its Undo state.
Only ordered button labels, values and modes affect this rebuild. Reordering JSON
object properties or changing unknown fields preserves the toolbar and Undo.
All extension buttons have `type="button"`; publication uses GitHub's own button.
Insertion and Undo require a trusted browser click, including native keyboard
activation. Synthetic clicks dispatched by a page do not modify the editor.
Insertion and Undo notify GitHub to refresh form validity. Comment becomes
available when the form is valid; restoring empty text makes it unavailable again.
After conversation navigation, a retained editor with a generic form action
stays inactive until it is replaced or has an action naming the current conversation.

## Repository suggestions (0.1.1)

The original assignment list came exclusively from `repositories` in the JSON,
not Firefox history or open tabs. In 0.1.1, Assignments adds suggestions combining
that configuration with a separate local repository catalog. It records repository
URLs encountered by the content script, including root, tree/blob, actions and other
repository pages, even when they have no button assignment. Owner/repository pairs
are deduplicated without regard to case; different owners remain distinct.

**Import GitHub history** requests Firefox's optional `history` permission and
searches all retained HTTPS GitHub history with explicit all-time and result-limit
parameters. It is not restricted to recent visits, the default 100 results, or open
tabs. Deleted history and private browsing are unavailable. GitHub profiles and
global routes such as settings, organizations, enterprises, stars, solutions,
resources, ReadME, Education and topics do not become repository suggestions.
URL extraction identifies candidates; it does not verify whether a
repository still exists or whether you still have access.

Start typing `owner/repository` in **Visited or configured repository**, choose a
suggestion, then click **Use repository**. It fills the manual Owner/Repository
fields. **Add repository** creates an empty assignment in the common draft; assign
one or more layouts and **Save** to activate its buttons. You may still enter any
repository manually. Importing or clearing suggestions does not save or discard
configuration edits. Clearing the catalog leaves configured assignments visible.
See PRIVACY.md for exact stored fields and permission behavior.
