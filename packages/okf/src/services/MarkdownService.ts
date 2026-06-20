import { Context, Data, Effect, Layer, Option } from "effect";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import YAML from "yaml";

export class MarkdownParseError extends Data.TaggedError("MarkdownParseError")<{
  reason: string;
}> {}

export interface RawLink {
  readonly label: string;
  readonly target: string;
}

/** Recursively extract plain text from an mdast node */
const extractText = (node: unknown): string => {
  if (node == null || typeof node !== "object") return "";
  const n = node as { value?: unknown; children?: unknown };
  if (typeof n.value === "string") return n.value;
  if (Array.isArray(n.children))
    return (n.children as Array<unknown>).map(extractText).join("");
  return "";
};

export class MarkdownService extends Context.Service<MarkdownService>()(
  "@repo/MarkdownService",
  {
    make: Effect.gen(function* () {
      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"]);

      /**
       * Parse raw markdown into frontmatter, body text, and links
       * in a single AST pass.
       *
       * - Frontmatter is `Option.none()` when no YAML block exists.
       * - Fails with `MarkdownParseError` on malformed YAML.
       * - Links are extracted via AST traversal (ignores code blocks).
       */
      const parse = (raw: string) =>
        Effect.gen(function* () {
          const tree = yield* Effect.try({
            try: () => processor.parse(raw),
            catch: (error) =>
              new MarkdownParseError({
                reason: error instanceof Error ? error.message : String(error),
              }),
          });

          // Extract frontmatter
          const yamlNode = tree.children.find((n) => n.type === "yaml");

          const frontmatter: Option.Option<unknown> =
            yamlNode && "value" in yamlNode
              ? Option.some(
                  yield* Effect.try({
                    try: () => YAML.parse(yamlNode.value as string),
                    catch: (error) =>
                      new MarkdownParseError({
                        reason:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      }),
                  }),
                )
              : Option.none();

          const body = yamlNode?.position
            ? raw.slice(yamlNode.position.end.offset).trimStart()
            : raw;

          // Extract links
          const links: Array<RawLink> = [];
          visit(tree, "link", (node) => {
            links.push({ label: extractText(node), target: node.url });
          });

          return { frontmatter, body, links };
        });

      return { parse } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
