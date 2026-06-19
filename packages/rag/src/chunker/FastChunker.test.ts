import { describe, expect, it } from "@effect/vitest";
import { Chunker } from "@repo/domain/Chunk";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { SchemaError } from "effect/Schema";
import { FastChunker, FastChunkerConfig } from "./FastChunker";

const makeFastChunkerLive = (config: {
  chunkSize: number;
  delimiters: readonly [string, ...string[]];
}) =>
  Layer.effect(Chunker)(FastChunker.make).pipe(
    Layer.provide(Layer.succeed(FastChunkerConfig, config)),
  );

describe("FastChunker", () => {
  it.layer(
    makeFastChunkerLive({
      chunkSize: 18,
      delimiters: [".", "?", "!"],
    }),
  )((it) => {
    it.effect(
      "Given delimiter-based chunking, when splitting, then delimiters bound windows",
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker;
          const text = "A short sentence. Another one! Last part?";
          const chunks = yield* chunker.chunk(text);

          expect(chunks.map((d) => d.text)).toEqual([
            "A short sentence.",
            " Another one!",
            " Last part?",
          ]);
          expect(chunks.map((d) => d.startIdx)).toEqual([0, 17, 30]);
          expect(chunks.map((d) => d.endIdx)).toEqual([17, 30, 41]);
          expect(chunks.map((d) => d.tokenCount)).toEqual([17, 13, 11]);
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
          const text = "one two three four five six seven";

          const first = yield* chunker.chunk(text);
          const second = yield* chunker.chunk(text);

          expect(second).toEqual(first);
        }),
    );
  });

  it.layer(
    makeFastChunkerLive({
      chunkSize: 10,
      delimiters: [".", "?", "!"],
    }),
  )((it) => {
    it.effect(
      "Given multibyte UTF-8 text, when chunking, then offsets and lengths align",
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker;
          const text = "Hi 👋 cafe. Привет?";
          const chunks = yield* chunker.chunk(text);

          expect(chunks.length).toBeGreaterThan(0);
          expect(chunks.map((chunk) => chunk.text).join("")).toEqual(text);

          for (const chunk of chunks) {
            expect(text.slice(chunk.startIdx, chunk.endIdx)).toEqual(
              chunk.text,
            );
            expect(chunk.endIdx - chunk.startIdx).toEqual(chunk.tokenCount);
          }
        }),
    );
  });

  it.effect(
    "Given non-positive chunk size, when chunking, then config validation fails",
    () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const chunker = yield* Chunker;
          return yield* chunker.chunk("A B C");
        }).pipe(
          Effect.provide(
            makeFastChunkerLive({
              chunkSize: -1,
              delimiters: [" "],
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
              "Expected a value greater than 0, got -1",
            );
          }
        }
      }),
  );
});

describe("FastChunker delimiter fallback", () => {
  it.layer(
    makeFastChunkerLive({
      chunkSize: 5,
      delimiters: [".", "?"],
    }),
  )((it) => {
    it.effect(
      "Given no delimiters found, when chunking, then splits by size",
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker;
          const text = "ABCDEFG";
          const chunks = yield* chunker.chunk(text);

          expect(chunks.map((d) => d.text)).toEqual(["ABCDE", "FG"]);
          expect(chunks.map((d) => d.startIdx)).toEqual([0, 5]);
          expect(chunks.map((d) => d.endIdx)).toEqual([5, 7]);
          for (const chunk of chunks) {
            expect(text.slice(chunk.startIdx, chunk.endIdx)).toEqual(
              chunk.text,
            );
          }
        }),
    );
  });
});
