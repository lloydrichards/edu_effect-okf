import { Flag } from "effect/unstable/cli";

export const json = Flag.boolean("json").pipe(
  Flag.withDescription("Print machine-readable JSON output"),
);
