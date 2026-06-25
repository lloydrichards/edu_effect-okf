import { String } from "effect";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { RouteGraph } from "./RouteGraph";

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const expected = (text: string): string =>
  visible(text).replace(/^\n/u, "").replace(/\n$/u, "");

describe("RouteGraph", () => {
  it("renders an outgoing route using neighborhood branch glyphs", () => {
    expect(
      visible(
        Box.renderPlainSync(
          RouteGraph({
            centerLabel: "Center",
            pathLabels: ["Fractions", "Equivalent Fractions"],
            direction: "outgoing",
            width: 40,
          }),
        ),
      ),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ Center │
         |╰─┬──────╯
         |  ╰─┬─▶ Fractions
         |    ╰──▶ Equivalent Fractions
         `),
      ),
    );
  });

  it("renders an incoming route above the center", () => {
    expect(
      visible(
        Box.renderPlainSync(
          RouteGraph({
            centerLabel: "Center",
            pathLabels: ["Prior Knowledge", "Prerequisites"],
            direction: "incoming",
            width: 40,
          }),
        ),
      ),
    ).toBe(
      expected(
        String.stripMargin(`
         |    ╭─── Prerequisites
         |  ╭─┴─ Prior Knowledge
         |╭─┴──────╮
         |│ Center │
         |╰────────╯
         `),
      ),
    );
  });

  it("renders only the center for self", () => {
    expect(
      visible(
        Box.renderPlainSync(
          RouteGraph({
            centerLabel: "Center",
            pathLabels: [],
            direction: "self",
            width: 40,
          }),
        ),
      ),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ Center │
         |╰────────╯
         `),
      ),
    );
  });
});
