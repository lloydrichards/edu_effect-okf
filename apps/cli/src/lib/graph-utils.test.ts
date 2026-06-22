import { describe, expect, it } from "@effect/vitest";
import { Graph, pipe } from "effect";
import {
  complement,
  difference,
  intersection,
  neighborhood,
  sum,
  symmetricDifference,
  union,
} from "./graph-utils";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

type N = { id: string; label: string };
type E = { weight: number };

const nodeId = (n: N): string => n.id;

const mkNode = (id: string, label?: string): N => ({
  id,
  label: label ?? id,
});
const mkEdge = (weight = 1): E => ({ weight });

/** Build a simple directed graph from node list + edge list */
const mkGraph = (
  nodes: Array<N>,
  edges: Array<[string, string, E]>,
): Graph.DirectedGraph<N, E> =>
  Graph.directed<N, E>((m) => {
    const idx = new Map<string, Graph.NodeIndex>();
    for (const n of nodes) {
      idx.set(n.id, Graph.addNode(m, n));
    }
    for (const [src, tgt, data] of edges) {
      Graph.addEdge(m, idx.get(src)!, idx.get(tgt)!, data);
    }
  });

/** Get all node IDs from a graph */
const getNodeIds = (g: Graph.DirectedGraph<N, E>): Set<string> => {
  const ids = new Set<string>();
  for (const [, data] of g) {
    ids.add(data.id);
  }
  return ids;
};

/** Get all edges as "src->tgt" strings */
const getEdgeKeys = (g: Graph.DirectedGraph<N, E>): Set<string> => {
  const keys = new Set<string>();
  const indexToId = new Map<Graph.NodeIndex, string>();
  for (const [idx, data] of g) {
    indexToId.set(idx, data.id);
  }
  for (const [, edge] of Graph.edges(g)) {
    keys.add(`${indexToId.get(edge.source)}->${indexToId.get(edge.target)}`);
  }
  return keys;
};

// ---------------------------------------------------------------------------
// compose (union)
// ---------------------------------------------------------------------------

describe("compose", () => {
  it("merges disjoint graphs", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge(1)]]);
    const g2 = mkGraph([mkNode("c"), mkNode("d")], [["c", "d", mkEdge(2)]]);

    const result = union(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b", "c", "d"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["a->b", "c->d"]));
  });

  it("merges overlapping graphs — that wins on node conflict", () => {
    const g1 = mkGraph(
      [mkNode("a", "from-self"), mkNode("b")],
      [["a", "b", mkEdge(1)]],
    );
    const g2 = mkGraph(
      [mkNode("a", "from-that"), mkNode("c")],
      [["a", "c", mkEdge(2)]],
    );

    const result = union(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b", "c"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["a->b", "a->c"]));

    // Verify "that" wins for overlapping node data
    for (const [, data] of result) {
      if (data.id === "a") {
        expect(data.label).toBe("from-that");
      }
    }
  });

  it("that wins on edge conflict (same source+target)", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge(10)]]);
    const g2 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge(99)]]);

    const result = union(g1, g2, nodeId);

    for (const [, edge] of Graph.edges(result)) {
      expect(edge.data.weight).toBe(99);
    }
  });

  it("handles empty graphs", () => {
    const g1 = mkGraph([mkNode("a")], []);
    const empty = mkGraph([], []);

    const result = union(g1, empty, nodeId);
    expect(getNodeIds(result)).toEqual(new Set(["a"]));
    expect(Graph.edgeCount(result)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

describe("intersection", () => {
  it("keeps only nodes and edges in both", () => {
    const g1 = mkGraph(
      [mkNode("a"), mkNode("b"), mkNode("c")],
      [
        ["a", "b", mkEdge(1)],
        ["b", "c", mkEdge(2)],
      ],
    );
    const g2 = mkGraph(
      [mkNode("a"), mkNode("b"), mkNode("d")],
      [
        ["a", "b", mkEdge(3)],
        ["a", "d", mkEdge(4)],
      ],
    );

    const result = intersection(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["a->b"]));
  });

  it("returns empty graph when no common nodes", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);
    const g2 = mkGraph([mkNode("c"), mkNode("d")], [["c", "d", mkEdge()]]);

    const result = intersection(g1, g2, nodeId);

    expect(Graph.nodeCount(result)).toBe(0);
    expect(Graph.edgeCount(result)).toBe(0);
  });

  it("common nodes but no common edges", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);
    const g2 = mkGraph([mkNode("a"), mkNode("b")], [["b", "a", mkEdge()]]);

    const result = intersection(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b"]));
    expect(Graph.edgeCount(result)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

describe("difference", () => {
  it("keeps all self nodes, removes edges found in that", () => {
    const g1 = mkGraph(
      [mkNode("a"), mkNode("b"), mkNode("c")],
      [
        ["a", "b", mkEdge(1)],
        ["b", "c", mkEdge(2)],
      ],
    );
    const g2 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge(9)]]);

    const result = difference(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b", "c"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["b->c"]));
  });

  it("no common edges means self is unchanged", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);
    const g2 = mkGraph([mkNode("a"), mkNode("b")], [["b", "a", mkEdge()]]);

    const result = difference(g1, g2, nodeId);

    expect(getEdgeKeys(result)).toEqual(new Set(["a->b"]));
  });

  it("all edges in common means result has no edges", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);
    const g2 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);

    const result = difference(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b"]));
    expect(Graph.edgeCount(result)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// symmetricDifference
// ---------------------------------------------------------------------------

describe("symmetricDifference", () => {
  it("keeps edges in exactly one graph", () => {
    const g1 = mkGraph(
      [mkNode("a"), mkNode("b"), mkNode("c")],
      [
        ["a", "b", mkEdge(1)],
        ["b", "c", mkEdge(2)],
      ],
    );
    const g2 = mkGraph(
      [mkNode("a"), mkNode("b"), mkNode("d")],
      [
        ["a", "b", mkEdge(3)],
        ["a", "d", mkEdge(4)],
      ],
    );

    const result = symmetricDifference(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b", "c", "d"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["b->c", "a->d"]));
  });

  it("identical graphs produce empty edge set", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);
    const g2 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);

    const result = symmetricDifference(g1, g2, nodeId);

    expect(getNodeIds(result)).toEqual(new Set(["a", "b"]));
    expect(Graph.edgeCount(result)).toBe(0);
  });

  it("disjoint graphs keeps all edges", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);
    const g2 = mkGraph([mkNode("c"), mkNode("d")], [["c", "d", mkEdge()]]);

    const result = symmetricDifference(g1, g2, nodeId);

    expect(getEdgeKeys(result)).toEqual(new Set(["a->b", "c->d"]));
  });
});

// ---------------------------------------------------------------------------
// complement
// ---------------------------------------------------------------------------

describe("complement", () => {
  it("produces all non-existing directed edges", () => {
    // Triangle: a->b, b->c, c->a
    const g = mkGraph(
      [mkNode("a"), mkNode("b"), mkNode("c")],
      [
        ["a", "b", mkEdge()],
        ["b", "c", mkEdge()],
        ["c", "a", mkEdge()],
      ],
    );

    const result = complement(g, (src, tgt) => ({ weight: 0 }));

    expect(getNodeIds(result)).toEqual(new Set(["a", "b", "c"]));
    // 3 nodes = 6 possible directed edges - 3 existing = 3 complement edges
    expect(Graph.edgeCount(result)).toBe(3);
    expect(getEdgeKeys(result)).toEqual(new Set(["b->a", "c->b", "a->c"]));
  });

  it("complement of complete graph is empty", () => {
    // Complete directed graph on 2 nodes: a->b, b->a
    const g = mkGraph(
      [mkNode("a"), mkNode("b")],
      [
        ["a", "b", mkEdge()],
        ["b", "a", mkEdge()],
      ],
    );

    const result = complement(g, () => ({ weight: 0 }));

    expect(Graph.edgeCount(result)).toBe(0);
  });

  it("complement of empty graph is complete (no self-loops)", () => {
    const g = mkGraph([mkNode("a"), mkNode("b"), mkNode("c")], []);

    const result = complement(g, () => ({ weight: 0 }));

    // 3 nodes, 6 possible directed edges, 0 existing = 6 complement
    expect(Graph.edgeCount(result)).toBe(6);
  });

  it("does not create self-loops", () => {
    const g = mkGraph([mkNode("a")], []);

    const result = complement(g, () => ({ weight: 0 }));

    expect(Graph.edgeCount(result)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// neighborhood
// ---------------------------------------------------------------------------

describe("neighborhood", () => {
  // Linear chain: a -> b -> c -> d -> e
  const chain = mkGraph(
    [mkNode("a"), mkNode("b"), mkNode("c"), mkNode("d"), mkNode("e")],
    [
      ["a", "b", mkEdge()],
      ["b", "c", mkEdge()],
      ["c", "d", mkEdge()],
      ["d", "e", mkEdge()],
    ],
  );

  const getNodeIndex = (
    g: Graph.DirectedGraph<N, E>,
    id: string,
  ): Graph.NodeIndex => {
    for (const [idx, data] of g) {
      if (data.id === id) return idx;
    }
    throw new Error(`Node ${id} not found`);
  };

  it("radius 1 includes immediate successors and predecessors", () => {
    const cIdx = getNodeIndex(chain, "c");
    const result = neighborhood(chain, cIdx, { radius: 1 });

    expect(getNodeIds(result)).toEqual(new Set(["b", "c", "d"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["b->c", "c->d"]));
  });

  it("radius 2 reaches two hops in both directions", () => {
    const cIdx = getNodeIndex(chain, "c");
    const result = neighborhood(chain, cIdx, { radius: 2 });

    expect(getNodeIds(result)).toEqual(new Set(["a", "b", "c", "d", "e"]));
  });

  it("default radius is 1", () => {
    const cIdx = getNodeIndex(chain, "c");
    const result = neighborhood(chain, cIdx);

    expect(getNodeIds(result)).toEqual(new Set(["b", "c", "d"]));
  });

  it("leaf node only includes itself and direct neighbor", () => {
    const aIdx = getNodeIndex(chain, "a");
    const result = neighborhood(chain, aIdx, { radius: 1 });

    // a has no predecessors, only successor b
    expect(getNodeIds(result)).toEqual(new Set(["a", "b"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["a->b"]));
  });

  it("radius 0 returns only the node itself", () => {
    const cIdx = getNodeIndex(chain, "c");
    const result = neighborhood(chain, cIdx, { radius: 0 });

    expect(getNodeIds(result)).toEqual(new Set(["c"]));
    expect(Graph.edgeCount(result)).toBe(0);
  });

  it("direction outgoing follows only successors", () => {
    const cIdx = getNodeIndex(chain, "c");
    const result = neighborhood(chain, cIdx, {
      radius: 1,
      direction: "outgoing",
    });

    // c -> d only (no predecessor b)
    expect(getNodeIds(result)).toEqual(new Set(["c", "d"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["c->d"]));
  });

  it("direction incoming follows only predecessors", () => {
    const cIdx = getNodeIndex(chain, "c");
    const result = neighborhood(chain, cIdx, {
      radius: 1,
      direction: "incoming",
    });

    // b -> c only (no successor d)
    expect(getNodeIds(result)).toEqual(new Set(["b", "c"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["b->c"]));
  });

  it("direction outgoing with radius 2 reaches two hops forward", () => {
    const bIdx = getNodeIndex(chain, "b");
    const result = neighborhood(chain, bIdx, {
      radius: 2,
      direction: "outgoing",
    });

    // b -> c -> d
    expect(getNodeIds(result)).toEqual(new Set(["b", "c", "d"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["b->c", "c->d"]));
  });

  it("direction incoming with radius 2 reaches two hops backward", () => {
    const dIdx = getNodeIndex(chain, "d");
    const result = neighborhood(chain, dIdx, {
      radius: 2,
      direction: "incoming",
    });

    // b <- c <- d
    expect(getNodeIds(result)).toEqual(new Set(["b", "c", "d"]));
    expect(getEdgeKeys(result)).toEqual(new Set(["b->c", "c->d"]));
  });
});

// ---------------------------------------------------------------------------
// sum (disjoint union)
// ---------------------------------------------------------------------------

describe("sum", () => {
  it("produces disconnected components with all nodes duplicated", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge(1)]]);
    const g2 = mkGraph([mkNode("a"), mkNode("c")], [["a", "c", mkEdge(2)]]);

    const result = sum(g1, g2);

    // Both "a" nodes are present (duplicated)
    expect(Graph.nodeCount(result)).toBe(4);
    expect(Graph.edgeCount(result)).toBe(2);
  });

  it("preserves all edges from both graphs", () => {
    const g1 = mkGraph(
      [mkNode("a"), mkNode("b")],
      [
        ["a", "b", mkEdge(1)],
        ["b", "a", mkEdge(2)],
      ],
    );
    const g2 = mkGraph([mkNode("c"), mkNode("d")], [["c", "d", mkEdge(3)]]);

    const result = sum(g1, g2);

    expect(Graph.nodeCount(result)).toBe(4);
    expect(Graph.edgeCount(result)).toBe(3);
  });

  it("summing with empty graph preserves self", () => {
    const g1 = mkGraph([mkNode("a"), mkNode("b")], [["a", "b", mkEdge()]]);
    const empty = mkGraph([], []);

    const result = sum(g1, empty);

    expect(Graph.nodeCount(result)).toBe(2);
    expect(Graph.edgeCount(result)).toBe(1);
  });

  it("summing two empty graphs is empty", () => {
    const empty1 = mkGraph([], []);
    const empty2 = mkGraph([], []);

    const result = sum(empty1, empty2);

    expect(Graph.nodeCount(result)).toBe(0);
    expect(Graph.edgeCount(result)).toBe(0);
  });
});
