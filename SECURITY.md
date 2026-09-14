# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report privately through
[GitHub Security Advisories](https://github.com/carrilloapps/rux/security/advisories/new),
or by email to <m@carrillo.app>.

Include what you can: affected version, reproduction steps, impact, and whether
elevation is required. You will get an acknowledgement within 72 hours and an
assessment within seven days.

## Scope

rux reads and modifies system state. The following are in scope:

- privilege escalation beyond what the user granted;
- command or script injection through a scanned value such as a registry entry,
  path or firewall rule name;
- removal of a protected location despite the guard;
- a backup that cannot restore what it claims to hold;
- exposure of machine data outside the local machine.

Out of scope: the need for administrator rights for machine-wide operations,
and SmartScreen warnings on the unsigned release binary.

## Design notes relevant to security

- Script parameters travel as base64-encoded JSON bound to a variable. No
  scanned value is interpolated into script text.
- A fixed list of protected paths is checked before any filesystem removal,
  independent of what a finding claims.
- rux makes no network requests. It reads the local machine and writes to the
  local machine only.
- npm releases are published with provenance attestation.
