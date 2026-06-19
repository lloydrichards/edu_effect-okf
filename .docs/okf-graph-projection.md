# OKF Graph Projection

## Why Project OKF Into A Graph

OKF bundles already contain an implicit graph:

- nodes: concept documents
- edges: markdown links
- optional extra edges: directory parent-child relationships

Projecting this into `effect/Graph` makes the structure queryable and analyzable.

## What Graph Is Good At

Graph retrieval is strongest for:

- backlinks
- neighborhood exploration
- reachability
- topic clusters
- explanatory paths between concepts
- bundle quality checks such as orphans and suspicious cycles

Graph retrieval is weaker than vector search when the user starts with vague natural language and does not know which concept to begin from.

## Recommended v1 Graph Model

Use a directed graph.

### Node shape

Store only the fields useful for retrieval and display.

```ts
type ConceptNode = {
  id: string
  path: string
  type: string
  title?: string
  description?: string
  resource?: string
  tags: ReadonlyArray<string>
}
```

### Edge shape

Start small.

```ts
type ConceptEdge = {
  kind: "concept-link" | "parent-child" | "citation"
  sourceId: string
  targetId: string
  label?: string
}
```

For v1, `concept-link` is the most important edge kind.

## Recommended Build Strategy

Use a two-pass builder.

1. parse all concepts
2. add one node per concept
3. build `Map<ConceptId, NodeIndex>`
4. add edges for resolvable internal links
5. record unresolved links as diagnostics

Why two passes:

- links may point forward to concepts discovered later
- the graph layer should not own markdown parsing
- broken links should not fail the whole projection

## Recommended Output Shape

Return more than just the graph.

```ts
type OkfGraphProjection = {
  graph: Graph.DirectedGraph<ConceptNode, ConceptEdge>
  nodeIndexById: Map<string, Graph.NodeIndex>
  unresolvedLinks: ReadonlyArray<{
    sourceId: string
    targetId: string
    label?: string
  }>
}
```

## Most Useful Graph Operations

From `effect/Graph`, the most relevant operations are:

- `Graph.directed`
- `Graph.addNode`
- `Graph.addEdge`
- `Graph.successors`
- `Graph.predecessors`
- `Graph.bfs`
- `Graph.dfs`
- `Graph.stronglyConnectedComponents`
- `Graph.dijkstra`
- `Graph.toGraphviz`

## First Useful Queries

- backlinks for a concept
- outgoing related concepts
- orphan detection
- strongly connected component analysis
- path between two concepts

## Architectural Boundary

Keep the graph derived and disposable.

- parsed OKF model is canonical
- graph is a structural retrieval projection
- graph-specific logic should not leak back into the parser
