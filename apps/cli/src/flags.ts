import { Flag } from "effect/unstable/cli";

export const json = Flag.boolean("json").pipe(
  Flag.withDescription("Print machine-readable JSON output"),
);

export const reset = Flag.boolean("reset").pipe(
  Flag.withDescription("Delete and recreate the target collection before ingesting"),
);
