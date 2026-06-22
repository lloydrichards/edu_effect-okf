import { Schema } from "effect";

export type MarkdownInline =
  | { readonly _tag: "Text"; readonly value: string }
  | { readonly _tag: "Break" }
  | {
      readonly _tag: "Paragraph";
      readonly children: ReadonlyArray<MarkdownInline>;
    }
  | { readonly _tag: "InlineCode"; readonly value: string }
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

export const MarkdownInline = Schema.TaggedUnion({
  Text: { value: Schema.String },
  Break: {},
  InlineCode: { value: Schema.String },
  Emphasis: {
    children: Schema.Array(
      Schema.suspend((): Schema.Codec<MarkdownInline> => MarkdownInline),
    ),
  },
  Paragraph: {
    children: Schema.Array(
      Schema.suspend((): Schema.Codec<MarkdownInline> => MarkdownInline),
    ),
  },
  Strong: {
    children: Schema.Array(
      Schema.suspend((): Schema.Codec<MarkdownInline> => MarkdownInline),
    ),
  },
  Delete: {
    children: Schema.Array(
      Schema.suspend((): Schema.Codec<MarkdownInline> => MarkdownInline),
    ),
  },
  Link: {
    url: Schema.String,
    title: Schema.optional(Schema.String),
    children: Schema.Array(
      Schema.suspend((): Schema.Codec<MarkdownInline> => MarkdownInline),
    ),
  },
});

export type MarkdownBlock =
  | { readonly _tag: "Frontmatter"; readonly value: string }
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
  | { readonly _tag: "Rule" }
  | { readonly _tag: "Html"; readonly value: string };

export const MarkdownBlock = Schema.TaggedUnion({
  Frontmatter: { value: Schema.String },
  Heading: {
    level: Schema.Literals([1, 2, 3, 4, 5, 6]),
    children: Schema.Array(MarkdownInline),
  },
  Paragraph: {
    children: Schema.Array(MarkdownInline),
  },
  List: {
    ordered: Schema.Boolean,
    start: Schema.optional(Schema.Number),
    items: Schema.Array(
      Schema.Array(
        Schema.suspend((): Schema.Codec<MarkdownBlock> => MarkdownBlock),
      ),
    ),
  },
  Blockquote: {
    children: Schema.Array(
      Schema.suspend((): Schema.Codec<MarkdownBlock> => MarkdownBlock),
    ),
  },
  CodeBlock: {
    value: Schema.String,
    language: Schema.optional(Schema.String),
  },
  Rule: {},
  Html: { value: Schema.String },
});

export const MarkdownDocument = Schema.Struct({
  blocks: Schema.Array(MarkdownBlock),
});

export type MarkdownDocument = typeof MarkdownDocument.Type;
