import {
  type Bundle,
  type Concept,
  ConceptEdge,
  ConceptFrontmatter,
  ConceptLink,
  type ConceptNode,
  ConceptNode as ConceptNodeSchema,
  type IndexFile,
  type LogFile,
  type ValidationResult,
} from "@repo/domain/Okf";
import {
  Array as Arr,
  Context,
  Data,
  Effect,
  FileSystem,
  Graph,
  Layer,
  Match,
  Option,
  Path,
  pipe,
  Result,
  Schema,
  String as Str,
} from "effect";
import {
  MarkdownParseError,
  MarkdownService,
  type RawLink,
} from "./MarkdownService";

export class BundleNotFound extends Data.TaggedError("BundleNotFound")<{
  path: string;
}> {}

export class BundleInvalid extends Data.TaggedError("BundleInvalid")<{
  path: string;
  issues: ReadonlyArray<{
    file: string;
    reason: string;
  }>;
}> {}

const RESERVED_NAMES = new Set(["index.md", "log.md"]);

export class OkfService extends Context.Service<OkfService>()(
  "@repo/OkfService",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const md = yield* MarkdownService;

      const parentDir = (id: string) =>
        pipe(
          id,
          Str.lastIndexOf("/"),
          Option.map((i) => Str.slice(0, i)(id)),
          Option.getOrElse(() => ""),
        );

      const classifyLink =
        (conceptId: string, knownIds: ReadonlySet<string>) =>
        (link: RawLink) => {
          if (/^https?:\/\//.test(link.target)) {
            return ConceptLink.cases.external.make({
              target: link.target,
              label: link.label,
            });
          }
          const relativeTarget = link.target.startsWith("/")
            ? link.target.slice(1)
            : path.join(parentDir(conceptId), link.target);
          const resolvedId = pipe(relativeTarget, Str.replace(/\.md$/, ""));
          return knownIds.has(resolvedId)
            ? ConceptLink.cases.internal.make({
                target: resolvedId,
                label: link.label,
              })
            : ConceptLink.cases.broken.make({ target: resolvedId });
        };

      const validateIndexFile = Effect.fn("validateIndexFile")(function* (
        rel: string,
        content: string,
      ) {
        const parsed = yield* md.parse(content);

        if (Option.isNone(parsed.frontmatter)) {
          return { path: rel, content } satisfies IndexFile;
        }

        if (rel !== "index.md") {
          return yield* new MarkdownParseError({
            reason: "Frontmatter is only permitted in the bundle-root index.md",
          });
        }

        if (
          typeof parsed.frontmatter.value !== "object" ||
          parsed.frontmatter.value === null ||
          Array.isArray(parsed.frontmatter.value)
        ) {
          return yield* new MarkdownParseError({
            reason: "Root index frontmatter must be a YAML object",
          });
        }

        const invalidKeys = Object.keys(parsed.frontmatter.value).filter(
          (key) => key !== "okf_version",
        );

        if (Arr.isArrayNonEmpty(invalidKeys)) {
          return yield* new MarkdownParseError({
            reason: `Unsupported root index frontmatter keys: ${invalidKeys.join(", ")}`,
          });
        }

        return yield* Schema.decodeUnknownEffect(
          Schema.Struct({ okf_version: Schema.optional(Schema.String) }),
        )(parsed.frontmatter.value).pipe(
          Effect.map(({ okf_version }) => ({
            path: rel,
            content,
            ...(okf_version ? { version: okf_version } : {}),
          })),
          Effect.mapError(
            (error) => new MarkdownParseError({ reason: String(error) }),
          ),
        );
      });

      const validateLogFile = Effect.fn("validateLogFile")(function* (
        rel: string,
        content: string,
      ) {
        const parsed = yield* md.parseDocument(content);

        if (Option.isSome(parsed.frontmatter)) {
          return yield* new MarkdownParseError({
            reason: "Frontmatter is not permitted in log.md",
          });
        }

        const invalidDateHeading = pipe(
          parsed.document.blocks,
          Arr.findFirst(
            (block) =>
              block._tag === "Heading" &&
              block.level === 2 &&
              !/^\d{4}-\d{2}-\d{2}$/.test(
                block.children
                  .filter((child) => child._tag === "Text")
                  .map((child) => child.value)
                  .join("")
                  .trim(),
              ),
          ),
        );

        if (Option.isSome(invalidDateHeading)) {
          return yield* new MarkdownParseError({
            reason: "Log date headings must use ISO 8601 YYYY-MM-DD format",
          });
        }

        return { path: rel, content } satisfies LogFile;
      });

      const loadBundle = Effect.fn("loadBundle")(function* (
        bundlePath: string,
      ) {
        // 1. Verify path exists and is a directory
        const pathNorm = path.normalize(bundlePath);
        yield* fs.exists(pathNorm);

        yield* fs
          .stat(pathNorm)
          .pipe(
            Effect.flatMap(({ type }) =>
              type !== "Directory"
                ? Effect.fail(new BundleNotFound({ path: bundlePath }))
                : Effect.succeed("Directory"),
            ),
          );

        // 2. Walk the directory tree for .md files
        const mdFiles = yield* fs
          .readDirectory(pathNorm, { recursive: true })
          .pipe(Effect.map(Arr.filter((e) => e.endsWith(".md"))));

        // 3. Partition reserved files from concept files
        const [conceptFiles, reservedFiles] = Arr.partition(mdFiles, (rel) =>
          RESERVED_NAMES.has(path.basename(rel))
            ? Result.succeed(rel)
            : Result.fail(rel),
        );

        // 4. Parse reserved files
        const reservedEntries = yield* Effect.forEach(
          reservedFiles,
          Effect.fn(function* (rel) {
            const content = yield* fs.readFileString(
              `${pathNorm}/${rel}`,
              "utf-8",
            );
            return { rel, content, basename: path.basename(rel) };
          }),
        );

        const [logEntries, indexEntries] = Arr.partition(
          reservedEntries,
          (entry) =>
            entry.basename === "index.md"
              ? Result.succeed(entry)
              : Result.fail(entry),
        );

        const indexResults = yield* Effect.forEach(
          indexEntries,
          ({ rel, content }) =>
            validateIndexFile(rel, content).pipe(
              Effect.map((file) => Result.succeed(file)),
              Effect.catchTag("MarkdownParseError", (error) =>
                Effect.succeed(
                  Result.fail({ file: rel, reason: error.reason }),
                ),
              ),
            ),
        );

        const logResults = yield* Effect.forEach(
          logEntries,
          ({ rel, content }) =>
            validateLogFile(rel, content).pipe(
              Effect.map((file) => Result.succeed(file)),
              Effect.catchTag("MarkdownParseError", (error) =>
                Effect.succeed(
                  Result.fail({ file: rel, reason: error.reason }),
                ),
              ),
            ),
        );

        const [indexIssues, indexFiles] = Arr.partition(indexResults, (r) => r);
        const [logIssues, logFiles] = Arr.partition(logResults, (r) => r);

        // 5. Parse each concept file -- single parse gets frontmatter, body, AND links
        const parseResults = yield* Effect.forEach(conceptFiles, (rel) =>
          Effect.gen(function* () {
            const raw = yield* fs.readFileString(`${pathNorm}/${rel}`, "utf-8");

            return yield* Effect.gen(function* () {
              const parsed = yield* md.parse(raw);
              if (Option.isNone(parsed.frontmatter)) {
                return yield* new MarkdownParseError({
                  reason: "No frontmatter found",
                });
              }
              const frontmatter = yield* Schema.decodeUnknownEffect(
                ConceptFrontmatter,
              )(parsed.frontmatter.value).pipe(
                Effect.mapError(
                  (e) => new MarkdownParseError({ reason: String(e) }),
                ),
              );
              return Result.succeed({
                id: pipe(rel, Str.replace(/\.md$/, "")),
                path: rel,
                frontmatter,
                body: parsed.body,
                links: parsed.links,
              });
            }).pipe(
              Effect.catchTag("MarkdownParseError", (e) =>
                Effect.succeed(Result.fail({ file: rel, reason: e.reason })),
              ),
            );
          }),
        );

        const [conceptIssues, parsedConcepts] = Arr.partition(
          parseResults,
          (r) => r,
        );
        const issues = [...indexIssues, ...logIssues, ...conceptIssues];

        // Fail fast on conformance issues
        if (Arr.isArrayNonEmpty(issues)) {
          return yield* new BundleInvalid({ path: bundlePath, issues });
        }

        // 6. Classify links (already extracted during parse)
        const knownIds = new Set(Arr.map(parsedConcepts, (c) => c.id));

        const concepts: ReadonlyArray<Concept> = Arr.map(
          parsedConcepts,
          (c) => ({
            ...c,
            links: Arr.map(c.links, classifyLink(c.id, knownIds)),
          }),
        );

        // 7. Extract version from root index file if present
        const rootVersion = Arr.findFirst(
          indexFiles,
          (f) => f.path === "index.md",
        ).pipe(
          Option.flatMap((idx) => Option.fromNullishOr(idx.version)),
          Option.getOrUndefined,
        );

        return {
          root: bundlePath,
          concepts,
          indexFiles,
          logFiles,
          ...(rootVersion ? { version: rootVersion } : {}),
        };
      });

      const buildGraph = Effect.fn("buildGraph")(function* (bundle: Bundle) {
        // Derive node data
        const nodes = Arr.map(bundle.concepts, (c) => ({
          id: c.id,
          data: Schema.decodeUnknownSync(ConceptNodeSchema)({
            id: c.id,
            path: c.path,
            type: c.frontmatter.type,
            tags: c.frontmatter.tags ?? [],
            title: c.frontmatter.title,
            description: c.frontmatter.description,
            resource: c.frontmatter.resource,
          }),
        }));

        // Flatten all links with their source concept
        const allLinks = Arr.flatMap(bundle.concepts, (c) =>
          Arr.map(c.links, (link) => ({ sourceId: c.id, link })),
        );

        const edgeIntents = pipe(
          allLinks,
          Arr.map(({ sourceId, link }) =>
            pipe(
              Match.value(link).pipe(
                Match.tag("internal", ({ label, target }) =>
                  Option.some({ targetId: target, label }),
                ),
                Match.orElse(() => Option.none()),
              ),
              Option.map((intent) => ({ sourceId, ...intent })),
            ),
          ),
          Arr.getSomes,
        );

        const unresolvedLinks = pipe(
          allLinks,
          Arr.map(({ sourceId, link }) =>
            pipe(
              Match.value(link).pipe(
                Match.tag("broken", ({ target }) =>
                  Option.some({ targetId: target }),
                ),
                Match.orElse(() => Option.none()),
              ),
              Option.map((unresolved) => ({ sourceId, ...unresolved })),
            ),
          ),
          Arr.getSomes,
        );

        // Build graph from derived data
        const nodeIndex = new Map<string, Graph.NodeIndex>();

        const graph = Graph.directed<ConceptNode, ConceptEdge>((mutable) => {
          for (const node of nodes) {
            nodeIndex.set(node.id, Graph.addNode(mutable, node.data));
          }

          for (const intent of edgeIntents) {
            const sourceIdx = nodeIndex.get(intent.sourceId);
            const targetIdx = nodeIndex.get(intent.targetId);
            if (sourceIdx === undefined || targetIdx === undefined) continue;

            Graph.addEdge(
              mutable,
              sourceIdx,
              targetIdx,
              Schema.decodeUnknownSync(ConceptEdge)({
                kind: "concept-link",
                ...intent,
              }),
            );
          }
        });

        return { graph, nodeIndex, unresolvedLinks };
      });

      return {
        make: Effect.fn("make")(function* (bundlePath: string) {
          const bundle = yield* loadBundle(bundlePath).pipe(
            Effect.catchTag(
              "PlatformError",
              () => new BundleNotFound({ path: bundlePath }),
            ),
          );
          const graph = yield* buildGraph(bundle);

          return {
            bundle,
            graph,
          } as const;
        }),
        validate: Effect.fn("validate")(function* (bundlePath: string) {
          const bundle = yield* loadBundle(bundlePath).pipe(
            Effect.catchTag(
              "PlatformError",
              () => new BundleNotFound({ path: bundlePath }),
            ),
          );
          const graph = yield* buildGraph(bundle);

          const issues = Arr.map(graph.unresolvedLinks, (link) => ({
            id: `${link.sourceId}->${link.targetId}`,
            source: "graph" as const,
            reason: `Broken internal link from ${link.sourceId} to ${link.targetId}`,
            severity: "error" as const,
          }));

          return {
            valid: issues.length === 0,
            issues,
          } satisfies ValidationResult;
        }),
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(MarkdownService.layer),
  );
}
