import type {
  MarkdownBlock,
  MarkdownDocument,
  MarkdownInline,
} from "@repo/okf";
import { Array, Match, pipe, String } from "effect";
import { Ansi, Box, Container } from "effect-boxes";

const blockquotePrefix = "│ ";

const clampWidth = (width: number): number => Math.max(1, width);

const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const renderInlineText = (children: ReadonlyArray<MarkdownInline>): string =>
  pipe(
    children,
    Array.map((child) =>
      Match.value(child).pipe(
        Match.tag("Text", ({ value }) => value),
        Match.tag("Break", () => "\n"),
        Match.tag("InlineCode", ({ value }) => value),
        Match.tag("Emphasis", ({ children }) => renderInlineText(children)),
        Match.tag("Strong", ({ children }) => renderInlineText(children)),
        Match.tag("Delete", ({ children }) => renderInlineText(children)),
        Match.tag("Link", ({ children }) => renderInlineText(children)),
        Match.exhaustive,
      ),
    ),
    Array.join(""),
    normalizeWhitespace,
  );

const PreformattedBlock = (text: string, width: number): Box.Box<unknown> =>
  Box.text(text).pipe(
    Box.truncate(clampWidth(width), Box.left),
    Box.annotate(Ansi.dim),
  );

const Paragraph = (
  children: ReadonlyArray<MarkdownInline>,
  width: number,
): Box.Box<never> =>
  Box.para(renderInlineText(children), Box.left, clampWidth(width));

const Document = (
  document: MarkdownDocument,
  width: number,
): Box.Box<unknown> => {
  const renderedBlocks = pipe(
    document.blocks,
    Array.map((block) => renderMarkdownBlock(block, clampWidth(width))),
  );

  return Array.match(renderedBlocks, {
    onEmpty: () => Box.nullBox,
    onNonEmpty: (blocks) => Box.vsep(blocks, 1, Box.left),
  });
};

const PrefixedBlock = (
  prefix: string,
  content: Box.Box<unknown>,
  width: number,
): Box.Box<unknown> => {
  const gutter = pipe(
    Math.max(content.rows, 1),
    Array.makeBy(() => prefix),
    Array.join("\n"),
    Box.text,
  );

  return Box.hcat(
    [gutter, content.pipe(Box.maxWidth(clampWidth(width - prefix.length)))],
    Box.top,
  );
};

const renderListMarker = (
  ordered: boolean,
  start: number | undefined,
  index: number,
): string => (ordered ? `${(start ?? 1) + index}.` : "•");

const getMarkerWidth = (
  block: Extract<MarkdownBlock, { _tag: "List" }>,
): number =>
  block.ordered
    ? pipe(
        block.items,
        Array.map(
          (_, index) => renderListMarker(true, block.start, index).length + 1,
        ),
        Array.reduce(0, (max, width) => Math.max(max, width)),
      )
    : 2;

const ListItem = (
  marker: string,
  blocks: ReadonlyArray<MarkdownBlock>,
  width: number,
  markerWidth: number,
): Box.Box<unknown> => {
  const markerBox = Box.text(String.padEnd(markerWidth, " ")(`${marker} `));
  const contentWidth = clampWidth(width - markerWidth);
  const content = Document({ blocks }, contentWidth);
  return Box.hcat([markerBox, content], Box.top);
};

const Heading = (
  level: number,
  children: ReadonlyArray<MarkdownInline>,
  width: number,
): Box.Box<unknown> => {
  const annotation = Match.value(level).pipe(
    Match.when(
      (value) => value <= 1,
      () => Ansi.combine(Ansi.bold, Ansi.cyan),
    ),
    Match.when(
      (value) => value === 2,
      () => Ansi.combine(Ansi.bold, Ansi.brightBlue),
    ),
    Match.orElse(() => Ansi.bold),
  );

  return Box.para(renderInlineText(children), Box.left, clampWidth(width)).pipe(
    Box.annotate(annotation),
  );
};

const renderMarkdownBlock = (
  block: MarkdownBlock,
  width: number,
): Box.Box<unknown> =>
  Match.value(block).pipe(
    Match.tag("Frontmatter", ({ value }) =>
      PreformattedBlock(`---\n${value}\n---`, width),
    ),
    Match.tag("Heading", ({ level, children }) =>
      Heading(level, children, width),
    ),
    Match.tag("Paragraph", ({ children }) => Paragraph(children, width)),
    Match.tag("List", (list) =>
      Box.vcat(
        pipe(
          list.items,
          Array.map((item, index) =>
            ListItem(
              renderListMarker(list.ordered, list.start, index),
              item,
              width,
              getMarkerWidth(list),
            ),
          ),
        ),
        Box.left,
      ),
    ),
    Match.tag("Blockquote", ({ children }) =>
      PrefixedBlock(
        blockquotePrefix,
        Document(
          { blocks: children },
          clampWidth(width - blockquotePrefix.length),
        ),
        width,
      ).pipe(Box.annotate(Ansi.dim)),
    ),
    Match.tag("CodeBlock", ({ value }) => PreformattedBlock(value, width)),
    Match.tag("Rule", () =>
      Box.text("─".repeat(clampWidth(width))).pipe(Box.annotate(Ansi.dim)),
    ),
    Match.tag("Html", ({ value }) => PreformattedBlock(value, width)),
    Match.exhaustive,
  );

export const MarkdownBox = (
  document: MarkdownDocument,
  width: number,
): Box.Box<unknown> => Document(document, width);

export const MarkdownPanel = (
  document: MarkdownDocument,
  width: number,
): Box.Box<unknown> => {
  const outerWidth = Math.max(3, width);
  const contentWidth = clampWidth(outerWidth - 2);

  return Container.make({ width: contentWidth }, (ctx) =>
    Document(document, clampWidth(ctx.innerWidth)),
  ).pipe(Box.border("rounded"));
};
