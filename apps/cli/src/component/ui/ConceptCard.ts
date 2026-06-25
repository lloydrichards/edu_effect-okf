import type { Concept, OkfGraph } from "@repo/domain/Okf";
import { MarkdownService } from "@repo/okf";

import { Effect, Graph } from "effect";
import { Box } from "effect-boxes";
import { ConceptSummaryCard } from "./ConceptSummaryCard";
import { MarkdownBox } from "./Markdown";

export const ConceptCard = (concept: Concept, graph: OkfGraph, width: number) =>
  Effect.gen(function* () {
    const markdown = yield* MarkdownService;
    const { document } = yield* markdown.parseDocument(concept.body);

    const graphNode = graph.nodeIndex.get(concept.id);
    if (!graphNode) return Box.nullBox;
    const incoming = Graph.predecessors(graph.graph, graphNode).length;
    const outgoing = Graph.successors(graph.graph, graphNode).length;

    return Box.vsep(
      [
        ConceptSummaryCard({
          title: concept.frontmatter.title ?? concept.id,
          reference: concept.path,
          type: concept.frontmatter.type,
          description: concept.frontmatter.description,
          tags: concept.frontmatter.tags,
          resource: concept.frontmatter.resource,
          incoming,
          outgoing,
          width,
        }),
        MarkdownBox(document, width - 2),
      ],
      1,
      Box.left,
    ).pipe(Box.pad(2, 0));
  });
