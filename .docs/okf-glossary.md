# OKF Glossary

## Knowledge Bundle

A self-contained directory of markdown files. The unit of distribution.
Analogous to a git repo or npm package. May be distributed as a git repo,
tarball, or subdirectory.

Spec: Sections 2, 3

## Concept

A single markdown file within a bundle. One file equals one concept. Represents
any unit of knowledge: a table, a metric, a playbook, an API endpoint, and so on.

Spec: Sections 2, 4

## Concept ID

The file path within the bundle, minus the `.md` extension.
Example: `tables/orders.md` -> `tables/orders`.

Spec: Section 2

## Frontmatter

YAML metadata block at the top of a concept file, delimited by `---`.
Contains structured fields. Only `type` is required.

Spec: Section 4.1

## Body

Everything after the frontmatter. Free-form markdown. Conventional sections
include `# Schema`, `# Examples`, `# Citations`.

Spec: Section 4.2

## `type` Field

The only required frontmatter field. A short string identifying the kind of
concept, for example `BigQuery Table`, `Metric`, or `Playbook`. It is not
centrally registered; producers choose descriptive values and consumers tolerate
unknown ones.

Spec: Section 4.1

## `resource` Field

Optional frontmatter field. A URI uniquely identifying the underlying asset the
concept describes. Absent for abstract concepts such as playbooks or metrics.

Spec: Section 4.1

## Link

A standard markdown link from one concept to another. It asserts a relationship.
The kind of relationship is conveyed by surrounding prose, not the link syntax.
Links can be absolute, bundle-relative paths starting with `/`, or relative paths.

Spec: Section 5

## Citation

A link from a concept to an external source supporting a claim. Usually listed
under a `# Citations` heading and numbered.

Spec: Section 8

## Index File (`index.md`)

Reserved filename. Directory listing for progressive disclosure. Contains no
frontmatter, except optionally at bundle root for `okf_version`.

Spec: Section 6

## Log File (`log.md`)

Reserved filename. Optional chronological update history. Uses date-grouped
entries, newest first.

Spec: Section 7

## Progressive Disclosure

The design principle that agents and humans can navigate a bundle one level at a
time via index files, without loading everything into context.

Spec: Section 6

## Conformance

A bundle is conformant if:

1. every non-reserved `.md` file has parseable YAML frontmatter
2. every frontmatter has a non-empty `type` field
3. reserved files follow their defined structure

Spec: Section 9

## Enrichment Agent

An agent that produces OKF bundles from metadata sources. The reference
implementation uses Google ADK, Gemini, and BigQuery.

Source: OKF README

## Consumption Agent

Any agent or tool that reads and traverses OKF bundles. Examples include search
indexes, graph viewers, RAG pipelines, and LLMs loading context.

Spec: Section 1

Source: [OKF SPEC.md v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
