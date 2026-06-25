import { String } from "effect";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { ConceptSummaryCard } from "./ConceptSummaryCard";

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const expected = (text: string): string =>
  visible(text).replace(/^\n/u, "").replace(/\n$/u, "");

const render = (
  options: Partial<Parameters<typeof ConceptSummaryCard>[0]> = {},
): string =>
  visible(
    Box.renderPlainSync(
      ConceptSummaryCard({
        title: "Introduction to Fractions",
        reference: "math/fractions/intro.md",
        type: "lesson",
        description:
          "Fractions represent parts of a whole and are introduced through visual models.",
        tags: ["math", "fractions", "grade-4"],
        incoming: 3,
        outgoing: 5,
        width: 60,
        ...options,
      }),
    ),
  );

describe("ConceptSummaryCard", () => {
  it("renders the shared static header design", () => {
    expect(render()).toBe(
      expected(
        String.stripMargin(`
         |╭──────────────────────────────────────────────────────────╮
         |│ Concept                                                  │
         |│ Introduction to Fractions                                │
         |│ math/fractions/intro.md                                  │
         |│                                                          │
         |│ lesson                                                   │
         |│ math · fractions · grade-4                               │
         |│                                                          │
         |│ Fractions represent parts of a whole and are introduced  │
         |│ through visual models.                                   │
         |│                                                          │
         |│ ← 3 in                                           5 out → │
         |╰──────────────────────────────────────────────────────────╯
         `),
      ),
    );
  });

  it("renders a compact explorer panel with a custom label", () => {
    expect(render({ label: "Current", width: 31 })).toBe(
      expected(
        String.stripMargin(`
         |╭─────────────────────────────╮
         |│ Current                     │
         |│ Introduction to Fractions   │
         |│ math/fractions/intro.md     │
         |│                             │
         |│ lesson                      │
         |│ math · fractions · grade-4  │
         |│                             │
         |│ Fractions represent parts   │
         |│ of a whole and are          │
         |│ introduced through visual   │
         |│ models.                     │
         |│                             │
         |│ ← 3 in              5 out → │
         |╰─────────────────────────────╯
         `),
      ),
    );
  });

  it("renders highlighted navigation context", () => {
    expect(
      render({
        label: "Highlighted",
        width: 36,
        context: { direction: "outgoing", depth: 2 },
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭──────────────────────────────────╮
         |│ Highlighted                      │
         |│ Introduction to Fractions        │
         |│ math/fractions/intro.md          │
         |│                                  │
         |│ lesson                           │
         |│ math · fractions · grade-4       │
         |│                                  │
         |│ Fractions represent parts of a   │
         |│ whole and are introduced through │
         |│ visual models.                   │
         |│                                  │
         |│ ← 3 in                   5 out → │
         |│                                  │
         |│ outgoing · depth 2               │
         |╰──────────────────────────────────╯
         `),
      ),
    );
  });
});
