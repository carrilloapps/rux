# Roadmap and gap analysis

A structured review of what rux does not yet do, what it does that could be
stronger, and what a project of this shape is normally expected to carry.

Each item states the gap, why it matters, and the cost of closing it. Items are
grouped by area and ordered by value inside each group. Status reflects the
current release.

Legend: **[done]** shipped · **[next]** planned for the next minor ·
**[later]** accepted but not scheduled · **[open]** decision pending.

---

## Product: detection coverage

**1. Winlogon and shell hijack points — [next]**
`HKLM\...\Winlogon\Userinit` and `Shell` are classic persistence locations that
rux does not read. A modified value there survives every startup cleanup the
tool currently performs. Low cost, high value: two registry values and a
comparison against the known-good defaults.

**2. Explorer shell extensions and context menu handlers — [later]**
Uninstalled software routinely leaves `ShellEx` handlers behind, which makes
Explorer slow and can make right-click hang for seconds. Detection is easy;
deciding what is safe to remove is not, because in-process handlers are shared.

**3. Browser extensions and their native messaging hosts — [later]**
Native messaging manifests point at executables and are left behind exactly like
firewall rules. Same detection rule as `apppath`, different location.

**4. Scheduled tasks in the `\Microsoft\Windows\` tree — [open]**
Currently skipped to avoid noise. Some genuinely break after third-party
software modifies them. Needs a curated allowlist before it can be enabled.

**5. Startup impact measurement — [later]**
Windows records per-entry startup cost under
`Explorer\StartupApproved` telemetry and in the `Microsoft-Windows-Diagnostics-Performance`
event log. Surfacing "this entry costs 4.2 s at logon" would make the startup
view actionable rather than informational.

**6. Driver rollback candidates — [later]**
Windows keeps previous driver packages in `DriverStore\FileRepository`. When a
recommendation says a driver is faulty, naming the exact rollback target would
close the loop.

**7. Disk health via SMART — [later]**
`MSStorageDriver_FailurePredictStatus` exposes predictive failure. A failing disk
outranks every other recommendation rux can make.

**8. Windows Update pending-reboot state — [next]**
Several recommendations are moot while a reboot is pending. Detecting it
prevents advice the user cannot act on.

**9. Storage Sense integration — [later]**
Windows already has a scheduled cleaner. rux should detect whether it is on and
say so, rather than duplicating a job the OS will do anyway.

**10. Per-user junk for other profiles — [open]**
Machines with several accounts accumulate the same caches per profile. Requires
administrator rights and raises a privacy question worth deciding deliberately.

---

## Product: correctness and trust

**11. Restore points before machine-wide changes — [next]**
`Checkpoint-Computer` before any `HKLM`, service or task removal would give an
OS-level undo above rux's own backups. Cheap, and it is what users expect from a
cleaner.

**12. Backup retention and pruning — [next]**
Backups accumulate with no upper bound. A retention policy (count, age, or total
size) plus `rux backups --prune` is needed before long-term use.

**13. Backup integrity verification — [later]**
A manifest records what was removed but nothing verifies the backup is readable.
Hashing each artifact at write time and checking at restore would catch a
corrupt `.reg` before the user needs it.

**14. Dry run for every mutating path — [done for leftovers and junk]**
`--dry-run` covers `clean` and `junk`. Startup mutations and `restore` have no
equivalent yet.

**15. Undo for junk cleaning — [open]**
Deliberately absent: copying gigabytes aside to delete gigabytes defeats the
purpose. Sending files to the Recycle Bin instead of deleting them is a middle
ground worth evaluating.

**16. Digital signature verification — [later]**
rux reports a publisher string from file version info, which is trivially
forged. Checking Authenticode status would let the startup view distinguish
a signed vendor binary from something merely claiming to be one.

**17. Concurrency guard — [next]**
Two rux processes removing at once can interleave backups. A lock file under the
data directory is a few lines and prevents a confusing failure.

**18. Transactional batch removal — [later]**
A batch that fails halfway leaves a partial backup. Grouping registry writes in
a transaction (`KTM`) is possible but adds significant complexity.

**19. Explicit exit codes — [next]**
Everything exits 0 or 1. Scripted use needs distinct codes for "nothing found",
"partial failure", "needs elevation" and "invalid usage".

**20. Machine-readable schema versioning — [next]**
`--json` output has no `schemaVersion`. Consumers cannot detect a breaking
change. One field, added now, avoids a painful migration later.

---

## Architecture and code

**21. Result types instead of thrown errors at boundaries — [later]**
`Outcome<T>` exists in the domain but adapters still throw. Making the port
contracts return `Outcome` would make failure handling explicit and testable.

**22. Adapter-level tests with a fake PowerShell runner — [next]**
The domain is well covered; the adapters are not. Injecting a fake runner that
returns recorded JSON would test the parsing and mapping layer, which is where
the shape bugs live.

**23. Golden-file tests for the generated PowerShell — [next]**
Script text is assembled from template literals. A snapshot test would catch an
accidental escaping change, which is the failure mode that has bitten this code
most often.

**24. Contract tests for the Zod schemas — [next]**
Capture real PowerShell output from several machines and assert the schemas
parse it. This is the cheapest defence against the single-element-array and
null-field problems.

**25. Property-based tests for the process matcher — [later]**
The four-rule matcher is the most subtle logic in the project. Generative tests
would explore combinations hand-written cases miss.

**26. Split `App.tsx` — [next]**
It holds all state for four views and is the one file that has grown past
comfortable. Per-view reducers or a small state machine would restore the
symmetry the rest of the codebase has.

**27. Extract a shared view-state hook — [later]**
Cursor, search, filter and selection are reimplemented per view. One hook would
remove the duplication and the small behavioural differences that came with it.

**28. Centralise the terminal width breakpoints — [later]**
Column layout thresholds are scattered as magic numbers across three components.

**29. Runtime validation of locale interpolation — [later]**
A translation can reference `{{count}}` where the caller passes `{total}`. A test
that extracts placeholders from both locales and compares them against call
sites would catch it.

**30. Domain events for auditability — [later]**
Every mutation currently writes a backup but no log. An append-only audit trail
would answer "what did rux change on this machine last month".

---

## Platform and packaging

**31. Code signing for the released binary — [open]**
The installer and executable are unsigned, so SmartScreen warns on first run.
This needs a certificate and is a cost decision, not a technical one.

**32. winget manifest — [next]**
`winget install carrilloapps.rux` is the expected install path on Windows today.
The manifest is small and can be automated from the release workflow.

**33. Chocolatey package — [later]**
Still widely used in corporate environments.

**34. Scoop bucket — [later]**
Popular with developers, trivial to add once checksums are published.

**35. ARM64 build — [later]**
Windows on ARM is growing. `pkg` supports the target; it needs a second matrix
entry and a real device to verify.

**36. Reduce binary size — [later]**
The packaged executable embeds a full Node runtime. Node's own single-executable
applications feature would produce a smaller artifact once it stabilises.

**37. Auto-update check — [open]**
Useful for a standalone binary, but it means a network call from a tool that
otherwise touches nothing outside the machine. Needs an explicit opt-in if added.

**38. Portable mode — [next]**
Preferences and backups go to `%LOCALAPPDATA%`. A `--portable` flag keeping
everything beside the executable would suit USB and locked-down use.

---

## Documentation and project health

**39. Contribution guide — [done]**
See `CONTRIBUTING.md`.

**40. Security policy — [done]**
See `SECURITY.md`.

**41. Changelog — [done]**
See `CHANGELOG.md`, following Keep a Changelog.

**42. Architecture decision records — [next]**
Several non-obvious choices (temp file over `-EncodedCommand`, no junk backups,
no automated graphics writes) are explained in comments. They belong in ADRs
where they can be revisited.

**43. Screenshots or an asciinema recording — [next]**
A terminal interface is hard to evaluate from prose alone.

**44. Localised README — [later]**
The interface is bilingual; the documentation is English only. A Spanish README
would match the audience.

**45. Troubleshooting guide — [next]**
Common situations — execution policy, antivirus blocking the binary, elevation
prompts, WSL not detected — have known answers that are not written down.

**46. Public JSON schema — [later]**
Publishing a JSON Schema for `--json` output would let consumers validate it.

---

## Operations

**47. Renovate as an alternative to Dependabot — [open]**
Dependabot is configured. Renovate offers finer grouping and a genuine 15-day
cadence via cron, which Dependabot expresses only as weekly or monthly.

**48. Supply chain hardening — [next]**
Pin GitHub Actions to commit SHAs rather than tags, and add `npm audit signatures`
to CI. Provenance is already enabled for npm publishing.

**49. Performance budget in CI — [later]**
The junk scan takes about thirty seconds. A regression check would catch a
change that doubles it.

**50. Telemetry — [open, leaning no]**
Usage data would guide the catalog, but a tool that inspects a machine and
promises to touch nothing else should probably not phone home. Recorded here so
the decision is explicit rather than forgotten.

---

## Summary

| Priority    | Count | Theme                                                     |
| ----------- | ----- | --------------------------------------------------------- |
| **[next]**  | 17    | Test depth, safety rails, packaging reach                 |
| **[later]** | 21    | Detection breadth, refactors, extra distribution channels |
| **[open]**  | 8     | Decisions with a cost or a principle attached             |
| **[done]**  | 4     | Already shipped                                           |

The highest-value cluster is items 22 to 24: the domain is well tested, the
adapter and script layer is not, and that is exactly where the defects found
during development have lived.
