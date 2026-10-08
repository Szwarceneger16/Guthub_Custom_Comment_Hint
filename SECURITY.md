# Security policy and review context

This policy applies to GitHub Custom Comment Hint and provides persistent review
context for Codex Security. The invariants below are requirements to verify, not
a claim that a security scan has passed. Build commands and execution boundaries
are documented in [AGENTS.md](AGENTS.md) and [README.md](README.md).

## Supported scope

Security fixes target `main` and the current 1.0.x line. Version 1.0.0 is a
submission candidate; this policy does not establish an AMO release. Earlier
0.1.x development snapshots are not maintained. Reports should identify the
affected commit/version and whether the issue also affects current code.

The product is a Firefox Desktop 140+ Manifest V3 extension for the exact
`https://github.com` origin. It inserts configurable text into the main new
comment editor on pull requests and issues. Users publish through GitHub.
GitHub Enterprise, Android and other browsers are outside the supported product
scope; escaping the declared host or frame scope is still a security concern.

## Reporting a vulnerability

Use **Security -> Report a vulnerability** in this repository when that private
reporting feature is available. If it is unavailable, open an issue requesting a
private reporting channel without publishing the exploit or sensitive details.
No security email or guaranteed response time is currently advertised.

Include the affected revision, Firefox version, attacker capabilities, minimal
reproduction, expected/actual behavior, impact and a suggested mitigation.
Use fictional repositories and synthetic configuration. Redact private owner or
repository names, comment bodies, credentials and personal paths. Do not attach
a real browser profile, history export or full personal configuration.

Coordinate public disclosure after maintainers have assessed the report. Scan
findings may reveal an exploit; review visibility before publishing them in
issues, pull requests, logs or release materials.

## Threat model

### Assets and actors

- Saved layouts and repository assignments can contain sensitive text or private
  project names. The repository catalog also contains private project metadata.
- Comment drafts and Undo text must remain scoped to the current editor/session.
- The user's GitHub session belongs to GitHub. The extension has no token,
  authentication service, server, cookie permission or native messaging host.
- Release integrity and developer signing credentials are separate build-time
  assets. The runtime must not gain access to those credentials.
- Relevant attackers can supply a shared configuration file, influence GitHub
  page content/URLs, or alter a dependency or release input. State exactly which
  capability a proposed attack requires. Do not silently assume extension-level
  execution or arbitrary access to the victim's operating system.

### Entry points and trust boundaries

| Entry point | Boundary to review |
| --- | --- |
| JSON/file import and stored configuration | Untrusted data enters privileged settings, validation, mapping and rendering. User selection of a file does not make its contents safe to execute. |
| GitHub URL, DOM, forms and page events | Page-controlled data enters an isolated content script and selects a comment editor. GitHub authentication does not make all DOM nodes trustworthy. |
| Runtime repository-discovery messages | Content-script data crosses into the background's storage privileges. Inspect browser-provided sender metadata as well as the payload. |
| Optional Firefox history results | Browser-wide permission exposes history; only intended GitHub repository metadata may be retained. |
| Dependencies, build inputs and ZIPs | Development tools produce a distributable extension and reviewer sources; extraction and signing run with developer privileges. |

Local storage is not encryption. Access by the profile/OS owner is an accepted
platform assumption. Shadow DOM is a presentation boundary, not an access-control
boundary. Labels intentionally appear on the assigned GitHub page; a value
inserted into its textarea becomes readable by that page. This does not permit
exposing other stored values, private history or Undo text outside their purpose.

## Security invariants

1. **Data stays data.** Labels, values, names and validation errors must use text
   or form-value APIs. Configuration must not become HTML, executable JavaScript,
   CSS, commands, remote imports or dynamically chosen script URLs. Preserve the
   WebExtension CSP and isolated-world boundary.
2. **Configuration is validated at use boundaries.** Reject unsupported versions,
   invalid types/modes, dangling references and owner/repository collisions.
   Unknown extra JSON fields are intentionally preserved as inert data. Object
   keys must not mutate prototypes or bypass own-property checks. Invalid imports
   and storage must not silently replace saved data or a valid unsaved draft.
3. **Insertion preserves user control.** Review whether page-triggered/synthetic
   events can cause unintended disclosure or writes. Extension buttons must not
   submit forms, invoke GitHub comment APIs or trigger GitHub's publish control.
   A configured command such as `@codex review` may act through an integration
   only after the user publishes it on GitHub.
4. **Editor selection fails closed.** Require one unambiguous main new-comment
   editor for the current owner, repository and conversation, with an allowed
   same-origin form action. Existing-comment edits and inline reviews are excluded.
   Recheck the target at click time; navigation, editor replacement and stale
   listeners must not write to another conversation or restore stale Undo data.
5. **Privileges stay narrow.** Required permission is `storage`, with HTTPS GitHub
   host access and top-frame content scripts only. `history` is optional and
   requested by an explicit settings action. No cookies, unrelated hosts, telemetry,
   remote code or credentials belong in the runtime.
6. **Discovery cannot expand access.** Validate message type, sender origin,
   top-frame/tab identity, private-window status and repository URL. Examine
   source/payload consistency and malformed messages. A discovery message must
   not become a route to history queries, configuration writes or data retrieval.
7. **Privacy matches actual data flow.** Private-window visits are excluded from
   discovery. The catalog retains only `{ owner, repo }`, not full URLs, queries,
   fragments, page titles, timestamps or comment text. JSON export includes
   configuration, not the catalog. Draft/Undo text is not persisted or logged.
   Clearing suggestions must not alter saved assignments.
8. **Release artifacts match reviewed source.** Preserve the frozen PNPM lockfile,
   permitted install scripts, explicit source allowlist, package hashes and
   runtime/source byte comparison. Reject unsafe archive paths or nonregular
   inputs. Signing must reject stale inputs; credentials must stay out of command
   arguments, source, archives and logs. Only authorized submission contacts AMO.

## Priority review paths

| Priority area | Starting points and cases |
| --- | --- |
| Configuration and rendering | `src/lib/config.js`, `src/lib/storage.js`, `src/options/draft.js`, `src/options/options.js`, `src/ui/grid.js`: malicious labels/values, prototype-sensitive keys, Unicode/case collisions, malformed UTF-8/BOM, extra fields and save/import races. |
| Editor and navigation integrity | `src/github/editor.js`, `src/lib/text.js`, `src/content.js`: duplicate/spoofed forms, foreign actions, disabled/read-only fields, synthetic clicks, SPA transitions, Write/Preview, replaced forms and Undo lifetime. |
| Messaging and repository privacy | `src/lib/repositories.js`, `src/background.js`, `src/manifest.json`: malformed senders, spoofed origins, credentials in URLs, encoded/path-confusing segments, global GitHub routes, private windows, denied/revoked history access and retained fields. |
| Availability and data integrity | Import, catalog accumulation, history import and mutation scheduling: large inputs, repeated events, storage failures and concurrent tabs. Distinguish persistent attacker-triggered loss from ordinary local resource exhaustion. |
| Build and publication | `scripts/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `amo/`: dependency reachability, lifecycle scripts, archive traversal/symlinks, accidental private data, source/runtime mismatch and signing credential exposure. |

These are review priorities, not an existing findings list. Check both sources
and the resulting manifest/bundle when a suspected issue depends on packaging.
Dependency advisories need version, runtime/build reachability and a realistic
impact analysis; development-only status is not an automatic dismissal.

## Reportable findings and severity

A vulnerability report needs an attacker-controlled source, a reachable path,
the broken control, affected asset and realistic impact. Show file/line evidence
and a minimal safe reproduction, or explicitly state the unverified assumptions.
Mocks that grant an attacker privileged browser APIs do not by themselves prove
an attack is reachable from an ordinary GitHub page.

| Severity context | Examples requiring evidence |
| --- | --- |
| Critical | A demonstrated path to broad developer/host compromise or signing-credential theft through supported build/release behavior. Do not infer OS execution from textarea insertion. |
| High | Extension-privileged code execution, sensitive data disclosure to an unauthorized origin/actor, or unauthorized GitHub publication/actions. |
| Medium | A demonstrated boundary bypass with limited impact, cross-conversation corruption, private-metadata disclosure or persistent attacker-triggered denial of service. |
| Low / hardening | Smaller verified security impact or a defense improvement. Separate confirmed vulnerabilities from recommendations without an exploit path. |

Calibrate severity to required access, user interaction, affected data, persistence
and recovery. Do not downgrade an otherwise valid report simply because it needs
a user to import a shared file. Do not claim credential compromise when only
fictional command text or intentionally displayed labels are involved.

Ordinary append/replace behavior, knowingly publishing an inserted integration
command, profile-owner access to local storage, GitHub's own authentication or
Markdown implementation, cosmetic defects and missing defense-in-depth controls
alone are not extension vulnerabilities. A proven extension contribution to an
attack remains reportable. Browser/OS compromise is outside this repository's
remediation boundary. This project has no bounty program.

## Validation and Codex Security use

Use synthetic local fixtures and a dedicated test profile. Follow the PNPM/mise
commands in README and the scope limits in AGENTS. Unit/Firefox fixture tests,
lint and the privacy audit support review but do not establish vulnerability
absence. The privacy audit is heuristic, not a full security scanner.

Keep real Firefox extension lifecycle, minimum-version compatibility, authenticated
GitHub behavior, dependency analysis and release integrity as distinct coverage
areas. Record deferred checks and distinguish reproduced, source-supported and
unvalidated findings. Do not use a personal profile, publish a test comment or
send credentials to a scanner. Signing checks use dummy credentials and intercept
submission; actual signing/upload requires separate authorization.

For a Codex Security codebase scan, include this root policy and scan the whole
repository. Confirm the branch/revision and report coverage, attacker assumptions,
validation evidence and gaps. For Cloud monitoring, use this threat model as the
repository's Project context. For Security Review, select `SECURITY.md` as the
checked-in threat-model file when configuring that source. Adding the file does
not start a scan, authorize fixes/publication or establish a clean security result.

Official workflow references:

- [Codex Security codebase scans](https://learn.chatgpt.com/docs/security/plugin/scans).
- [Cloud threat-model context](https://learn.chatgpt.com/docs/security/threat-model).
- [Security Review configuration](https://learn.chatgpt.com/docs/security/security-review).
