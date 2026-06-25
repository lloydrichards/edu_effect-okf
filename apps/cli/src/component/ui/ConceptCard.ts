import type { Concept, OkfGraph } from "@repo/domain/Okf";
import { MarkdownService } from "@repo/okf";

import { Effect, Graph } from "effect";
import { Ansi, Box, Flex } from "effect-boxes";
import { MarkdownBox } from "./Markdown";

export const ConceptCard = (concept: Concept, graph: OkfGraph, width: number) =>
  Effect.gen(function* () {
    const markdown = yield* MarkdownService;
    const { document } = yield* markdown.parseDocument(concept.body);

    const graphNode = graph.nodeIndex.get(concept.id);
    if (!graphNode) return Box.nullBox;
    const predecessors = Graph.predecessors(graph.graph, graphNode).map(
      (node) => graph.graph.nodes.get(node),
    );
    const successors = Graph.successors(graph.graph, graphNode).map((node) =>
      graph.graph.nodes.get(node),
    );

    const predecessorIds = predecessors.map((p) => p?.id ?? "");
    const successorIds = successors.map((s) => s?.id ?? "");
    const conceptLines = (width: number) =>
      Box.vsep(
        [
          Box.text(concept.id).pipe(Box.annotate(Ansi.bold)),
          Box.vcat(
            [
              Box.text(`Title: ${concept.frontmatter.title}`),
              Box.text(`Type: ${concept.frontmatter.type}`),
              Box.text(`Resource: ${concept.frontmatter.resource ?? ""}`),
              Box.text(`Tags: ${concept.frontmatter.tags?.join(", ") ?? ""}`),
            ],
            Box.left,
          ),
          Box.text(concept.frontmatter.description ?? ""),
        ],
        1,
        Box.left,
      ).pipe(Box.truncate(width, Box.left));

    const contentHeight = Math.max(
      predecessorIds.length + 1,
      Box.rows(conceptLines(width)) + 2,
      successorIds.length + 1,
    );

    return Box.vsep(
      [
        Flex.row(
          [
            Flex.fill((w) => {
              const innerWidth = Math.max(1, w - 2);
              const contentWidth = Math.max(1, innerWidth - 2);

              return Box.vcat(
                [
                  Box.alignHoriz(
                    Box.text("<- Predecessors")
                      .pipe(Box.truncate(contentWidth, Box.center1))
                      .pipe(Box.annotate(Ansi.bold)),
                    Box.center1,
                    contentWidth,
                  ),
                  Box.vcat(
                    predecessorIds.map((id) =>
                      Box.text(id).pipe(Box.truncate(contentWidth, Box.left)),
                    ),
                    Box.left,
                  ),
                ],
                Box.left,
              ).pipe(
                Box.pad(0, 1),
                Box.minWidth(innerWidth),
                Box.minHeight(contentHeight),
                Box.border("rounded", {
                  annotation: Ansi.dim,
                  sides: { right: false },
                }),
              );
            }, 1),
            Flex.fill((w) => {
              const innerWidth = Math.max(1, w - 2);
              const contentWidth = Math.max(1, innerWidth - 2);

              return conceptLines(contentWidth).pipe(
                Box.pad(0, 1),
                Box.minWidth(innerWidth),
                Box.minHeight(contentHeight),
                Box.border("rounded"),
              );
            }, 3),
            Flex.fill((w) => {
              const innerWidth = Math.max(1, w - 2);
              const contentWidth = Math.max(1, innerWidth - 2);

              return Box.vcat(
                [
                  Box.alignHoriz(
                    Box.text("Successors ->")
                      .pipe(Box.truncate(contentWidth, Box.center1))
                      .pipe(Box.annotate(Ansi.bold)),
                    Box.center1,
                    contentWidth,
                  ),
                  Box.vcat(
                    successorIds.map((id) =>
                      Box.text(id).pipe(
                        Box.truncate(contentWidth, Box.right),
                        Box.alignHoriz(Box.right, contentWidth),
                      ),
                    ),
                    Box.left,
                  ),
                ],
                Box.left,
              ).pipe(
                Box.pad(0, 1),
                Box.minWidth(innerWidth),
                Box.minHeight(contentHeight),
                Box.border("rounded", {
                  annotation: Ansi.dim,
                  sides: { left: false },
                }),
              );
            }, 1),
          ],
          width,
          { gap: 1 },
        ),
        MarkdownBox(document, width - 2),
      ],
      1,
      Box.left,
    ).pipe(Box.pad(2, 0));
  });
