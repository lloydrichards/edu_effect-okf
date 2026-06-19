# OKF CLI Design

## Goal

The CLI should expose the shape of the knowledge system, not just wrap parser functions.

A good OKF CLI should support:

- building or enriching bundles
- validating and inspecting bundles
- exploring graph structure
- querying bundles with natural language

## Recommended Top-Level Shape

Use a resource-oriented command tree.

```text
okf
├── bundle
├── concept
├── graph
├── query
└── ingest
```

Why this shape works:

- `bundle` for whole-bundle operations
- `concept` for one-concept exploration
- `graph` for structural analysis
- `query` for hybrid retrieval workflows
- `ingest` for bundle creation and enrichment

## Recommended MVP Commands

```text
okf bundle parse <bundle>
okf bundle validate <bundle>
okf bundle stats <bundle>
okf concept show <bundle> <concept-id>
okf concept backlinks <bundle> <concept-id>
okf graph stats <bundle>
okf query ask <bundle> <question>
```

### Why these belong in MVP

- `bundle parse`: foundational debugging primitive
- `bundle validate`: quality gate
- `bundle stats`: fast overview
- `concept show`: core inspection workflow
- `concept backlinks`: first graph-powered exploration command
- `graph stats`: proves graph projection value
- `query ask`: flagship hybrid retrieval workflow

## Nice-To-Haves

```text
okf bundle init <bundle>
okf bundle reindex <bundle>
okf bundle visualize <bundle>
okf concept links <bundle> <concept-id>
okf concept path <bundle> <from> <to>
okf graph orphans <bundle>
okf graph export <bundle>
okf query explain <bundle> <question>
```

Useful additions after MVP:

- bundle scaffolding
- index regeneration
- HTML or graph visualization
- pathfinding between concepts
- retrieval-plan introspection

## Future Roadmap

Potential future commands:

- `okf ingest enrich`
- `okf ingest embed`
- `okf concept new`
- `okf concept edit`
- `okf query eval`
- repair or fix commands for common bundle issues

## Global CLI UX Conventions

Recommended cross-cutting flags and behaviors:

- explicit bundle path arguments
- `--format text|json`
- `--verbose`
- `--quiet`
- machine-readable errors for automation
- warnings separated from fatal failures

Because OKF is permissive, many issues should be warnings rather than hard errors.

## Strongest MVP Slice

If implementation scope must stay tight, prioritize:

1. `okf bundle validate`
2. `okf bundle stats`
3. `okf concept show`
4. `okf concept backlinks`
5. `okf query ask`

This slice proves:

- bundle parsing
- bundle diagnostics
- concept inspection
- graph projection value
- hybrid retrieval value

## Summary

The CLI should teach the user how to think about the system.

- bundles are the canonical artifacts
- concepts are the main unit of exploration
- graph is the structural projection
- query is the retrieval-facing workflow
- ingest is the future production path
