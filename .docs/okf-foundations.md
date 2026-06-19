# OKF Foundations

## What OKF Is

OKF is a vendor-neutral knowledge format built from markdown files with YAML frontmatter.

- A bundle is a directory tree of markdown files
- A concept is one markdown document
- A concept ID is the file path without `.md`
- Markdown links express relationships between concepts

## What OKF Is Not

OKF is not:

- a vector database
- a query engine
- a schema registry
- a retrieval system

It is a stable, portable knowledge artifact that other systems can build on.

## Core Design Philosophy

OKF is markdown-first, not schema-first.

- only `type` is required in concept frontmatter
- consumers should be permissive
- partial knowledge is better than rejected knowledge
- unknown keys and broken links should be tolerated during consumption

This matters for Effect modeling: parsing and validation should preserve imperfect but still useful data.

## Why OKF Matters For Retrieval Systems

OKF already contains useful retrieval structure:

- concept-level boundaries
- explicit links between concepts
- directory hierarchy
- lightweight typed frontmatter

This makes it a strong canonical format for:

- graph projection
- vector indexing
- bundle inspection and validation
- hybrid retrieval pipelines

## Canonical Architecture

The clean mental model is:

1. source material is enriched into OKF
2. OKF becomes the source of truth
3. retrieval projections are built from OKF

Examples of retrieval projections:

- vector index for semantic entry-point search
- graph projection for structural navigation
- bundle stats and diagnostics for quality analysis

## Key Boundary

Do not treat OKF itself as the retrieval layer.

- OKF is the durable representation
- indexes and graphs are rebuildable projections

If chunking, embedding, or traversal strategy changes, rebuild the projection rather than mutating the canonical bundle model.
