import { Ansi, Box } from "effect-boxes";

export type ConceptSummaryCardContext = {
  readonly direction?: "self" | "incoming" | "outgoing" | undefined;
  readonly depth?: number | undefined;
};

export type ConceptSummaryCardOptions = {
  readonly title: string;
  readonly reference: string;
  readonly type: string;
  readonly description?: string | undefined;
  readonly tags?: ReadonlyArray<string> | undefined;
  readonly resource?: string | undefined;
  readonly incoming: number;
  readonly outgoing: number;
  readonly width: number;
  readonly height?: number | undefined;
  readonly label?: string | undefined;
  readonly context?: ConceptSummaryCardContext | undefined;
};

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const tagLine = (
  tags: ReadonlyArray<string> | undefined,
): string | undefined =>
  tags && tags.length > 0 ? tags.join(" · ") : undefined;

const contextLine = (
  context: ConceptSummaryCardContext | undefined,
): string | undefined => {
  const parts = [
    context?.direction && context.direction !== "self"
      ? context.direction
      : undefined,
    context?.depth !== undefined ? `depth ${context.depth}` : undefined,
  ].filter((part): part is string => part !== undefined);

  return parts.length > 0 ? parts.join(" · ") : undefined;
};

const statsLine = (
  incoming: number,
  outgoing: number,
  width: number,
): string => {
  const left = `← ${incoming} in`;
  const right = `${outgoing} out →`;
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
};

export const ConceptSummaryCard = (
  options: ConceptSummaryCardOptions,
): Box.Box<unknown> => {
  const width = Math.max(12, options.width);
  const innerWidth = Math.max(1, width - 4);
  const bodyHeight = options.height
    ? Math.max(1, options.height - 2)
    : undefined;
  const tags = tagLine(options.tags);
  const resource = nonEmpty(options.resource);
  const description = nonEmpty(options.description);
  const context = contextLine(options.context);
  const title = nonEmpty(options.label) ?? "Concept";

  const body = Box.vsep(
    [
      Box.vcat(
        [
          Box.text(title).pipe(Box.annotate(Ansi.bold)),
          Box.text(options.title).pipe(Box.annotate(Ansi.bold)),
          Box.text(options.reference).pipe(Box.annotate(Ansi.dim)),
        ],
        Box.left,
      ),
      Box.vcat(
        [
          Box.text(options.type),
          ...(tags ? [Box.text(tags).pipe(Box.annotate(Ansi.cyan))] : []),
        ],
        Box.left,
      ),
      ...(description ? [Box.para(description, Box.left, innerWidth)] : []),
      ...(resource
        ? [Box.text(`resource ${resource}`).pipe(Box.annotate(Ansi.dim))]
        : []),
      Box.text(statsLine(options.incoming, options.outgoing, innerWidth)).pipe(
        Box.annotate(Ansi.dim),
      ),
      ...(context ? [Box.text(context).pipe(Box.annotate(Ansi.dim))] : []),
    ],
    1,
    Box.left,
  );

  const content = bodyHeight
    ? body.pipe(Box.maxHeight(bodyHeight), Box.minHeight(bodyHeight))
    : body;

  return content.pipe(
    Box.truncate(innerWidth, Box.left),
    Box.minWidth(innerWidth),
    Box.pad(0, 1),
    Box.border("rounded"),
  );
};
