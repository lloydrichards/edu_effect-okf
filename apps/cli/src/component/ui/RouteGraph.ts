import { Match } from "effect";
import { Ansi, Box } from "effect-boxes";

export type RouteGraphDirection = "self" | "incoming" | "outgoing";

export type RouteGraphOptions = {
  readonly centerLabel: string;
  readonly pathLabels: ReadonlyArray<string>;
  readonly direction: RouteGraphDirection;
  readonly width: number;
};

const selectedBox = (
  label: string,
  hasIncoming: boolean,
  hasOutgoing: boolean,
): ReadonlyArray<Box.Box<Ansi.AnsiStyle>> => {
  const cap = "─".repeat(label.length);

  return [
    Box.hcat(
      [Box.text(hasIncoming ? "╭─┴" : "╭──"), Box.text(cap), Box.text("╮")],
      Box.top,
    ).pipe(Box.annotate(Ansi.dim)),
    Box.hcat([Box.text("│ "), Box.text(label), Box.text(" │")], Box.top).pipe(
      Box.annotate(Ansi.dim),
    ),
    Box.hcat(
      [Box.text(hasOutgoing ? "╰─┬" : "╰──"), Box.text(cap), Box.text("╯")],
      Box.top,
    ).pipe(Box.annotate(Ansi.dim)),
  ];
};

const routeLabel = (
  label: string,
  isHighlighted: boolean,
): Box.Box<Ansi.AnsiStyle> =>
  Box.text(label).pipe(
    Box.annotate(
      isHighlighted ? Ansi.combine(Ansi.yellow, Ansi.bold) : Ansi.dim,
    ),
  );

const outgoingRoute = (
  centerLabel: string,
  pathLabels: ReadonlyArray<string>,
): Box.Box<Ansi.AnsiStyle> =>
  Box.vcat(
    [
      ...selectedBox(centerLabel, false, pathLabels.length > 0),
      ...pathLabels.map((label, index) =>
        Box.hcat(
          [
            Box.text(
              `${"  ".repeat(index + 1)}${index === pathLabels.length - 1 ? "╰──▶ " : "╰─┬─▶ "}`,
            ).pipe(Box.annotate(Ansi.dim)),
            routeLabel(label, index === pathLabels.length - 1),
          ],
          Box.top,
        ),
      ),
    ],
    Box.left,
  );

const incomingRoute = (
  centerLabel: string,
  pathLabels: ReadonlyArray<string>,
): Box.Box<Ansi.AnsiStyle> =>
  Box.vcat(
    [
      ...pathLabels
        .slice()
        .reverse()
        .map((label, index) => {
          const indent = "  ".repeat(pathLabels.length - index);
          const connector = index === 0 ? "╭─── " : "╭─┴─ ";

          return Box.hcat(
            [
              Box.text(`${indent}${connector}`).pipe(Box.annotate(Ansi.dim)),
              routeLabel(label, index === 0),
            ],
            Box.top,
          );
        }),
      ...selectedBox(centerLabel, pathLabels.length > 0, false),
    ],
    Box.left,
  );

export const RouteGraph = (
  options: RouteGraphOptions,
): Box.Box<Ansi.AnsiStyle> =>
  Match.value(options.direction).pipe(
    Match.when("self", () =>
      Box.vcat(selectedBox(options.centerLabel, false, false), Box.left),
    ),
    Match.when("incoming", () =>
      incomingRoute(options.centerLabel, options.pathLabels),
    ),
    Match.orElse(() => outgoingRoute(options.centerLabel, options.pathLabels)),
    Box.truncate(options.width, Box.left),
  );
