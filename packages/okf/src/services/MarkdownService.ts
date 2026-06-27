import {
  MarkdownBlock,
  type MarkdownDocument,
  MarkdownInline,
} from "@repo/domain/Markdown";
import {
  Array as Arr,
  Context,
  Data,
  Effect,
  Layer,
  Match,
  Option,
  pipe,
} from "effect";
import type {
  Link,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  Yaml,
} from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";
import YAML from "yaml";

export class MarkdownParseError extends Data.TaggedError("MarkdownParseError")<{
  reason: string;
}> {}

export interface RawLink {
  readonly label: string;
  readonly target: string;
  readonly title?: string | undefined;
}

export interface ParsedMarkdown {
  readonly frontmatter: Option.Option<unknown>;
  readonly body: string;
  readonly links: ReadonlyArray<RawLink>;
}

export interface ParsedMarkdownDocument extends ParsedMarkdown {
  readonly document: MarkdownDocument;
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

const mapInline = (node: PhrasingContent): ReadonlyArray<MarkdownInline> =>
  Match.value(node).pipe(
    Match.when({ type: "text" }, (n) => [
      MarkdownInline.cases.Text.make({ value: n.value }),
    ]),
    Match.when({ type: "break" }, () => [MarkdownInline.cases.Break.make({})]),
    Match.when({ type: "inlineCode" }, (n) => [
      MarkdownInline.cases.InlineCode.make({ value: n.value }),
    ]),
    Match.when({ type: "emphasis" }, (n) => [
      MarkdownInline.cases.Emphasis.make({
        children: mapInlines(n.children),
      }),
    ]),
    Match.when({ type: "strong" }, (n) => [
      MarkdownInline.cases.Strong.make({
        children: mapInlines(n.children),
      }),
    ]),
    Match.when({ type: "delete" }, (n) => [
      MarkdownInline.cases.Delete.make({
        children: mapInlines(n.children),
      }),
    ]),
    Match.when({ type: "link" }, (n) => [
      MarkdownInline.cases.Link.make({
        url: n.url,
        title: n.title ?? undefined,
        children: mapInlines(n.children),
      }),
    ]),
    Match.orElse((n) => [
      MarkdownInline.cases.Text.make({ value: extractText(n) }),
    ]),
  );

const mapInlines = (
  nodes: ReadonlyArray<PhrasingContent>,
): ReadonlyArray<MarkdownInline> => Arr.flatMap(nodes, mapInline);

const mapListItem = (node: ListItem): ReadonlyArray<MarkdownBlock> =>
  Arr.flatMap(node.children, mapBlock);

const mapBlock = (node: RootContent): ReadonlyArray<MarkdownBlock> =>
  Match.value(node).pipe(
    Match.when({ type: "yaml" }, (n) => [
      MarkdownBlock.cases.Frontmatter.make({ value: n.value }),
    ]),
    Match.when({ type: "heading" }, (n) => [
      MarkdownBlock.cases.Heading.make({
        level: n.depth,
        children: mapInlines(n.children),
      }),
    ]),
    Match.when({ type: "paragraph" }, (n) => [
      MarkdownBlock.cases.Paragraph.make({
        children: mapInlines(n.children),
      }),
    ]),
    Match.when({ type: "list" }, (n) => [
      MarkdownBlock.cases.List.make({
        ordered: n.ordered ?? false,
        start: n.start ?? undefined,
        items: Arr.map(n.children, mapListItem),
      }),
    ]),
    Match.when({ type: "blockquote" }, (n) => [
      MarkdownBlock.cases.Blockquote.make({
        children: Arr.flatMap(n.children, mapBlock),
      }),
    ]),
    Match.when({ type: "code" }, (n) => [
      MarkdownBlock.cases.CodeBlock.make({
        value: n.value,
        language: n.lang ?? undefined,
      }),
    ]),
    Match.when({ type: "thematicBreak" }, () => [
      MarkdownBlock.cases.Rule.make({}),
    ]),
    Match.when({ type: "html" }, (n) => [
      MarkdownBlock.cases.Html.make({ value: n.value }),
    ]),
    Match.orElse(() => []),
  );

const mapDocument = (tree: Root): MarkdownDocument => ({
  blocks: Arr.flatMap(tree.children, mapBlock),
});

/** Recursively collect all link nodes from an AST node list */
const collectLinks = (
  nodes: ReadonlyArray<RootContent>,
): ReadonlyArray<RawLink> =>
  Arr.flatMap(nodes, (node): ReadonlyArray<RawLink> => {
    const self: ReadonlyArray<RawLink> =
      node.type === "link"
        ? [
            {
              label: extractText(node),
              target: (node as Link).url,
              title: (node as Link).title ?? undefined,
            },
          ]
        : [];
    const nested: ReadonlyArray<RawLink> =
      "children" in node
        ? collectLinks(node.children as ReadonlyArray<RootContent>)
        : [];
    return Arr.appendAll(self, nested);
  });

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
       * - Links are extracted via recursive AST traversal.
       */
      const parseDocument = (raw: string) =>
        Effect.gen(function* () {
          const tree = yield* Effect.try({
            try: () => processor.parse(raw) as Root,
            catch: (error) =>
              new MarkdownParseError({
                reason: error instanceof Error ? error.message : String(error),
              }),
          });

          // Extract frontmatter via Option pipeline
          const yamlNode = Arr.findFirst(
            tree.children,
            (n): n is Yaml => n.type === "yaml",
          );

          const frontmatter = yield* pipe(
            yamlNode,
            Option.match({
              onNone: () => Effect.succeed(Option.none<unknown>()),
              onSome: (node) =>
                Effect.try({
                  try: () => YAML.parse(node.value),
                  catch: (error) =>
                    new MarkdownParseError({
                      reason:
                        error instanceof Error ? error.message : String(error),
                    }),
                }).pipe(Effect.map(Option.some)),
            }),
          );

          const body = pipe(
            yamlNode,
            Option.flatMap((node) => Option.fromNullishOr(node.position)),
            Option.map((pos) => raw.slice(pos.end.offset).trimStart()),
            Option.getOrElse(() => raw),
          );

          // Collect links via recursive traversal (no mutation)
          const links = collectLinks(tree.children);

          return {
            frontmatter,
            body,
            links,
            document: mapDocument(tree),
          } satisfies ParsedMarkdownDocument;
        });

      const parse = (raw: string) =>
        parseDocument(raw).pipe(
          Effect.map(
            ({ frontmatter, body, links }) =>
              ({
                frontmatter,
                body,
                links,
              }) satisfies ParsedMarkdown,
          ),
        );

      return { parse, parseDocument } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
