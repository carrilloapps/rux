<div align="center">

<img src="assets/icon-256.png" alt="rux" width="128" height="128" />

# rux

**Windows system inspector and cleaner, in your terminal.**

See what starts with Windows, what your uninstallers left behind, where your disk space went,
and whether your graphics, drivers and WSL are actually configured well.

[![CI](https://github.com/carrilloapps/rux/actions/workflows/ci.yml/badge.svg)](https://github.com/carrilloapps/rux/actions/workflows/ci.yml)
[![CodeQL](https://github.com/carrilloapps/rux/actions/workflows/codeql.yml/badge.svg)](https://github.com/carrilloapps/rux/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/@carrilloapps/rux?logo=npm&color=cb3837)](https://www.npmjs.com/package/@carrilloapps/rux)
[![downloads](https://img.shields.io/npm/dm/@carrilloapps/rux?logo=npm&color=cb3837)](https://www.npmjs.com/package/@carrilloapps/rux)

[![license](https://img.shields.io/github/license/carrilloapps/rux?color=blue)](./LICENSE)
[![node](https://img.shields.io/node/v/@carrilloapps/rux?logo=node.js&color=5fa04e)](https://nodejs.org)
[![platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D4?logo=windows)](https://www.microsoft.com/windows)
[![typescript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](./tsconfig.json)
[![i18n](https://img.shields.io/badge/i18n-en--US%20%7C%20es--VE-22d3ee)](#language)
[![coverage](https://img.shields.io/badge/coverage-100%25%20statements-brightgreen)](#development)

[Install](#install) - [Startup](#startup) - [Leftovers](#leftovers) - [Junk](#junk-files) -
[Hardware](#hardware-and-recommendations) - [WSL](#wsl) - [Roadmap](./docs/ROADMAP.md)

</div>

---

Four things Windows makes hard to see, in one tool:

| View          | Question it answers                                                |
| ------------- | ------------------------------------------------------------------ |
| **Startup**   | What launches at logon, and is it running right now?               |
| **Leftovers** | What still references programs that are no longer installed?       |
| **Junk**      | Where is my disk space going, and what is safe to reclaim?         |
| **Hardware**  | Are my graphics, drivers, WSL and system settings configured well? |

Every removal that touches the registry, a service, a task or a firewall rule is **backed up first**
and can be undone with one command.

```sh
npx @carrilloapps/rux                 # startup entries
npx @carrilloapps/rux clean           # uninstall leftovers
npx @carrilloapps/rux junk            # caches and junk files
npx @carrilloapps/rux hardware        # graphics, drivers, recommendations
npx @carrilloapps/rux --lang es-VE    # interfaz en espanol
```

---

## Contents

- [Install](#install)
- [Language](#language)
- [Startup](#startup)
- [Leftovers](#leftovers)
- [Junk files](#junk-files)
- [Hardware and recommendations](#hardware-and-recommendations)
- [WSL](#wsl)
- [Backups and undo](#backups-and-undo)
- [Command line](#command-line)
- [Permissions](#permissions)
- [Safety model](#safety-model)
- [Architecture](#architecture)
- [Development](#development)

---

## Install

Pick whichever suits you.

**Installer** — download `rux-<version>-setup.exe` from
[Releases](https://github.com/carrilloapps/rux/releases). It installs per user, needs no
administrator rights, and adds rux to your `PATH`.

**Portable** — download `rux-<version>-win-x64.zip`, unpack it, run `rux.exe`. No Node required.

**npm**

```sh
npm install -g @carrilloapps/rux
rux
```

Windows only. The npm package needs Node 20.11 or newer; the standalone binary needs nothing.
Neither depends on PowerShell 7 — rux uses the Windows PowerShell 5.1 that ships with every
supported Windows.

Every release asset is listed in `SHA256SUMS.txt`. Verify before running:

```powershell
Get-FileHash .\rux-1.0.0-setup.exe -Algorithm SHA256
```

---

## Language

The interface ships in **United States English** and **Venezuelan Spanish**. All source code,
identifiers and comments are English; only the interface is translated.

- rux picks a language from `RUX_LOCALE`, `LC_ALL`, `LANG` or `LANGUAGE` on first run.
- Press `l` in the interface to switch. The choice is remembered.
- `--lang en-US` or `--lang es-VE` overrides both for a single run.

Translations are type-checked: `es-VE` is declared as the `Translation` type derived from `en-US`,
so a missing or renamed key is a build error, never a silent fallback. A test also asserts both
locales expose exactly the same key set.

---

## Startup

```
 rux Startup | Leftovers | Junk | Hardware [user]          en-US  ASUSTUFGAMING
 10 entries - 1 running - 2 disabled - 1 missing   all/status

   NAME                        SOURCE              STATUS    MEM     PUBLISHER
 + ASUS Smart Display Control  Run (machine x86)   running   13 MB   ASUSTeK
 o Discord                     Run (user)          stopped   -       Discord Inc.
 x OneDrive                    Run (user)          disabled  -       Microsoft
 ! Surfshark                   Run (user)          missing   -       -
```

| Mark         | Meaning                                   |
| ------------ | ----------------------------------------- |
| `+` running  | enabled, and a matching process is live   |
| `o` stopped  | enabled, but not currently running        |
| `x` disabled | registered, but Windows skips it at logon |
| `!` missing  | the executable no longer exists           |

Enabling and disabling writes the same `Explorer\StartupApproved` flag Task Manager uses, so a
change in rux shows up in Windows and vice versa.

### Sources scanned

`HKCU` and `HKLM` Run and RunOnce (including the WOW6432Node 32-bit views), the user and machine
Startup folders, and — with `--tasks` — scheduled tasks with logon or boot triggers.

### How "running" is decided

Startup entries frequently point at a launcher rather than the app. Matching is layered, and the
detail panel always names the rule that fired:

1. **exact path** — the process runs the exact registered executable;
2. **launcher target** — an `.exe` named on the command line is running (Squirrel apps register
   `Update.exe --processStart App.exe` but run `App.exe`);
3. **executable name** — same filename in a versioned install folder;
4. **install folder** — a process running from the entry's own directory.

Shared system directories are excluded from rule 4, so a `System32` entry never claims unrelated
processes.

---

## Leftovers

Eight classes of residue, all detected by one rule: **it references a path that no longer exists.**

| Class       | What it finds                                                  |
| ----------- | -------------------------------------------------------------- |
| `startup`   | Run/RunOnce entries pointing at a missing executable           |
| `uninstall` | Add/Remove Programs entries whose files are gone               |
| `service`   | Windows services whose binary is missing                       |
| `task`      | Scheduled tasks that run a missing program                     |
| `shortcut`  | Start Menu, Desktop and Startup `.lnk` files with dead targets |
| `apppath`   | `App Paths` registry entries resolving to nothing              |
| `firewall`  | Firewall rules for programs that are gone                      |
| `directory` | Empty folders left in Program Files, AppData and ProgramData   |

One uninstall usually leaves traces in several at once:

```
  STARTUP ENTRY
  - Surfshark            C:\Program Files\Surfshark\Surfshark.exe
  SERVICE
  - Surfshark Service    C:\Program Files\Surfshark\Surfshark.Service.exe
  FOLDER
  - Surfshark            C:\Program Files\Surfshark
```

**Risk levels.** `safe` means the referenced target is provably gone. `review` marks heuristic
matches from `--deep`. In the interface, `a` selects only safe items; `A` is required for review
ones.

**Deep scan** (`--deep`, or `D` in the interface) additionally reports program folders that still
contain executables but that no installed program claims. These are always `review`, because a
portable app looks identical to the scanner.

### Not reported, deliberately

- Windows' own firewall rules for optional features (group is a resource string like
  `@FirewallAPI.dll,-32002`);
- folders Windows creates and expects to exist, several of which are empty by design
  (`VirtualStore`, `PeerDistRepub`, `SoftwareDistribution`, `Uninstall Information`, ...);
- MSI uninstall entries unless the install folder is demonstrably gone, since `msiexec` plus a
  product code always resolves;
- shortcuts to Store apps and control panel items, which have no filesystem target;
- rux's own backup folder.

Registry values are unquoted before the existence check. A value stored as `"C:\Program Files\App"`
with its own quotes is a healthy install, and a naive check reports it as a leftover.

---

## Junk files

Twenty-four known locations across sixteen categories: temp folders, Windows Update and Delivery
Optimization caches, Prefetch, thumbnail and icon caches, error reports, crash dumps, the Recycle
Bin, font cache, servicing logs, browser caches (Edge, Chrome, Firefox) and package manager caches
(npm, NuGet, pip, Yarn), plus `Windows.old`.

```
  LOCATION              CATEGORY                   FILES        SIZE
- npm-cache             Package manager cache      87,458    1.1 GB
- user-temp             User temp                   7,829    415 MB
- chrome-cache          Browser cache               2,426    395 MB
? firefox-cache         Browser cache                 754    114 MB

  17 locations - 2.1 GB reclaimable - 12 safe (2.0 GB)
```

Two rules keep the sweep from touching live data:

- **Minimum age.** Each location declares one. Temp folders hold state for in-flight installs, so
  files newer than a day are skipped; Prefetch entries are kept for thirty days.
- **Sweep mode.** Locations Windows recreates lazily are _emptied_, not deleted, so the folder
  itself survives. The Recycle Bin goes through `Clear-RecycleBin`, because the shell owns its index
  and deleting the folder by hand corrupts it.

Files held open by a running process are counted, skipped and reported — not treated as a failure.

**Junk removal is not backed up.** Caches are regenerated by design, and copying gigabytes aside to
delete gigabytes would defeat the purpose. The interface says so before every sweep.

---

## Hardware and recommendations

rux reads the graphics configuration, the full driver inventory and system capabilities, then turns
them into advice you can act on. It never applies graphics or driver changes itself: those are
vendor- and model-specific, and a wrong automated write is far more damaging than a stale registry
key. Every recommendation names the exact place to make the change, with a copyable command where
one exists.

```
  SYSTEM
  CPU             Intel Core i5-12500H
  Memory          64 GB (52 GB free)
  Secure Boot     unknown
  Virtualization  enabled
  Power plan      Silent

  GRAPHICS
  NVIDIA GeForce RTX 3050 Laptop GPU   discrete    4.0 GB VRAM   driver 616.56
  Intel Iris Xe Graphics               integrated  2.0 GB VRAM   driver -

  DISPLAYS
  Default Monitor    1920x1080 @ 144 Hz (native 1920x1080, 32-bit)

  RECOMMENDATIONS
  [medium] Background game recording is on
    Finding: Game DVR is recording in the background.
    Advice:  Turning it off removes a constant capture overhead.
    Where:   Settings > Gaming > Captures
    Command: start ms-settings:gaming-gamedvr
```

### What it checks

**Graphics and display** — hybrid GPU setups with no per-application preference, hardware-accelerated
GPU scheduling, Game DVR, Game Mode, graphics driver age, refresh rate below the panel maximum,
non-native resolution, and reduced color depth.

**Drivers** — Device Manager problem codes mapped to health states, unsigned drivers, and stale
drivers on core device classes.

**System** — Secure Boot, hardware virtualization, memory pressure, and power plan.

### Accuracy notes

Three Windows quirks are handled explicitly, because each produces a confident wrong answer:

- **DPI scaling is not a wrong resolution.** `systeminformation` reports the scaled desktop size, so
  a 1920x1080 panel at 125% reads as 1536x864. rux takes the real mode from the adapter and, when
  comparing, requires _both_ axes to scale by the same factor — otherwise 1280x1024 on a 1920x1080
  panel would be dismissed as scaling.
- **Virtualization reads as disabled once Hyper-V claims it.** A present hypervisor is checked first.
- **Inbox drivers carry sentinel dates.** Windows ships packages stamped 1968 and 2006 whose hardware
  contract has not changed. Dates before 1995 are treated as unknown, and Microsoft-provided drivers
  are excluded from staleness checks.

---

## WSL

When the Windows Subsystem for Linux is installed, rux reads the distribution list and your
`.wslconfig`, then advises on how the Linux virtual machine shares the host with Windows.

```
  WSL
  Distributions   Ubuntu (v2, Stopped, default), docker-desktop (v2, Stopped)
  Configuration   memory=48 GB  processors=14  swap=8.0 GB  gpu=not set
                  C:\Users\you\.wslconfig
```

It checks the memory limit against installed RAM in both directions — too low starves the
distribution, too high starves Windows — plus processor allocation, swap, GPU access, nested
virtualization, sparse virtual disks, and whether firmware virtualization is enabled at all, since
without it WSL 2 cannot start.

**Networking is deliberately out of scope.** WSL network behaviour depends on your host adapters,
VPN client and firewall, so mirrored mode, DNS tunnelling and proxy settings are manual decisions
rather than something a tool should recommend from inspection.

---

## Backups and undo

Every leftover removal writes a backup first, under `%LOCALAPPDATA%\rux\backups\<timestamp>\`.

| Item                 | How it is preserved                                              |
| -------------------- | ---------------------------------------------------------------- |
| registry value / key | exported with `reg export` to a `.reg` file                      |
| service              | its `CurrentControlSet\Services` key exported before `sc delete` |
| scheduled task       | exported to its full task XML                                    |
| firewall rule        | fields captured as JSON for `New-NetFirewallRule`                |
| file / folder        | **moved** into the backup, not deleted                           |

```sh
rux backups                          # what can be undone
rux restore 20260914-081626-d275     # put it all back
rux purge   20260914-081626-d275     # delete the backup for good
```

A fully restored backup removes itself; a partially restored one is kept so you can retry.

---

## Command line

```
rux [command] [options]
```

| Command               | Description                                |
| --------------------- | ------------------------------------------ |
| `startup` _(default)_ | inspect what starts with Windows           |
| `clean`               | find and remove uninstall leftovers        |
| `junk`                | find and clear caches and junk files       |
| `hardware`            | inspect graphics, drivers and capabilities |
| `backups`             | list the backups rux can restore from      |
| `restore <id>`        | restore a backup                           |
| `purge <id>`          | delete a backup permanently                |

| Option            | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `--lang <locale>` | `en-US` or `es-VE`                                      |
| `--json`          | print machine-readable JSON and exit                    |
| `-l, --list`      | print a plain table and exit                            |
| `-t, --tasks`     | include scheduled tasks triggered at logon or boot      |
| `--deep`          | also report program folders no installed program claims |
| `-y, --yes`       | with `--list`, apply the safe actions without asking    |
| `--dry-run`       | with `--yes`, print exactly what would happen and stop  |
| `--class <name>`  | limit a leftover scan to one class (repeatable)         |
| `--read-only`     | disable every mutating key in the interface             |
| `--interval <ms>` | process refresh interval; `0` disables                  |
| `-v, --version`   | print the version                                       |
| `-h, --help`      | show help                                               |

Running a command with no `--list` or `--json` opens the interface on that view.

### Keys

| Key                   | Action                                                      |
| --------------------- | ----------------------------------------------------------- |
| `tab` / `shift+tab`   | next / previous view                                        |
| `up` `down` / `j` `k` | move selection                                              |
| `g` / `G`             | first / last                                                |
| `/`                   | search                                                      |
| `f` / `F`             | cycle filter _(startup)_                                    |
| `s`                   | cycle sort _(startup)_                                      |
| `space`               | toggle entry _(startup)_ or select item _(leftovers, junk)_ |
| `d`                   | remove entry _(startup)_                                    |
| `a` / `A` / `n`       | select safe / all / none _(leftovers, junk)_                |
| `x` or `enter`        | apply to the selected items                                 |
| `D`                   | toggle deep scan _(leftovers)_                              |
| `t`                   | include scheduled tasks _(startup)_                         |
| `r`                   | rescan                                                      |
| `l`                   | switch language                                             |
| `?`                   | help                                                        |
| `q`                   | quit                                                        |

### Examples

```sh
rux clean --list --yes --dry-run     # show exactly what would go, change nothing
rux clean --list --class service     # one class at a time
rux junk --list --lang es-VE         # basura, en espanol
rux hardware --json | jq '.recommendations[] | select(.impact == "critical")'
rux --json | jq '.entries[] | select(.executableExists == false)'
```

---

## Permissions

Entries under `HKCU` and your own AppData are yours to change. Machine-wide items — `HKLM`, services,
scheduled tasks, firewall rules, Program Files, `%SystemRoot%` — need administrator rights.

The header shows `[admin]` or `[user]`, each item is marked when it needs elevation, and when a
selection includes machine-wide items rux relaunches **only the removal step** through UAC and reads
the result back. Start your terminal as administrator to avoid the prompt.

---

## Safety model

1. **Read-only by default.** Nothing changes until you press a key that says it will.
2. **Confirmation on every mutation**, stating exactly what is about to happen.
3. **Backup before removal** for leftovers — files are moved, not deleted.
4. **Protected paths are refused.** `C:\`, `%SystemRoot%`, `System32`, `SysWOW64`, `Program Files`,
   `ProgramData`, your profile and the AppData roots cannot be removed, whatever a finding claims.
5. **`safe` means provable.** Heuristics are always `review` and never auto-selected.
6. **No command injection.** Script parameters travel as base64-encoded JSON bound to a variable;
   no caller value is ever interpolated into script text.
7. **`--dry-run`** prints the exact operations and changes nothing.
8. **`--read-only`** disables every mutating key for the whole session.

---

## Architecture

Clean architecture, with dependencies pointing inward only.

```
src/
  domain/              pure types and rules; no I/O, no framework
    common.ts, startup.ts, residue.ts, junk.ts, hardware.ts, recommendation.ts
    services/          process-matcher, graphics-advisor, driver-advisor, junk-catalog
  application/         use cases and the ports they depend on
    ports.ts, use-cases.ts
  infrastructure/      adapters that implement the ports
    powershell/        runner, schema helpers, scripts as typed TS modules
    adapters/          startup, residue, junk, hardware, backup
    container.ts       composition root
  presentation/
    tui/               Ink components
    cli/               plain-text renderers
    config.ts          persisted preferences
  i18n/                i18next setup and locale files
  shared/              errors and formatting
  main.tsx             commander entry point
```

Two conventions apply throughout:

- **Imports use the `@/` alias**, never relative paths: `@/domain/startup`, not
  `../../domain/startup`.
- **No `index` files.** Every module is named for what it holds, so an import path says what it
  points at.

The domain layer is pure and synchronous, so every rule — process matching, graphics advice, driver
advice — is unit-tested without a Windows machine present. Use cases depend on interfaces in
`ports.ts`, never on PowerShell.

### The PowerShell transport

Windows exposes no stable Node API for the registry, services, scheduled tasks or the firewall, so
those go through PowerShell. It is confined to `infrastructure/powershell/`, and the scripts are
**TypeScript modules** that build script text — there are no loose `.ps1` files.

Four hard-won implementation details live there:

- **Scripts are written to a temp file with a UTF-8 BOM**, not passed as `-EncodedCommand`. Windows
  PowerShell reads a script as ANSI without a BOM, so one non-ASCII character corrupts the parse;
  and an encoded command is still a command line, which Windows caps at 32767 characters.
- **Parameters are base64 JSON**, so paths containing quotes or ampersands cannot break a script.
- **`reg.exe` writes its success message to stderr.** Under a `Stop` error preference, a merged
  stderr stream turns a successful export into a thrown error, so `reg` calls are judged by exit
  code alone.
- **PowerShell 5.1 cannot cast a hashtable containing a generic `List` to `[pscustomobject]`.**
  Collections are converted with `.ToArray()` before serialization, and the Zod schemas tolerate
  `ConvertTo-Json` collapsing single-element arrays into bare objects.

---

## Development

```sh
npm install
npm run verify     # typecheck + lint + tests
npm run build
node dist/main.js
```

| Script                                      | Purpose                          |
| ------------------------------------------- | -------------------------------- |
| `npm run build`                             | bundle with tsup                 |
| `npm run dev`                               | bundle in watch mode             |
| `npm run typecheck`                         | `tsc --noEmit`                   |
| `npm run lint` / `lint:fix`                 | ESLint 9 flat config, type-aware |
| `npm run format` / `format:check`           | Prettier                         |
| `npm test` / `test:watch` / `test:coverage` | Vitest                           |
| `npm run verify`                            | everything above, in order       |

TypeScript runs with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch` and `verbatimModuleSyntax`.

### Releasing

Publishing a GitHub release triggers `.github/workflows/release.yml`, which on a Windows runner:

1. verifies and builds the bundle;
2. packages a standalone `rux.exe`;
3. runs that executable and fails the release if it cannot report its version, print help, list
   startup entries in both languages, or produce hardware JSON;
4. builds the Inno Setup installer and a portable archive;
5. publishes checksums, attaches every asset to the release, and publishes to npm with provenance.

### Dependencies

Versions are pinned exactly (`save-exact=true`). Dependabot proposes minor and patch updates
monthly and never majors; security advisories bypass that schedule. See `.github/dependabot.yml`.

### What is missing

`docs/ROADMAP.md` is a gap analysis of fifty items across detection coverage, correctness,
architecture, packaging and operations, each with its reasoning and status.

---

## License

MIT
