import { Array, Graph, Match, Option, pipe } from "effect";
import { Ansi, Box } from "effect-boxes";

export type NeighborhoodGraphDirection = "incoming" | "outgoing" | "both";

export type NeighborhoodGraphOptions<N, E> = {
  readonly graph: Graph.Graph<N, E>;
  readonly nodeIndex: Graph.NodeIndex;
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
): ReadonlyArray<Branch> =>
  branches.map((branch) => {
    if (seen.has(branch.index)) {
      return { ...branch, repeat: branch.repeat ?? "CrossLink", children: [] };
    }

    seen.add(branch.index);
    return {
      ...branch,
      children:
        branch.repeat !== undefined ? [] : walkBranches(branch.children, seen),
    };
  });

const LabelBox = (branch: Branch) =>
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
  ).pipe(Box.annotate(branch.repeat !== undefined ? Ansi.dim : Ansi.fgDefault));

const DownBranchBox = (
  branch: Branch,
  prefix: Box.Box,
  isLast: boolean,
): Box.Box =>
  Box.vcat(
    [
      Box.hcat(
        [
          prefix,
          Box.text(isLast ? "╰" : "├"),
          Box.text(branch.children.length > 0 ? "─┬─▶ " : "──▶ "),
          LabelBox(branch),
        ],
        Box.top,
      ),
      ...branch.children.flatMap((child, index) =>
        DownBranchBox(
          child,
          Box.hcat([prefix, Box.text(isLast ? "  " : "│ ")], Box.top),
          index === branch.children.length - 1,
        ),
      ),
    ],
    Box.left,
  );

const UpRootBox = (branch: Branch, isFirst: boolean) => {
  if (branch.children.length === 0) {
    return Box.hcat(
      [
        Box.text("  "),
        Box.text(isFirst ? "╭" : "├"),
        Box.text("─── "),
        LabelBox(branch),
      ],
      Box.top,
    );
  }

  const child = branch.children[0];

  return Box.vcat(
    [
      Box.hcat(
        [
          Box.text(isFirst ? "    ╭─── " : "  │ ╭─── "),
          ...(child ? [LabelBox(child)] : []),
        ],
        Box.top,
      ),
      Box.hcat(
        [Box.text(isFirst ? "  ╭─┴─ " : "  ├─┴─ "), LabelBox(branch)],
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
): ReadonlyArray<Box.Box<never>> => {
  const right = "─".repeat(label.length);

  return [
    Box.hcat(
      [Box.text(hasIncoming ? "╭─┴" : "╭──"), Box.text(right), Box.text("╮")],
      Box.top,
    ),
    Box.hcat([Box.text("│ "), Box.text(label), Box.text(" │")], Box.top),
    Box.hcat(
      [Box.text(hasOutgoing ? "╰─┬" : "╰──"), Box.text(right), Box.text("╯")],
      Box.top,
    ),
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
  );

  return Box.vcat(
    [
      ...normIncoming.map((branch, index) => UpRootBox(branch, index === 0)),
      ...selectedBox(
        options.nodeLabel(selected.value),
        incoming.length > 0,
        outgoing.length > 0,
      ),
      ...normOutgoing.map((branch, index) =>
        DownBranchBox(
          branch,
          Box.text("  "),
          index === normOutgoing.length - 1,
        ),
      ),
    ],
    Box.left,
  );
};
