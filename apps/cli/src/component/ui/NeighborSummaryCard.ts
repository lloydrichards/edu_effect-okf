import { Match } from "effect";
import { Ansi, Box } from "effect-boxes";
import { RouteGraph, type RouteGraphDirection } from "./RouteGraph";

export type NeighborSummaryCardOptions = {
  readonly title: string;
  readonly reference: string;
  readonly type: string;
  readonly centerLabel: string;
  readonly pathLabels: ReadonlyArray<string>;
  readonly direction: RouteGraphDirection;
  readonly canExpand: boolean;
  readonly incoming: number;
  readonly outgoing: number;
  readonly width: number;
  readonly height?: number | undefined;
};

const statsLine = (
  incoming: number,
  outgoing: number,
  width: number,
): string => {
  const left = `← ${incoming} in`;
  const right = `${outgoing} out →`;
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
};

const relationLine = (direction: RouteGraphDirection, depth: number): string =>
  Match.value(direction).pipe(
    Match.when("self", () => "current center"),
    Match.orElse(() => `${direction} neighbor · depth ${depth}`),
  );

const rightAction = (
  direction: RouteGraphDirection,
  canExpand: boolean,
): string =>
  Match.value(direction).pipe(
    Match.when("self", () => "Right  not expandable"),
    Match.orElse(() =>
      canExpand ? `Right  expand ${direction} path` : "Right  no deeper path",
    ),
  );

export const NeighborSummaryCard = (
  options: NeighborSummaryCardOptions,
): Box.Box<unknown> => {
  const width = Math.max(12, options.width);
  const innerWidth = Math.max(1, width - 4);
  const bodyHeight = options.height
    ? Math.max(1, options.height - 2)
    : undefined;
  const depth = options.pathLabels.length;
  const body = Box.vsep(
    [
      Box.vcat(
        [
          Box.text("Highlighted Neighbor").pipe(Box.annotate(Ansi.bold)),
          Box.text(options.title).pipe(Box.annotate(Ansi.bold)),
          Box.text(`${options.type} · ${options.reference}`).pipe(
            Box.annotate(Ansi.dim),
          ),
        ],
        Box.left,
      ),
      Box.text(relationLine(options.direction, depth)).pipe(
        Box.annotate(Ansi.yellow),
      ),
      Box.vcat(
        [
          Box.text("Route").pipe(Box.annotate(Ansi.bold)),
          RouteGraph({
            centerLabel: options.centerLabel,
            pathLabels: options.pathLabels,
            direction: options.direction,
            width: innerWidth,
          }),
        ],
        Box.left,
      ),
      Box.vcat(
        [
          Box.text(
            options.direction === "self"
              ? "Enter  stay centered"
              : "Enter  recenter here",
          ),
          Box.text(rightAction(options.direction, options.canExpand)),
        ],
        Box.left,
      ).pipe(Box.annotate(Ansi.dim)),
      Box.text(statsLine(options.incoming, options.outgoing, innerWidth)).pipe(
        Box.annotate(Ansi.dim),
      ),
    ],
    1,
    Box.left,
  );

  const content = bodyHeight
    ? body.pipe(Box.maxHeight(bodyHeight), Box.minHeight(bodyHeight))
    : body;

  return content.pipe(
    Box.truncate(innerWidth, Box.left),
    Box.minWidth(innerWidth),
    Box.pad(0, 1),
    Box.border("rounded"),
  );
};
