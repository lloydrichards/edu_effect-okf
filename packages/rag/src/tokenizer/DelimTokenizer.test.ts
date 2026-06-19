import { describe, expect, it } from "@effect/vitest";
import { Tokenizer, TokenizerError } from "@repo/domain/Chunk";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import {
  CharacterTokenizerLive,
  DelimTokenizer,
  SentenceTokenizerLive,
  WordTokenizerLive,
} from "./DelimTokenizer";

describe("CharacterTokenizer", () => {
  it.layer(CharacterTokenizerLive)((it) => {
    it.effect("encodes and decodes text", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const encoded = yield* tokenizer.encode("abba");
        const decoded = yield* tokenizer.decode(encoded);

        expect(encoded).toEqual([0, 1, 1, 0]);
        expect(decoded).toBe("abba");
      }),
    );

    it.effect("reuses ids across multiple encode calls", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const first = yield* tokenizer.encode("ab");
        const second = yield* tokenizer.encode("ba!");

        expect(first).toEqual([0, 1]);
        expect(second).toEqual([1, 0, 2]);
      }),
    );

    it.effect("counts tokens by character", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const count = yield* tokenizer.countTokens("a🙂b");

        expect(count).toBe(4);
      }),
    );

    it.effect("fails to decode unknown ids", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const exit = yield* Effect.exit(tokenizer.decode([999]));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const failure = Cause.findErrorOption(exit.cause);
          expect(Option.isSome(failure)).toBe(true);
          if (Option.isSome(failure)) {
            expect(failure.value).toBeInstanceOf(TokenizerError);
            expect(failure.value.message).toContain("Unknown token id: 999");
          }
        }
      }),
    );
  });
});

describe("SentenceTokenizer", () => {
  it.layer(WordTokenizerLive)((it) => {
    it.effect("encodes and decodes text", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const encoded = yield* tokenizer.encode("run really really fast");
        const decoded = yield* tokenizer.decode(encoded);

        expect(encoded).toEqual([0, 1, 1, 2]);
        expect(decoded).toBe("run really really fast");
      }),
    );

    it.effect("reuses ids across multiple encode calls", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const first = yield* tokenizer.encode("the quick sly fox");
        const second = yield* tokenizer.encode("sly fox jumps");

        expect(first).toHaveLength(4);
        expect(second).toHaveLength(3);
        expect(second[0]).toBe(first[2]);
        expect(second[1]).toBe(first[3]);

        const knownId = first[3];
        const newId = second[2];

        expect(knownId).not.toBeUndefined();
        expect(newId).not.toBeUndefined();

        if (knownId !== undefined && newId !== undefined) {
          expect(newId).toBeGreaterThan(knownId);
        }
      }),
    );

    it.effect("counts tokens by character", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const count = yield* tokenizer.countTokens("the quick sly fox");

        expect(count).toBe(4);
      }),
    );

    it.effect("fails to decode unknown ids", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const exit = yield* Effect.exit(tokenizer.decode([999]));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const failure = Cause.findErrorOption(exit.cause);
          expect(Option.isSome(failure)).toBe(true);
          if (Option.isSome(failure)) {
            expect(failure.value).toBeInstanceOf(TokenizerError);
            expect(failure.value.message).toContain("Unknown token id: 999");
          }
        }
      }),
    );
  });
});

describe("DelimTokenizer delimiters", () => {
  it.layer(
    Layer.effect(Tokenizer)(
      DelimTokenizer.make(["!\n", ". ", "? ", " ", "\n", ".", "?", "!"], " "),
    ),
  )((it) => {
    it.effect("supports array delimiters", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const text = "One fish. Two fish!\nRed fish? Blue fish";
        const encoded = yield* tokenizer.encode(text);
        const count = yield* tokenizer.countTokens(text);
        const decoded = yield* tokenizer.decode(encoded);

        expect(count).toBe(8);
        expect(decoded).toBe("One fish Two fish Red fish Blue fish");
      }),
    );
  });
});

describe("SentenceTokenizerLive", () => {
  it.layer(SentenceTokenizerLive)((it) => {
    it.effect("splits on newline and sentence punctuation", () =>
      Effect.gen(function* () {
        const tokenizer = yield* Tokenizer;
        const text = "Hello world!\nHow are you? Fine.";
        const encoded = yield* tokenizer.encode(text);
        const decoded = yield* tokenizer.decode(encoded);
        const count = yield* tokenizer.countTokens(text);

        expect(encoded).toEqual([0, 1, 2]);
        expect(count).toBe(3);
        expect(decoded).toBe("Hello world. How are you. Fine");
      }),
    );
  });
});
