# apps/cli

Main CLI tool for interacting with OKF bundles.

## Current State

Skeleton app with a single `hello` subcommand. OKF-specific commands are TBD
and will be developed as the project evolves.

## Stack

- Effect unstable CLI (`effect/unstable/cli`)
- `@effect/platform-bun` (BunRuntime, BunServices)

## Patterns

- Root command via `Command.make("cli")` with subcommands composed via
  `Command.withSubcommands`
- Each subcommand lives in `src/commands/<name>.ts`
- Args and options use `Command.make` with `Args` and `Options` from
  `effect/unstable/cli`
- Entry point provides `BunServices.layer` and runs with `BunRuntime.runMain`

## Run

```bash
bun dev --filter=cli
```
