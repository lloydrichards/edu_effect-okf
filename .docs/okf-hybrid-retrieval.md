# OKF Hybrid Retrieval

## Core Idea

Use two retrieval modes together:

- vector retrieval finds where to start
- graph traversal finds what nearby structure matters

This is a better fit for large OKF corpora than either approach alone.

## Why Graph Alone Is Not Enough

Graph works well when the user already knows a relevant concept.

It works poorly for broad natural-language prompts such as:

> I have some leftover olives, what kind of bread can I make this weekend?

That query expresses ingredients, intent, and constraints, not a known concept ID.

## Why Vector Search Alone Is Not Enough

Vector search can find semantically relevant concept text, but it does not tell you:

- which concepts support one another
- which techniques or prerequisites are nearby
- which concepts form a coherent local neighborhood

Increasing top-K usually increases noise and token cost.

## Hybrid Pattern

```text
query
  -> vector retrieval
  -> seed concepts
  -> graph expansion
  -> bounded context package
  -> LLM answer
```

## Retrieval Loop

1. accept the user query
2. run vector retrieval over concept documents or concept chunks
3. select top seed concepts
4. map seeds to graph nodes by `conceptId`
5. expand the graph neighborhood
6. score and prune expanded nodes
7. build a bounded context package
8. ask the LLM to answer from that package

## Stable Identity Bridge

The vector index and graph must share the same stable identity.

Use `conceptId` for both.

```text
vector hit -> conceptId -> graph node -> graph neighborhood
```

## Good First Expansion Policy

Start simple.

- expansion depth: 1
- directions: both outgoing and incoming
- filters: optional type filters and edge-kind filters
- pruning: keep nodes that were direct hits or connected to multiple seeds

This gives structure without exploding into the whole graph.

## Bounded Context Package

The retrieval stage should return structured evidence, not just a bag of text.

```ts
type RetrievedContext = {
  query: string
  seeds: ReadonlyArray<ConceptNode>
  expanded: ReadonlyArray<ConceptNode>
  edges: ReadonlyArray<ConceptEdge>
  reasons: ReadonlyArray<{
    conceptId: string
    whyIncluded: string
  }>
}
```

## Bread Example

Query:

> I have some leftover olives, what kind of bread can I make this weekend?

Possible vector seeds:

- `recipes/olive-focaccia`
- `ingredients/olives`
- `schedules/weekend-baking`

Possible graph expansion:

- neighboring olive bread recipes
- linked techniques such as cold fermentation
- linked schedule concepts

Result:

- the LLM reasons over recipe + ingredient + technique + schedule context
- the answer is better than pure semantic matching or pure graph traversal alone

## Key Tuning Knobs

- vector top-K
- seed count
- expansion depth
- edge filters
- type filters
- pruning heuristics
- final context budget

## Summary

- RAG finds entry points
- graph traversal expands context
- the LLM answers from the bounded local subgraph
