import type { Graph } from "effect";
import { Schema, SchemaGetter } from "effect";

export const ConceptLink = Schema.TaggedUnion({
  internal: {
    target: Schema.String,
    label: Schema.String,
  },
  external: {
    target: Schema.String,
    label: Schema.String,
  },
  broken: {
    target: Schema.String,
  },
});

export type ConceptLink = typeof ConceptLink.Type;

/** Accept both YAML arrays and comma-separated strings, normalize to array */
const Tags = Schema.Union([
  Schema.Array(Schema.String),
  Schema.String.pipe(
    Schema.decodeTo(Schema.Array(Schema.String), {
      decode: SchemaGetter.transform((s: string) =>
        s
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      ),
      encode: SchemaGetter.transform((arr: ReadonlyArray<string>) =>
        arr.join(", "),
      ),
    }),
  ),
]);

export const ConceptFrontmatter = Schema.Struct({
  type: Schema.NonEmptyString.annotate({
    description: "Kind of concept — MUST be non-empty (OKF §4.1, §9)",
  }),
  title: Schema.optional(
    Schema.String.annotate({ description: "Human-readable title (OKF §4.1)" }),
  ),
  description: Schema.optional(
    Schema.String.annotate({
      description: "Brief summary of the concept (OKF §4.1)",
    }),
  ),
  resource: Schema.optional(
    Schema.String.annotate({
      description: "URI identifying the underlying asset (OKF §4.1)",
    }),
  ),
  tags: Schema.optional(Tags),
  timestamp: Schema.optional(
    Schema.String.annotate({
      description: "ISO 8601 datetime (OKF §4.1)",
    }),
  ),
});

export type ConceptFrontmatter = typeof ConceptFrontmatter.Type;

export const Concept = Schema.Struct({
  id: Schema.String,
  path: Schema.String,
  frontmatter: ConceptFrontmatter,
  body: Schema.String,
  links: Schema.Array(ConceptLink),
});

export type Concept = typeof Concept.Type;

export const IndexFile = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
  version: Schema.optional(Schema.String),
});

export type IndexFile = typeof IndexFile.Type;

export const IndexFrontmatter = Schema.Struct({
  version: Schema.optional(Schema.String),
});

export type IndexFrontmatter = typeof IndexFrontmatter.Type;

export const LogFile = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
});

export type LogFile = typeof LogFile.Type;

export const Bundle = Schema.Struct({
  root: Schema.String,
  concepts: Schema.Array(Concept),
  indexFiles: Schema.Array(IndexFile),
  logFiles: Schema.Array(LogFile),
  version: Schema.optional(Schema.String),
});

export type Bundle = typeof Bundle.Type;

export const ConceptNode = Schema.Struct({
  id: Schema.String,
  path: Schema.String,
  type: Schema.String,
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  resource: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
});

export type ConceptNode = typeof ConceptNode.Type;

export const ConceptEdge = Schema.Struct({
  kind: Schema.Literals(["concept-link", "parent-child", "citation"]),
  sourceId: Schema.String,
  targetId: Schema.String,
  label: Schema.optional(Schema.String),
});

export type ConceptEdge = typeof ConceptEdge.Type;

export const UnresolvedLink = Schema.Struct({
  sourceId: Schema.String,
  targetId: Schema.String,
  label: Schema.optional(Schema.String),
});

export type UnresolvedLink = typeof UnresolvedLink.Type;

export type OkfGraph = {
  readonly graph: Graph.DirectedGraph<ConceptNode, ConceptEdge>;
  readonly nodeIndex: Map<string, Graph.NodeIndex>;
  readonly unresolvedLinks: ReadonlyArray<UnresolvedLink>;
};

export const ValidationIssueSource = Schema.Literals([
  "concept",
  "index",
  "log",
  "graph",
  "bundle",
]);

export type ValidationIssueSource = typeof ValidationIssueSource.Type;

export const ValidationIssue = Schema.Struct({
  id: Schema.String,
  source: ValidationIssueSource,
  reason: Schema.String,
  severity: Schema.Literals(["error", "warning"]),
});

export type ValidationIssue = typeof ValidationIssue.Type;

export const ValidationResult = Schema.Struct({
  valid: Schema.Boolean,
  issues: Schema.Array(ValidationIssue),
});

export type ValidationResult = typeof ValidationResult.Type;

export const OkfSourceInput = Schema.TaggedUnion({
  Local: {
    input: Schema.String,
    path: Schema.String,
  },
  Git: {
    input: Schema.String,
    repoUrl: Schema.String,
    ref: Schema.String,
    subpath: Schema.String,
  },
});

export type OkfSourceInput = typeof OkfSourceInput.Type;

export const ResolvedOkfSource = Schema.Struct({
  input: Schema.String,
  bundlePath: Schema.String,
  source: OkfSourceInput,
  checkoutPath: Schema.optional(Schema.String),
  commit: Schema.optional(Schema.String),
});

export type ResolvedOkfSource = typeof ResolvedOkfSource.Type;
