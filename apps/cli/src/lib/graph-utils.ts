import { Graph, Option } from "effect";

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
  graph: Graph.DirectedGraph<N, E>,
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

// ---------------------------------------------------------------------------
// union: G1 ∪ G2 = (V1 ∪ V2, E1 ∪ E2)
// Overlapping nodes/edges: `that` takes precedence.
// ---------------------------------------------------------------------------

export const union = <N, E>(
  self: Graph.DirectedGraph<N, E>,
  that: Graph.DirectedGraph<N, E>,
  nodeId: NodeId<N>,
): Graph.DirectedGraph<N, E> => {
  const selfMaps = buildNodeMaps(self, nodeId);
  const thatMaps = buildNodeMaps(that, nodeId);

  const allNodeIds = new Set([
    ...selfMaps.byId.keys(),
    ...thatMaps.byId.keys(),
  ]);

  return Graph.directed<N, E>((mutable) => {
    const newIndexMap = new Map<string, Graph.NodeIndex>();

    // Add all nodes — `that` wins on conflict
    for (const id of allNodeIds) {
      const entry = thatMaps.byId.get(id) ?? selfMaps.byId.get(id);
      if (entry === undefined) continue; // skip nodes with missing data
      newIndexMap.set(id, Graph.addNode(mutable, entry.data));
    }

    // Collect edges from both, `that` wins on conflict
    const edgeMap = new Map<
      string,
      { sourceId: string; targetId: string; data: E }
    >();

    for (const [, edge] of Graph.edges(self)) {
      const sourceId = selfMaps.byIndex.get(edge.source);
      const targetId = selfMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
      edgeMap.set(edgeKey(sourceId, targetId), {
        sourceId,
        targetId,
        data: edge.data,
      });
    }

    for (const [, edge] of Graph.edges(that)) {
      const sourceId = thatMaps.byIndex.get(edge.source);
      const targetId = thatMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
      edgeMap.set(edgeKey(sourceId, targetId), {
        sourceId,
        targetId,
        data: edge.data,
      });
    }

    // Add all edges
    for (const { sourceId, targetId, data } of edgeMap.values()) {
      const sourceIndex = newIndexMap.get(sourceId);
      const targetIndex = newIndexMap.get(targetId);
      if (sourceIndex === undefined || targetIndex === undefined) continue; // skip edges with missing nodes
      Graph.addEdge(mutable, sourceIndex, targetIndex, data);
    }
  });
};

// ---------------------------------------------------------------------------
// intersection: G1 ∩ G2 = (V1 ∩ V2, E1 ∩ E2)
// Keeps only nodes present in both. Keeps edges where both endpoints are in
// the intersection AND the edge exists in both graphs.
// ---------------------------------------------------------------------------

export const intersection = <N, E>(
  self: Graph.DirectedGraph<N, E>,
  that: Graph.DirectedGraph<N, E>,
  nodeId: NodeId<N>,
): Graph.DirectedGraph<N, E> => {
  const selfMaps = buildNodeMaps(self, nodeId);
  const thatMaps = buildNodeMaps(that, nodeId);

  // Node intersection
  const commonNodeIds = [...selfMaps.byId.keys()].filter((id) =>
    thatMaps.byId.has(id),
  );
  const commonNodeIdSet = new Set(commonNodeIds);

  // Edge sets for both graphs
  const selfEdgeKeys = new Set<string>();
  for (const [, edge] of Graph.edges(self)) {
    const sourceId = selfMaps.byIndex.get(edge.source);
    const targetId = selfMaps.byIndex.get(edge.target);
    if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
    selfEdgeKeys.add(edgeKey(sourceId, targetId));
  }

  return Graph.directed<N, E>((mutable) => {
    const newIndexMap = new Map<string, Graph.NodeIndex>();

    // Add common nodes (self data preserved)
    for (const id of commonNodeIds) {
      const entry = selfMaps.byId.get(id);
      if (entry === undefined) continue; // skip nodes with missing data
      newIndexMap.set(id, Graph.addNode(mutable, entry.data));
    }

    // Add edges present in both where both endpoints are common
    for (const [, edge] of Graph.edges(that)) {
      const sourceId = thatMaps.byIndex.get(edge.source);
      const targetId = thatMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
      if (
        commonNodeIdSet.has(sourceId) &&
        commonNodeIdSet.has(targetId) &&
        selfEdgeKeys.has(edgeKey(sourceId, targetId))
      ) {
        const sourceIndex = newIndexMap.get(sourceId);
        const targetIndex = newIndexMap.get(targetId);
        if (sourceIndex === undefined || targetIndex === undefined) continue; // skip edges with missing nodes
        Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
      }
    }
  });
};

// ---------------------------------------------------------------------------
// difference: G1 \ G2 = (V1, E1 \ E2)
// Keeps all nodes from self. Removes edges that also exist in that.
// ---------------------------------------------------------------------------

export const difference = <N, E>(
  self: Graph.DirectedGraph<N, E>,
  that: Graph.DirectedGraph<N, E>,
  nodeId: NodeId<N>,
): Graph.DirectedGraph<N, E> => {
  const selfMaps = buildNodeMaps(self, nodeId);
  const thatMaps = buildNodeMaps(that, nodeId);

  // Build that's edge set (by node IDs)
  const thatEdgeKeys = new Set<string>();
  for (const [, edge] of Graph.edges(that)) {
    const sourceId = thatMaps.byIndex.get(edge.source);
    const targetId = thatMaps.byIndex.get(edge.target);
    if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
    thatEdgeKeys.add(edgeKey(sourceId, targetId));
  }

  return Graph.directed<N, E>((mutable) => {
    const newIndexMap = new Map<string, Graph.NodeIndex>();

    // Add all self nodes
    for (const [id, entry] of selfMaps.byId) {
      newIndexMap.set(id, Graph.addNode(mutable, entry.data));
    }

    // Add self edges NOT in that
    for (const [, edge] of Graph.edges(self)) {
      const sourceId = selfMaps.byIndex.get(edge.source);
      const targetId = selfMaps.byIndex.get(edge.target);
      if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
      if (!thatEdgeKeys.has(edgeKey(sourceId, targetId))) {
        const sourceIndex = newIndexMap.get(sourceId);
        const targetIndex = newIndexMap.get(targetId);
        if (sourceIndex === undefined || targetIndex === undefined) continue; // skip edges with missing nodes
        Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
      }
    }
  });
};

// ---------------------------------------------------------------------------
// symmetricDifference: G1 △ G2 = (V1 ∪ V2, (E1 \ E2) ∪ (E2 \ E1))
// Keeps all nodes from both. Keeps edges in exactly one graph.
// ---------------------------------------------------------------------------

export const symmetricDifference = <N, E>(
  self: Graph.DirectedGraph<N, E>,
  that: Graph.DirectedGraph<N, E>,
  nodeId: NodeId<N>,
): Graph.DirectedGraph<N, E> => {
  const selfMaps = buildNodeMaps(self, nodeId);
  const thatMaps = buildNodeMaps(that, nodeId);

  // Build edge sets for both
  const selfEdges = new Map<
    string,
    { sourceId: string; targetId: string; data: E }
  >();
  for (const [, edge] of Graph.edges(self)) {
    const sourceId = selfMaps.byIndex.get(edge.source);
    const targetId = selfMaps.byIndex.get(edge.target);
    if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
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
    if (sourceId === undefined || targetId === undefined) continue; // skip edges with missing nodes
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

    // Add all nodes — `that` wins on conflict
    for (const id of allNodeIds) {
      const entry = thatMaps.byId.get(id) ?? selfMaps.byId.get(id);
      if (entry === undefined) continue; // skip missing nodes
      newIndexMap.set(id, Graph.addNode(mutable, entry.data));
    }

    // Add edges in self but NOT in that
    for (const [key, { sourceId, targetId, data }] of selfEdges) {
      if (!thatEdges.has(key)) {
        const sourceIndex = newIndexMap.get(sourceId);
        const targetIndex = newIndexMap.get(targetId);
        if (sourceIndex === undefined || targetIndex === undefined) continue;
        Graph.addEdge(mutable, sourceIndex, targetIndex, data);
      }
    }

    // Add edges in that but NOT in self
    for (const [key, { sourceId, targetId, data }] of thatEdges) {
      if (!selfEdges.has(key)) {
        const sourceIndex = newIndexMap.get(sourceId);
        const targetIndex = newIndexMap.get(targetId);
        if (sourceIndex === undefined || targetIndex === undefined) continue;
        Graph.addEdge(mutable, sourceIndex, targetIndex, data);
      }
    }
  });
};

// ---------------------------------------------------------------------------
// complement: G̅ = (V, all ordered pairs of distinct vertices \ E)
// Produces every directed edge that does NOT exist in the input.
// Warning: O(n²) edges for sparse graphs.
// ---------------------------------------------------------------------------

export const complement = <N, E>(
  self: Graph.DirectedGraph<N, E>,
  createEdge: (source: N, target: N) => E,
): Graph.DirectedGraph<N, E> => {
  const nodes = [...self];

  return Graph.directed<N, E>((mutable) => {
    const newIndexMap = new Map<Graph.NodeIndex, Graph.NodeIndex>();

    // Add all nodes
    for (const [oldIdx, data] of nodes) {
      newIndexMap.set(oldIdx, Graph.addNode(mutable, data));
    }

    // Add edges for all non-existing pairs
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
};

// ---------------------------------------------------------------------------
// neighborhood: G[N, r] = (V', E') where V' = {v | d(v, N) ≤ r} and E' = {e | e ⊆ V'}
// Returns the induced subgraph of all nodes within a given radius of a node.
// ---------------------------------------------------------------------------

export type NeighborhoodDirection = "outgoing" | "incoming" | "both";

export const neighborhood = <N, E>(
  self: Graph.DirectedGraph<N, E>,
  nodeIndex: Graph.NodeIndex,
  options?: { radius?: number; direction?: NeighborhoodDirection },
): Graph.DirectedGraph<N, E> => {
  const radius = options?.radius ?? 1;
  const direction = options?.direction ?? "both";

  // BFS to find all nodes within radius
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

  // Build induced subgraph: include all edges between visited nodes
  return Graph.directed<N, E>((mutable) => {
    const newIndexMap = new Map<Graph.NodeIndex, Graph.NodeIndex>();

    for (const oldIdx of visited) {
      const nodeData = Option.getOrThrow(Graph.getNode(self, oldIdx));
      newIndexMap.set(oldIdx, Graph.addNode(mutable, nodeData));
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
};

// ---------------------------------------------------------------------------
// sum (disjoint union): G1 + G2
// Always produces disconnected components. No node merging — all nodes from
// both graphs are added regardless of identity.
// ---------------------------------------------------------------------------

export const sum = <N, E>(
  self: Graph.DirectedGraph<N, E>,
  that: Graph.DirectedGraph<N, E>,
): Graph.DirectedGraph<N, E> =>
  Graph.directed<N, E>((mutable) => {
    // Add all nodes and edges from self
    const selfIndexMap = new Map<Graph.NodeIndex, Graph.NodeIndex>();
    for (const [oldIdx, data] of self) {
      selfIndexMap.set(oldIdx, Graph.addNode(mutable, data));
    }
    for (const [, edge] of Graph.edges(self)) {
      const sourceIndex = selfIndexMap.get(edge.source);
      const targetIndex = selfIndexMap.get(edge.target);
      if (sourceIndex === undefined || targetIndex === undefined) continue;
      Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
    }

    // Add all nodes and edges from that
    const thatIndexMap = new Map<Graph.NodeIndex, Graph.NodeIndex>();
    for (const [oldIdx, data] of that) {
      thatIndexMap.set(oldIdx, Graph.addNode(mutable, data));
    }
    for (const [, edge] of Graph.edges(that)) {
      const sourceIndex = thatIndexMap.get(edge.source);
      const targetIndex = thatIndexMap.get(edge.target);
      if (sourceIndex === undefined || targetIndex === undefined) continue;
      Graph.addEdge(mutable, sourceIndex, targetIndex, edge.data);
    }
  });
