import { Tokenizer, TokenizerError } from "@repo/domain/Chunk";
import { Context, Effect, Layer, Ref } from "effect";

type Delimiter = string | ReadonlyArray<string>;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toSplitPattern = (delimiter: Delimiter): string | RegExp => {
  if (typeof delimiter === "string") {
    return delimiter;
  }
  if (delimiter.length === 0) {
    return "";
  }
  return new RegExp(delimiter.map(escapeRegex).join("|"));
};

const getJoinDelimiter = (delimiter: Delimiter, joiner?: string): string => {
  if (joiner !== undefined) {
    return joiner;
  }
  if (typeof delimiter === "string") {
    return delimiter;
  }
  return delimiter[0] ?? "";
};

export class DelimTokenizer extends Context.Service<Tokenizer>()(
  "DelimTokenizer",
  {
    make: Effect.fn(function* (delimiter: Delimiter, joiner?: string) {
      const joinDelimiter = getJoinDelimiter(delimiter, joiner);
      const splitPattern = toSplitPattern(delimiter);
      const splitText = (text: string): Array<string> => {
        const tokens = text.split(splitPattern);
        return Array.isArray(delimiter)
          ? tokens.filter((token) => token.length > 0)
          : tokens;
      };

      const stateRef = yield* Ref.make({
        vocab: new Map<string, number>(),
        reverse: new Map<number, string>(),
        nextId: 0,
      });

      const encode = (text: string) =>
        Ref.modify(stateRef, (state) => {
          const vocab = new Map(state.vocab);
          const reverse = new Map(state.reverse);
          let nextId = state.nextId;

          const ids: Array<number> = [];
          for (const token of splitText(text)) {
            let id = vocab.get(token);
            if (id === undefined) {
              id = nextId++;
              vocab.set(token, id);
              reverse.set(id, token);
            }
            ids.push(id);
          }

          return [
            ids,
            {
              vocab,
              reverse,
              nextId,
            },
          ] as const;
        });

      const decode = (tokens: ReadonlyArray<number>) =>
        Effect.gen(function* () {
          const { reverse } = yield* Ref.get(stateRef);
          const tokensArray: Array<string> = [];
          for (const id of tokens) {
            const token = reverse.get(id);
            if (token === undefined) {
              return yield* Effect.fail(
                new TokenizerError({
                  message: `Unknown token id: ${id}`,
                }),
              );
            }
            tokensArray.push(token);
          }
          return tokensArray.join(joinDelimiter);
        });

      const countTokens = (text: string) =>
        Effect.succeed(splitText(text).length);

      return { encode, decode, countTokens } as const;
    }),
  },
) {}

export const CharacterTokenizerLive = Layer.effect(Tokenizer)(
  DelimTokenizer.make(""),
);
export const WordTokenizerLive = Layer.effect(Tokenizer)(
  DelimTokenizer.make(" "),
);
export const SentenceTokenizerLive = Layer.effect(Tokenizer)(
  DelimTokenizer.make(["!\n", ". ", "? ", "\n", ".", "?", "!"], ". "),
);
