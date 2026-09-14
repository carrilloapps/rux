# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-09-14

### Added

- Startup view: reads Run and RunOnce across `HKCU`, `HKLM` and the 32-bit
  registry views, both Startup folders, and optionally scheduled tasks with
  logon or boot triggers. Entries are correlated with live processes through a
  four-rule matcher that handles launcher stubs and versioned install folders.
- Leftovers view: eight classes of uninstall residue (startup entries,
  uninstall keys, services, scheduled tasks, shortcuts, App Paths, firewall
  rules and empty install folders), each with a removal descriptor and evidence.
- Junk view: twenty-four known cache and temporary locations across sixteen
  categories, measured with per-location minimum file ages.
- Hardware view: graphics adapters, display modes, the full driver inventory and
  system capabilities, turned into prioritised recommendations.
- WSL analysis: detects installed distributions and reads `.wslconfig`, then
  advises on memory, processor, swap, GPU and nested virtualization settings.
  Networking is deliberately out of scope.
- Reversible removal: every leftover removal writes a backup first, restorable
  with `rux restore`.
- Bilingual interface in United States English and Venezuelan Spanish, switchable
  at runtime and persisted.
- Non-interactive `--list` and `--json` output for every view, plus `--dry-run`.
- Release workflow producing a standalone Windows executable, an Inno Setup
  installer and a portable archive with checksums.

### Testing

- 429 tests covering every domain rule, use case, adapter, command and interface
  component, at complete statement, line and function coverage.
- The PowerShell transport is tested against real PowerShell rather than a mock,
  including parameter safety, non-ASCII round trips and scripts larger than a
  Windows command line allows.

### Security

- Script parameters are passed as base64-encoded JSON rather than interpolated
  into script text.
- A protected-path guard refuses removal of system directories regardless of
  what a finding claims.

[Unreleased]: https://github.com/carrilloapps/rux/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/carrilloapps/rux/releases/tag/v0.0.1
