import {
  Array as Arr,
  Data,
  Effect,
  Graph,
  Match,
  Option,
  pipe,
  Terminal,
} from "effect";
import { Prompt } from "effect/unstable/cli";
import { Ansi, Box, Cmd, Flex } from "effect-boxes";
import { NeighborhoodGraph } from "./ui/NeighborhoodGraph";

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

export type NeighborhoodExplorerOptions<N, E> = {
  readonly graph: Graph.Graph<N, E>;
  readonly nodeIndex: Graph.NodeIndex;
  readonly radius?: number | undefined;
  readonly message?: string | undefined;
  readonly nodeLabel: (node: N) => string;
};

type Direction = "self" | "incoming" | "outgoing";

type NavigationTarget = {
  readonly nodeIndex: Graph.NodeIndex;
  readonly direction: Direction;
  readonly path: ReadonlyArray<Graph.NodeIndex>;
};

type NeighborhoodExplorerState = {
  readonly center: Graph.NodeIndex;
  readonly direction: Direction;
  readonly path: ReadonlyArray<Graph.NodeIndex>;
  readonly cursor: number;
};

const neighbors = <N, E>(
  graph: Graph.Graph<N, E>,
  nodeIndex: Graph.NodeIndex,
  direction: Exclude<Direction, "self">,
): ReadonlyArray<Graph.NodeIndex> =>
  direction === "incoming"
    ? Graph.predecessors(graph, nodeIndex)
    : Graph.successors(graph, nodeIndex);

const immediateNeighbors = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
): ReadonlyArray<NavigationTarget> => [
  ...Graph.predecessors(graph, center).map((nodeIndex) => ({
    nodeIndex,
    direction: "incoming" as const,
    path: [nodeIndex],
  })),
  { nodeIndex: center, direction: "self", path: [] },
  ...Graph.successors(graph, center).map((nodeIndex) => ({
    nodeIndex,
    direction: "outgoing" as const,
    path: [nodeIndex],
  })),
];

const selfCursor = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
): number => Graph.predecessors(graph, center).length;

const isOppositeSideCrossLink = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  target: NavigationTarget,
): boolean =>
  target.direction === "self"
    ? false
    : target.direction === "outgoing"
      ? Graph.predecessors(graph, center).includes(target.nodeIndex)
      : Graph.successors(graph, center).includes(target.nodeIndex);

const canExpandTarget = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  target: NavigationTarget,
): boolean => !isOppositeSideCrossLink(graph, center, target);

const frontier = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  direction: Direction,
  path: ReadonlyArray<Graph.NodeIndex>,
): ReadonlyArray<NavigationTarget> => {
  if (path.length === 0) return immediateNeighbors(graph, center);
  if (direction === "self") return [];

  const anchor = pipe(
    path,
    Arr.last,
    Option.getOrElse(() => center),
  );

  return pipe(
    neighbors(graph, anchor, direction),
    Arr.filter(
      (nodeIndex) => nodeIndex !== center && !path.includes(nodeIndex),
    ),
    Arr.map((nodeIndex) => ({
      nodeIndex,
      direction,
      path: [...path, nodeIndex],
    })),
  );
};

const selectedNodeIndex = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  state: NeighborhoodExplorerState,
): Option.Option<NavigationTarget> =>
  pipe(
    frontier(options.graph, state.center, state.direction, state.path),
    Arr.get(state.cursor),
  );

const clampCursor = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  state: NeighborhoodExplorerState,
): NeighborhoodExplorerState => {
  const nodes = frontier(
    options.graph,
    state.center,
    state.direction,
    state.path,
  );

  return {
    ...state,
    cursor: nodes.length === 0 ? 0 : state.cursor % nodes.length,
  };
};

const stripAnsi = (text: string): string =>
  text.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu"), "");

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const renderLines = (lines: ReadonlyArray<string>): Box.Box<never> =>
  Box.text(lines.join("\n"));

const panel = (
  title: string,
  width: number,
  height: number,
  body: Box.Box<Ansi.AnsiStyle>,
): Box.Box<unknown> => {
  const innerWidth = Math.max(1, width - 4);
  const innerHeight = Math.max(1, height - 2);
  const titleBox = Box.text(title).pipe(
    Box.truncate(innerWidth, Box.left),
    Box.annotate(Ansi.bold),
  );
  const bodyHeight = Math.max(0, innerHeight - 1);

  return Box.vcat(
    [
      titleBox,
      body.pipe(
        Box.truncate(innerWidth, Box.left),
        Box.maxHeight(bodyHeight),
        Box.minHeight(bodyHeight),
      ),
    ],
    Box.left,
  ).pipe(Box.minWidth(innerWidth), Box.pad(0, 1), Box.border("rounded"));
};

const panelBodyHeight = (height: number): number =>
  Math.max(1, Math.max(1, height - 2) - 1);

const nodeLabel = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  nodeIndex: Graph.NodeIndex,
): string =>
  pipe(
    Graph.getNode(options.graph, nodeIndex),
    Option.map(options.nodeLabel),
    Option.getOrElse(() => nodeIndex.toString()),
  );

const nodeDetails = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  nodeIndex: Graph.NodeIndex,
  extra: ReadonlyArray<string>,
): Box.Box<Ansi.AnsiStyle> =>
  Box.vsep(
    [
      Box.text(nodeLabel(options, nodeIndex)).pipe(Box.annotate(Ansi.cyan)),
      Box.vcat(
        [
          Box.text(`index: ${nodeIndex}`),
          Box.text(
            `parents: ${Graph.predecessors(options.graph, nodeIndex).length}`,
          ),
          Box.text(
            `children: ${Graph.successors(options.graph, nodeIndex).length}`,
          ),
          ...extra.map((line) => Box.text(line)),
        ],
        Box.left,
      ).pipe(Box.annotate(Ansi.dim)),
    ],
    1,
    Box.left,
  );

const graphViewport = (
  graph: Box.Box<Ansi.AnsiStyle>,
  selectedLabel: string,
  selectedDirection: Direction | undefined,
  width: number,
  height: number,
): Box.Box<Ansi.AnsiStyle> => {
  const lines = Box.renderPrettySync(graph).split("\n");
  const plainLines = lines.map(stripAnsi);
  const isSelectedLine = (line: string) => {
    if (selectedLabel === "none" || !line.includes(selectedLabel)) return false;
    if (selectedDirection === "self")
      return line.includes(`│ ${selectedLabel} │`);

    return selectedDirection === "outgoing"
      ? line.includes(`▶ ${selectedLabel}`)
      : !line.includes(`▶ ${selectedLabel}`);
  };
  const selectedRow = Math.max(0, plainLines.findIndex(isSelectedLine));
  const bodyHeight = Math.max(1, height);
  const maxOffset = Math.max(0, lines.length - bodyHeight);
  const offset = clamp(selectedRow - Math.floor(bodyHeight / 2), 0, maxOffset);
  const visible = lines.slice(offset, offset + bodyHeight);

  return renderLines(visible).pipe(
    Box.truncate(width, Box.left),
    Box.maxHeight(height),
    Box.minHeight(height),
    Box.annotate(Ansi.fgDefault),
  );
};

const renderLayout = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  state: NeighborhoodExplorerState,
  submitted: boolean,
) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    const terminalWidth = yield* terminal.columns;
    const terminalHeight = yield* terminal.rows;
    const width = Math.max(60, terminalWidth);
    const height = Math.max(12, terminalHeight - 1);
    const label = Box.text(options.message ?? "Explore neighborhood").pipe(
      Box.annotate(Ansi.bold),
    );

    const selected = selectedNodeIndex(options, state);
    const selectedLabel = pipe(
      selected,
      Option.flatMap((target) =>
        Graph.getNode(options.graph, target.nodeIndex),
      ),
      Option.map(options.nodeLabel),
      Option.getOrElse(() => "none"),
    );
    const selectedDirection = pipe(
      selected,
      Option.map((target) => target.direction),
      Option.getOrUndefined,
    );
    const selectedGraphDirection =
      selectedDirection === "self" ? undefined : selectedDirection;

    if (submitted) {
      const centerLabel = pipe(
        Graph.getNode(options.graph, state.center),
        Option.map(options.nodeLabel),
        Option.getOrElse(() => state.center.toString()),
      );

      return Box.hsep(
        [
          Box.text("✔").pipe(Box.annotate(Ansi.green)),
          label,
          Box.text(centerLabel).pipe(Box.annotate(Ansi.cyan)),
        ],
        1,
        Box.top,
      );
    }

    const graph = NeighborhoodGraph({
      graph: options.graph,
      nodeIndex: state.center,
      highlightedNodeIndex: pipe(
        selected,
        Option.map((target) => target.nodeIndex),
        Option.getOrUndefined,
      ),
      highlightedPath: pipe(
        selected,
        Option.map((target) => target.path),
        Option.getOrUndefined,
      ),
      highlightedDirection: selectedGraphDirection,
      radius: options.radius ?? 3,
      direction: "both",
      nodeLabel: options.nodeLabel,
    });

    const status = Box.hsep(
      [
        Box.text("highlight:"),
        Box.text(selectedLabel).pipe(Box.annotate(Ansi.yellow)),
        Box.text(`(${state.direction}, depth ${state.path.length + 1})`).pipe(
          Box.annotate(Ansi.dim),
        ),
      ],
      1,
      Box.left,
    );

    const hints = Box.text(
      "up/down parents/children · left/right level · enter recenter · esc submit",
    ).pipe(Box.annotate(Ansi.dim));

    const centerNode = nodeDetails(options, state.center, ["current center"]);
    const highlightedNode = pipe(
      selected,
      Option.match({
        onNone: () =>
          Box.text("No highlighted node").pipe(Box.annotate(Ansi.dim)),
        onSome: (target) =>
          nodeDetails(options, target.nodeIndex, [
            `direction: ${target.direction}`,
            `depth: ${target.path.length}`,
            `path: ${target.path.map((index) => nodeLabel(options, index)).join(" → ")}`,
          ]),
      }),
    );
    const headerHeight = 1;
    const footerHeight = 2;
    const panelHeight = Math.max(6, height - headerHeight - footerHeight - 2);
    const sideMinWidth = 24;
    const canShowSides = width >= 90;
    const row = canShowSides
      ? Flex.row(
          [
            Flex.fill((panelWidth) =>
              panel(
                "Current",
                Math.max(sideMinWidth, panelWidth),
                panelHeight,
                centerNode,
              ),
            ),
            Flex.fill(
              (panelWidth) =>
                panel(
                  "Neighborhood",
                  panelWidth,
                  panelHeight,
                  graphViewport(
                    graph,
                    selectedLabel,
                    selectedDirection,
                    Math.max(1, panelWidth - 4),
                    panelBodyHeight(panelHeight),
                  ),
                ),
              2,
            ),
            Flex.fill((panelWidth) =>
              panel(
                "Highlighted",
                Math.max(sideMinWidth, panelWidth),
                panelHeight,
                highlightedNode,
              ),
            ),
          ],
          width,
          { gap: 1 },
        )
      : panel(
          "Neighborhood",
          width,
          panelHeight,
          graphViewport(
            graph,
            selectedLabel,
            selectedDirection,
            Math.max(1, width - 4),
            panelBodyHeight(panelHeight),
          ),
        );

    return Box.vsep([label, row, status, hints], 1, Box.left).pipe(
      Box.maxHeight(height),
    );
  });

export const NeighborhoodExplorer = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
): Prompt.Prompt<Graph.NodeIndex> => {
  const initialState: NeighborhoodExplorerState = {
    center: options.nodeIndex,
    direction: "outgoing",
    path: [],
    cursor: selfCursor(options.graph, options.nodeIndex),
  };

  let hasRendered = false;

  return Prompt.custom<NeighborhoodExplorerState, Graph.NodeIndex>(
    initialState,
    {
      render: Effect.fnUntraced(function* (state, action) {
        const layout = yield* Action.$match(action, {
          Beep: () => renderLayout(options, state, false),
          Submit: () => renderLayout(options, state, true),
          NextFrame: ({ state: nextState }) =>
            renderLayout(options, nextState, false),
          default: () => renderLayout(options, state, false),
        });

        if (action._tag === "Submit") {
          return yield* Box.renderPretty(
            Box.combineAll([
              Cmd.cursorShow,
              Cmd.altScreenLeave,
              layout,
              Cmd.cursorNextLine(1),
            ]),
          );
        }

        const setup = hasRendered
          ? Box.combine(Cmd.home, Cmd.clearScreen)
          : Box.combineAll([
              Cmd.altScreenEnter,
              Cmd.cursorHide,
              Cmd.clearScreen,
            ]);
        hasRendered = true;

        return yield* Box.renderPretty(
          Box.combine(setup, layout.pipe(Box.combine(Cmd.cursorHide))),
        );
      }),
      process: Effect.fnUntraced(function* (input, state) {
        const maxDepth = options.radius ?? 3;
        const currentFrontier = frontier(
          options.graph,
          state.center,
          state.direction,
          state.path,
        );
        const next = (state: NeighborhoodExplorerState) =>
          Action.NextFrame({ state: clampCursor(options, state) });
        const cycleCursor = (offset: number) =>
          currentFrontier.length === 0
            ? 0
            : (state.cursor + offset + currentFrontier.length) %
              currentFrontier.length;
        const depth = state.path.length + 1;

        return Match.value(input).pipe(
          Match.when({ key: { name: "up" } }, () =>
            depth === 1
              ? next({ ...state, cursor: cycleCursor(-1) })
              : next({
                  ...state,
                  cursor: cycleCursor(1),
                }),
          ),
          Match.when({ key: { name: "down" } }, () =>
            depth === 1
              ? next({ ...state, cursor: cycleCursor(1) })
              : next({
                  ...state,
                  cursor: cycleCursor(1),
                }),
          ),
          Match.when({ key: { name: "left" } }, () =>
            next({
              ...state,
              path: state.path.slice(0, -1),
              cursor: 0,
            }),
          ),
          Match.when({ key: { name: "right" } }, () =>
            pipe(
              Arr.get(currentFrontier, state.cursor),
              Option.match({
                onNone: () => Action.Beep(),
                onSome: (selected) =>
                  depth >= maxDepth ||
                  selected.direction === "self" ||
                  !canExpandTarget(options.graph, state.center, selected) ||
                  frontier(
                    options.graph,
                    state.center,
                    selected.direction,
                    selected.path,
                  ).length === 0
                    ? Action.Beep()
                    : next({
                        ...state,
                        direction: selected.direction,
                        path: selected.path,
                        cursor: 0,
                      }),
              }),
            ),
          ),
          Match.when({ key: { name: "return" } }, () =>
            pipe(
              Arr.get(currentFrontier, state.cursor),
              Option.match({
                onNone: () => Action.Beep(),
                onSome: (target) =>
                  next({
                    center: target.nodeIndex,
                    direction: "outgoing",
                    path: [],
                    cursor: selfCursor(options.graph, target.nodeIndex),
                  }),
              }),
            ),
          ),
          Match.when({ key: { name: "escape" } }, () =>
            Action.Submit({ value: state.center }),
          ),
          Match.orElse(() => next(state)),
        );
      }),
      clear: () => Effect.succeed(""),
    },
  );
};
