import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import {
  parseOkfSourceInput,
  SourceParseError,
  SourceResolver,
} from "./SourceResolver";

const TestLayer = Layer.mergeAll(SourceResolver.layer).pipe(
  Layer.provideMerge(NodeServices.layer),
);

describe("SourceResolver", () => {
  it.effect("parses GitHub tree URLs", () =>
    Effect.gen(function* () {
      const input =
        "https://github.com/lloydrichards/edu_effect-okf/tree/main/house-plants-okf";

      const source = yield* parseOkfSourceInput(input);

      expect(source).toEqual({
        _tag: "Git",
        input,
        ref: "main",
        subpath: "house-plants-okf",
        repoUrl: "https://github.com/lloydrichards/edu_effect-okf.git",
      });
    }),
  );

  it.effect("parses git URL fragments", () =>
    Effect.gen(function* () {
      const input =
        "git@github.com:lloydrichards/edu_effect-okf.git#feature/foo:house-plants-okf";

      const source = yield* parseOkfSourceInput(input);

      expect(source).toEqual({
        _tag: "Git",
        input,
        repoUrl: "git@github.com:lloydrichards/edu_effect-okf.git",
        ref: "feature/foo",
        subpath: "house-plants-okf",
      });
    }),
  );

  it.effect("rejects unsupported remote inputs", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        parseOkfSourceInput("https://github.com/lloydrichards/edu_effect-okf"),
      );

      expect(error).toBeInstanceOf(SourceParseError);
    }),
  );

  it.effect("resolves a local path to an absolute bundle path", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const resolver = yield* SourceResolver;
      const dir = yield* fs.makeTempDirectoryScoped({
        prefix: "okf-source-local-",
      });

      const source = yield* resolver.resolve(dir);

      expect(source).toEqual({
        input: dir,
        bundlePath: dir,
        source: {
          _tag: "Local",
          input: dir,
          path: dir,
        },
      });
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );
});
