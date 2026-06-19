import { Data } from "effect";

export class BundleNotFound extends Data.TaggedError("BundleNotFound")<{
  path: string;
}> {}

export class BundleInvalid extends Data.TaggedError("BundleInvalid")<{
  path: string;
  issues: ReadonlyArray<{
    file: string;
    reason: string;
  }>;
}> {}

export class ConceptNotFound extends Data.TaggedError("ConceptNotFound")<{
  conceptId: string;
}> {}

export class MarkdownParseError extends Data.TaggedError("MarkdownParseError")<{
  reason: string;
}> {}
