# Contributing

Thanks for considering a contribution to rux.

## Getting started

```sh
git clone https://github.com/carrilloapps/rux.git
cd rux
npm ci
npm run verify
```

rux targets Windows. The domain layer is pure and runs anywhere, but the
adapters shell out to PowerShell, so integration work needs a Windows machine.

## Layout

Dependencies point inward only:

```
presentation -> application -> domain
infrastructure ------------^
```

- `src/domain` holds types and rules. No I/O, no framework, no PowerShell.
- `src/application` holds use cases and the ports they depend on.
- `src/infrastructure` implements those ports.
- `src/presentation` renders. It never talks to infrastructure directly.

Imports use the `@/` alias, never relative paths. Modules are named for what
they contain; there are no `index` files.

## Before opening a pull request

```sh
npm run verify   # format check, type-check, lint, tests
npm run build
```

New behaviour needs a test. Domain rules are pure and easy to cover, so a rule
without a test will be asked for one.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), lower case, no
trailing period:

```
feat(wsl): detect distributions and .wslconfig limits
fix(residue): unquote InstallLocation before the existence check
docs(readme): document the junk scan age rules
```

Types in use: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`.

Explain _why_ in the body when the change is not self-evident. Do not add
co-authorship or generated-by trailers.

## Adding a detection rule

1. Put the rule in `src/domain/services/`. It must be a pure function of its
   inputs so it can be tested without Windows.
2. Add both locale strings. `es-VE` is typed against `en-US`, so a missing key
   is a build error.
3. Add a test that proves the rule fires, and one that proves it does not fire
   on a healthy machine. False positives are the main risk in this project.

## Adding a junk location

Entries go in `src/domain/services/junk-catalog.ts`. `risk: 'safe'` is reserved
for data Windows or a tool regenerates on demand with no user-visible loss.
Anything else is `review`. Always set a `minimumAgeDays` that protects in-flight
work.

## Reporting a bug

Include the rux version, the Windows build, whether you ran elevated, and the
output of the relevant `--json` command with anything sensitive removed.
