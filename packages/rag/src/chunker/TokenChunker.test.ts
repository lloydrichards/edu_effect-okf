import { describe, expect, it } from "@effect/vitest";
import { Chunker } from "@repo/domain/Chunk";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { SchemaError } from "effect/Schema";
import {
  CharacterTokenizerLive,
  WordTokenizerLive,
} from "../tokenizer/DelimTokenizer";
import { TokenChunker, TokenChunkerConfig } from "./TokenChunker";

const makeWordTokenChunkerLive = (config: {
  chunkSize: number;
  chunkOverlap: number;
}) =>
  Layer.effect(Chunker)(TokenChunker.make).pipe(
    Layer.provide(WordTokenizerLive),
    Layer.provide(Layer.succeed(TokenChunkerConfig, config)),
  );

const makeCharacterTokenChunkerLive = (config: {
  chunkSize: number;
  chunkOverlap: number;
}) =>
  Layer.effect(Chunker)(TokenChunker.make).pipe(
    Layer.provide(CharacterTokenizerLive),
    Layer.provide(Layer.succeed(TokenChunkerConfig, config)),
  );

describe("TokenChunker", () => {
  it.layer(makeWordTokenChunkerLive({ chunkSize: 5, chunkOverlap: 2 }))(
    (it) => {
      it.effect(
        "Given overlap, when chunking tokens, then windows overlap with correct offsets",
        () =>
          Effect.gen(function* () {
            const chunker = yield* Chunker;
            const text = "Hello world. How are you. Fine";
            const chunks = yield* chunker.chunk(text);

            expect(chunks.map((d) => d.text)).toEqual([
              "Hello world. How are you.",
              "are you. Fine",
            ]);
            expect(chunks.map((d) => d.startIdx)).toEqual([0, 17]);
            expect(chunks.map((d) => d.endIdx)).toEqual([25, 30]);
            expect(chunks.map((d) => d.tokenCount)).toEqual([5, 3]);
          }),
      );

      it.effect(
        "Given whitespace-only input, when chunking, then returns empty chunks",
        () =>
          Effect.gen(function* () {
            const chunker = yield* Chunker;
            const chunks = yield* chunker.chunk("   \n\t  ");

            expect(chunks).toEqual([]);
          }),
      );

      it.effect(
        "Given same input and config, when chunking twice, then output is deterministic",
        () =>
          Effect.gen(function* () {
            const chunker = yield* Chunker;
            const text = "one two three four five six";

            const first = yield* chunker.chunk(text);
            const second = yield* chunker.chunk(text);

            expect(second).toEqual(first);
          }),
      );
    },
  );

  it.effect(
    "Given overlap equals chunk size, when chunking, then config validation fails",
    () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const chunker = yield* Chunker;
          return yield* chunker.chunk("A B C");
        }).pipe(
          Effect.provide(
            makeWordTokenChunkerLive({
              chunkSize: 3,
              chunkOverlap: 3,
            }),
          ),
        );

        const exit = yield* Effect.exit(program);

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const failure = Cause.findErrorOption(exit.cause);
          expect(Option.isSome(failure)).toBe(true);
          if (Option.isSome(failure)) {
            expect(failure.value).toBeInstanceOf(SchemaError);
            expect(failure.value.message).toContain(
              "chunkOverlap must be less than chunkSize",
            );
          }
        }
      }),
  );

  it.effect(
    "Given non-positive chunk size, when chunking, then config validation fails",
    () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const chunker = yield* Chunker;
          return yield* chunker.chunk("A B C");
        }).pipe(
          Effect.provide(
            makeWordTokenChunkerLive({
              chunkSize: 0,
              chunkOverlap: 0,
            }),
          ),
        );

        const exit = yield* Effect.exit(program);

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const failure = Cause.findErrorOption(exit.cause);
          expect(Option.isSome(failure)).toBe(true);
          if (Option.isSome(failure)) {
            expect(failure.value).toBeInstanceOf(SchemaError);
            expect(failure.value.message).toContain(
              "Expected a value greater than 0, got 0",
            );
          }
        }
      }),
  );
});

describe("TokenChunker non-overlapping windows", () => {
  it.layer(
    makeCharacterTokenChunkerLive({
      chunkSize: 2,
      chunkOverlap: 0,
    }),
  )((it) => {
    it.effect(
      "Given zero overlap, when chunking, then windows do not overlap and offsets advance",
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker;
          const chunks = yield* chunker.chunk("ABCDE");

          expect(chunks.map((d) => d.text)).toEqual(["AB", "CD", "E"]);
          expect(chunks.map((d) => d.startIdx)).toEqual([0, 2, 4]);
          expect(chunks.map((d) => d.endIdx)).toEqual([2, 4, 5]);
          expect(chunks.map((d) => d.tokenCount)).toEqual([2, 2, 1]);
        }),
    );
  });
});

describe("TokenChunker lesson alignment", () => {
  it.layer(
    makeCharacterTokenChunkerLive({
      chunkSize: 4,
      chunkOverlap: 1,
    }),
  )((it) => {
    it.effect(
      "Given character tokenization, when chunking, then windows align to size and overlap",
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker;
          const chunks = yield* chunker.chunk("ABCDEFGHIJ");

          expect(chunks.map((d) => d.text)).toEqual(["ABCD", "DEFG", "GHIJ"]);
          expect(chunks.map((d) => d.startIdx)).toEqual([0, 3, 6]);
          expect(chunks.map((d) => d.endIdx)).toEqual([4, 7, 10]);
          expect(chunks.map((d) => d.tokenCount)).toEqual([4, 4, 4]);
        }),
    );
  });
});
