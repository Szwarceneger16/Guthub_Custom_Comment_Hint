# Repository privacy and publication checks

## Scope

Publishable source contains extension code, fictional tests, user documentation,
license and AMO materials. Conversation archives, personal handoff/memory records,
local-machine evidence, unrelated repository references and old generated copies
are outside that scope and have been removed from the working tree.

Test data uses fictional owner/repository pairs. Public project identity is
intentional: the publisher's GitHub handle, this project's URL, copyright notice
and stable extension ID remain. Git authors use the publisher's GitHub noreply
address. Those fields are not credentials or private infrastructure data.

The audit checks nonignored project files. With --history it scans every local
Git object, including unreachable objects. With --packages it opens all prepared
release ZIPs and checks each entry. It looks for credential patterns, personal
machine paths, private-repository markers, contact emails, conversation IDs,
retired material paths and PNG metadata. Results include counts and finding types;
matched values are never printed or saved. General byte-pattern checks apply to
PNGs too, including chunk content and trailing bytes after IEND; metadata detection
does not skip those checks. Literal-secret checks accept quoted and unquoted
keys and values in JSON, environment and YAML-style assignments, while preserving
placeholder exclusions. PNG pixel content is reviewed visually.
Private-key checks include encrypted PKCS #8 PEM. Isolated audit regressions cover
worktree files, unreachable Git blobs and ZIP entries; public-key and certificate
headers remain allowed.
General rules also scan original and separator-normalized path names in worktree
files, full nested Git trees and ZIP entries. Sensitive paths are replaced with
opaque SHA-256-derived identifiers in findings and console output. Archive locations
are checked too; an archive with a sensitive name is rejected before opening it.

```sh
mise exec -- pnpm audit:privacy --history --packages
```

This is a scoped automated check plus source and image review; it cannot determine
that an arbitrary natural-language sentence is private. Keep fixtures fictional
and inspect changes before committing or publishing. Credentials must never be
stored here, including ignored reports or archives.

## Git history and the remote

The local cleanup replaces the old development history with a signed root snapshot
of the reviewed source. Old local refs, reflogs and unreachable objects must be
removed and the all-object audit repeated. Do not merge or fetch the old history
back into the clean branch.

A local rewrite does not clean GitHub. Keep the remote private until replacement
history is published with explicitly approved force-with-lease protection and
remote refs/commit contents are verified. Do not use a broad mirror push. Any
other clone must be replaced or cleaned before pushing again.

Even after force-push, GitHub may retain old commits by SHA in cached views.
For full server-side removal, follow [GitHub's sensitive-data removal process](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
GitHub Support may need to remove cached references and run server garbage
collection. If that cannot be confirmed, a new empty repository containing only
the reviewed root snapshot avoids publishing the old repository's object store.
Deleting/recreating a repository or changing visibility requires separate approval.

## Current verification

The current review candidate passed these local checks:

| Check | Result |
| --- | --- |
| Logic and privacy-rule tests | 38 passed. |
| Firefox synthetic fixture tests | 89 passed. |
| Intercepted signing checks | 6 passed; no AMO request. |
| web-ext lint | 0 errors, 0 notices, 1 retained Desktop-only warning. |
| Extracted-source rebuild | All 15 runtime files match byte for byte. |
| Current nonignored files | 76 checked, 0 audit findings. |
| Prepared release ZIPs | All three archives checked, 0 audit findings. |
| Runtime/configuration/locale integrity | Passed. |

The final all-object result is recorded in ignored artifacts/privacy-audit.json
after local history cleanup. Release archives and detailed reports are local
generated outputs. They contain no conversation copies, profiles or private
configuration. Remote history is a separate gate and has not been replaced by
these local checks.
