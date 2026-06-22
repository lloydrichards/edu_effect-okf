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

**When to cross-link:**
- Parent/child relationships (document → section)
- Dependencies (guide references API docs)
- Related concepts (alternative approaches, comparisons)

**Broken links are tolerated** - link to not-yet-written concepts when appropriate.

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
- Include cross-links to related concepts

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
