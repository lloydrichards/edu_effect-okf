import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { ChunkService } from "./ChunkService";

describe("ChunkService table strategy routing", () => {
  it.effect("routes markdown table content to table chunker behavior", () =>
    Effect.gen(function* () {
      const service = yield* ChunkService;
      const markdownTable = `| name | score |
| --- | --- |
| Ada | 91 |
| Lin | 88 |
| Sam | 95 |
| Mia | 90 |
`;
      const chunks = yield* service.chunkText("grades.md", markdownTable);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.text).toContain("| name | score |");
        expect(chunk.text).toContain("| --- | --- |");
      }
    }).pipe(Effect.provide(ChunkService.Default)),
  );
  it.effect("routes non-table markdown to recursive strategy behavior", () =>
    Effect.gen(function* () {
      const service = yield* ChunkService;
      const markdownDoc = `# Intro
This is normal markdown prose.
- item one
- item two
`;
      const chunks = yield* service.chunkText("notes.md", markdownDoc);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.text.includes("| --- |"))).toBe(false);
    }).pipe(Effect.provide(ChunkService.Default)),
  );

  it.effect("chunks mixed markdown prose and table segments in order", () =>
    Effect.gen(function* () {
      const service = yield* ChunkService;
      const mixedMarkdown = `# Weekly report

Intro paragraph before table.

| name | score |
| --- | --- |
| Ada | 91 |
| Lin | 88 |

Notes after first table.

| item | status |
| --- | --- |
| Parser | done |
| Tests | pending |

Final summary paragraph.
`;

      const chunks = yield* service.chunkText(
        "weekly-report.md",
        mixedMarkdown,
      );

      expect(chunks.length).toBeGreaterThan(0);

      const chunkTexts = chunks.map((chunk) => chunk.text);

      expect(
        chunkTexts.some((text) =>
          text.includes("Intro paragraph before table."),
        ),
      ).toBe(true);
      expect(
        chunkTexts.some((text) => text.includes("Notes after first table.")),
      ).toBe(true);
      expect(
        chunkTexts.some((text) => text.includes("Final summary paragraph.")),
      ).toBe(true);

      expect(chunkTexts.some((text) => text.includes("| name | score |"))).toBe(
        true,
      );
      expect(
        chunkTexts.some((text) => text.includes("| item | status |")),
      ).toBe(true);

      const firstTableChunkIndex = chunkTexts.findIndex((text) =>
        text.includes("| name | score |"),
      );
      const secondTableChunkIndex = chunkTexts.findIndex((text) =>
        text.includes("| item | status |"),
      );

      expect(firstTableChunkIndex).toBeGreaterThanOrEqual(0);
      expect(secondTableChunkIndex).toBeGreaterThan(firstTableChunkIndex);
    }).pipe(Effect.provide(ChunkService.Default)),
  );
});
