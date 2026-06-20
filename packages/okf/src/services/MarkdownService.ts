import { Context, Data, Effect, Layer, Option } from "effect";
import type {
  Blockquote,
  Code,
  Delete,
  Emphasis,
  Heading,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Strong,
  Text,
  Yaml,
} from "mdast";
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

export type MarkdownInline =
  | {
      readonly _tag: "Text";
      readonly value: string;
    }
  | {
      readonly _tag: "Break";
    }
  | {
      readonly _tag: "InlineCode";
      readonly value: string;
    }
  | {
      readonly _tag: "Emphasis";
      readonly children: ReadonlyArray<MarkdownInline>;
    }
  | {
      readonly _tag: "Strong";
      readonly children: ReadonlyArray<MarkdownInline>;
    }
  | {
      readonly _tag: "Delete";
      readonly children: ReadonlyArray<MarkdownInline>;
    }
  | {
      readonly _tag: "Link";
      readonly url: string;
      readonly title?: string | undefined;
      readonly children: ReadonlyArray<MarkdownInline>;
    };

export type MarkdownBlock =
  | {
      readonly _tag: "Frontmatter";
      readonly value: string;
    }
  | {
      readonly _tag: "Heading";
      readonly level: 1 | 2 | 3 | 4 | 5 | 6;
      readonly children: ReadonlyArray<MarkdownInline>;
    }
  | {
      readonly _tag: "Paragraph";
      readonly children: ReadonlyArray<MarkdownInline>;
    }
  | {
      readonly _tag: "List";
      readonly ordered: boolean;
      readonly start?: number | undefined;
      readonly items: ReadonlyArray<ReadonlyArray<MarkdownBlock>>;
    }
  | {
      readonly _tag: "Blockquote";
      readonly children: ReadonlyArray<MarkdownBlock>;
    }
  | {
      readonly _tag: "CodeBlock";
      readonly value: string;
      readonly language?: string | undefined;
    }
  | {
      readonly _tag: "Rule";
    }
  | {
      readonly _tag: "Html";
      readonly value: string;
    };

export interface MarkdownDocument {
  readonly blocks: ReadonlyArray<MarkdownBlock>;
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

const mapInline = (node: PhrasingContent): ReadonlyArray<MarkdownInline> => {
  switch (node.type) {
    case "text":
      return [{ _tag: "Text", value: (node as Text).value }];
    case "break":
      return [{ _tag: "Break" }];
    case "inlineCode":
      return [{ _tag: "InlineCode", value: (node as InlineCode).value }];
    case "emphasis":
      return [
        {
          _tag: "Emphasis",
          children: mapInlines((node as Emphasis).children),
        },
      ];
    case "strong":
      return [
        {
          _tag: "Strong",
          children: mapInlines((node as Strong).children),
        },
      ];
    case "delete":
      return [
        {
          _tag: "Delete",
          children: mapInlines((node as Delete).children),
        },
      ];
    case "link": {
      const link = node as Link;
      return [
        {
          _tag: "Link",
          url: link.url,
          title: link.title ?? undefined,
          children: mapInlines(link.children),
        },
      ];
    }
    default:
      return [{ _tag: "Text", value: extractText(node) }];
  }
};

const mapInlines = (
  nodes: ReadonlyArray<PhrasingContent>,
): ReadonlyArray<MarkdownInline> => nodes.flatMap(mapInline);

const mapListItem = (node: ListItem): ReadonlyArray<MarkdownBlock> =>
  node.children.flatMap(mapBlock);

const mapBlock = (node: RootContent): ReadonlyArray<MarkdownBlock> => {
  switch (node.type) {
    case "yaml":
      return [{ _tag: "Frontmatter", value: (node as Yaml).value }];
    case "heading": {
      const heading = node as Heading;
      return [
        {
          _tag: "Heading",
          level: heading.depth,
          children: mapInlines(heading.children),
        },
      ];
    }
    case "paragraph": {
      const paragraph = node as Paragraph;
      return [
        {
          _tag: "Paragraph",
          children: mapInlines(paragraph.children),
        },
      ];
    }
    case "list": {
      const list = node as List;
      return [
        {
          _tag: "List",
          ordered: list.ordered ?? false,
          start: list.start ?? undefined,
          items: list.children.map(mapListItem),
        },
      ];
    }
    case "blockquote": {
      const blockquote = node as Blockquote;
      return [
        {
          _tag: "Blockquote",
          children: blockquote.children.flatMap(mapBlock),
        },
      ];
    }
    case "code": {
      const code = node as Code;
      return [
        {
          _tag: "CodeBlock",
          value: code.value,
          language: code.lang ?? undefined,
        },
      ];
    }
    case "thematicBreak":
      return [{ _tag: "Rule" }];
    case "html":
      return [{ _tag: "Html", value: node.value }];
    default:
      return [];
  }
};

const mapDocument = (tree: Root): MarkdownDocument => ({
  blocks: tree.children.flatMap(mapBlock),
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
       * - Links are extracted via AST traversal (ignores code blocks).
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
