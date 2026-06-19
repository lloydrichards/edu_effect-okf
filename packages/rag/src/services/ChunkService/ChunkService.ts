import type { Chunk, TokenizerError } from "@repo/domain/Chunk";
import {
  Array,
  Context,
  Effect,
  Layer,
  Option,
  pipe,
  type Record,
  type Schema,
  String,
} from "effect";
import { FastChunker } from "../../chunker/FastChunker";
import { TokenChunker } from "../../chunker/TokenChunker";
import { CharacterTokenizerLive } from "../../tokenizer/DelimTokenizer";
import {
  getFileExtension,
  normalizeWhitespace,
  resolveMimeTypeForFile,
} from "../../utils";

const FAST_CHUNK_THRESHOLD_CHARS = 100_000;

type ChunkStrategy = "fast" | "token";

type ChunkEntry = {
  text: string;
  pageNumber?: number;
  pageCount?: number;
  metadata?: Record<string, unknown> | undefined;
};

type MarkdownSegment = {
  kind: "text" | "table";
  text: string;
};

export class ChunkService extends Context.Service<ChunkService>()(
  "ChunkService",
  {
    make: Effect.gen(function* () {
      const fastChunker = yield* FastChunker;
      const tokenChunker = yield* TokenChunker;

      const toChunkEntries = (
        chunks: ReadonlyArray<Chunk>,
        metadata?: { pageNumber?: number; pageCount?: number },
        baseMetadata?: Record<string, unknown>,
      ): Array<ChunkEntry> =>
        pipe(
          chunks,
          Array.map((chunk) => ({
            ...chunk,
            text: String.trim(chunk.text),
          })),
          Array.filter((chunk) => String.isNonEmpty(chunk.text)),
          Array.map((chunk) => ({
            text: chunk.text,
            ...metadata,
            metadata: {
              ...(baseMetadata ?? {}),
              chunkCharStart: chunk.startIdx,
              chunkCharEnd: chunk.endIdx,
              chunkTokenCount: chunk.tokenCount,
              ...(chunk.metadata ?? {}),
            },
          })),
        );

      const chunkWithStrategy = (
        strategy: ChunkStrategy,
        text: string,
      ): Effect.Effect<Array<Chunk>, Schema.SchemaError | TokenizerError> => {
        switch (strategy) {
          case "fast":
            return fastChunker.chunk(text);
          case "token":
            return tokenChunker.chunk(text);
        }
      };

      const isMarkdownTableSeparatorLine = (line: string): boolean =>
        /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

      const isPipeLine = (line: string): boolean => /^\s*\|.*\|\s*$/.test(line);

      const splitMarkdownSegments = (text: string): Array<MarkdownSegment> => {
        const lines = text.split("\n");
        const segments: Array<MarkdownSegment> = [];
        const proseBuffer: Array<string> = [];

        const flushProse = () => {
          if (proseBuffer.length === 0) return;
          segments.push({ kind: "text", text: proseBuffer.join("\n") });
          proseBuffer.length = 0;
        };

        for (let index = 0; index < lines.length; index += 1) {
          const header = lines[index] ?? "";
          const separator = lines[index + 1] ?? "";
          const isTableStart =
            isPipeLine(header) && isMarkdownTableSeparatorLine(separator);

          if (!isTableStart) {
            proseBuffer.push(header);
            continue;
          }

          flushProse();

          const tableLines = [header, separator];
          index += 2;

          while (index < lines.length && isPipeLine(lines[index] ?? "")) {
            tableLines.push(lines[index] ?? "");
            index += 1;
          }

          segments.push({
            kind: "table",
            text: `${tableLines.join("\n")}\n`,
          });

          index -= 1;
        }

        flushProse();

        return segments.filter((segment) =>
          String.isNonEmpty(String.trim(segment.text)),
        );
      };

      const selectStrategy = (
        extension: string,
        normalizedText: string,
      ): Option.Option<ChunkStrategy> => {
        switch (extension) {
          case ".csv":
            return Option.some("token");
          case ".md":
            return Option.some("token");
          case ".pdf":
          case ".txt":
            return Option.some(
              normalizedText.length >= FAST_CHUNK_THRESHOLD_CHARS
                ? "fast"
                : "token",
            );
          default:
            return Option.none();
        }
      };

      const chunkMarkdownText = (
        normalizedText: string,
      ): Effect.Effect<
        Array<ChunkEntry>,
        Schema.SchemaError | TokenizerError
      > =>
        Effect.gen(function* () {
          const segments = splitMarkdownSegments(normalizedText);
          const allEntries = yield* Effect.forEach(segments, (segment) =>
            Effect.map(chunkWithStrategy("token", segment.text), (chunks) =>
              toChunkEntries(chunks, undefined, { chunkStrategy: "token" }),
            ),
          );

          return allEntries.flat();
        });

      const chunkNormalizedText = (
        extension: string,
        normalizedText: string,
      ): Effect.Effect<
        Array<ChunkEntry>,
        Schema.SchemaError | TokenizerError
      > =>
        pipe(
          selectStrategy(extension, normalizedText),
          Option.match({
            onNone: () => Effect.succeed([] as Array<ChunkEntry>),
            onSome: (strategy) =>
              Effect.map(
                chunkWithStrategy(strategy, normalizedText),
                (chunks) =>
                  toChunkEntries(chunks, undefined, {
                    chunkStrategy: strategy,
                  }),
              ),
          }),
        );

      const chunkText = Effect.fn(function* (fileName: string, text: string) {
        const extension = getFileExtension(fileName);
        const baseChunks: Array<ChunkEntry> = yield* ((): Effect.Effect<
          Array<ChunkEntry>,
          Schema.SchemaError | TokenizerError
        > => {
          switch (extension) {
            case ".csv":
            case ".txt":
            case ".pdf":
              return chunkNormalizedText(extension, normalizeWhitespace(text));
            case ".md":
              return chunkMarkdownText(normalizeWhitespace(text));
            default:
              return Effect.succeed([] as Array<ChunkEntry>);
          }
        })();

        return baseChunks.map((chunk, index) => ({
          ...chunk,
          metadata: {
            sourceFile: fileName,
            fileExt: getFileExtension(fileName),
            mimeType: resolveMimeTypeForFile(fileName),
            chunkIndex: index,
            chunkCount: baseChunks.length,
            ...(chunk.metadata ?? {}),
            ...(chunk.pageNumber !== undefined
              ? { pageNumber: chunk.pageNumber }
              : {}),
            ...(chunk.pageCount !== undefined
              ? { pageCount: chunk.pageCount }
              : {}),
          },
        }));
      });

      const decodeTextFile = (fileName: string, buffer: Uint8Array) => {
        const extension = getFileExtension(fileName);
        const decoder = new TextDecoder("utf-8");

        switch (extension) {
          case ".txt":
          case ".md":
          case ".csv":
            return Effect.succeed(decoder.decode(buffer));
          default:
            return Effect.fail(new Error(`Unsupported file type: ${fileName}`));
        }
      };

      const chunkFile = Effect.fn(function* (
        fileName: string,
        buffer: Uint8Array,
      ) {
        const extension = getFileExtension(fileName);

        switch (extension) {
          case ".txt":
          case ".md":
          case ".csv": {
            const text = yield* decodeTextFile(fileName, buffer);
            return yield* chunkText(fileName, text);
          }
          default:
            return [] as Array<ChunkEntry>;
        }
      });

      return {
        chunkFile,
        chunkText,
        resolveMimeTypeForFile,
      } as const;
    }),
  },
) {
  static Default = Layer.effect(ChunkService)(ChunkService.make).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.effect(FastChunker)(FastChunker.make),
        Layer.effect(TokenChunker)(TokenChunker.make),
      ).pipe(Layer.provide(CharacterTokenizerLive)),
    ),
  );
}
