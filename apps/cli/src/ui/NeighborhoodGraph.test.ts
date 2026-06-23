import { Graph, String } from "effect";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { NeighborhoodGraph } from "./NeighborhoodGraph";

type Node = {
  readonly id: string;
  readonly label: string;
};

type Edge = Record<string, never>;

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const expected = (text: string): string =>
  visible(text).replace(/^\n/u, "").replace(/\n$/u, "");

const node = (id: string, label = id): Node => ({ id, label });

const getIndex = (
  nodeIndex: ReadonlyMap<string, Graph.NodeIndex>,
  id: string,
): Graph.NodeIndex => {
  const index = nodeIndex.get(id);
  if (index === undefined) throw new Error(`Missing node index: ${id}`);
  return index;
};

const makeGraph = (
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<readonly [source: string, target: string]>,
): {
  readonly graph: Graph.DirectedGraph<Node, Edge>;
  readonly nodeIndex: Map<string, Graph.NodeIndex>;
} => {
  const nodeIndex = new Map<string, Graph.NodeIndex>();
  const graph = Graph.directed<Node, Edge>((mutable) => {
    for (const current of nodes) {
      nodeIndex.set(current.id, Graph.addNode(mutable, current));
    }

    for (const [source, target] of edges) {
      Graph.addEdge(
        mutable,
        getIndex(nodeIndex, source),
        getIndex(nodeIndex, target),
        {},
      );
    }
  });

  return { graph, nodeIndex };
};

const fixture = () =>
  makeGraph(
    [
      node("select"),
      node("parentA"),
      node("parentB"),
      node("parentC"),
      node("grandparentA"),
      node("childB"),
      node("childC"),
      node("grandchildA"),
      node("grandchildC"),
    ],
    [
      ["parentA", "select"],
      ["parentB", "select"],
      ["grandparentA", "parentC"],
      ["parentC", "select"],
      ["select", "parentA"],
      ["select", "childB"],
      ["select", "childC"],
      ["childB", "grandchildA"],
      ["childB", "parentC"],
      ["childB", "grandchildC"],
    ],
  );

const render = (
  options: Omit<
    Parameters<typeof NeighborhoodGraph<Node, Edge>>[0],
    "nodeLabel"
  >,
): string =>
  visible(
    Box.renderPlainSync(
      NeighborhoodGraph({
        ...options,
        nodeLabel: (current) => current.label,
      }),
    ),
  );

describe("NeighborhoodGraph", () => {
  it("renders a bidirectional radius-2 neighborhood with flipped predecessors and cycle markers", () => {
    const { graph, nodeIndex } = fixture();

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 2,
        direction: "both",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |  ╭─── parentA
         |  ├─── parentB
         |  │ ╭─── grandparentA
         |  ├─┴─ parentC
         |╭─┴──────╮
         |│ select │
         |╰─┬──────╯
         |  ├──▶ parentA ↗
         |  ├─┬─▶ childB
         |  │ ├──▶ grandchildA
         |  │ ├──▶ parentC ↗
         |  │ ╰──▶ grandchildC
         |  ╰──▶ childC
         `),
      ),
    );
  });

  it("renders only the selected node at radius 0", () => {
    const { graph, nodeIndex } = fixture();

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 0,
        direction: "both",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ select │
         |╰────────╯
         `),
      ),
    );
  });

  it("limits traversal to immediate neighbors at radius 1", () => {
    const { graph, nodeIndex } = fixture();

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 1,
        direction: "both",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |  ╭─── parentA
         |  ├─── parentB
         |  ├─── parentC
         |╭─┴──────╮
         |│ select │
         |╰─┬──────╯
         |  ├──▶ parentA ↗
         |  ├──▶ childB
         |  ╰──▶ childC
         `),
      ),
    );
  });

  it("can render only predecessors", () => {
    const { graph, nodeIndex } = fixture();

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 2,
        direction: "incoming",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |  ╭─── parentA
         |  ├─── parentB
         |  │ ╭─── grandparentA
         |  ├─┴─ parentC
         |╭─┴──────╮
         |│ select │
         |╰────────╯
         `),
      ),
    );
  });

  it("uses a top cap when the first predecessor has its own predecessor", () => {
    const { graph, nodeIndex } = makeGraph(
      [node("select"), node("parent"), node("grandparent")],
      [
        ["parent", "select"],
        ["grandparent", "parent"],
      ],
    );

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 2,
        direction: "incoming",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |    ╭─── grandparent
         |  ╭─┴─ parent
         |╭─┴──────╮
         |│ select │
         |╰────────╯
         `),
      ),
    );
  });

  it("can render only successors", () => {
    const { graph, nodeIndex } = fixture();

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 2,
        direction: "outgoing",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ select │
         |╰─┬──────╯
         |  ├──▶ parentA
         |  ├─┬─▶ childB
         |  │ ├──▶ grandchildA
         |  │ ├──▶ parentC
         |  │ ╰──▶ grandchildC
         |  ╰──▶ childC
         `),
      ),
    );
  });

  it("marks the first successor occurrence when a later successor repeats it", () => {
    const { graph, nodeIndex } = makeGraph(
      [node("select"), node("childA"), node("childB"), node("grandchild")],
      [
        ["select", "childA"],
        ["select", "childB"],
        ["childB", "childA"],
        ["childB", "grandchild"],
      ],
    );

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 2,
        direction: "outgoing",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ select │
         |╰─┬──────╯
         |  ├──▶ childA
         |  ╰─┬─▶ childB
         |    ├──▶ childA ↗
         |    ╰──▶ grandchild
         `),
      ),
    );
  });

  it("marks a true cycle back to an ancestor path", () => {
    const { graph, nodeIndex } = makeGraph(
      [node("select"), node("child"), node("grandchild")],
      [
        ["select", "child"],
        ["child", "grandchild"],
        ["grandchild", "child"],
      ],
    );

    expect(
      render({
        graph,
        nodeIndex: getIndex(nodeIndex, "select"),
        radius: 3,
        direction: "outgoing",
      }),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ select │
         |╰─┬──────╯
         |  ╰─┬─▶ child
         |    ╰─┬─▶ grandchild
         |      ╰──▶ child ⟳
         `),
      ),
    );
  });
});
