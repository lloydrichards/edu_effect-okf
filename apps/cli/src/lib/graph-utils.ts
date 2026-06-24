import { Function, Graph, Option } from "effect";
import { dual } from "effect/Function";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeId<N> = (node: N) => string;

type NodeMaps<N> = {
  readonly byId: Map<string, { index: Graph.NodeIndex; data: N }>;
  readonly byIndex: Map<Graph.NodeIndex, string>;
};

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

const buildNodeMaps = <N, E>(
  graph: Graph.Graph<N, E>,
  nodeId: NodeId<N>,
): NodeMaps<N> => {
  const byId = new Map<string, { index: Graph.NodeIndex; data: N }>();
  const byIndex = new Map<Graph.NodeIndex, string>();
  for (const [index, data] of graph) {
    const id = nodeId(data);
    byId.set(id, { index, data });
    byIndex.set(index, id);
  }
  return { byId, byIndex };
};

const edgeKey = (sourceId: string, targetId: string): string =>
  `${sourceId}\0${targetId}`;

/**
 * Returns the union of two graphs, merging nodes by `nodeId`.
 *
 * Nodes and directed edges with the same identity use data from `that`.
 */
export const compose = Function.dual<
  <N, E>(
    self: Graph.Graph<N, E>,
  ) => (that: Graph.Graph<N, E>, nodeId: NodeId<N>) => Graph.Graph<N, E>,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => Graph.Graph<N, E>
>(
  3,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => {
    const selfMaps = buildNodeMaps(self, nodeId);
    const thatMaps = buildNodeMaps(that, nodeId);

    const allNodeIds = new Set([
      ...selfMaps.byId.keys(),
      ...thatMaps.byId.keys(),
    ]);

    return Graph.directed<N, E>((mutable) => {
      const newIndexMap = new Map<string, Graph.NodeIndex>();

      for (const id of allNodeIds) {
        const entry = thatMaps.byId.get(id) ?? selfMaps.byId.get(id);
        if (entry === undefined) continue;
        newIndexMap.set(id, Graph.addNode(mutable, entry.data));
      }

      const edgeMap = new Map<
        string,
        { sourceId: string; targetId: string; data: E }
      >();

      for (const [, edge] of Graph.edges(self)) {
        const sourceId = selfMaps.byIndex.get(edge.source);
        const targetId = selfMaps.byIndex.get(edge.target);
        if (sourceId === undefined || targetId === undefined) continue;
        edgeMap.set(edgeKey(sourceId, targetId), {
          sourceId,
          targetId,
          data: edge.data,
        });
      }

      for (const [, edge] of Graph.edges(that)) {
        const sourceId = thatMaps.byIndex.get(edge.source);
        const targetId = thatMaps.byIndex.get(edge.target);
        if (sourceId === undefined || targetId === undefined) continue;
        edgeMap.set(edgeKey(sourceId, targetId), {
          sourceId,
          targetId,
          data: edge.data,
        });
      }

      for (const { sourceId, targetId, data } of edgeMap.values()) {
        const sourceIndex = newIndexMap.get(sourceId);
        const targetIndex = newIndexMap.get(targetId);
        if (sourceIndex === undefined || targetIndex === undefined) continue;
        Graph.addEdge(mutable, sourceIndex, targetIndex, data);
      }
    });
  },
);

/**
 * Returns the intersection of two graphs, matching nodes by `nodeId`.
 *
 * Keeps shared directed edges by endpoint identity. Node data comes from `self`;
 * edge data comes from `that`.
 */
export const intersection = dual<
  <N, E>(
    self: Graph.Graph<N, E>,
  ) => (that: Graph.Graph<N, E>, nodeId: NodeId<N>) => Graph.Graph<N, E>,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => Graph.Graph<N, E>
>(
  3,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => {
    const selfMaps = buildNodeMaps(self, nodeId);
    const thatMaps = buildNodeMaps(that, nodeId);

    const commonNodeIds = [...selfMaps.byId.keys()].filter((id) =>
      thatMaps.byId.has(id),
    );
    const commonNodeIdSet = new Set(commonNodeIds);

    const selfEdgeKeys = new Set<string>();
    for (const [, edge] of Graph.edges(self)) {
      const sourceId = selfMaps.byIndex.get(edge.source);
      const targetId = selfMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue;
      selfEdgeKeys.add(edgeKey(sourceId, targetId));
    }

    return Graph.directed<N, E>((mutable) => {
      const newIndexMap = new Map<string, Graph.NodeIndex>();

      for (const id of commonNodeIds) {
        const entry = selfMaps.byId.get(id);
        if (entry === undefined) continue;
        newIndexMap.set(id, Graph.addNode(mutable, entry.data));
      }

      for (const [, edge] of Graph.edges(that)) {
        const sourceId = thatMaps.byIndex.get(edge.source);
        const targetId = thatMaps.byIndex.get(edge.target);
        if (sourceId === undefined || targetId === undefined) continue;
        if (
          commonNodeIdSet.has(sourceId) &&
          commonNodeIdSet.has(targetId) &&
          selfEdgeKeys.has(edgeKey(sourceId, targetId))
        ) {
          const sourceIndex = newIndexMap.get(sourceId);
          const targetIndex = newIndexMap.get(targetId);
          if (sourceIndex === undefined || targetIndex === undefined) continue;
          Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
        }
      }
    });
  },
);

/**
 * Returns `self` without edges also present in `that`.
 *
 * All nodes from `self` are preserved. Directed edges are matched by endpoint
 * identity; edge data is ignored.
 */
export const difference = dual<
  <N, E>(
    self: Graph.Graph<N, E>,
  ) => (that: Graph.Graph<N, E>, nodeId: NodeId<N>) => Graph.Graph<N, E>,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => Graph.Graph<N, E>
>(
  3,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => {
    const selfMaps = buildNodeMaps(self, nodeId);
    const thatMaps = buildNodeMaps(that, nodeId);

    const thatEdgeKeys = new Set<string>();

    for (const [, edge] of Graph.edges(that)) {
      const sourceId = thatMaps.byIndex.get(edge.source);
      const targetId = thatMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue;
      thatEdgeKeys.add(edgeKey(sourceId, targetId));
    }

    return Graph.directed<N, E>((mutable) => {
      const newIndexMap = new Map<string, Graph.NodeIndex>();

      for (const [id, entry] of selfMaps.byId) {
        newIndexMap.set(id, Graph.addNode(mutable, entry.data));
      }

      for (const [, edge] of Graph.edges(self)) {
        const sourceId = selfMaps.byIndex.get(edge.source);
        const targetId = selfMaps.byIndex.get(edge.target);
        if (sourceId === undefined || targetId === undefined) continue;
        if (!thatEdgeKeys.has(edgeKey(sourceId, targetId))) {
          const sourceIndex = newIndexMap.get(sourceId);
          const targetIndex = newIndexMap.get(targetId);
          if (sourceIndex === undefined || targetIndex === undefined) continue;
          Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
        }
      }
    });
  },
);

/**
 * Returns the symmetric difference of two directed graphs.
 *
 * Keeps nodes from both graphs and directed edges present in exactly one graph.
 * Overlapping nodes use data from `that`.
 */
export const symmetricDifference = dual<
  <N, E>(
    self: Graph.Graph<N, E>,
  ) => (that: Graph.Graph<N, E>, nodeId: NodeId<N>) => Graph.Graph<N, E>,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => Graph.Graph<N, E>
>(
  3,
  <N, E>(
    self: Graph.Graph<N, E>,
    that: Graph.Graph<N, E>,
    nodeId: NodeId<N>,
  ) => {
    const selfMaps = buildNodeMaps(self, nodeId);
    const thatMaps = buildNodeMaps(that, nodeId);

    const selfEdges = new Map<
      string,
      { sourceId: string; targetId: string; data: E }
    >();

    for (const [, edge] of Graph.edges(self)) {
      const sourceId = selfMaps.byIndex.get(edge.source);
      const targetId = selfMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue;
      selfEdges.set(edgeKey(sourceId, targetId), {
        sourceId,
        targetId,
        data: edge.data,
      });
    }

    const thatEdges = new Map<
      string,
      { sourceId: string; targetId: string; data: E }
    >();
    for (const [, edge] of Graph.edges(that)) {
      const sourceId = thatMaps.byIndex.get(edge.source);
      const targetId = thatMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue;
      thatEdges.set(edgeKey(sourceId, targetId), {
        sourceId,
        targetId,
        data: edge.data,
      });
    }

    const allNodeIds = new Set([
      ...selfMaps.byId.keys(),
      ...thatMaps.byId.keys(),
    ]);

    return Graph.directed<N, E>((mutable) => {
      const newIndexMap = new Map<string, Graph.NodeIndex>();

      for (const id of allNodeIds) {
        const entry = thatMaps.byId.get(id) ?? selfMaps.byId.get(id);
        if (entry === undefined) continue;
        newIndexMap.set(id, Graph.addNode(mutable, entry.data));
      }

      for (const [key, { sourceId, targetId, data }] of selfEdges) {
        if (!thatEdges.has(key)) {
          const sourceIndex = newIndexMap.get(sourceId);
          const targetIndex = newIndexMap.get(targetId);
          if (sourceIndex === undefined || targetIndex === undefined) continue;
          Graph.addEdge(mutable, sourceIndex, targetIndex, data);
        }
      }

      for (const [key, { sourceId, targetId, data }] of thatEdges) {
        if (!selfEdges.has(key)) {
          const sourceIndex = newIndexMap.get(sourceId);
          const targetIndex = newIndexMap.get(targetId);
          if (sourceIndex === undefined || targetIndex === undefined) continue;
          Graph.addEdge(mutable, sourceIndex, targetIndex, data);
        }
      }
    });
  },
);

/**
 * Returns the directed complement over the existing node set.
 *
 * Adds every missing edge between distinct nodes. Edge data is produced by
 * `createEdge`.
 */
export const complement = dual<
  <N, E>(
    self: Graph.Graph<N, E>,
  ) => (createEdge: (source: N, target: N) => E) => Graph.Graph<N, E>,
  <N, E>(
    self: Graph.Graph<N, E>,
    createEdge: (source: N, target: N) => E,
  ) => Graph.Graph<N, E>
>(
  2,
  <N, E>(self: Graph.Graph<N, E>, createEdge: (source: N, target: N) => E) => {
    const nodes = [...self];

    return Graph.directed<N, E>((mutable) => {
      const newIndexMap = new Map<Graph.NodeIndex, Graph.NodeIndex>();

      for (const [oldIdx, data] of nodes) {
        newIndexMap.set(oldIdx, Graph.addNode(mutable, data));
      }

      for (const [srcOldIdx, srcData] of nodes) {
        for (const [tgtOldIdx, tgtData] of nodes) {
          if (srcOldIdx === tgtOldIdx) continue; // no self-loops
          if (Graph.hasEdge(self, srcOldIdx, tgtOldIdx)) continue;
          const srcNewIdx = newIndexMap.get(srcOldIdx);
          const tgtNewIdx = newIndexMap.get(tgtOldIdx);
          if (srcNewIdx === undefined || tgtNewIdx === undefined) continue;
          Graph.addEdge(
            mutable,
            srcNewIdx,
            tgtNewIdx,
            createEdge(srcData, tgtData),
          );
        }
      }
    });
  },
);

export type NeighborhoodDirection = "outgoing" | "incoming" | "both";

/**
 * Returns the induced subgraph containing nodes within `radius` of `nodeIndex`.
 *
 * `direction` controls traversal, and the result keeps all original edges whose
 * endpoints are both reached.
 */
export const neighborhood = dual<
  <N, E>(
    self: Graph.DirectedGraph<N, E>,
  ) => (
    nodeIndex: Graph.NodeIndex,
    options?: { radius?: number; direction?: NeighborhoodDirection },
  ) => Graph.DirectedGraph<N, E>,
  <N, E>(
    self: Graph.DirectedGraph<N, E>,
    nodeIndex: Graph.NodeIndex,
    options?: { radius?: number; direction?: NeighborhoodDirection },
  ) => Graph.DirectedGraph<N, E>
>(
  (args) => args.length >= 2,
  <N, E>(
    self: Graph.DirectedGraph<N, E>,
    nodeIndex: Graph.NodeIndex,
    options?: { radius?: number; direction?: NeighborhoodDirection },
  ) => {
    const radius = options?.radius ?? 1;
    const direction = options?.direction ?? "both";

    const visited = new Set<Graph.NodeIndex>();
    let frontier = new Set<Graph.NodeIndex>([nodeIndex]);

    visited.add(nodeIndex);

    for (let depth = 0; depth < radius; depth++) {
      const nextFrontier = new Set<Graph.NodeIndex>();
      for (const idx of frontier) {
        if (direction === "outgoing" || direction === "both") {
          for (const succ of Graph.successors(self, idx)) {
            if (!visited.has(succ)) {
              visited.add(succ);
              nextFrontier.add(succ);
            }
          }
        }
        if (direction === "incoming" || direction === "both") {
          for (const pred of Graph.predecessors(self, idx)) {
            if (!visited.has(pred)) {
              visited.add(pred);
              nextFrontier.add(pred);
            }
          }
        }
      }
      frontier = nextFrontier;
      if (frontier.size === 0) break;
    }

    return Graph.directed<N, E>((mutable) => {
      const newIndexMap = new Map<Graph.NodeIndex, Graph.NodeIndex>();

      for (const oldIdx of visited) {
        newIndexMap.set(
          oldIdx,
          Graph.addNode(
            mutable,
            Option.getOrThrow(Graph.getNode(self, oldIdx)),
          ),
        );
      }

      for (const [, edge] of Graph.edges(self)) {
        if (visited.has(edge.source) && visited.has(edge.target)) {
          const sourceIndex = newIndexMap.get(edge.source);
          const targetIndex = newIndexMap.get(edge.target);
          if (sourceIndex === undefined || targetIndex === undefined) continue;
          Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
        }
      }
    });
  },
);

/**
 * Returns the disjoint union of two directed graphs.
 *
 * No node identity function is used; equal node data still produces distinct
 * nodes.
 */
export const sum = dual<
  <N, E>(
    self: Graph.DirectedGraph<N, E>,
  ) => (that: Graph.DirectedGraph<N, E>) => Graph.DirectedGraph<N, E>,
  <N, E>(
    self: Graph.DirectedGraph<N, E>,
    that: Graph.DirectedGraph<N, E>,
  ) => Graph.DirectedGraph<N, E>
>(
  2,
  <N, E>(self: Graph.DirectedGraph<N, E>, that: Graph.DirectedGraph<N, E>) => {
    const copyInto = (
      mutable: Graph.MutableDirectedGraph<N, E>,
      graph: Graph.DirectedGraph<N, E>,
    ) => {
      const indexMap = new Map<Graph.NodeIndex, Graph.NodeIndex>();

      for (const [oldIndex, data] of Graph.nodes(graph)) {
        indexMap.set(oldIndex, Graph.addNode(mutable, data));
      }

      for (const [, edge] of Graph.edges(graph)) {
        const sourceIndex = indexMap.get(edge.source);
        const targetIndex = indexMap.get(edge.target);
        if (sourceIndex === undefined || targetIndex === undefined) continue;
        Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
      }
    };

    return Graph.directed<N, E>((mutable) => {
      copyInto(mutable, self);
      copyInto(mutable, that);
    });
  },
);
