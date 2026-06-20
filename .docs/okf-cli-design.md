# OKF CLI Design

## Goal

The MVP CLI should be agent-first and spec-first.

Its primary job is to help downstream agents and CI validate and explore an OKF
bundle by navigating its concept graph.

Natural-language query is important, but it is a follow-up product feature, not
part of the CLI MVP.

## Primary Users

- downstream agents and LLM-based tooling
- CI pipelines that need pass/fail validation
- humans doing manual debugging as a secondary use case

## MVP Principles

- prefer stable machine-readable behavior
- every command should support `--json`, including structured success and error
  payloads
- keep canonical concept ids aligned with bundle-relative file paths without the
  `.md` suffix
- separate spec validation from quality linting
- use graph-native language such as `incoming`, `outgoing`, `neighbors`, and
  `path`
- no interactive mode in MVP

## Recommended Top-Level Shape

Use a mixed workflow-and-resource command tree.

```text
okf
├── validate
├── lint
├── bundle
├── concept
└── graph
```

Why this shape works:

- `validate` and `lint` are top-level workflows, not resources
- `bundle` covers spec-native bundle artifacts such as `index.md` and `log.md`
- `concept` is the main read primitive for exploring one concept
- `graph` is justified in MVP because neighbor traversal and shortest-path
  exploration are core user jobs
- `query` is intentionally deferred until the first product feature lands

## Recommended MVP Commands

```text
okf validate <bundle>
okf concept <bundle> <concept-id>
okf graph neighbors <bundle> <concept-id>
okf graph path <bundle> <from> <to>
okf bundle index <bundle> [scope]
```

### Why these belong in MVP

- `validate`: enforce OKF conformance and graph integrity
- `concept`: inspect one concept together with its structural context
- `graph neighbors`: the most direct graph exploration primitive
- `graph path`: shortest-path traversal between two concepts
- `bundle index`: spec-native bundle navigation and progressive disclosure

## Near-MVP Follow-Ups

```text
okf lint <bundle>
okf bundle log <bundle> [scope]
okf graph export <bundle>
```

Why these are close but not required for the first slice:

- `lint`: useful, but secondary to hard validation
- `bundle log`: spec-native, but lower value than `bundle index` for day-1
  exploration
- `graph export`: cheap and useful, but not required to prove navigation

## Explicitly Deferred

```text
okf query ask <bundle> <question>
okf ingest *
okf bundle parse <bundle>
okf bundle stats <bundle>
okf graph stats <bundle>
okf concept show <bundle> <concept-id>
okf concept backlinks <bundle> <concept-id>
```

Why these are deferred:

- `query ask` is a product feature, not a spec-first MVP command
- `ingest` is future workflow surface
- `bundle parse` is more of an implementation/debugging primitive
- `bundle stats` and `graph stats` are less important than navigation commands
- `concept show` and `concept backlinks` are subsumed by the base `concept`
  command plus graph commands

## Command Semantics

### `validate`

`validate` should check both:

- OKF spec conformance
- graph integrity derived from the bundle

It should fail CI by default for:

- malformed frontmatter or malformed reserved files
- missing required spec fields such as concept `type`
- broken internal concept links

It should return structured issues suitable for automation.

### `lint`

`lint` is separate from `validate`.

It should cover non-spec quality guidance such as:

- missing recommended metadata
- weak descriptions
- missing optional bundle scaffolding
- other bundle hygiene checks

`lint` should not redefine spec conformance.

### `concept`

`concept` should be a base command, not a namespace.

```text
okf concept <bundle> <concept-id>
```

Default output should include:

- frontmatter
- body
- incoming neighbors
- outgoing neighbors

Use `incoming` and `outgoing` terminology instead of `parent` and `children`.

Minimum MVP flags:

- `--json`
- `--incoming`
- `--outgoing`
- `--body`

### `graph neighbors`

`graph neighbors` should expose direct structural traversal around a concept.

Expected use cases:

- find what links into a concept
- find what a concept links out to
- support iterative exploration by agents

### `graph path`

`graph path` should return the shortest path between two concepts.

MVP path semantics:

- shortest path only
- canonical concept ids as inputs
- no interactive traversal mode

### `bundle index`

`bundle index` should expose index-driven navigation for the bundle root or a
subdirectory scope.

This is a spec-native navigation primitive and should be preferred over adding
more generic bundle summary commands early.

## Global CLI UX Conventions

- explicit positional `<bundle>` arguments
- `--json` support on every command
- machine-readable issue and error payloads
- stable exit behavior for CI and agent consumers
- warnings separated from hard validation failures

Because the CLI is agent-first, consistency matters more than rich terminal UX.

## Strongest MVP Slice

If implementation scope must stay tight, prioritize:

1. `okf validate`
2. `okf bundle index`
3. `okf concept`
4. `okf graph neighbors`
5. `okf graph path`

This slice proves:

- OKF spec validation
- graph integrity validation
- spec-native bundle navigation
- concept inspection
- graph-based exploration

## Summary

The MVP CLI should help an agent answer three questions reliably:

- does this directory conform to OKF?
- what concept is this, and what is connected to it?
- how do I navigate from one concept to another?

That leads to a smaller, sharper MVP:

- `validate` for hard conformance
- `bundle index` for spec-native navigation
- `concept` for concept inspection
- `graph neighbors` and `graph path` for graph exploration

Everything else should wait until this slice is proven.
