import { type Chunk, Chunker } from "@repo/domain/Chunk";
import { Context, Effect, Layer, Schema } from "effect";
import { isBlank } from "./utils";

const FastChunkerConfigSchema = Schema.Struct({
  chunkSize: Schema.Number.check(Schema.isGreaterThan(0)),
  delimiters: Schema.NonEmptyArray(Schema.String),
});

export const FastChunkerConfig = Context.Reference<
  typeof FastChunkerConfigSchema.Type
>("FastChunkerConfig", {
  defaultValue: () => ({
    chunkSize: 4096,
    delimiters: ["\n", ".", "?"],
  }),
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const isContinuationByte = (byte: number): boolean =>
  (byte & 0b1100_0000) === 0b1000_0000;

const isDelimiter = (
  byte: number,
  delimiters: ReadonlyArray<string>,
): boolean => delimiters.includes(String.fromCharCode(byte));

export class FastChunker extends Context.Service<Chunker>()("FastChunker", {
  make: Effect.gen(function* () {
    const config = yield* FastChunkerConfig;
    const { chunkSize, delimiters } = yield* Schema.decodeEffect(
      FastChunkerConfigSchema,
    )(config);

    const findSplit = (
      bytes: Uint8Array,
      start: number,
      targetEnd: number,
      delimiters: ReadonlyArray<string>,
    ): number => {
      const maxEnd = Math.min(targetEnd, bytes.length);

      for (let i = maxEnd - 1; i > start; i--) {
        if (isDelimiter(bytes[i] as number, delimiters)) {
          return i + 1;
        }
      }

      return maxEnd;
    };

    const alignUtf8Boundary = (
      bytes: Uint8Array,
      start: number,
      end: number,
    ): number => {
      if (end >= bytes.length) {
        return bytes.length;
      }

      let aligned = end;
      while (aligned > start && isContinuationByte(bytes[aligned] as number)) {
        aligned--;
      }

      if (aligned > start) {
        return aligned;
      }

      aligned = end;
      while (
        aligned < bytes.length &&
        isContinuationByte(bytes[aligned] as number)
      ) {
        aligned++;
      }

      return aligned;
    };

    const chunk = Effect.fn("FastChunker.chunk")((text: string) =>
      Effect.sync(() => {
        if (isBlank(text)) {
          return [];
        }
        const bytes = encoder.encode(text);
        const chunks: Array<Chunk> = [];
        let start = 0;
        let charIndex = 0;

        while (start < bytes.length) {
          const target = start + chunkSize;
          const split = findSplit(bytes, start, target, delimiters);
          const end = alignUtf8Boundary(bytes, start, split);

          const textSlice = decoder.decode(bytes.slice(start, end));
          chunks.push({
            text: textSlice,
            startIdx: charIndex,
            endIdx: charIndex + textSlice.length,
            tokenCount: textSlice.length,
          });

          charIndex += textSlice.length;
          start = end;
        }

        return chunks;
      }),
    );

    return {
      chunk,
      name: "fast",
    };
  }),
}) {}

export const FastChunkerLive = Layer.effect(Chunker)(FastChunker.make);
