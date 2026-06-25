---
name: okf-validator
description: Validate Open Knowledge Format (OKF) bundles for spec compliance, checking frontmatter completeness, structural correctness, broken links, and metadata quality. Use when the user asks to "validate OKF", "check OKF bundle", "verify OKF spec compliance", "find OKF errors", or after building/modifying a bundle with okf-builder or okf-enricher. Reports issues with severity levels and actionable fixes.
---

# OKF Bundle Validator

This skill teaches an AI agent how to validate Open Knowledge Format (OKF) bundles against the OKF v0.1 specification and implementation requirements. It checks for spec compliance, metadata quality, structural issues, and broken links.

## When to Use

Use this skill when asked to:
- Validate, verify, or check an OKF bundle
- Find errors or issues in an OKF bundle
- Ensure spec compliance before publishing or ingestion
- Debug problems with OKF bundle structure

This skill pairs with:
- **okf-builder** - Validate after building a bundle
- **okf-enricher** - Validate after enrichment
- **okf-reader** - Use reader patterns for efficient bundle traversal

## What This Skill Validates

### 1. Frontmatter Requirements (Critical)

Each concept file must have valid YAML frontmatter with required fields:

**Required fields (spec-enforced via CLI `validate`):**
- `type` - Non-empty string (e.g., "Reference", "Document", "Guide")

**Strongly recommended fields (not enforced but expected by consumers):**
- `title` - Non-empty string, human-readable
- `description` - Non-empty string, one-sentence summary
- `timestamp` - Valid ISO 8601 datetime

**Common issues:**
- Missing frontmatter block (no `---` delimiters)
- Invalid YAML syntax
- Empty `type` field (the only hard requirement)
- Invalid timestamp format (not ISO 8601) - reported as warning

### 2. File Structure (Critical)

**Concept files:**
- UTF-8 encoded markdown
- YAML frontmatter between first two `---` markers
- Markdown body follows frontmatter
- `.md` extension

**Reserved filenames:**
- `index.md` - MUST NOT have frontmatter (navigation aid, not a concept)
- `log.md` - Optional, chronological update history

### 3. Cross-Links (Warning)

Links between concepts should be valid:

**Valid link forms:**
- Absolute (bundle-relative): `/path/to/concept.md`
- Relative: `./concept.md`, `../dir/concept.md`

**Issues to detect:**
- Broken links (target file does not exist)
- Malformed link syntax
- Links to non-markdown files (usually unintentional)

**Note:** Per the OKF spec, broken links are tolerated (may represent not-yet-written knowledge), so report them as warnings, not errors.

### 4. Metadata Quality (Warning)

**Description quality:**
- Not a placeholder (e.g., "No description available", "TODO")
- Not a restatement of the title
- Actually informative (more than just the type + title)

**Timestamp validity:**
- Proper ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ` or with timezone
- Reasonable date (not in the distant future, not before 1970)

**Type consistency:**
- Type names are descriptive (not "Unknown", "N/A")
- Similar concepts use consistent types

### 5. Index Files (Warning)

**Structure:**
- Plain markdown (no frontmatter)
- Contains markdown links to concepts or subdirectories
- Grouped under section headings (`##` or `###`)

**Issues:**
- Index has frontmatter (should not)
- Index links to non-existent files
- Directory with 3+ concepts has no index (navigation gap)

### 6. Coverage Metrics (Info)

**Measure:**
- Percentage of concepts with non-placeholder descriptions
- Percentage of concepts with valid types
- Number of broken links
- Number of orphan concepts (no links to or from)

### 7. Graph Usefulness (Warning/Info)

Spec-valid OKF can still be poor for retrieval if the graph is too dense. Check whether concept links create useful local neighborhoods or whether generic hubs pull in most of the bundle.

Watch for:
- Concept pages with very high outgoing or incoming link counts
- Broad concepts such as `watering`, `light`, `diagnosis`, `safety`, or `sources` linking across many categories
- Dense reciprocal links where A links to B and B links back only because they are generally related
- Query neighborhoods that include most concepts in the bundle
- Source/reference pages acting as internal graph hubs

Prefer this shape:
- `index.md` carries broad navigation links
- Generic overview concepts define scope with few graph edges
- Focused concepts carry causal, diagnostic, workflow, or dependency links
- Plant/domain profiles link to focused issue pages rather than generic care hubs

## Validation Procedure

### 1. Discover the Bundle

Follow **okf-reader** patterns for efficient traversal:

**Start at root:**
- Check for `index.md` - read it first if present
- Glob for concept files: `**/*.md` (excluding `index.md`, `log.md`)

**Never:**
- Recursively read all files at once (inefficient)
- Load file bodies when checking frontmatter only

### 2. Parse Frontmatter

For each concept file:

- Read frontmatter only (between first two `---` delimiters)
- Check valid YAML syntax
- Validate `type` field is present and non-empty
- Check `title`, `description`, `timestamp` presence (warn if missing)
- Validate timestamp is ISO 8601 if present: `YYYY-MM-DDTHH:MM:SS(Z|+HH:MM)`

### 3. Check Cross-Links

For each concept body, extract markdown links (`[text](url)`) and validate:
- Skip external URLs (`http://`, `https://`)
- Resolve absolute links (`/path/to/concept.md`) from bundle root
- Resolve relative links (`./concept.md`, `../dir/concept.md`) from current file
- Report broken links as warnings (target file doesn't exist)

### 4. Validate Index Files

For each `index.md`:
- Must NOT have frontmatter (navigation aid, not a concept)
- Should contain markdown links to concepts or subdirectories
- Warn for directories with 3+ concepts but no `index.md`

### 5. Evaluate Metadata Quality

**Description quality:**
- Warn for placeholders: empty, "TODO", "No description", restated title
- Warn if description just repeats `type + title`

**Type consistency:**
- Collect all unique types; warn about single-use types (possible typos)


### 6. Build Coverage Report

Calculate and report:
- Total concepts in bundle
- Concepts with valid (non-placeholder) descriptions
- Concepts missing recommended fields (`title`, `description`, `timestamp`)
- Broken link count
- Orphan concepts (no incoming or outgoing links)
- Directories missing `index.md`
- Coverage percentage: `(validDescriptions / totalConcepts) * 100`

### 7. Check Graph Density

Use the CLI graph command after spec validation:

```bash
bun run src/index.ts -- graph --json <bundle-path>
```

Inspect:
- Total nodes and edges
- Nodes with unusually many incoming or outgoing links
- Whether generic concepts dominate edge lists

Then test at least one realistic query if the bundle is intended for retrieval:

```bash
bun run src/index.ts query <bundle-path> "realistic user question"
```

If the query subgraph approaches the full graph, report this as a graph design warning. Suggest splitting broad concepts into focused concepts and moving broad navigation links to `index.md`.

## Issue Severity Levels

**Critical (Must Fix):**
- Missing required frontmatter fields
- Invalid YAML syntax
- Invalid timestamp format
- Concept file without frontmatter
- `index.md` with frontmatter (spec violation)

**Warning (Should Fix):**
- Broken links
- Placeholder descriptions
- Inconsistent type names
- Directory without index (3+ concepts)
- Description duplicates title
- Over-connected concept hubs that make local graph neighborhoods too broad
- Broad navigation links embedded in concept files instead of `index.md`

**Info (Nice to Have):**
- Low coverage metrics
- Orphan concepts (isolated, no links)
- Single-use types (potential typos)
- Non-standard frontmatter fields (allowed, but note them)
- Candidate concept splits for pages with many unrelated outgoing links

## Validation Output Format

Report issues grouped by severity:

### Critical Errors

```
❌ concepts/user-guide.md
  - Missing required field: description
  - Invalid timestamp: "2026-06-32T25:00:00Z"

❌ references/index.md
  - Index file has frontmatter (must be plain markdown)
```

### Warnings

```
⚠️  concepts/api-reference.md
  - Broken link: /guides/authentication.md (target not found)
  - Placeholder description: "TODO: Add description"

⚠️  documents/
  - Directory has 5 concepts but no index.md
```

### Coverage Metrics

```
📊 Bundle Statistics:
  - Total concepts: 42
  - Valid descriptions: 38 (90.5%)
  - Placeholder descriptions: 4 (9.5%)
  - Broken links: 3
  - Orphan concepts: 2
  - Missing indexes: 1

✅ Coverage: 90.5%
```

### Summary

```
Bundle validation: ⚠️  PASSED WITH WARNINGS
  - 2 critical errors (must fix)
  - 5 warnings (should fix)
  - Bundle is 90.5% complete
```

## Efficient Validation Patterns

- **Frontmatter-only pass first:** Read just the YAML block (stop at second `---`), validate fields without loading bodies
- **Batch by check type:** All frontmatter checks first, then cross-links (needs full file list), then coverage
- **Use Grep:** `grep -r "TODO\|No description" --include="*.md"` for placeholder scanning
- **Use the CLI first:** `bun run src/index.ts -- validate --json <path>` for spec-level validation, then layer quality checks on top

## Integration with CLI Tool

The `apps/cli` tool validates bundles. Run from the `apps/cli` directory:

```bash
# Basic validation (human-readable output)
bun run src/index.ts -- validate <bundle-path>

# JSON output for programmatic use
bun run src/index.ts -- validate --json <bundle-path>

# View bundle graph (confirms cross-links work)
bun run src/index.ts -- graph <bundle-path>

# JSON graph output for edge-count inspection
bun run src/index.ts -- graph --json <bundle-path>

# Query-time neighborhood sanity check
bun run src/index.ts query <bundle-path> "example domain question"

# View a specific concept
bun run src/index.ts -- concept <bundle-path> <concept-id>
```

**JSON output format:**
```json
{
  "bundle": "/path/to/bundle",
  "valid": true,
  "issues": [
    { "severity": "error", "message": "...", "path": "..." },
    { "severity": "warning", "message": "...", "path": "..." }
  ]
}
```

**What the CLI checks:**
- `type` field is present and non-empty on all concept files
- YAML frontmatter is valid and parseable
- ISO 8601 timestamps (when present) are well-formed
- `resource` URIs (when present) are valid format
- Internal links resolve to existing files (warnings for broken links)
- `index.md` at root has no frontmatter (unless at bundle root with `okf_version`)
- `log.md` has no frontmatter

**What the CLI does NOT check (this skill adds):**
- Description quality (placeholders, duplicated titles)
- Coverage metrics (percentage with descriptions)
- Type consistency across the bundle
- Missing index files for directories

## Quality Guidelines

**Be thorough:**
- Check every concept file in the bundle
- Don't skip validation steps for speed
- Report all issues found (grouped by severity)

**Be helpful:**
- Explain WHY each issue matters
- Provide actionable fix suggestions
- Reference the OKF spec section when relevant

**Be efficient:**
- Use okf-reader patterns (index-first, frontmatter-only)
- Batch checks when possible
- Use Grep for bundle-wide searches

**Be accurate:**
- Parse YAML properly (don't regex)
- Handle edge cases (malformed files, empty bundles)
- Distinguish errors from warnings correctly

## Example Validation Workflow

1. **Discover:** Glob for all `.md` files, note `index.md` locations
2. **Parse:** For each concept, extract and validate frontmatter
3. **Link check:** For each concept, extract and validate markdown links
4. **Index check:** For each directory, check if index exists and is valid
5. **Quality check:** Evaluate description quality, type consistency
6. **Report:** Output issues grouped by severity, with coverage metrics
7. **Summary:** Give user actionable next steps

## Limitations

**This skill:**
- Validates directory-based OKF bundles (local files)
- Checks spec compliance per OKF v0.1
- Focuses on structural and metadata validation

**This skill does NOT:**
- Fix issues automatically (reports only)
- Validate semantic correctness (e.g., if descriptions accurately reflect content)
- Check for duplicate concepts
- Validate resource URIs (only checks they're present if specified)

## Output to User

After validation, tell the user:

1. **Status:** Did validation pass, pass with warnings, or fail?
2. **Critical issues:** What must be fixed (with file paths)
3. **Warnings:** What should be fixed
4. **Coverage:** How complete is the bundle?
5. **Next steps:** Suggest fixes or tools (okf-builder, okf-enricher)

**Example:**
```
Validated bundle at ./knowledge-base/

✅ Validation passed with 2 warnings.

⚠️  Warnings:
  - documents/setup-guide.md: Broken link to /guides/install.md
  - references/api.md: Description is a placeholder

📊 Coverage: 95% (38/40 concepts with valid descriptions)

Next steps:
  - Fix the broken link in setup-guide.md
  - Run okf-enricher to improve placeholder descriptions
```
