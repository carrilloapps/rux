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

[Install](#install) - [Usage](#usage) - [Views](#the-four-views) - [Safety](#safety-model) -
[Development](#development) - [Roadmap](./docs/ROADMAP.md)

</div>

---

## Try it right now

No install, no clone, nothing left behind:

```sh
npx @carrilloapps/rux
```

That opens the startup view. Every other view is one word away:

```sh
npx @carrilloapps/rux clean        # uninstall leftovers
npx @carrilloapps/rux junk         # caches and junk files
npx @carrilloapps/rux hardware     # graphics, drivers, recommendations
npx @carrilloapps/rux --lang es-VE # interfaz en espanol
```

rux is **read-only until you press a key that says otherwise**, so running it changes nothing.
To be certain, add `--read-only` and every mutating key is disabled for the session.

Four things Windows makes hard to see, in one tool:

| View          | Question it answers                                                |
| ------------- | ------------------------------------------------------------------ |
| **Startup**   | What launches at logon, and is it running right now?               |
| **Leftovers** | What still references programs that are no longer installed?       |
| **Junk**      | Where is my disk space going, and what is safe to reclaim?         |
| **Hardware**  | Are my graphics, drivers, WSL and system settings configured well? |

Every removal that touches the registry, a service, a task or a firewall rule is **backed up first**
and can be undone with one command.

---

## Contents

- [Install](#install)
- [Usage](#usage)
- [The four views](#the-four-views) — [Startup](#startup) · [Leftovers](#leftovers) ·
  [Junk files](#junk-files) · [Hardware](#hardware-and-recommendations) · [WSL](#wsl)
- [Backups and undo](#backups-and-undo)
- [Language](#language)
- [Permissions](#permissions)
- [Safety model](#safety-model)
- [How it works](#how-it-works)
- [Development](#development)

---

## Install

Pick whichever suits you. All three give you the same tool.

<details>
<summary><b>npx</b> — nothing installed, always the latest version</summary>

<br />

```sh
npx @carrilloapps/rux
```

npm downloads the package, runs it, and caches it for next time. Everything is bundled into a single
file, so there is no dependency tree to install.

To pin a version, or to force a fresh download:

```sh
npx @carrilloapps/rux@0.0.2      # a specific version
npx --yes @carrilloapps/rux      # skip the install prompt
```

Needs Node 20.19 or newer.

</details>

<details>
<summary><b>npm global</b> — type <code>rux</code> from anywhere</summary>

<br />

```sh
npm install -g @carrilloapps/rux
rux
```

Update and remove with the usual commands:

```sh
npm update -g @carrilloapps/rux
npm uninstall -g @carrilloapps/rux
```

Needs Node 20.19 or newer.

</details>

<details>
<summary><b>Installer or portable</b> — no Node required at all</summary>

<br />

Download from [Releases](https://github.com/carrilloapps/rux/releases):

- **`rux-<version>-setup.exe`** — installs per user, needs no administrator rights, and can add rux
  to your `PATH`. Uninstall from Add/Remove Programs.
- **`rux-<version>-win-x64.zip`** — unpack anywhere and run **`rux.cmd`** (or `rux.ps1` from
  PowerShell). Nothing is written outside the folder.

Both carry their own Node runtime, so neither needs Node installed.

Every release asset is listed in `SHA256SUMS.txt`. Verify before running:

```powershell
Get-FileHash .\rux-<version>-setup.exe -Algorithm SHA256
```

</details>

Windows 10 and 11 only. rux uses the Windows PowerShell 5.1 that ships with every supported
Windows — PowerShell 7 is not required.

---

## Usage

```
rux [command] [options]
```

Running a command with neither `--list` nor `--json` opens the interactive interface on that view.
With either flag, rux prints and exits — which is what you want in a script.

### Commands

| Command               | Description                                     |
| --------------------- | ----------------------------------------------- |
| `startup` _(default)_ | inspect what starts with Windows                |
| `clean`               | find and remove uninstall leftovers             |
| `junk`                | find and clear caches and junk files            |
| `hardware`            | inspect graphics, drivers, WSL and capabilities |
| `backups`             | list the backups rux can restore from           |
| `restore <id>`        | restore a backup                                |
| `purge <id>`          | delete a backup permanently                     |

### Options

Options are global: they work before or after a command.

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

<details>
<summary><b>Examples</b> — inspecting, scripting, cleaning</summary>

<br />

**Look around, change nothing.**

```sh
rux                                  # interactive, starts on Startup
rux hardware --read-only             # interactive, every mutating key disabled
rux junk --list                      # a plain table, then exit
```

**See exactly what a cleanup would do, before doing it.**

```sh
rux clean --list --yes --dry-run     # prints every operation, changes nothing
rux clean --list --class service     # one class at a time
rux clean --list --deep              # include heuristic matches
```

**Actually clean, without the interface.**

```sh
rux clean --list --yes               # applies only the safe items, backs up first
rux junk --list --yes                # sweeps only the safe locations
rux backups                          # confirm what can be undone
```

**Feed it to something else.** Every view speaks JSON.

```sh
# Startup entries whose executable no longer exists
rux --json | jq '.entries[] | select(.executableExists == false)'

# Only the recommendations worth acting on
rux hardware --json | jq '.recommendations[] | select(.impact == "critical" or .impact == "high")'

# Total reclaimable bytes
rux junk --json | jq '[.findings[].sizeBytes] | add'

# Leftovers grouped by kind
rux clean --json | jq 'group_by(.kind) | map({kind: .[0].kind, count: length})'
```

**In Spanish.**

```sh
rux junk --list --lang es-VE
```

</details>

<details>
<summary><b>Keyboard reference</b> — every key in the interface</summary>

<br />

| Key                   | Action                                                      |
| --------------------- | ----------------------------------------------------------- |
| `tab` / `shift+tab`   | next / previous view                                        |
| `up` `down` / `j` `k` | move selection                                              |
| `g` / `G`             | first / last                                                |
| `/`                   | search (`Esc` clears, `Enter` keeps the query)              |
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

</details>

---

## The four views

Every frame below is real output, captured from a running session.

### Startup

<details open>
<summary>What launches at logon, and what is actually running</summary>

<br />

```
 rux Startup | Leftovers | Junk | Hardware [user] [read-only]              English (US) WORKSTATION
 11 entries - 2 running - 2 disabled - 1 missing  all/status
   NAME                                      SOURCE              STATUS     MEM      PUBLISHER
 + ASUS Smart Display Control                Run (machine x86)   running    4.1 MB   ASUSTeK Computer Inc.
 + Spotify                                   Run (user)          running    1.2 GB   Spotify Ltd
 o Discord                                   Run (user)          stopped    -        Discord Inc.
 o Docker Desktop                            Run (user)          stopped    -        Docker Inc.
 o EEventManager                             Run (machine x86)   stopped    -        Seiko Epson Corporation
 o Nearby Share                              Run (machine)       stopped    -        Google
 o SecurityHealth                            Run (machine)       stopped    -        Microsoft Corporation
 x MicrosoftEdgeAutoLaunch_6BF482821AD42EA~  Run (user)          disabled   -        Microsoft Corporation
 x OneDrive                                  Run (user)          disabled   -        Microsoft Corporation
 ! Surfshark                                 Run (user)          missing    -        -
 ╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ + ASUS Smart Display Control - Run (machine x86)                                                 │
 │ Status        running                                                                            │
 │ Command       "C:\Program Files (x86)\ASUS\ASUS Smart Display Control\ASUSSmartDisplayControl.e~ │
 │ Publisher     ASUSTeK Computer Inc.                                                              │
 │ Processes     1 process - pid 9268 - 4.1 MB - matched by executable name                         │
 │ Registered    HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run                    │
 │ File          175 KB - modified 2024-03-30                                                       │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
 tab switch view - / search - l switch language - ? help - q quit
```

| Mark         | Meaning                                   |
| ------------ | ----------------------------------------- |
| `+` running  | enabled, and a matching process is live   |
| `o` stopped  | enabled, but not currently running        |
| `x` disabled | registered, but Windows skips it at logon |
| `!` missing  | the executable no longer exists           |

Enabling and disabling writes the same `Explorer\StartupApproved` flag Task Manager uses, so a
change in rux shows up in Windows and vice versa.

**Sources scanned.** `HKCU` and `HKLM` Run and RunOnce (including the WOW6432Node 32-bit views), the
user and machine Startup folders, and — with `--tasks` — scheduled tasks with logon or boot triggers.

**How "running" is decided.** Startup entries frequently point at a launcher rather than the app.
Matching is layered, and the detail panel always names the rule that fired:

1. **exact path** — the process runs the exact registered executable;
2. **launcher target** — an `.exe` named on the command line is running (Squirrel apps register
   `Update.exe --processStart App.exe` but run `App.exe`);
3. **executable name** — same filename in a versioned install folder;
4. **install folder** — a process running from the entry's own directory.

Shared system directories are excluded from rule 4, so a `System32` entry never claims unrelated
processes.

</details>

### Leftovers

<details>
<summary>What your uninstallers forgot to take with them</summary>

<br />

```
 rux Startup | Leftovers | Junk | Hardware [user] [read-only]              English (US) WORKSTATION
 66 leftovers - 0 selected
     LEFTOVER                          KIND               SIZE     POINTS AT
 [ ] Surfshark                         Startup entry      -        C:\Program Files\Surfshark\Surfshark.exe
 [ ] Surfshark Service                 Service            -        C:\Program Files\Surfshark\Surfshark.Ser~
 [ ] P508PowerAgent_sdk                Scheduled task     -        C:\Program Files (x86)\ASUS\ArmouryDevic~
 [ ] IDLE (Python 3.14 64-bit)         Shortcut           2.7 KB   C:\Users\you\AppData\Local\Programs\Pyth~
 [ ] Discord.exe                       App path           -        C:\Users\you\AppData\Local\Discord\app-1~
 [ ] Microsoft Edge (mDNS-In)          Firewall rule      -        C:\Program Files (x86)\Microsoft\EdgeWeb~
 [ ] ACSETUP                           Firewall rule      -        C:\ProgramData\ASUS\ARMOURY CRATE One Pa~
 [ ] postman.exe                       Firewall rule      -        C:\users\you\appdata\local\postman\app-1~
 [ ] GoLand 2026.1.3                   Firewall rule      -        C:\program files\jetbrains\goland 2026.1~
 -- 1 / 66 --
 ╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ Surfshark - Startup entry                                                                        │
 │ Why           A startup entry in HKCU:\...\Run points at a file that no longer exists            │
 │ Points at     C:\Program Files\Surfshark\Surfshark.exe                                           │
 │ Removes       registryValue: HKCU:\Software\Microsoft\Windows\CurrentVersion\Run                 │
 │ Risk          safe - the target it references no longer exists                                   │
 │ Recovery      backed up before removal; restore with "rux restore"                               │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
 tab switch view - / search - l switch language - ? help - q quit
```

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

One uninstall usually leaves traces in several at once — the Surfshark entry above appears as a
startup entry, a service and a folder.

**Risk levels.** `safe` means the referenced target is provably gone. `review` marks heuristic
matches from `--deep`. In the interface, `a` selects only safe items; `A` is required for review
ones.

**Deep scan** (`--deep`, or `D` in the interface) additionally reports program folders that still
contain executables but that no installed program claims. These are always `review`, because a
portable app looks identical to the scanner.

**Not reported, deliberately:**

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

</details>

### Junk files

<details>
<summary>Where the disk space went, and what is safe to reclaim</summary>

<br />

```
 rux Startup | Leftovers | Junk | Hardware [user] [read-only]              English (US) WORKSTATION
 17 locations - 2.3 GB reclaimable - - selected
     LOCATION                    CATEGORY                  FILES     SIZE
 [ ] npm-cache                   Package manager cache    87,470   1.3 GB
 [ ] user-temp                   User temp                11,725   516 MB
 [ ] chrome-cache                Browser cache             1,318   400 MB
 [ ] firefox-cache               Browser cache               754   114 MB
 [ ] thumbnail-cache             Thumbnail cache              30    19 MB
 [ ] inet-cache                  Icon cache                    3    63 KB
 [ ] recycle-bin                 Recycle Bin                   2    57 KB
 [ ] windows-temp                System temp                   0        -
 [ ] windows-update-cache        Windows Update                0        -
 [ ] prefetch                    Prefetch                      0        -
 [ ] crash-dumps                 Crash dumps                   0        -
 ╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ npm-cache - Package manager cache                                                                │
 │ Why           The npm package cache. npm refills it on the next install.                         │
 │ LOCATION      C:\Users\you\AppData\Local\npm-cache                                               │
 │ SIZE          1.3 GB - 87,470 files                                                              │
 │ Risk          safe - regenerated automatically, nothing is lost                                  │
 │ Recovery      This deletes files permanently and is not backed up.                               │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
 tab switch view - / search - l switch language - ? help - q quit
```

Twenty-four known locations across sixteen categories: temp folders, Windows Update and Delivery
Optimization caches, Prefetch, thumbnail and icon caches, error reports, crash dumps, the Recycle
Bin, font cache, servicing logs, browser caches (Edge, Chrome, Firefox) and package manager caches
(npm, NuGet, pip, Yarn), plus `Windows.old`.

Two rules keep the sweep from touching live data:

- **Minimum age.** Each location declares one. Temp folders hold state for in-flight installs, so
  files newer than a day are skipped; Prefetch entries are kept for thirty days.
- **Sweep mode.** Locations Windows recreates lazily are _emptied_, not deleted, so the folder
  itself survives. The Recycle Bin goes through `Clear-RecycleBin`, because the shell owns its index
  and deleting the folder by hand corrupts it.

Files held open by a running process are counted, skipped and reported — not treated as a failure.

**Junk removal is not backed up.** Caches are regenerated by design, and copying gigabytes aside to
delete gigabytes would defeat the purpose. The interface says so before every sweep.

</details>

### Hardware and recommendations

<details>
<summary>Graphics, drivers and system settings, turned into advice you can act on</summary>

<br />

```
 rux Startup | Leftovers | Junk | Hardware [user] [read-only]              English (US) WORKSTATION
 Recommendations - 4  256 devices
   IMPACT      AREA        RECOMMENDATION
   medium      driver      Core drivers have not been updated in years
   medium      graphics    Background game recording is on
   low         wsl         WSL virtual disks do not shrink automatically
   info        driver      All devices report healthy drivers
 ╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ Core drivers have not been updated in years - medium                                             │
 │ Finding       1 drivers for core components are more than three years old.                       │
 │ Advice        Check Windows Update optional updates, then the vendor site, for newer packages.   │
 │ Where         Settings > Windows Update > Advanced > Optional updates                            │
 │ Command       start ms-settings:windowsupdate                                                    │
 │ Evidence      ELAN SMBus Driver - 2022-06-29                                                     │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
 tab switch view - / search - l switch language - ? help - q quit
```

rux reads the graphics configuration, the full driver inventory and system capabilities, then turns
them into advice you can act on. **It never applies graphics or driver changes itself**: those are
vendor- and model-specific, and a wrong automated write is far more damaging than a stale registry
key. Every recommendation names the exact place to make the change, with a copyable command where
one exists.

**What it checks.**

- **Graphics and display** — hybrid GPU setups with no per-application preference, hardware-
  accelerated GPU scheduling, Game DVR, Game Mode, graphics driver age, refresh rate below the panel
  maximum, non-native resolution, and reduced color depth.
- **Drivers** — Device Manager problem codes mapped to health states, unsigned drivers, and stale
  drivers on core device classes.
- **System** — Secure Boot, hardware virtualization, memory pressure, and power plan.

**Accuracy notes.** Three Windows quirks are handled explicitly, because each produces a confident
wrong answer:

- **DPI scaling is not a wrong resolution.** `systeminformation` reports the scaled desktop size, so
  a 1920x1080 panel at 125% reads as 1536x864. rux takes the real mode from the adapter and, when
  comparing, requires _both_ axes to scale by the same factor — otherwise 1280x1024 on a 1920x1080
  panel would be dismissed as scaling.
- **Virtualization reads as disabled once Hyper-V claims it.** A present hypervisor is checked first.
- **Inbox drivers carry sentinel dates.** Windows ships packages stamped 1968 and 2006 whose hardware
  contract has not changed. Dates before 1995 are treated as unknown, and Microsoft-provided drivers
  are excluded from staleness checks.

</details>

### WSL

<details>
<summary>How the Linux virtual machine shares the host with Windows</summary>

<br />

```
  WSL
  Distributions   Ubuntu (v2, Stopped, default), docker-desktop (v2, Stopped)
  Configuration   memory=48 GB  processors=14  swap=8.0 GB  gpu=not set
                  C:\Users\you\.wslconfig
```

When the Windows Subsystem for Linux is installed, rux reads the distribution list and your
`.wslconfig`, then checks the memory limit against installed RAM in both directions — too low
starves the distribution, too high starves Windows — plus processor allocation, swap, GPU access,
nested virtualization, sparse virtual disks, and whether firmware virtualization is enabled at all,
since without it WSL 2 cannot start.

**Networking is deliberately out of scope.** WSL network behaviour depends on your host adapters,
VPN client and firewall, so mirrored mode, DNS tunnelling and proxy settings are manual decisions
rather than something a tool should recommend from inspection.

</details>

---

## Backups and undo

Every leftover removal writes a backup first, under `%LOCALAPPDATA%\rux\backups\<timestamp>\`.

```sh
rux backups                          # what can be undone
rux restore 20260914-081626-d275     # put it all back
rux purge   20260914-081626-d275     # delete the backup for good
```

| Item                 | How it is preserved                                              |
| -------------------- | ---------------------------------------------------------------- |
| registry value / key | exported with `reg export` to a `.reg` file                      |
| service              | its `CurrentControlSet\Services` key exported before `sc delete` |
| scheduled task       | exported to its full task XML                                    |
| firewall rule        | fields captured as JSON for `New-NetFirewallRule`                |
| file / folder        | **moved** into the backup, not deleted                           |

A fully restored backup removes itself; a partially restored one is kept so you can retry.

Junk sweeps are the one exception, and the interface says so before every sweep: caches are
regenerated by design, so they are deleted rather than copied aside.

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

## How it works

<details>
<summary><b>Architecture</b> — clean layers, dependencies pointing inward only</summary>

<br />

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

tests/                 mirrors src/, plus helpers/ for builders and fakes
```

Two conventions apply throughout:

- **Imports use path aliases, never relative paths.** `@/` points at `src/` and `@tests/` at
  `tests/`, so `@/domain/startup` and `@tests/helpers/builders` — never `../../domain/startup`.
- **No `index` files.** Every module is named for what it holds, so an import path says what it
  points at.

The domain layer is pure and synchronous, so every rule — process matching, graphics advice, driver
advice — is unit-tested without a Windows machine present. Use cases depend on interfaces in
`ports.ts`, never on PowerShell.

</details>

<details>
<summary><b>The PowerShell transport</b> — four hard-won details</summary>

<br />

Windows exposes no stable Node API for the registry, services, scheduled tasks or the firewall, so
those go through PowerShell. It is confined to `infrastructure/powershell/`, and the scripts are
**TypeScript modules** that build script text — there are no loose `.ps1` files.

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

</details>

<details>
<summary><b>How it is distributed</b> — one bundle, three delivery routes</summary>

<br />

`tsup` bundles every dependency into a single ESM file, so the published package declares no runtime
dependencies at all: `npx @carrilloapps/rux` downloads one tarball and nothing else.

That bundle is ESM rather than a packed single-file executable because Ink loads its layout engine
through top-level `await`, which makes the whole graph ESM-only — and every Node single-file packer
loads its entry as CommonJS. The Windows installer and portable archive therefore ship the bundle
beside an embedded `node.exe`, with `rux.cmd` and `rux.ps1` as launchers.

Two accommodations make the bundle self-contained: Ink statically imports `react-devtools-core` from
a code path that only runs when `DEV` is set, so a stub stands in for it; and several dependencies
are CommonJS, so a banner builds the `require` that an ESM module scope does not have.

</details>

---

## Development

```sh
git clone https://github.com/carrilloapps/rux.git
cd rux
npm install
npm run verify     # format + typecheck + lint + tests
npm run build
node dist/main.js
```

<details>
<summary><b>All scripts</b></summary>

<br />

**Build and run**

| Script                                    | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `npm run build`                           | bundle with tsup into `dist/main.js`        |
| `npm run dev`                             | bundle in watch mode                        |
| `npm start`                               | run the built bundle                        |
| `npm run preview -- <view> <locale> <ms>` | render one frame headlessly, for docs or CI |
| `npm run clean`                           | remove `dist`, `build` and `coverage`       |

**Quality gates**

| Script                            | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `npm run typecheck`               | `tsc --noEmit`                                    |
| `npm run lint` / `lint:fix`       | ESLint 9 flat config, type-aware                  |
| `npm run format` / `format:check` | Prettier                                          |
| `npm test` / `test:watch`         | Vitest                                            |
| `npm run test:coverage`           | Vitest with v8 coverage and thresholds            |
| `npm run verify`                  | format check, typecheck, lint and tests, in order |
| `npm run verify:coverage`         | the same, with coverage thresholds enforced       |

**Distribution**

| Script                      | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `npm run icons`             | render `assets/icon.svg` into PNGs and `icon.ico`     |
| `npm run package:windows`   | stage the portable distribution into `build/stage`    |
| `npm run package:installer` | compile the Inno Setup installer (needs Inno Setup 6) |
| `npm run pack:check`        | list exactly what would be published to npm           |
| `npm run version:set <ver>` | write a version into `package.json` and the lockfile  |

Example, end to end:

```sh
npm run clean
npm run verify
npm run build
npm run package:windows
npm run package:installer
```

</details>

<details>
<summary><b>Testing and coverage</b></summary>

<br />

429 tests across 23 files, mirroring the source tree. Statements, lines and functions are held at
**100%**; branches stop short of it because the remainder are defensive fallbacks for states the
types already rule out, plus the UAC-gated elevation path. Forcing those would mean asserting
against a mock rather than against behaviour.

The PowerShell transport is tested against **real PowerShell**, not a mock, including parameter
safety, non-ASCII round trips and scripts larger than a Windows command line allows.

TypeScript runs with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch` and `verbatimModuleSyntax`.

</details>

<details>
<summary><b>Releasing</b></summary>

<br />

The release tag is the only place a version is authored. Publishing a GitHub release triggers
`.github/workflows/release.yml`, which on a Windows runner:

1. writes the tag into `package.json` and the lockfile;
2. verifies and builds the bundle;
3. stages the portable distribution with an embedded Node runtime;
4. **copies that distribution out of the checkout** and runs every command there, so a build that
   only works beside its own `node_modules` fails the release;
5. builds the Inno Setup installer and a portable archive;
6. publishes checksums and attaches every asset to the release.

**Publishing to npm is manual**, so a package version is never pushed to the registry without
someone deciding to. From a clean checkout on Windows:

```sh
npm ci
npm run version:set 0.0.3      # writes package.json and the lockfile
npm run verify                 # format, types, lint, tests
npm run pack:check             # confirm the tarball is the five expected files
npm publish --access public
```

`prepublishOnly` re-runs `verify` and `build`, so a failing check stops the publish rather than
shipping past it. Add `--provenance` when publishing from CI with an OIDC token; it does nothing
useful from a workstation.

Versions are pinned exactly (`save-exact=true`). Dependabot proposes minor and patch updates
monthly and never majors; security advisories bypass that schedule. See `.github/dependabot.yml`.

Two dependencies are deliberately held back, and both move up as soon as their plugins allow:
ESLint stays on 9 because `eslint-plugin-react` supports nothing above 9.7, and TypeScript stays
on 6 because `typescript-eslint` supports nothing from 6.1.

</details>

`docs/ROADMAP.md` is a gap analysis of fifty items across detection coverage, correctness,
architecture, packaging and operations, each with its reasoning and status.

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Security reports go through
[SECURITY.md](./SECURITY.md).

---

## License

MIT - [Jose Carrillo](https://github.com/carrilloapps)
