import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { bundlePath } from "../args";

export const validate = Command.make(
  "validate",
  { bundlePath },
  ({ bundlePath }) =>
    Effect.gen(function* () {
      yield* Console.log(`Validating bundle at path: ${bundlePath}`);
    }),
).pipe(Command.withDescription("Validate a bundle"));
