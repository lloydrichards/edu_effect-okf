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
import {
  ConceptSummaryCard,
  type ConceptSummaryCardOptions,
} from "./ui/ConceptSummaryCard";
import { NeighborhoodGraph } from "./ui/NeighborhoodGraph";
import { NeighborSummaryCard } from "./ui/NeighborSummaryCard";

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

export type NeighborhoodExplorerOptions<N, E> = {
  readonly graph: Graph.Graph<N, E>;
  readonly nodeIndex: Graph.NodeIndex;
  readonly radius?: number | undefined;
  readonly message?: string | undefined;
  readonly nodeLabel: (node: N) => string;
  readonly nodeSummary?:
    | ((
        node: N,
      ) => Omit<ConceptSummaryCardOptions, "incoming" | "outgoing" | "width">)
    | undefined;
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
  readonly history: ReadonlyArray<Graph.NodeIndex>;
  readonly historyCursor: number;
};

const immediateNeighbors = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  radius: number,
): ReadonlyArray<NavigationTarget> => [
  { nodeIndex: center, direction: "self", path: [] },
  ...outgoingRootTargets(graph, center, radius),
  ...incomingRootTargets(graph, center, radius),
];

const outgoingRootTargets = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  radius: number,
): ReadonlyArray<NavigationTarget> => {
  const visit = (
    target: NavigationTarget,
    depth: number,
  ): ReadonlyArray<NavigationTarget> =>
    depth >= radius
      ? []
      : pipe(
          Graph.successors(graph, target.nodeIndex),
          Arr.filter(
            (nodeIndex) =>
              nodeIndex !== center && !target.path.includes(nodeIndex),
          ),
          Arr.flatMap((nodeIndex) => {
            const child = {
              nodeIndex,
              direction: "outgoing" as const,
              path: [...target.path, nodeIndex],
            };

            return [child, ...visit(child, depth + 1)];
          }),
        );

  const roots = Graph.successors(graph, center).map((nodeIndex) => ({
    nodeIndex,
    direction: "outgoing" as const,
    path: [nodeIndex],
  }));

  return radius <= 0
    ? []
    : pipe(
        roots,
        Arr.flatMap((root) => [root, ...visit(root, 1)]),
      );
};

const incomingRootTargets = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  radius: number,
): ReadonlyArray<NavigationTarget> => {
  const visit = (
    target: NavigationTarget,
    depth: number,
  ): ReadonlyArray<NavigationTarget> => {
    if (depth >= radius) return [target];

    const parents = pipe(
      Graph.predecessors(graph, target.nodeIndex),
      Arr.filter(
        (nodeIndex) => nodeIndex !== center && !target.path.includes(nodeIndex),
      ),
      Arr.flatMap((nodeIndex) =>
        visit(
          {
            nodeIndex,
            direction: "incoming" as const,
            path: [...target.path, nodeIndex],
          },
          depth + 1,
        ),
      ),
    );

    return [...parents, target];
  };

  return radius <= 0
    ? []
    : pipe(
        Graph.predecessors(graph, center),
        Arr.flatMap((nodeIndex) =>
          visit(
            {
              nodeIndex,
              direction: "incoming" as const,
              path: [nodeIndex],
            },
            1,
          ),
        ),
      );
};

const neighbors = <N, E>(
  graph: Graph.Graph<N, E>,
  nodeIndex: Graph.NodeIndex,
  direction: Exclude<Direction, "self">,
): ReadonlyArray<Graph.NodeIndex> =>
  direction === "incoming"
    ? Graph.predecessors(graph, nodeIndex)
    : Graph.successors(graph, nodeIndex);

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
  radius: number,
): ReadonlyArray<NavigationTarget> => {
  if (path.length === 0) return immediateNeighbors(graph, center, radius);
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
    frontier(
      options.graph,
      state.center,
      state.direction,
      state.path,
      options.radius ?? 3,
    ),
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
    options.radius ?? 3,
  );

  return {
    ...state,
    cursor: nodes.length === 0 ? 0 : state.cursor % nodes.length,
  };
};

const stripAnsi = (text: string): string =>
  text.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu"), "");

const yellowAnsi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*33m`, "u");

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

const breadcrumb = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  history: ReadonlyArray<Graph.NodeIndex>,
  cursor: number,
) =>
  Box.punctuateH(
    Arr.map(history, (index, position) =>
      Box.text(nodeLabel(options, index)).pipe(
        Box.annotate(position === cursor ? Ansi.bold : Ansi.dim),
      ),
    ),
    Box.left,
    Box.text(" ▶ ").pipe(Box.annotate(Ansi.dim)),
  );

const historyAt = (
  history: ReadonlyArray<Graph.NodeIndex>,
  cursor: number,
): Option.Option<Graph.NodeIndex> => pipe(history, Arr.get(cursor));

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

const conceptPanel = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  nodeIndex: Graph.NodeIndex,
  width: number,
  height: number,
  label: string,
  context?: ConceptSummaryCardOptions["context"] | undefined,
): Box.Box<unknown> => {
  const summary = pipe(
    Graph.getNode(options.graph, nodeIndex),
    Option.flatMap((node) =>
      options.nodeSummary
        ? Option.some(options.nodeSummary(node))
        : Option.none(),
    ),
  );

  return pipe(
    summary,
    Option.match({
      onNone: () =>
        panel(label, width, height, nodeDetails(options, nodeIndex, [])),
      onSome: (card) =>
        ConceptSummaryCard({
          ...card,
          label,
          context,
          incoming: Graph.predecessors(options.graph, nodeIndex).length,
          outgoing: Graph.successors(options.graph, nodeIndex).length,
          width,
          height,
        }),
    }),
  );
};

const neighborPanel = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  center: Graph.NodeIndex,
  target: NavigationTarget,
  width: number,
  height: number,
): Box.Box<unknown> => {
  const summary = pipe(
    Graph.getNode(options.graph, target.nodeIndex),
    Option.flatMap((node) =>
      options.nodeSummary
        ? Option.some(options.nodeSummary(node))
        : Option.none(),
    ),
  );
  const canExpand =
    target.direction !== "self" &&
    canExpandTarget(options.graph, center, target) &&
    frontier(
      options.graph,
      center,
      target.direction,
      target.path,
      options.radius ?? 3,
    ).length > 0 &&
    target.path.length + 1 < (options.radius ?? 3);
  const pathLabels = target.path.map((index) => nodeLabel(options, index));
  const centerLabel = nodeLabel(options, center);

  return pipe(
    summary,
    Option.match({
      onNone: () =>
        panel(
          "Highlighted",
          width,
          height,
          nodeDetails(options, target.nodeIndex, [
            `direction: ${target.direction}`,
            `depth: ${target.path.length}`,
          ]),
        ),
      onSome: (card) =>
        NeighborSummaryCard({
          title: card.title,
          reference: card.reference,
          type: card.type,
          centerLabel,
          pathLabels,
          direction: target.direction,
          canExpand,
          incoming: Graph.predecessors(options.graph, target.nodeIndex).length,
          outgoing: Graph.successors(options.graph, target.nodeIndex).length,
          width,
          height,
        }),
    }),
  );
};

const graphViewport = (
  graph: Box.Box<Ansi.AnsiStyle>,
  selectedLabel: string,
  selectedDirection: Direction | undefined,
  width: number,
  height: number,
): Box.Box<Ansi.AnsiStyle> => {
  const lines = Box.renderPrettySync(graph).split("\n");
  const plainLines = lines.map(stripAnsi);
  const highlightedRow = lines.findIndex(
    (line, index) =>
      plainLines[index]?.includes(selectedLabel) === true &&
      yellowAnsi.test(line),
  );
  const isSelectedLine = (line: string) => {
    if (selectedLabel === "none" || !line.includes(selectedLabel)) return false;
    if (selectedDirection === "self")
      return line.includes(`│ ${selectedLabel} │`);

    return selectedDirection === "outgoing"
      ? line.includes(`▶ ${selectedLabel}`)
      : !line.includes(`▶ ${selectedLabel}`);
  };
  const selectedRow = Math.max(
    0,
    highlightedRow === -1
      ? plainLines.findIndex(isSelectedLine)
      : highlightedRow,
  );
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

const neighborhoodBody = (
  graph: Box.Box<Ansi.AnsiStyle>,
  selectedLabel: string,
  selectedDirection: Direction | undefined,
  width: number,
  height: number,
): Box.Box<Ansi.AnsiStyle> => {
  const hint = Box.text(
    "up/down select · left/right history · enter recenter · esc submit",
  ).pipe(Box.annotate(Ansi.dim));
  const hintHeight = 1;
  const gapHeight = 1;
  const graphHeight = Math.max(1, height - hintHeight - gapHeight);

  return Box.vsep(
    [
      graphViewport(
        graph,
        selectedLabel,
        selectedDirection,
        width,
        graphHeight,
      ),
      hint,
    ],
    1,
    Box.left,
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
        Box.text("history:"),
        breadcrumb(options, state.history, state.historyCursor).pipe(
          Box.annotate(Ansi.yellow),
        ),
      ],
      1,
      Box.left,
    );

    const headerHeight = 1;
    const footerHeight = 1;
    const panelHeight = Math.max(6, height - headerHeight - footerHeight - 2);
    const sideMinWidth = 24;
    const canShowSides = width >= 90;
    const row = canShowSides
      ? Flex.row(
          [
            Flex.fill((panelWidth) =>
              conceptPanel(
                options,
                state.center,
                Math.max(sideMinWidth, panelWidth),
                panelHeight,
                "Current",
              ),
            ),
            Flex.fill(
              (panelWidth) =>
                panel(
                  "Neighborhood",
                  panelWidth,
                  panelHeight,
                  neighborhoodBody(
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
              pipe(
                selected,
                Option.match({
                  onNone: () =>
                    panel(
                      "Highlighted",
                      Math.max(sideMinWidth, panelWidth),
                      panelHeight,
                      Box.text("No highlighted node").pipe(
                        Box.annotate(Ansi.dim),
                      ),
                    ),
                  onSome: (target) =>
                    neighborPanel(
                      options,
                      state.center,
                      target,
                      Math.max(sideMinWidth, panelWidth),
                      panelHeight,
                    ),
                }),
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
          neighborhoodBody(
            graph,
            selectedLabel,
            selectedDirection,
            Math.max(1, width - 4),
            panelBodyHeight(panelHeight),
          ),
        );

    return Box.vsep([label, row, status], 1, Box.left).pipe(
      Box.maxHeight(height),
    );
  });

export const NeighborhoodExplorer = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
): Prompt.Prompt<Graph.NodeIndex> => {
  const initialState: NeighborhoodExplorerState = {
    center: options.nodeIndex,
    direction: "self",
    path: [],
    cursor: 0,
    history: [options.nodeIndex],
    historyCursor: 0,
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
        const currentFrontier = frontier(
          options.graph,
          state.center,
          state.direction,
          state.path,
          options.radius ?? 3,
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
            state.historyCursor <= 0
              ? Action.Beep()
              : pipe(
                  historyAt(state.history, state.historyCursor - 1),
                  Option.match({
                    onNone: () => Action.Beep(),
                    onSome: (center) =>
                      next({
                        ...state,
                        center,
                        direction: "self",
                        path: [],
                        cursor: 0,
                        historyCursor: state.historyCursor - 1,
                      }),
                  }),
                ),
          ),
          Match.when({ key: { name: "right" } }, () =>
            state.historyCursor >= state.history.length - 1
              ? Action.Beep()
              : pipe(
                  historyAt(state.history, state.historyCursor + 1),
                  Option.match({
                    onNone: () => Action.Beep(),
                    onSome: (center) =>
                      next({
                        ...state,
                        center,
                        direction: "self",
                        path: [],
                        cursor: 0,
                        historyCursor: state.historyCursor + 1,
                      }),
                  }),
                ),
          ),
          Match.when({ key: { name: "return" } }, () =>
            pipe(
              Arr.get(currentFrontier, state.cursor),
              Option.match({
                onNone: () => Action.Beep(),
                onSome: (target) => {
                  const historyPrefix = state.history.slice(
                    0,
                    state.historyCursor + 1,
                  );
                  const history =
                    target.path.length === 0
                      ? historyPrefix
                      : [...historyPrefix, ...target.path];

                  return next({
                    center: target.nodeIndex,
                    direction: "self",
                    path: [],
                    cursor: 0,
                    history,
                    historyCursor: history.length - 1,
                  });
                },
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
