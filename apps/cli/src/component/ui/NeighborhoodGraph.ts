import { Array, Graph, Match, Option, pipe } from "effect";
import { Ansi, Box } from "effect-boxes";

export type NeighborhoodGraphDirection = "incoming" | "outgoing" | "both";
export type NeighborhoodGraphHighlightDirection = "incoming" | "outgoing";

export type NeighborhoodGraphOptions<N, E> = {
  readonly graph: Graph.Graph<N, E>;
  readonly nodeIndex: Graph.NodeIndex;
  readonly highlightedNodeIndex?: Graph.NodeIndex | undefined;
  readonly highlightedPath?: ReadonlyArray<Graph.NodeIndex> | undefined;
  readonly highlightedDirection?:
    | NeighborhoodGraphHighlightDirection
    | undefined;
  readonly radius: number;
  readonly direction: NeighborhoodGraphDirection;
  readonly nodeLabel: (node: N) => string;
};

type Branch = {
  readonly index: Graph.NodeIndex;
  readonly label: string;
  readonly children: ReadonlyArray<Branch>;
  readonly repeat: Repeat | undefined;
};

type Repeat = "Cycle" | "CrossLink";

type Highlight = {
  readonly nodeIndex: Graph.NodeIndex | undefined;
  readonly path: ReadonlyArray<Graph.NodeIndex> | undefined;
  readonly direction: NeighborhoodGraphHighlightDirection | undefined;
};

type BuildContext = {
  readonly root: Graph.NodeIndex;
  readonly seen: ReadonlySet<Graph.NodeIndex>;
};

const buildBranches = <N, E>(
  options: NeighborhoodGraphOptions<N, E>,
  direction: "incoming" | "outgoing",
  from: Graph.NodeIndex,
  radius: number,
  context: BuildContext,
): ReadonlyArray<Branch> => {
  if (radius <= 0) return [];

  return Match.value(direction).pipe(
    Match.when("incoming", () => Graph.predecessors(options.graph, from)),
    Match.orElse(() => Graph.successors(options.graph, from)),
    Array.filter((index) => index !== context.root),
    Array.flatMap((index) =>
      pipe(
        Graph.getNode(options.graph, index),
        Option.match({
          onNone: () => [],
          onSome: (node) => {
            const repeat: Repeat | undefined = context.seen.has(index)
              ? "Cycle"
              : undefined;
            const nextSeen = new Set(context.seen).add(index);

            return [
              {
                index,
                label: options.nodeLabel(node),
                repeat,
                children:
                  repeat !== undefined
                    ? []
                    : buildBranches(options, direction, index, radius - 1, {
                        ...context,
                        seen: nextSeen,
                      }),
              },
            ];
          },
        }),
      ),
    ),
  );
};

const walkBranches = (
  branches: ReadonlyArray<Branch>,
  seen = new Set<Graph.NodeIndex>(),
  highlightedPath: ReadonlyArray<Graph.NodeIndex> | undefined = undefined,
  path: ReadonlyArray<Graph.NodeIndex> = [],
): ReadonlyArray<Branch> =>
  branches.map((branch) => {
    const branchPath = [...path, branch.index];
    const isHighlightedPath = isPathPrefix(branchPath, highlightedPath);

    if (seen.has(branch.index) && !isHighlightedPath) {
      return { ...branch, repeat: branch.repeat ?? "CrossLink", children: [] };
    }

    seen.add(branch.index);
    return {
      ...branch,
      children:
        branch.repeat !== undefined
          ? []
          : walkBranches(branch.children, seen, highlightedPath, branchPath),
    };
  });

const isPathPrefix = (
  prefix: ReadonlyArray<Graph.NodeIndex>,
  path: ReadonlyArray<Graph.NodeIndex> | undefined,
): boolean =>
  path !== undefined &&
  prefix.length <= path.length &&
  prefix.every((nodeIndex, index) => nodeIndex === path[index]);

const isSamePath = (
  left: ReadonlyArray<Graph.NodeIndex>,
  right: ReadonlyArray<Graph.NodeIndex> | undefined,
): boolean =>
  right !== undefined &&
  left.length === right.length &&
  left.every((nodeIndex, index) => nodeIndex === right[index]);

const LabelBox = (
  branch: Branch,
  highlight: Highlight,
  path: ReadonlyArray<Graph.NodeIndex>,
  direction: NeighborhoodGraphHighlightDirection,
) =>
  Box.hcat(
    [
      Box.text(branch.label),
      Match.value(branch.repeat).pipe(
        Match.when("Cycle", () => Box.text(" ⟳")),
        Match.when("CrossLink", () => Box.text(" ↗")),
        Match.orElse(() => Box.nullBox),
      ),
    ],
    Box.top,
  ).pipe(
    Box.annotate(
      isSamePath(path, highlight.path) && direction === highlight.direction
        ? Ansi.combine(Ansi.yellow, Ansi.bold)
        : branch.index === highlight.nodeIndex
          ? Ansi.cyan
          : branch.repeat !== undefined
            ? Ansi.dim
            : Ansi.fgDefault,
    ),
  );

const DownBranchBox = (
  branch: Branch,
  prefix: Box.Box,
  isLast: boolean,
  highlight: Highlight,
  path: ReadonlyArray<Graph.NodeIndex>,
): Box.Box =>
  Box.vcat(
    [
      Box.hcat(
        [
          prefix,
          Box.text(isLast ? "╰" : "├"),
          Box.text(branch.children.length > 0 ? "─┬─▶ " : "──▶ "),
          LabelBox(branch, highlight, path, "outgoing"),
        ],
        Box.top,
      ),
      ...branch.children.flatMap((child, index) =>
        DownBranchBox(
          child,
          Box.hcat([prefix, Box.text(isLast ? "  " : "│ ")], Box.top),
          index === branch.children.length - 1,
          highlight,
          [...path, child.index],
        ),
      ),
    ],
    Box.left,
  );

const UpRootBox = (branch: Branch, isFirst: boolean, highlight: Highlight) => {
  const path = [branch.index];

  if (branch.children.length === 0) {
    return Box.hcat(
      [
        Box.text("  "),
        Box.text(isFirst ? "╭" : "├"),
        Box.text("─── "),
        LabelBox(branch, highlight, path, "incoming"),
      ],
      Box.top,
    );
  }

  return Box.vcat(
    [
      ...branch.children.map((child, index) =>
        Box.hcat(
          [
            Box.text(
              isFirst
                ? index === 0
                  ? "    ╭─── "
                  : "    ├─── "
                : index === 0
                  ? "  │ ╭─── "
                  : "  │ ├─── ",
            ),
            LabelBox(child, highlight, [...path, child.index], "incoming"),
          ],
          Box.top,
        ),
      ),
      Box.hcat(
        [
          Box.text(isFirst ? "  ╭─┴─ " : "  ├─┴─ "),
          LabelBox(branch, highlight, path, "incoming"),
        ],
        Box.top,
      ),
    ],
    Box.left,
  );
};

const selectedBox = (
  label: string,
  hasIncoming: boolean,
  hasOutgoing: boolean,
  isHighlighted: boolean,
): ReadonlyArray<Box.Box<Ansi.AnsiStyle>> => {
  const right = "─".repeat(label.length);
  const annotate = isHighlighted
    ? Box.annotate(Ansi.combine(Ansi.yellow, Ansi.bold))
    : Box.annotate(Ansi.fgDefault);

  return [
    Box.hcat(
      [Box.text(hasIncoming ? "╭─┴" : "╭──"), Box.text(right), Box.text("╮")],
      Box.top,
    ).pipe(annotate),
    Box.hcat([Box.text("│ "), Box.text(label), Box.text(" │")], Box.top).pipe(
      annotate,
    ),
    Box.hcat(
      [Box.text(hasOutgoing ? "╰─┬" : "╰──"), Box.text(right), Box.text("╯")],
      Box.top,
    ).pipe(annotate),
  ];
};

export const NeighborhoodGraph = <N, E>(
  options: NeighborhoodGraphOptions<N, E>,
) => {
  const selected = Graph.getNode(options.graph, options.nodeIndex);
  if (Option.isNone(selected)) return Box.nullBox;

  const incoming =
    options.direction === "outgoing"
      ? []
      : buildBranches(options, "incoming", options.nodeIndex, options.radius, {
          root: options.nodeIndex,
          seen: new Set<Graph.NodeIndex>([options.nodeIndex]),
        });

  const normIncoming = walkBranches(incoming);

  const outgoing =
    options.direction === "incoming"
      ? []
      : buildBranches(options, "outgoing", options.nodeIndex, options.radius, {
          root: options.nodeIndex,
          seen: new Set<Graph.NodeIndex>([options.nodeIndex]),
        });

  const normOutgoing = walkBranches(
    outgoing,
    new Set([
      options.nodeIndex,
      ...normIncoming.reduce((acc, branch) => {
        acc.add(branch.index);
        const child = branch.children[0];
        if (child !== undefined) acc.add(child.index);
        return acc;
      }, new Set<Graph.NodeIndex>()),
    ]),
    options.highlightedDirection === "outgoing"
      ? options.highlightedPath
      : undefined,
  );

  const highlight: Highlight = {
    nodeIndex: options.highlightedNodeIndex,
    path: options.highlightedPath,
    direction: options.highlightedDirection,
  };

  return Box.vcat(
    [
      ...normIncoming.map((branch, index) =>
        UpRootBox(branch, index === 0, highlight),
      ),
      ...selectedBox(
        options.nodeLabel(selected.value),
        incoming.length > 0,
        outgoing.length > 0,
        options.highlightedNodeIndex === options.nodeIndex &&
          options.highlightedPath?.length === 0,
      ),
      ...normOutgoing.map((branch, index) =>
        DownBranchBox(
          branch,
          Box.text("  "),
          index === normOutgoing.length - 1,
          highlight,
          [branch.index],
        ),
      ),
    ],
    Box.left,
  );
};
