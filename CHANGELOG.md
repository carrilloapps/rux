# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.3] - 2026-09-14

### Changed

- Every GitHub Action moved to its current major: `actions/checkout` and
  `actions/upload-artifact` to v7, `actions/setup-node` to v7,
  `github/codeql-action` to v4, and `softprops/action-gh-release` to v3.
- Every dependency moved to its latest stable release, which meant migrating
  four majors: Zod 4 renamed the types the PowerShell runner imports and now
  requires a key schema on `z.record`; i18next 26 replaced `initImmediate` with
  its inverse, `initAsync`; TypeScript 6 deprecates `baseUrl`, so the path
  aliases resolve relative to `tsconfig.json` instead; and Ink 7, React 19.3,
  Vitest 5 and commander 15 came with them.
- ESLint stays on 9 and TypeScript on 6: `eslint-plugin-react` supports no
  ESLint above 9.7, and `typescript-eslint` supports no TypeScript from 6.1.
  Both move up as soon as those plugins do.
- The key handler is published to its ref from a layout effect rather than
  during render. React 19 reports a ref write during render as an error, and a
  passive effect would leave a keystroke in the gap after a frame is painted
  handled by the previous render's closure.
- Publishing to npm is a manual step and the release workflow no longer
  attempts it. The workflow still builds, verifies, smoke-tests in isolation
  and attaches every Windows asset to the release.

### Fixed

- The test suite no longer depends on whether the surrounding shell forces
  colour. CI exports `FORCE_COLOR=1`, which made Ink interleave escape codes
  through every rendered frame, so six assertions that passed on a developer
  machine failed there and had left CI red on `main`.
- A display reporting a zero width or height is treated as unknown rather than
  as a wrong resolution. The check lived in two places with different
  definitions of missing, and the one that ran first admitted zero, which
  divides into Infinity rather than a scale ratio.

### Testing

- 448 tests, up from 429. Vitest 5 maps statements far more precisely than 3
  did, which exposed real gaps the old reporter had counted as covered:
  startup filters and sorts, paged movement, read-only guards, in-flight key
  suppression, partial removal failures, and integrated-GPU detection by model
  name and by shared memory. Coverage is back to complete statements, lines
  and functions.

## [0.0.2] - 2026-09-14

### Added

- `@tests/*` path alias beside `@/*`, so test helpers are imported by a stable
  path rather than by counting directories back to `tests/helpers`.
- `npm run clean`, `npm run preview`, `npm run package:installer`,
  `npm run pack:check`, `npm run version:set` and `npm run verify:coverage`.
  The installer is now compiled by the same script locally and in CI.
- Subcommand help points at the global option list, which Commander does not
  repeat per command.

### Fixed

- The installer and portable archive of 0.0.1 could not start. The bundler
  marked `react`, `ink` and `systeminformation` as external while the
  distribution ships no `node_modules`, so both artifacts failed at load with
  `Cannot find package 'react'`. Every dependency is now bundled, and the
  distribution runs with nothing beside it.
- The npm package is published from a Windows runner. `npm ci` refuses to
  install a package whose manifest declares `os: win32` on any other platform,
  so 0.0.1 never reached the registry.

### Changed

- `set-version.mjs` also writes the version into `package-lock.json`, which
  otherwise drifted out of sync with the manifest and would fail `npm ci`.
- The README leads with `npx`, documents every command, option and key, and
  folds the long sections into collapsible blocks with real captured frames.
- The runtime dependencies moved to `devDependencies`. They are compiled into
  the bundle, so declaring them only made `npx @carrilloapps/rux` download a
  dependency tree it never loads. The published package is now the tarball
  alone.
- The release smoke test copies the staged build out of the checkout before
  running it, and asserts no `node_modules` came with it. Running it in place
  let the repository satisfy imports the distribution has to carry itself,
  which is how artifacts that cannot start reached a release.

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

[Unreleased]: https://github.com/carrilloapps/rux/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/carrilloapps/rux/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/carrilloapps/rux/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/carrilloapps/rux/releases/tag/v0.0.1
