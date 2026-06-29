import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import { MarkdownService } from "./MarkdownService";
import { BundleInvalid, OkfService } from "./OkfService";

const TestLayer = Layer.mergeAll(OkfService.layer, MarkdownService.layer).pipe(
  Layer.provideMerge(NodeServices.layer),
);

describe("OkfService", () => {
  it.effect("rejects reserved files with invalid structure", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const okf = yield* OkfService;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "okf-invalid-" });

      yield* fs.writeFileString(
        `${dir}/index.md`,
        `---\ntitle: Invalid\n---\n\n# Index\n`,
      );
      yield* fs.writeFileString(
        `${dir}/concept.md`,
        `---\ntype: Note\n---\n\nHello\n`,
      );

      const error = yield* Effect.flip(okf.validate(dir));

      expect(error).toBeInstanceOf(BundleInvalid);
      if (error._tag !== "BundleInvalid") {
        throw new Error(`Expected BundleInvalid, got ${error._tag}`);
      }
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0]?.file).toBe("index.md");
      expect(error.issues[0]?.reason).toContain(
        "Unsupported root index frontmatter keys",
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("reports broken internal links as warnings (OKF §5.3)", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const okf = yield* OkfService;
      const dir = yield* fs.makeTempDirectoryScoped({
        prefix: "okf-broken-link-",
      });

      yield* fs.writeFileString(
        `${dir}/concept.md`,
        `---\ntype: Note\n---\n\nSee [missing](/missing.md).\n`,
      );

      const result = yield* okf.validate(dir);

      // Per OKF §5.3: "Consumers MUST tolerate broken links"
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([
        {
          id: "concept->missing",
          source: "graph",
          reason: "Broken internal link from concept to missing",
          severity: "warning",
        },
      ]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
