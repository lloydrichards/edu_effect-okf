---
name: okf-enricher
description: Enrich an Open Knowledge Format (OKF) bundle by improving descriptions, adding cross-links, and suggesting tags — using the agent's own LLM grounded in the bundle's content. Use when asked to "enrich OKF", "improve OKF descriptions", "add descriptions to OKF", "document OKF bundle", or when a bundle has missing, weak, or placeholder descriptions. Instructions-only; no binary required.
---

# OKF Bundle Enricher

This skill teaches an AI agent how to enrich an Open Knowledge Format (OKF) bundle — improving descriptions, adding cross-links between concepts, and suggesting tags — using the agent's own LLM grounded in the bundle's content.

There is no embedded model or binary. The agent already has an LLM in the loop; this skill provides the procedure and quality bar for generating good descriptions from existing content.

## When to Use

Load this skill when asked to:
- Enrich, document, describe, or annotate an OKF bundle
- Improve placeholder or weak descriptions
- Add cross-links between related concepts
- Suggest tags for classification

Pairs with:
- **okf-builder** - Build the bundle first, then enrich
- **okf-validator** - Validate after enrichment

## The Target: What You're Writing

Each OKF concept is a markdown file with YAML frontmatter. The enrichment targets are:

1. **`description` field** (primary) - The one-sentence summary in frontmatter
2. **Cross-links** (secondary) - Markdown links between related concepts
3. **Tags** (tertiary) - Classification tags in frontmatter

```yaml
---
type: Reference
title: Authentication Flow
description: ""              # <- Your primary target
timestamp: 2026-06-22T10:00:00Z
tags: []                     # <- Secondary target
---

# Authentication Flow

...body content with potential [cross-links](/path/to/other.md)...
```

## Procedure

### 1. Discover Concepts (Index-First)

Follow okf-reader patterns — efficient traversal, not brute-force:

- Read `index.md` first if present
- Use it to locate concept files
- Do NOT recursively read the whole bundle
- Use Grep for targeted lookups when needed

### 2. Triage — What Needs Enrichment?

Enrich a concept when its `description` is:
- Empty (`""` or missing)
- A placeholder (`"No description available"`, `"TODO"`)
- A restatement of type + title (`"Reference: Authentication Flow"`)

**Do NOT overwrite** a substantive, human-authored description unless explicitly asked to regenerate.

**Priority order** (spend tokens on the most valuable first):
1. Hub concepts — linked to by many others
2. Top-level concepts — in root or first-level directories
3. Concepts with empty descriptions
4. Concepts with placeholder descriptions

### 3. Gather Grounding (Never Guess)

Base every claim on evidence in the document. Read the concept file and ground your description in:

**Body content:**
- Headings reveal structure and topics covered
- Code blocks show implementation details
- Lists enumerate steps, items, or properties
- Tables describe schemas or comparisons

**Cross-links in body:**
- Links to other concepts reveal relationships
- Section headings near links indicate relationship type
- Markdown link titles encode explicit graph relations when present

**Frontmatter context:**
- `type` tells you the concept category
- `title` tells you the subject
- `tags` (if present) indicate domain

**Sibling concepts:**
- Other files in the same directory share context
- Use Grep to find related concepts without reading everything

### 4. Write the Description

**Format:** One sentence that captures what the concept represents and its purpose.

**Pattern:** "What it is" + "what it's for" or "how it relates"

**Examples:**

Good:
```yaml
description: Step-by-step guide for setting up JWT-based authentication with refresh token rotation.
```

Bad (just restates title):
```yaml
description: Authentication setup guide.
```

Good:
```yaml
description: One record per user session, tracking login time, device fingerprint, and session expiry for access control.
```

Bad (too vague):
```yaml
description: Contains session data.
```

**Rules:**
- **Ground every claim** in the document content — don't invent meaning
- **Add information** the title alone doesn't convey
- **Be concise** — one sentence, not a paragraph
- **State the grain** where applicable (what one record/item represents)
- **Note the purpose** — why this concept exists or how it's used
- If the purpose is genuinely ambiguous, describe the structure and note uncertainty

### 5. Add Cross-Links (Optional)

If concepts are clearly related but not yet linked:

**When to add links:**
- Concept A references a topic covered in Concept B
- Parent/child relationships exist but aren't linked
- A guide references an API that has its own concept file

**How to add links:**
- Use bundle-relative paths: `/path/to/concept.md`
- Add links naturally in prose (not as a bare list)
- Place in context where the relationship is relevant
- Add a markdown link title when the relationship type is clear

**Example:**
```markdown
This authentication flow uses the [JWT Token Format](/references/jwt-format.md)
and integrates with the [User Service](/services/user-service.md).
```

**Semantic relationship example:**
```markdown
This diagnostic route [depends on](/care/soil-moisture-check.md "depends on")
the soil moisture check before recommending a watering change.
```

The title string becomes graph edge `relation` metadata. The relation should
read from the current concept to the linked concept:

```text
current concept --relation--> linked concept
```

Prefer concise phrases such as `child of`, `part of`, `requires`, `depends on`,
`caused by`, `diagnosed by`, `treated by`, `prevents`, `symptom of`,
`example of`, and `contrasts with`.

**Do NOT:**
- Add links to non-existent concepts (broken links)
- Add redundant links (already present)
- Create a "Related" section with bare links (prefer inline)
- Invent link-title relations when the content only supports a loose mention

### 6. Suggest Tags (Optional)

Add classification tags to aid search and filtering:

**Tag categories:**
- Domain: `authentication`, `data-modeling`, `api`
- Content type: `guide`, `reference`, `tutorial`
- Technology: `typescript`, `effect`, `chromadb`
- Cross-cutting: `security`, `performance`, `testing`

**Rules:**
- Add tags to the existing set (union, deduplicated, sorted)
- Never remove or reorder existing tags
- Keep to 3-7 tags per concept
- Use lowercase, hyphenated format
- Be conservative — only tag with high confidence

### 7. Write Back Surgically

**Only modify:**
- The `description` field in frontmatter
- The `tags` field (additions only, sorted)
- Cross-links in the body (additions only)

**Never modify:**
- `type`, `title`, `timestamp`, `resource` fields
- Existing body content (headings, paragraphs, code blocks)
- `index.md` or `log.md`
- Other concepts' files (unless enriching them too)

**Preserve byte-for-byte:**
- All existing markdown structure
- All existing cross-links
- All existing tags (append new ones)

### 8. Batch by Directory

Enrich a whole directory in one pass rather than file-by-file:

1. Read the directory's index to understand the group
2. Read frontmatter of all concepts in the directory
3. Write descriptions for all of them together
4. This keeps wording consistent within related groups

## Quality Rules (Summary)

1. **Ground, don't guess** — every claim backed by document evidence
2. **One field, surgical edits** — touch `description` and optionally `tags`; preserve everything else
3. **Concise and purposeful** — grain + purpose, never a restated schema
4. **Idempotent** — safe to re-run; don't overwrite substantive descriptions
5. **Consistent** — similar concepts get similar description styles

## Cost & Token Efficiency

Since the LLM in the loop is the cost center:

**Skip what's done:**
- If description is already substantive, don't regenerate
- Focus on empty/placeholder descriptions only

**Batch reads:**
- Read frontmatter-only for triage (don't load full bodies)
- Process directories as groups, not individual files
- Use Grep for targeted searches instead of reading everything

**Reuse patterns:**
- If you write a good description for one concept, use the same style for similar ones
- Establish a pattern in the first few descriptions and follow it

## Example Enrichment

**Before:**
```yaml
---
type: Document
title: Effect Error Handling
description: ""
timestamp: 2026-06-22T10:00:00Z
tags: [effect]
---

# Effect Error Handling

## Using the Error Channel

Effect uses a typed error channel instead of try/catch...

## Custom Error Types

Define errors using Data.TaggedError...

## Recovery Patterns

Use Effect.catchTag for selective recovery...
```

**After:**
```yaml
---
type: Document
title: Effect Error Handling
description: Guide to typed error handling in Effect, covering the error channel, custom error types with Data.TaggedError, and selective recovery using catchTag.
timestamp: 2026-06-22T10:00:00Z
tags: [effect, error-handling, typescript]
---
```

Body unchanged. Only `description` and `tags` were modified.

## Limitations

**This skill assumes:**
- OKF bundles as local directory trees
- Content is markdown (not databases or APIs)
- Agent has LLM capability for generating descriptions
- Bundle was built by okf-builder or equivalent

**This skill does NOT:**
- Sync descriptions back to external systems
- Generate descriptions from raw data (needs structured content)
- Validate the bundle (use okf-validator)
- Build bundles from scratch (use okf-builder)

## Output to User

After enrichment, report:

1. **What was enriched:** How many concepts had descriptions added/improved
2. **What was skipped:** How many already had good descriptions
3. **Coverage change:** Before and after percentages
4. **Suggest next steps:** Run okf-validator, review descriptions

**Example:**
```
Enriched bundle at ./knowledge-base/

📝 Enriched: 12 concepts (added descriptions)
⏭️  Skipped: 28 concepts (already had good descriptions)
🏷️  Tags added: 8 concepts received new tags
🔗 Cross-links: 5 new links added

📊 Coverage: 70% → 100% (40/40 concepts with descriptions)

Next steps:
  - Run okf-validator to check the bundle
  - Review descriptions in concepts/api/ (most changes there)
```
