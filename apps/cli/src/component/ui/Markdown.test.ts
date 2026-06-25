import type { MarkdownDocument } from "@repo/okf";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { MarkdownBox, MarkdownPanel } from "./Markdown";

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const document = (blocks: MarkdownDocument["blocks"]): MarkdownDocument => ({
  blocks,
});

describe("renderMarkdownBox", () => {
  it("wraps paragraph content instead of clipping it", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "Paragraph",
              children: [
                {
                  _tag: "Text",
                  value: "This is a paragraph that wraps nicely.",
                },
              ],
            },
          ]),
          12,
        ),
      ),
    );

    expect(rendered).toBe("This is a\nparagraph\nthat wraps\nnicely.");
  });

  it("renders bullet lists with hanging indentation", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "List",
              ordered: false,
              items: [
                [
                  {
                    _tag: "Paragraph",
                    children: [
                      { _tag: "Text", value: "first item wraps nicely" },
                    ],
                  },
                ],
              ],
            },
          ]),
          14,
        ),
      ),
    );

    expect(rendered).toBe("• first item\n  wraps nicely");
  });

  it("renders ordered lists with aligned markers", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "List",
              ordered: true,
              start: 1,
              items: [
                [
                  {
                    _tag: "Paragraph",
                    children: [{ _tag: "Text", value: "alpha beta gamma" }],
                  },
                ],
                [
                  {
                    _tag: "Paragraph",
                    children: [{ _tag: "Text", value: "delta epsilon" }],
                  },
                ],
              ],
            },
          ]),
          16,
        ),
      ),
    );

    expect(rendered).toBe("1. alpha beta\n   gamma\n2. delta epsilon");
  });

  it("renders blockquotes with a quoted gutter", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "Blockquote",
              children: [
                {
                  _tag: "Paragraph",
                  children: [
                    { _tag: "Text", value: "quoted words here please" },
                  ],
                },
              ],
            },
          ]),
          14,
        ),
      ),
    );

    expect(rendered).toBe("│ quoted words\n│ here please");
  });

  it("preserves preformatted code blocks and truncates long lines", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "CodeBlock",
              value: "abcdefghijk\nxyz",
              language: "ts",
            },
          ]),
          6,
        ),
      ),
    );

    expect(rendered).toBe("abcde…\nxyz");
  });

  it("preserves frontmatter as a preformatted block", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            { _tag: "Frontmatter", value: "version: 1\nname: demo" },
            {
              _tag: "Paragraph",
              children: [{ _tag: "Text", value: "Body text" }],
            },
          ]),
          20,
        ),
      ),
    );

    expect(rendered).toBe("---\nversion: 1\nname: demo\n---\n\nBody text");
  });
});

describe("renderMarkdownPanel", () => {
  it("fits the requested outer width", () => {
    const panel = MarkdownPanel(
      document([
        {
          _tag: "Paragraph",
          children: [{ _tag: "Text", value: "Simple text" }],
        },
      ]),
      18,
    );

    expect(panel.cols).toBe(18);
  });
});
