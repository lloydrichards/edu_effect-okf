import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { MarkdownService } from "./MarkdownService";

describe("MarkdownService", () => {
  it.effect(
    "parses a markdown document into a TUI-friendly document shape",
    () =>
      Effect.gen(function* () {
        const markdown = yield* MarkdownService;
        const parsed = yield* markdown.parseDocument(`---
title: Demo
---

# Heading

Paragraph with [link](https://example.com) and \`code\`.

- first item
- second item

> quoted text

\`\`\`ts
const x = 1
\`\`\`
`);

        expect(parsed.document).toEqual({
          blocks: [
            { _tag: "Frontmatter", value: "title: Demo" },
            {
              _tag: "Heading",
              level: 1,
              children: [{ _tag: "Text", value: "Heading" }],
            },
            {
              _tag: "Paragraph",
              children: [
                { _tag: "Text", value: "Paragraph with " },
                {
                  _tag: "Link",
                  url: "https://example.com",
                  title: undefined,
                  children: [{ _tag: "Text", value: "link" }],
                },
                { _tag: "Text", value: " and " },
                { _tag: "InlineCode", value: "code" },
                { _tag: "Text", value: "." },
              ],
            },
            {
              _tag: "List",
              ordered: false,
              start: undefined,
              items: [
                [
                  {
                    _tag: "Paragraph",
                    children: [{ _tag: "Text", value: "first item" }],
                  },
                ],
                [
                  {
                    _tag: "Paragraph",
                    children: [{ _tag: "Text", value: "second item" }],
                  },
                ],
              ],
            },
            {
              _tag: "Blockquote",
              children: [
                {
                  _tag: "Paragraph",
                  children: [{ _tag: "Text", value: "quoted text" }],
                },
              ],
            },
            {
              _tag: "CodeBlock",
              value: "const x = 1",
              language: "ts",
            },
          ],
        });
      }).pipe(Effect.provide(MarkdownService.layer)),
  );
});
