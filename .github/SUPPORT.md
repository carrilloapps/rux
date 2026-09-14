# Support

## Questions and problems

- **Something is wrong with rux** - open a
  [bug report](https://github.com/carrilloapps/rux/issues/new?template=bug_report.yml).
  False positives count: if rux flagged something that is actually in use, that
  is a bug worth reporting.
- **You want rux to detect something it does not** - open a
  [feature request](https://github.com/carrilloapps/rux/issues/new?template=feature_request.yml).
- **A security problem** - do not open an issue. Follow [SECURITY.md](../SECURITY.md).

## Before opening an issue

Include the output of:

```powershell
rux --version
[System.Environment]::OSVersion.Version
```

and the relevant `--json` output with anything sensitive removed.

## Common situations

**"running scripts is disabled on this system"** - rux invokes PowerShell with
`-ExecutionPolicy Bypass` for its own scripts, so your policy is not the cause.
If you see this, something else is intercepting the call.

**A security product blocks the release binary** - the executable is not code
signed, so SmartScreen and some antivirus products warn on first run. Verify the
checksum against `SHA256SUMS.txt` before allowing it.

**WSL is not detected** - rux looks for `wsl.exe` on `PATH`. If WSL is installed
but not on `PATH`, rux reports it as absent rather than guessing.

**Machine-wide items show "needs admin"** - `HKLM`, services, scheduled tasks and
firewall rules require elevation. Start the terminal as administrator, or let rux
raise the removal step through UAC.
