---
name: okf-builder
description: Build valid Open Knowledge Format (OKF) bundles from markdown files and agent context. Use when the user asks to "create an OKF bundle", "build OKF", "generate OKF from files", "convert to OKF format", or mentions building knowledge catalogs, documentation bundles, or structured knowledge from existing markdown/text content. This skill covers the full workflow from reading source files to writing valid OKF concept documents with proper frontmatter.
---

# OKF Bundle Builder

This skill teaches an AI agent how to construct valid Open Knowledge Format (OKF) bundles from markdown files and other content available in the agent's context. It assumes OKF bundles are directory trees with markdown files and does NOT require external tools or databases.

## When to Use

Use this skill when asked to:
- Create, build, or generate an OKF bundle from existing files
- Convert markdown documentation into OKF format
- Structure knowledge as an OKF catalog
- Build a knowledge bundle from scratch

This skill pairs with:
- **okf-validator** - Validate the bundle after building
- **okf-enricher** - Add rich descriptions after initial construction

## What is an OKF Bundle?

An OKF bundle is a directory tree where each concept is a markdown file with YAML frontmatter:

```markdown
---
type: <content type>
title: <display name>
description: <one-line summary>
timestamp: <ISO 8601 datetime>
tags: [<tag>, ...]
resource: <optional URI>
---

# Body content

The markdown body contains the detailed information about the concept.
```

### Required Frontmatter Fields

Per the OKF spec, only `type` is strictly required for validation:
- **type** - Non-empty content type (e.g., "Reference", "Document", "Guide", "Concept")

### Strongly Recommended Fields

Always include these for a high-quality bundle (the CLI validates without them but they are expected by consumers):
- **title** - Human-readable display name
- **description** - Single sentence summary
- **timestamp** - ISO 8601 datetime (e.g., "2026-06-22T10:30:00Z")

### Optional Frontmatter Fields

- **tags** - YAML list for categorization
- **resource** - Canonical URI identifying the underlying asset
- **content_hash** - Structural hash for tracking changes (auto-generated)

### Reserved Filenames

- **index.md** - Directory listing for progressive disclosure
- **log.md** - Chronological update history (optional)

## Graph Modeling Principles

OKF links are not just documentation conveniences: local tools turn markdown links into graph edges. If concepts are too broad or heavily cross-linked, a query neighborhood can expand into most of the bundle and become useless for retrieval.

Use this mental model:
- `index.md` files are for navigation breadth and can link widely.
- Concept files are for focused information and should link selectively.
- Broad category concepts should define scope, not route to every related concept.
- Focused concepts should carry diagnostic, causal, dependency, or workflow edges.
- Prefer one-way semantic links unless the reverse relationship is genuinely useful.

### When to Split a Concept

Split a concept when it naturally needs many unrelated outgoing links or acts as an umbrella for multiple tasks, symptoms, or causes.

Good splits:
- `watering.md` overview plus `soil-moisture-check.md`, `dry-down.md`, `watering-demand.md`
- `light-intensity.md` overview plus `insufficient-light.md`, `light-acclimation.md`, `bright-indirect-light.md`
- `yellowing-leaves.md` overview plus `yellow-leaves-overwatering.md`, `yellow-leaves-low-light.md`, `yellow-leaves-pests.md`

Rule of thumb: if a concept wants to link to 10+ internal concepts, it is probably an index/navigation page or should be split into narrower concepts.

### Link Direction Guidelines

Use links to express useful graph traversal, not every possible association:
- Specific symptom → focused cause or diagnostic route
- Plant profile → distinctive plant-specific issue, propagation method, or safety issue
- Focused issue → check/remedy concepts
- Workflow step → the focused concept needed for that step

### Edge Relation Metadata

When the relationship type is known, encode it in the markdown link title:

```markdown
[visible link text](/path/to/concept.md "relation phrase")
```

Local graph tooling treats the link title as edge `relation` metadata. The
visible link text remains the human-facing label, while the title phrase tells
the knowledge graph what the edge means.

Good examples:
```markdown
[Root Rot](/problems/root-rot.md "caused by")
[Soil Moisture Check](/care/soil-moisture-check.md "diagnosed by")
[Propagation](/propagation/index.md "child of")
[Bright Indirect Light](/care/bright-indirect-light.md "requires")
```

Use short, natural relation phrases that read as:

```text
source concept --relation--> target concept
```

Prefer relation phrases such as:
- `child of`
- `part of`
- `requires`
- `depends on`
- `caused by`
- `diagnosed by`
- `treated by`
- `prevents`
- `symptom of`
- `example of`
- `contrasts with`

Do not add a title when the relationship is only a loose mention. Avoid using
the same generic relation everywhere; if the precise relationship is unclear,
leave the link untitled rather than inventing semantics.

Avoid dense reciprocal links:
- Do not make `watering.md` link to every plant and every water-related symptom.
- Do not make every plant link to generic hubs like `watering`, `light`, `humidity`, and `pet toxicity` unless those edges are genuinely useful for retrieval.
- Do not use source/reference pages as graph hubs; keep source lists mostly external URLs.

## Building Procedure

### 1. Discover Source Content

Start by understanding what content you're working with:

**From Files:**
- Use Glob to find markdown files: `**/*.md`
- Use Read to examine file content and structure
- Note existing frontmatter (if any) - preserve it when possible

**From Agent Context:**
- User-provided text, documentation, or knowledge
- Existing directory structures to mirror
- Conceptual relationships described in conversation

**Never guess** - if the content structure is unclear, ask the user for clarification.

### 2. Design the Bundle Structure

Organize concepts into a logical hierarchy. Common patterns:

**Flat structure:**
```
bundle/
├── index.md
├── concept-1.md
├── concept-2.md
└── concept-3.md
```

**Hierarchical structure:**
```
bundle/
├── index.md
├── category-a/
│   ├── index.md
│   ├── concept-1.md
│   └── concept-2.md
└── category-b/
    ├── index.md
    └── concept-3.md
```

**Domain-specific structure** (adapt to your content):
```
bundle/
├── index.md
├── documents/
│   └── *.md
├── guides/
│   └── *.md
└── references/
    └── *.md
```

The structure should match the domain and help users navigate. There are no required directory names - organize however makes sense.

### 3. Determine Content Types

Choose a consistent type vocabulary for your bundle. Types are producer-defined strings that help classify concepts.

**Examples:**
- Documentation: `Document`, `Guide`, `Tutorial`, `Reference`
- Code knowledge: `API`, `Function`, `Class`, `Module`
- Data: `Dataset`, `Table`, `Schema`, `Metric`
- General: `Concept`, `Topic`, `Resource`, `Note`

Keep types:
- **Descriptive** - Self-explanatory, not cryptic
- **Consistent** - Same type for similar concepts
- **Appropriate** - Match the domain (e.g., don't use "BigQuery Table" for markdown files)

### 4. Extract or Generate Metadata

For each concept, determine:

**Title:**
- Extract from existing H1 heading, filename, or user context
- Prefer display names over slugs ("User Authentication" not "user-auth")

**Description:**
- Extract from existing frontmatter or first paragraph
- Generate a concise one-sentence summary if missing
- Ground in the content - don't invent information
- Format: Start with what the concept represents, then its purpose

**Timestamp:**
- Use current time in ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`
- Use UTC timezone
- Effect has `DateTime` in the standard library for this

**Tags:**
- Extract from existing frontmatter
- Generate based on content categories, file paths, or domain
- Keep to 3-5 tags per concept
- Use lowercase, hyphenated format: `data-modeling`, `typescript`

**Resource:**
- For local files: `file:///absolute/path/to/file`
- For URLs: full URL including scheme
- For other resources: appropriate URI scheme
- Optional - only include if there's a canonical external resource

### 5. Cross-Link Related Concepts

Build relationships using standard markdown links:

**Absolute links (recommended):**
```markdown
See the [Authentication Guide](/guides/authentication.md) for details.
```

**Relative links:**
```markdown
See the [related concept](../category/concept.md) for more.
```

**Semantic links with graph relation metadata:**
```markdown
This workflow [depends on](/references/api-contract.md "depends on") the API contract.
```

Use titled links whenever the edge relation is clear and useful for graph
traversal. The title should describe the relationship from the current concept
to the target concept.

**When to cross-link:**
- Parent/child relationships (document → section)
- Dependencies (guide references API docs)
- Related concepts (alternative approaches, comparisons)
- Focused diagnostic routes (symptom → likely cause → check/remedy)
- Plant-specific or domain-specific issues (plant profile → focused problem page)

**Broken links are tolerated** - link to not-yet-written concepts when appropriate.

**When NOT to cross-link:**
- When the link is only a broad category association already covered by `index.md`
- When the target is a generic hub that many unrelated pages already link to
- When the reverse link would only make the graph symmetrical, not more informative
- When a plain-text mention preserves readability without adding a noisy graph edge

### 6. Create Index Files

For each directory with multiple concepts, create an `index.md`:

**Format:**
```markdown
# Directory Name

Brief description of what this directory contains.

## Category/Group Name

* [Concept Title](./concept-1.md) - One-line description
* [Concept Title](./concept-2.md) - One-line description

## Another Category

* [Subdirectory Name](./subdir/) - Description of subdirectory
```

**Index files:**
- Have NO frontmatter (they're navigation aids, not concepts)
- Group related concepts under section headings
- Use relative links
- Include one-line descriptions (can match the concept's description)
- Carry broad navigation that would be too noisy inside concept files

Start with the root `index.md` and create nested indexes for subdirectories.

### 7. Write Concept Files

For each concept, create a markdown file:

**Frontmatter template:**
```yaml
---
type: <Type>
title: <Title>
description: <One-sentence summary>
timestamp: <ISO 8601 datetime>
tags: [<tag1>, <tag2>, <tag3>]
---
```

**Body content:**
- Preserve existing markdown structure when converting
- Use standard markdown (headings, lists, tables, code blocks)
- No required sections - structure naturally for the content
- Include selective cross-links to focused concepts; use plain text for broad category mentions that should not become graph edges

**Filename conventions:**
- Lowercase with hyphens: `user-authentication.md`
- Match the concept naturally: `api-reference.md`, `quick-start.md`
- Avoid special characters (stick to letters, numbers, hyphens)

### 8. Validate as You Build

Check each file as you create it:

**Frontmatter:**
- All four required fields present: `type`, `title`, `description`, `timestamp`
- Timestamp is valid ISO 8601 format
- YAML is well-formed (no syntax errors)

**Structure:**
- Frontmatter between `---` markers
- Markdown body follows frontmatter
- Cross-links use correct paths
- Index files have no frontmatter

Run **okf-validator** when done to catch any issues.

## Quality Guidelines

**Ground in content, don't invent:**
- Base descriptions on actual file content
- Don't fabricate relationships or metadata not present in the source
- If information is ambiguous, describe what's there rather than guessing

**Maintain existing structure:**
- When converting, preserve the original organization when sensible
- Keep existing frontmatter fields (add required ones if missing)
- Don't restructure unnecessarily - the goal is valid OKF, not perfection

**Be consistent within the bundle:**
- Use the same type names for similar concepts
- Follow the same tagging conventions throughout
- Match filename patterns across the bundle

**Optimize for navigation:**
- Create index files for directories with 3+ concepts
- Group related concepts in the same directory
- Use descriptive filenames that match titles

**Optimize for graph usefulness:**
- Keep concept pages information-focused and low-to-moderate degree
- Move broad lists of related concepts into `index.md`
- Introduce focused intermediate concepts instead of linking everything to generic hubs
- After building, run `graph --json` and inspect node/edge counts plus query neighborhoods
- If a radius-1 or radius-2 neighborhood returns most of the bundle, split hub concepts and remove broad reciprocal links

**Stay surgical:**
- When converting existing markdown, only add frontmatter
- Preserve the body content byte-for-byte when possible
- Don't rewrite or "improve" content unless explicitly asked

## Example Workflows

### Converting Existing Markdown Files

1. Glob for all markdown files: `**/*.md`
2. For each file:
   - Read the content
   - Check for existing frontmatter
   - Extract title from H1 or filename
   - Generate description from first paragraph or summary
   - Add timestamp (current time)
   - Infer tags from directory path or content
   - Write back with complete frontmatter
3. Create index files for each directory
4. Validate the bundle

### Building from Scratch

1. Understand the knowledge domain from user context
2. Design the directory structure
3. Choose consistent type vocabulary
4. For each concept:
   - Determine title, description, tags
   - Write frontmatter and body content
   - Cross-link to related concepts
5. Create index files
6. Validate the bundle

### Converting Documentation

1. Mirror the existing documentation structure
2. Map documentation types to OKF types:
   - "Tutorial" → `Tutorial`
   - "API Reference" → `API` or `Reference`
   - "Guide" → `Guide`
   - "README" → `Document` or `Overview`
3. Preserve existing cross-links and add new ones
4. Generate descriptions from existing summaries or first paragraphs
5. Create index files to match the navigation structure
6. Validate the bundle

## Limitations

**This skill assumes:**
- OKF bundles built as directory trees (no database/API)
- Markdown source content or text from agent context
- No external tools or connectors required
- Building locally in the workspace

**This skill does NOT:**
- Extract from databases (use connectors like okf-sqlite, okf-bigquery)
- Generate rich schema documentation (use okf-enricher after building)
- Validate bundles (use okf-validator)
- Sync to external systems (out of scope)

## Output

The result should be a valid OKF bundle ready for:
- Validation with okf-validator
- Enrichment with okf-enricher
- Ingestion into RAG systems
- Publishing as documentation

Tell the user:
- Where the bundle was created
- How many concepts were generated
- Suggest running okf-validator to check for issues
- Suggest running okf-enricher to add richer descriptions
