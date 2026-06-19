import { type Chunk, Chunker, Tokenizer } from "@repo/domain/Chunk";
import { Context, Effect, Layer, Schema } from "effect";
import { WordTokenizerLive } from "../tokenizer/DelimTokenizer";
import { isBlank } from "./utils";

const TokenChunkerConfigSchema = Schema.Struct({
  chunkSize: Schema.Number.check(Schema.isGreaterThan(0)),
  chunkOverlap: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
}).pipe(
  Schema.check(
    Schema.makeFilter(
      ({ chunkOverlap, chunkSize }) =>
        chunkOverlap < chunkSize || "chunkOverlap must be less than chunkSize",
    ),
  ),
);

export const TokenChunkerConfig = Context.Reference<
  typeof TokenChunkerConfigSchema.Type
>("TokenChunkerConfig", {
  defaultValue: () => ({
    chunkSize: 2048,
    chunkOverlap: 0,
  }),
});

export class TokenChunker extends Context.Service<Chunker>()("TokenChunker", {
  make: Effect.gen(function* () {
    const tokenizer = yield* Tokenizer;
    const config = yield* TokenChunkerConfig;
    const { chunkSize, chunkOverlap } = yield* Schema.decodeEffect(
      TokenChunkerConfigSchema,
    )(config);
    const chunk = Effect.fn("TokenChunker.chunk")(function* (text: string) {
      if (isBlank(text)) {
        return [];
      }
      const tokens = yield* tokenizer.encode(text);
      const stride = chunkSize - chunkOverlap;
      const groups: Array<Array<number>> = [];

      for (let start = 0; start < tokens.length; start += stride) {
        const end = Math.min(start + chunkSize, tokens.length);
        groups.push(tokens.slice(start, end));
        if (end === tokens.length) break;
      }
      const chunks: Array<Chunk> = [];
      let currentIndex = 0;

      for (const group of groups) {
        const chunkText = yield* tokenizer.decode(group);
        const overlapText = yield* chunkOverlap > 0
          ? tokenizer.decode(group.slice(-chunkOverlap))
          : Effect.succeed("");

        const startIdx = currentIndex;
        const endIdx = startIdx + chunkText.length;

        chunks.push({
          text: chunkText,
          startIdx,
          endIdx,
          tokenCount: group.length,
        });

        currentIndex = endIdx - overlapText.length;
      }

      return chunks;
    });

    return {
      chunk,
      name: "token",
    };
  }),
}) {}

export const TokenChunkerLive = Layer.effect(Chunker)(TokenChunker.make).pipe(
  Layer.provide(WordTokenizerLive),
);
